<?php

namespace App\Workspace;

use App\Enums\BookingStatus;
use App\Enums\EmailTemplateKey;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Models\Addon;
use App\Models\Booking;
use App\Models\CustomerPass;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Space;
use App\Models\User;
use App\Notifications\BookingNotification;
use App\Notifications\StaffAlertNotification;
use App\Payments\InvoiceService;
use App\Payments\PaymentService;
use App\Support\FrontendLinks;
use App\Support\Money;
use App\Support\Settings;
use App\Support\StaffAlerts;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Everything that happens to a booking: pricing, holding the slot, confirming once paid,
 * approval, cancellation with refunds, and check-in at the front desk.
 */
class BookingService
{
    /**
     * Minutes a slot is held while the customer pays online.
     */
    public const HOLD_MINUTES = 15;

    /**
     * Hours a customer has to pay once staff approve a booking request.
     */
    public const APPROVED_HOLD_HOURS = 24;

    public const DESTINATION_EXTERNAL = 'external';

    public const DESTINATION_INTERNAL = 'internal';

    public function __construct(
        private Availability $availability,
        private InvoiceService $invoices,
        private PaymentService $payments,
        private Settings $settings,
        private SeatPlanner $seatPlanner,
    ) {}

    /**
     * Whether bookings are taken on this site, or sent to the separate booking site.
     */
    public function isOpen(): bool
    {
        return $this->settings->get('workspace.booking_destination', self::DESTINATION_EXTERNAL) === self::DESTINATION_INTERNAL;
    }

    public function externalUrl(): string
    {
        return (string) $this->settings->get('workspace.external_booking_url', 'https://book.reenite.com');
    }

    public function assertOpen(): void
    {
        if (! $this->isOpen()) {
            throw new HttpException(403, 'Online booking on this site is paused. Please book at '.$this->externalUrl().'.');
        }
    }

    /**
     * Prices a booking without saving anything.
     *
     * @param  array{date: string, start_time?: string|null, rate_unit: string, quantity: int, seats: int, seat_ids?: list<int>|null, addons?: list<array{id: int, quantity: int}>, use_pass?: bool}  $input
     * @return array<string, mixed>
     */
    public function quote(Space $space, array $input, ?User $customer, ?int $ignoreBookingId = null): array
    {
        $space->loadMissing(['location', 'type', 'cancellationPolicy', 'rates', 'addons']);
        abort_unless($space->is_active && $space->location->is_active && $space->type->is_active, 404);

        $rate = $space->rates->first(fn ($rate) => $rate->unit === $input['rate_unit'] && $rate->is_active);
        if (! $rate) {
            throw ValidationException::withMessages(['rate_unit' => "{$space->name} can't be booked by the {$input['rate_unit']}."]);
        }

        $quantity = (int) $input['quantity'];
        $seats = (int) $input['seats'];
        [$startsAt, $endsAt] = $this->availability->window($space, $input['date'], $input['rate_unit'], $quantity, $input['start_time'] ?? null);
        $this->availability->assertBookable($space, $startsAt, $endsAt, $input['rate_unit'], $seats, $ignoreBookingId);

        // Chosen seats are optional: with none chosen, the booking gets the first free seats.
        $seatIds = array_values(array_map('intval', $input['seat_ids'] ?? []));
        if ($seatIds !== []) {
            $this->seatPlanner->assertChoice($space, $startsAt, $endsAt, $seatIds, $seats, $ignoreBookingId);
        }

        // Shared spaces (hot desks) are priced per person; a whole room is priced once.
        $people = $space->isShared() ? $seats : 1;
        $subtotal = $rate->price * $quantity * $people;
        $lines = [[
            'label' => $space->name.' · '.$quantity.' '.str($input['rate_unit'])->plural($quantity).($people > 1 ? " × {$people} people" : ''),
            'amount' => $subtotal,
        ]];

        $hours = max(1, (int) ceil($startsAt->diffInMinutes($endsAt, true) / 60));
        $addons = [];
        foreach ($input['addons'] ?? [] as $requested) {
            $addon = $space->addons->first(fn (Addon $addon) => $addon->id === (int) $requested['id'] && $addon->is_active);
            if (! $addon) {
                throw ValidationException::withMessages(['addons' => 'One of the extras is not available for this space.']);
            }
            $count = (int) $requested['quantity'];
            if ($count < 1) {
                continue;
            }
            if ($addon->max_quantity && $count > $addon->max_quantity) {
                throw ValidationException::withMessages(['addons' => "You can add up to {$addon->max_quantity} of {$addon->name}."]);
            }
            $multiplier = match ($addon->charge_type) {
                'per_hour' => $hours,
                'per_person' => $seats,
                default => 1,
            };
            $total = $addon->price * $count * $multiplier;
            $addons[] = ['addon_id' => $addon->id, 'name' => $addon->name, 'charge_type' => $addon->charge_type, 'quantity' => $count, 'unit_price' => $addon->price * $multiplier, 'total' => $total];
            $lines[] = ['label' => $addon->name.($count > 1 ? " × {$count}" : ''), 'amount' => $total];
        }
        $addonsTotal = array_sum(array_column($addons, 'total'));

        $discount = 0;
        $discountLabel = null;
        $pass = null;
        $credits = $this->creditsNeeded($input['rate_unit'], $startsAt, $endsAt, $space);
        $eligiblePass = $customer && $credits !== null ? $this->usablePass($customer, $space, $startsAt, $endsAt, $credits) : null;
        $creditsNeeded = $eligiblePass ? ($eligiblePass->credit_type === 'hours' ? $credits['hours'] : $credits['days']) : 0;

        if (($input['use_pass'] ?? false) && $eligiblePass) {
            // The pass pays for the space; extras are still charged.
            $pass = $eligiblePass;
            $discount = $subtotal;
            $discountLabel = $pass->name.' ('.$creditsNeeded.' '.str($pass->credit_type === 'hours' ? 'hour' : 'visit')->plural($creditsNeeded).')';
        } elseif ($membership = $customer?->activeMembership()) {
            if ($membership->discount_percent > 0) {
                $discount = intdiv($subtotal * $membership->discount_percent, 100);
                $discountLabel = "{$membership->name} membership ({$membership->discount_percent}% off)";
            }
        }
        if ($discount > 0) {
            $lines[] = ['label' => $discountLabel, 'amount' => -$discount];
        }

        return [
            'space' => $space,
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'rate_unit' => $input['rate_unit'],
            'quantity' => $quantity,
            'seats' => $seats,
            'seat_ids' => $seatIds,
            'lines' => $lines,
            'subtotal' => $subtotal,
            'addons' => $addons,
            'addons_total' => $addonsTotal,
            'discount' => $discount,
            'discount_label' => $discountLabel,
            'total' => max(0, $subtotal + $addonsTotal - $discount),
            'pass' => $pass,
            'pass_credits' => $pass ? $creditsNeeded : 0,
            'eligible_pass' => $eligiblePass ? ['id' => $eligiblePass->id, 'name' => $eligiblePass->name, 'credits_needed' => $creditsNeeded, 'credits_left' => $eligiblePass->creditsLeft()] : null,
            'requires_approval' => $space->requires_approval,
        ];
    }

    /**
     * Holds the slot and raises the invoice. Free bookings (fully covered by a pass) confirm at once;
     * spaces that need approval wait for staff before anyone pays.
     *
     * @param  array<string, mixed>  $input
     */
    public function create(Space $space, array $input, User $customer): Booking
    {
        $this->assertOpen();

        $booking = DB::transaction(function () use ($space, $input, $customer) {
            // Serialises bookings for this space so two people can't take the same slot.
            Space::whereKey($space->id)->lockForUpdate()->first();
            $quote = $this->quote($space->fresh(), $input, $customer);

            if ($quote['pass']) {
                $pass = CustomerPass::whereKey($quote['pass']->id)->lockForUpdate()->firstOrFail();
                abort_if($pass->creditsLeft() < $quote['pass_credits'], 422, 'Your pass no longer has enough credits for this booking.');
                $pass->increment('credits_used', $quote['pass_credits']);
            }

            $policy = $quote['space']->cancellationPolicy;
            $status = match (true) {
                $quote['requires_approval'] => BookingStatus::PendingApproval,
                $quote['total'] === 0 => BookingStatus::Confirmed,
                default => BookingStatus::Held,
            };

            $booking = Booking::create([
                'user_id' => $customer->id,
                'space_id' => $space->id,
                'customer_pass_id' => $quote['pass']?->id,
                'status' => $status,
                'starts_at' => $quote['starts_at'],
                'ends_at' => $quote['ends_at'],
                'rate_unit' => $quote['rate_unit'],
                'quantity' => $quote['quantity'],
                'seats' => $quote['seats'],
                'subtotal' => $quote['subtotal'],
                'addons_total' => $quote['addons_total'],
                'discount' => $quote['discount'],
                'discount_label' => $quote['discount_label'],
                'total' => $quote['total'],
                'pass_credits_used' => $quote['pass_credits'],
                'paid_via' => $status === BookingStatus::Confirmed ? ($quote['pass'] ? 'pass' : 'free') : null,
                'hold_expires_at' => $status === BookingStatus::Held ? now()->addMinutes(self::HOLD_MINUTES) : null,
                'check_in_code' => $status === BookingStatus::Confirmed ? Booking::newCheckInCode() : null,
                'confirmed_at' => $status === BookingStatus::Confirmed ? now() : null,
                'manage_token' => Str::random(40),
                'space_name' => $quote['space']->name,
                'location_name' => $quote['space']->location->name,
                'policy_snapshot' => $policy ? ['name' => $policy->name, 'rules' => $policy->rules, 'summary' => $policy->summary()] : null,
                'notes' => $input['notes'] ?? null,
            ]);
            foreach ($quote['addons'] as $addon) {
                $booking->addons()->create($addon);
            }
            $this->seatPlanner->assign($booking, $quote['space'], $quote['seat_ids']);

            if ($status === BookingStatus::Held) {
                $this->raiseInvoice($booking, $quote['lines']);
            }

            return $booking;
        });

        $booking->load('user');
        match ($booking->status) {
            BookingStatus::Confirmed => $this->announceConfirmed($booking),
            BookingStatus::PendingApproval => $booking->user->notify(new BookingNotification(EmailTemplateKey::BookingPendingApproval, $booking)),
            default => null,
        };

        return $booking->refresh();
    }

    /**
     * The booking's invoice was paid (online or by an approved transfer). Usually this confirms
     * a live hold; if the hold had already run out, the slot is re-checked before confirming.
     */
    public function markPaid(Booking $booking): void
    {
        $booking->loadMissing(['invoice', 'user']);
        $gateway = $booking->invoice?->payments()->where('status', PaymentStatus::Success->value)->latest('id')->value('gateway');
        $paidVia = match (true) {
            $gateway === Payment::BANK_TRANSFER => 'bank_transfer',
            // A discount code covered the whole invoice, so no money changed hands.
            $gateway === null && $booking->invoice?->coupon_code !== null => 'coupon',
            default => 'online',
        };

        // What the customer actually paid, which is less than the booking total when a discount code was used.
        $paid = $booking->invoice ? max(0, $booking->invoice->amount_paid - $booking->invoice->amount_refunded) : $booking->total;

        $outcome = DB::transaction(function () use ($booking, $paidVia, $paid) {
            Space::whereKey($booking->space_id)->lockForUpdate()->first();
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();

            if ($locked->status === BookingStatus::Held) {
                $this->confirmLocked($locked, $paidVia);

                return 'confirmed';
            }

            if ($locked->status === BookingStatus::Expired) {
                $space = Space::with(['type', 'location'])->findOrFail($locked->space_id);
                if ($this->availability->hasRoom($space, CarbonImmutable::instance($locked->starts_at), CarbonImmutable::instance($locked->ends_at), $locked->seats, $locked->id)
                    && $this->seatPlanner->reclaim($locked, $space)) {
                    $this->confirmLocked($locked, $paidVia);

                    return 'confirmed';
                }

                // Paid too late and someone else took the slot: cancel with a full refund due.
                $locked->update([
                    'status' => BookingStatus::Cancelled,
                    'paid_via' => $paidVia,
                    'cancelled_at' => now(),
                    'cancel_reason' => 'Payment arrived after the hold ended and the time had been booked by someone else.',
                    'refund_amount' => $paid,
                ]);

                return 'clashed';
            }

            return null;
        });

        $booking->refresh()->load('user');
        if ($outcome === 'confirmed') {
            $this->announceConfirmed($booking);
        }
        if ($outcome === 'clashed') {
            Log::warning('Booking paid after its slot was taken', ['booking' => $booking->reference]);
            $this->refundAutomatically($booking, $paid, 'Booking could not be confirmed: slot taken after the hold ended.');
            $booking->user->notify(new BookingNotification(EmailTemplateKey::BookingCancelled, $booking, [
                'refund_amount' => $paid > 0 ? Money::format($paid) : 'No refund',
                'reason' => 'your payment arrived after the hold ended and the time had been booked by someone else',
            ]));
        }
    }

    /**
     * Staff accept a booking request. Free bookings confirm straight away; otherwise the customer
     * gets a day to pay.
     */
    public function approve(Booking $booking): Booking
    {
        abort_unless($booking->status === BookingStatus::PendingApproval, 422, 'Only bookings awaiting approval can be approved.');

        DB::transaction(function () use ($booking) {
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            if ($locked->total === 0) {
                $this->confirmLocked($locked, $locked->customer_pass_id ? 'pass' : 'free');

                return;
            }
            $locked->update(['status' => BookingStatus::Held, 'hold_expires_at' => now()->addHours(self::APPROVED_HOLD_HOURS)]);
            $locked->load('addons');
            $lines = [['label' => $locked->space_name.' · '.$locked->quantity.' '.str($locked->rate_unit)->plural($locked->quantity), 'amount' => $locked->subtotal]];
            foreach ($locked->addons as $addon) {
                $lines[] = ['label' => $addon->name, 'amount' => $addon->total];
            }
            if ($locked->discount > 0) {
                $lines[] = ['label' => (string) $locked->discount_label, 'amount' => -$locked->discount];
            }
            $this->raiseInvoice($locked, $lines);
        });

        $booking->refresh()->load('user');
        if ($booking->status === BookingStatus::Confirmed) {
            $this->announceConfirmed($booking);
        } else {
            $booking->user->notify(new BookingNotification(EmailTemplateKey::BookingAwaitingPayment, $booking, [
                'hold_expires' => $booking->hold_expires_at->timezone((string) config('app.display_timezone'))->format('j M Y, g:ia'),
            ]));
        }

        return $booking;
    }

    /**
     * Cancels a booking. Customers get the refund their cancellation policy allows; staff choose
     * the refund percentage. Online payments are refunded automatically; anything else is left
     * as refund due for Finance.
     */
    public function cancel(Booking $booking, ?User $staff, string $reason, ?int $staffRefundPercent = null): Booking
    {
        abort_unless($booking->status->isCancellable(), 422, 'This booking can no longer be cancelled.');
        abort_if(! $staff && $booking->starts_at->isPast(), 422, 'This booking has already started. Please speak to the front desk.');

        $booking->loadMissing('invoice');
        $invoice = $booking->invoice;
        abort_if($invoice?->hasPendingTransfer(), 422, "We're still checking a bank transfer for this booking. Please contact us to cancel it.");

        $paid = $invoice ? max(0, $invoice->amount_paid - $invoice->amount_refunded) : 0;
        $percent = $staffRefundPercent ?? $this->policyRefundPercent($booking);
        $refund = intdiv($paid * $percent, 100);

        DB::transaction(function () use ($booking, $staff, $reason, $refund, $percent, $invoice) {
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            abort_unless($locked->status->isCancellable(), 422, 'This booking can no longer be cancelled.');

            $locked->update([
                'status' => BookingStatus::Cancelled,
                'cancelled_at' => now(),
                'cancelled_by' => $staff?->id,
                'cancel_reason' => $reason,
                'refund_amount' => $refund,
                'hold_expires_at' => null,
            ]);

            // Pass credits come back whenever the policy would refund something.
            if ($locked->customer_pass_id && $locked->pass_credits_used > 0 && $percent > 0) {
                CustomerPass::whereKey($locked->customer_pass_id)->lockForUpdate()->first()?->decrement('credits_used', $locked->pass_credits_used);
            }

            if ($invoice && $invoice->status === InvoiceStatus::Unpaid && $invoice->amount_paid === 0) {
                $invoice->update(['status' => InvoiceStatus::Void, 'voided_at' => now()]);
            }
        });

        $booking->refresh()->load('user');
        if ($refund > 0) {
            $this->refundAutomatically($booking, $refund, "Booking {$booking->reference} cancelled: {$reason}");
        }

        $booking->user->notify(new BookingNotification(EmailTemplateKey::BookingCancelled, $booking, [
            'refund_amount' => $refund > 0 ? Money::format($refund) : 'No refund',
            'reason' => $reason,
        ]));

        return $booking;
    }

    /**
     * Refund percentage the booking's policy allows right now (100% for unpaid bookings).
     */
    public function policyRefundPercent(Booking $booking): int
    {
        $rules = collect($booking->policy_snapshot['rules'] ?? [])->sortByDesc('hours_before');
        if ($rules->isEmpty()) {
            return 0;
        }
        $hoursBefore = max(0, now()->diffInMinutes($booking->starts_at, false) / 60);

        foreach ($rules as $rule) {
            if ($hoursBefore >= $rule['hours_before']) {
                return (int) $rule['refund_percent'];
            }
        }

        return 0;
    }

    /**
     * Customers checking themselves in from the poster at reception may do so this many minutes
     * before their start. Staff at the desk can check people in up to two hours early.
     */
    public const SELF_CHECK_IN_MINUTES = 30;

    public function checkIn(Booking $booking, User $staff): Booking
    {
        $this->assertCanCheckIn($booking, 120);

        $booking->update(['status' => BookingStatus::CheckedIn, 'checked_in_at' => now(), 'checked_in_by' => $staff->id, 'checked_in_via' => 'desk']);

        return $booking;
    }

    /**
     * The customer checking themselves in at the location's self check-in link.
     */
    public function selfCheckIn(Booking $booking): Booking
    {
        $this->assertCanCheckIn($booking, self::SELF_CHECK_IN_MINUTES);

        $booking->update(['status' => BookingStatus::CheckedIn, 'checked_in_at' => now(), 'checked_in_by' => null, 'checked_in_via' => 'self']);

        return $booking;
    }

    private function assertCanCheckIn(Booking $booking, int $opensMinutesBefore): void
    {
        $timezone = (string) config('app.display_timezone');
        abort_if($booking->status === BookingStatus::CheckedIn, 422, 'Already checked in at '.$booking->checked_in_at?->timezone($timezone)->format('g:ia').'.');
        abort_unless($booking->status === BookingStatus::Confirmed, 422, 'Only confirmed bookings can be checked in. This one is '.mb_strtolower($booking->status->label()).'.');
        abort_if($booking->ends_at->isPast(), 422, 'This booking has already ended.');

        $window = $opensMinutesBefore === 120 ? 'two hours' : "{$opensMinutesBefore} minutes";
        abort_if($booking->starts_at->copy()->subMinutes($opensMinutesBefore)->isFuture(), 422, "Check-in opens {$window} before the booking starts (".$booking->starts_at->timezone($timezone)->format('j M, g:ia').').');
    }

    /**
     * Lets go of holds nobody paid for, so the time is free again. Holds with a bank transfer
     * waiting for review stay until Finance decides.
     */
    public function expireHolds(): int
    {
        $expired = 0;
        Booking::query()
            ->where('status', BookingStatus::Held->value)
            ->where('hold_expires_at', '<=', now())
            ->with('invoice')
            ->orderBy('id')
            ->chunkById(100, function ($bookings) use (&$expired) {
                foreach ($bookings as $booking) {
                    if ($booking->invoice?->hasPendingTransfer()) {
                        continue;
                    }
                    $booking->update(['status' => BookingStatus::Expired]);
                    if ($booking->invoice && $booking->invoice->status === InvoiceStatus::Unpaid && $booking->invoice->amount_paid === 0) {
                        $booking->invoice->update(['status' => InvoiceStatus::Void, 'voided_at' => now()]);
                    }
                    $expired++;
                }
            });

        return $expired;
    }

    /**
     * Marks bookings that have ended as completed.
     */
    public function completeEnded(): int
    {
        return Booking::query()
            ->whereIn('status', [BookingStatus::Confirmed->value, BookingStatus::CheckedIn->value])
            ->where('ends_at', '<=', now())
            ->update(['status' => BookingStatus::Completed->value, 'updated_at' => now()]);
    }

    /**
     * Emails customers whose booking starts in the next day or so, once per booking.
     */
    public function sendReminders(): int
    {
        $sent = 0;
        Booking::query()
            ->where('status', BookingStatus::Confirmed->value)
            ->whereNull('reminder_sent_at')
            ->whereBetween('starts_at', [now()->addHours(12), now()->addHours(36)])
            ->with(['user', 'space.location'])
            ->orderBy('id')
            ->chunkById(100, function ($bookings) use (&$sent) {
                foreach ($bookings as $booking) {
                    $booking->user->notify(new BookingNotification(EmailTemplateKey::BookingReminder, $booking));
                    $booking->update(['reminder_sent_at' => now()]);
                    $sent++;
                }
            });

        return $sent;
    }

    /**
     * Credits a pass would need for this booking: visit passes count days, hour passes count
     * started hours. Week and month bookings can't use a pass.
     *
     * @return array{days: int, hours: int}|null
     */
    private function creditsNeeded(string $rateUnit, CarbonImmutable $startsAt, CarbonImmutable $endsAt, Space $space): ?array
    {
        if (! in_array($rateUnit, ['hour', 'day'], true)) {
            return null;
        }
        $timezone = $this->availability->timezone($space);
        $days = (int) $startsAt->setTimezone($timezone)->startOfDay()->diffInDays($endsAt->setTimezone($timezone)->subSecond()->startOfDay()) + 1;

        return ['days' => $days, 'hours' => (int) ceil($startsAt->diffInMinutes($endsAt, true) / 60)];
    }

    /**
     * @param  array{days: int, hours: int}  $credits
     */
    private function usablePass(User $customer, Space $space, CarbonImmutable $startsAt, CarbonImmutable $endsAt, array $credits): ?CustomerPass
    {
        return $customer->passes()
            ->where('status', CustomerPass::ACTIVE)
            ->where('ends_at', '>=', $endsAt)
            ->where('starts_at', '<=', $startsAt)
            ->orderBy('ends_at')
            ->get()
            ->first(fn (CustomerPass $pass) => $pass->covers($space, $startsAt, $endsAt) && $pass->creditsLeft() >= ($pass->credit_type === 'hours' ? $credits['hours'] : $credits['days']));
    }

    /**
     * @param  list<array{label: string, amount: int}>  $lines
     */
    private function raiseInvoice(Booking $booking, array $lines): Invoice
    {
        $items = collect($lines)->filter(fn (array $line) => $line['amount'] > 0)
            ->map(fn (array $line) => ['description' => $line['label'], 'quantity' => 1, 'unit_amount' => $line['amount']])->values()->all();
        $discount = -collect($lines)->filter(fn (array $line) => $line['amount'] < 0)->sum('amount');

        $invoice = $this->invoices->create($booking->user()->firstOrFail(), $items, now()->toDateString(), "For booking {$booking->reference}", null, notify: false);
        if ($discount > 0) {
            // Invoice lines can't be negative, so the discount reduces the total directly.
            $invoice->update(['total' => $invoice->subtotal - $discount, 'notes' => "For booking {$booking->reference}. Includes {$booking->discount_label}: -".Money::format($discount)]);
        }
        $invoice->source()->associate($booking)->save();
        $booking->update(['invoice_id' => $invoice->id]);

        return $invoice;
    }

    private function confirmLocked(Booking $booking, string $paidVia): void
    {
        $booking->update([
            'status' => BookingStatus::Confirmed,
            'paid_via' => $paidVia,
            'hold_expires_at' => null,
            'confirmed_at' => now(),
            'check_in_code' => $booking->check_in_code ?? Booking::newCheckInCode(),
        ]);
    }

    private function announceConfirmed(Booking $booking): void
    {
        $booking->loadMissing(['user', 'space.location']);
        $booking->user->notify(new BookingNotification(EmailTemplateKey::BookingConfirmed, $booking));
        if ($booking->user->isGuest()) {
            $booking->user->notify(new BookingNotification(EmailTemplateKey::GuestAccountInvite, $booking));
        }

        Notification::send(StaffAlerts::recipients('bookings.manage'), new StaffAlertNotification(
            EmailTemplateKey::StaffNewBooking,
            BookingNotification::bookingVariables($booking) + ['customer_name' => $booking->user->name, 'amount' => Money::format($booking->chargedAmount())],
            FrontendLinks::adminBooking((string) $booking->reference),
        ));
    }

    /**
     * Refunds an online payment through its gateway. Bank transfers, and gateway failures, are left
     * as "refund due" on the booking for Finance to pay back by hand.
     */
    private function refundAutomatically(Booking $booking, int $amount, string $reason): void
    {
        $payment = Payment::query()
            ->where('invoice_id', $booking->invoice_id)
            ->whereIn('status', [PaymentStatus::Success->value, PaymentStatus::PartiallyRefunded->value])
            ->latest('id')
            ->first();
        if (! $payment || $payment->isBankTransfer()) {
            return;
        }

        try {
            $this->payments->refund($payment, min($amount, $payment->refundable()), $reason, 'gateway', null);
        } catch (HttpException $exception) {
            Log::warning('Automatic booking refund failed; left for Finance', ['booking' => $booking->reference, 'error' => $exception->getMessage()]);
        }
    }
}
