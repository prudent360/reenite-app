<?php

namespace App\Consultations;

use App\Enums\EmailTemplateKey;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Models\Consultation;
use App\Models\ConsultationType;
use App\Models\Payment;
use App\Models\User;
use App\Notifications\ConsultationNotification;
use App\Notifications\StaffAlertNotification;
use App\Payments\InvoiceService;
use App\Payments\PaymentService;
use App\Support\FrontendLinks;
use App\Support\Money;
use App\Support\StaffAlerts;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Booking paid sessions with an officer. Unpaid consultations hold their time for 30 minutes,
 * like space bookings; paying the invoice confirms them.
 */
class ConsultationService
{
    /** Start times are offered every half hour. */
    public const SLOT_STEP_MINUTES = 30;

    /** How far ahead customers can book. */
    public const BOOK_AHEAD_DAYS = 60;

    public function __construct(private InvoiceService $invoices, private PaymentService $payments) {}

    private function timezone(): string
    {
        return (string) config('app.display_timezone');
    }

    /**
     * Start times still free on a date, in Lagos time.
     *
     * @return list<array{starts_at: string, label: string}>
     */
    public function slots(ConsultationType $type, string $date): array
    {
        $day = CarbonImmutable::parse($date, $this->timezone())->startOfDay();
        $hours = $type->schedule[(string) $day->dayOfWeekIso] ?? null;
        if (! $hours || $day->greaterThan(now($this->timezone())->addDays(self::BOOK_AHEAD_DAYS))) {
            return [];
        }

        [$open, $close] = $hours;
        $start = $day->setTimeFromTimeString($open);
        $end = $day->setTimeFromTimeString($close);
        $earliest = now()->addHours($type->notice_hours);
        $taken = $type->consultations()->occupying()
            ->where('starts_at', '<', $end->utc())
            ->where('ends_at', '>', $start->utc())
            ->get(['starts_at', 'ends_at']);

        $slots = [];
        for ($slot = $start; $slot->addMinutes($type->duration_minutes)->lessThanOrEqualTo($end); $slot = $slot->addMinutes(self::SLOT_STEP_MINUTES)) {
            $slotEnd = $slot->addMinutes($type->duration_minutes);
            if ($slot->lessThan($earliest)) {
                continue;
            }
            $clashes = $taken->contains(fn (Consultation $other) => $other->starts_at->lessThan($slotEnd) && $other->ends_at->greaterThan($slot));
            if (! $clashes) {
                $slots[] = ['starts_at' => $slot->toIso8601String(), 'label' => $slot->format('g:ia')];
            }
        }

        return $slots;
    }

    /**
     * Books a time. Free consultations are confirmed straight away; paid ones wait for the invoice.
     */
    public function book(User $customer, ConsultationType $type, string $startsAt, string $topic): Consultation
    {
        abort_unless($type->is_active, 422, 'This consultation is not being offered right now.');
        $start = CarbonImmutable::parse($startsAt)->setTimezone($this->timezone());
        $available = collect($this->slots($type, $start->toDateString()))->pluck('starts_at')
            ->contains(fn (string $slot) => CarbonImmutable::parse($slot)->equalTo($start));
        if (! $available) {
            throw ValidationException::withMessages(['starts_at' => 'That time is no longer available. Please pick another.']);
        }

        $consultation = DB::transaction(function () use ($customer, $type, $start, $topic) {
            // One session of a type at a time: lock the type while checking for a clash.
            ConsultationType::whereKey($type->id)->lockForUpdate()->first();
            $end = $start->addMinutes($type->duration_minutes);
            $clash = $type->consultations()->occupying()->where('starts_at', '<', $end->utc())->where('ends_at', '>', $start->utc())->exists();
            if ($clash) {
                throw ValidationException::withMessages(['starts_at' => 'Someone has just booked that time. Please pick another.']);
            }

            $free = $type->price === 0;
            $consultation = Consultation::create([
                'user_id' => $customer->id,
                'consultation_type_id' => $type->id,
                'name' => $type->name,
                'mode' => $type->mode,
                'starts_at' => $start->utc(),
                'ends_at' => $end->utc(),
                'topic' => $topic,
                'status' => $free ? Consultation::CONFIRMED : Consultation::PENDING_PAYMENT,
                'hold_expires_at' => $free ? null : now()->addMinutes(Consultation::HOLD_MINUTES),
                'confirmed_at' => $free ? now() : null,
                'price' => $type->price,
            ]);

            if (! $free) {
                $invoice = $this->invoices->create(
                    $customer,
                    [['description' => "{$type->name} on ".$start->format('j M Y, g:ia'), 'quantity' => 1, 'unit_amount' => $type->price]],
                    now()->toDateString(),
                    "For consultation {$consultation->refresh()->reference}",
                    null,
                    notify: false,
                );
                $invoice->source()->associate($consultation)->save();
                $consultation->update(['invoice_id' => $invoice->id]);
            }

            return $consultation;
        });

        $consultation->refresh();
        if ($consultation->status === Consultation::CONFIRMED) {
            $this->announceConfirmed($consultation);
        }

        return $consultation;
    }

    /**
     * The invoice was paid. Confirms the consultation, or refunds it if the hold ran out and
     * someone else took the time meanwhile.
     */
    public function markPaid(Consultation $consultation): void
    {
        $outcome = DB::transaction(function () use ($consultation) {
            ConsultationType::whereKey($consultation->consultation_type_id)->lockForUpdate()->first();
            $locked = Consultation::whereKey($consultation->id)->lockForUpdate()->firstOrFail();
            if (! in_array($locked->status, [Consultation::PENDING_PAYMENT, Consultation::EXPIRED], true)) {
                return null;
            }

            $clash = Consultation::query()
                ->where('consultation_type_id', $locked->consultation_type_id)
                ->whereKeyNot($locked->id)
                ->occupying()
                ->where('starts_at', '<', $locked->ends_at)
                ->where('ends_at', '>', $locked->starts_at)
                ->exists();
            if ($clash) {
                $locked->update([
                    'status' => Consultation::CANCELLED,
                    'cancelled_at' => now(),
                    'cancel_reason' => 'Payment arrived after the hold ended and the time had been booked by someone else.',
                    'refund_amount' => $locked->amountPaid(),
                ]);

                return 'clashed';
            }

            $locked->update(['status' => Consultation::CONFIRMED, 'hold_expires_at' => null, 'confirmed_at' => now()]);

            return 'confirmed';
        });

        $consultation->refresh();
        if ($outcome === 'confirmed') {
            $this->announceConfirmed($consultation);
        } elseif ($outcome === 'clashed') {
            $this->refundAutomatically($consultation, $consultation->refund_amount, "Consultation {$consultation->reference}: paid after the time was taken");
            $consultation->loadMissing('user');
            $consultation->user->notify(new ConsultationNotification(EmailTemplateKey::ConsultationCancelled, $consultation, [
                'reason' => (string) $consultation->cancel_reason,
                'refund_amount' => Money::format($consultation->refund_amount).' (full refund)',
            ]));
        }
    }

    /**
     * Customers get a full refund up to 24 hours before, and nothing after. Staff choose the refund.
     */
    public function cancel(Consultation $consultation, ?User $staff, string $reason, ?int $staffRefundPercent = null): Consultation
    {
        abort_unless($consultation->isCancellable(), 422, 'This consultation can no longer be cancelled.');
        abort_if(! $staff && $consultation->starts_at->isPast(), 422, 'This consultation has already started. Please contact us.');
        $consultation->loadMissing('invoice');
        abort_if($consultation->invoice?->hasPendingTransfer(), 422, "We're still checking a bank transfer for this consultation. Please contact us to cancel it.");

        $paid = $consultation->amountPaid();
        $percent = $staffRefundPercent ?? (now()->diffInHours($consultation->starts_at, false) >= Consultation::FREE_CANCEL_HOURS ? 100 : 0);
        $refund = intdiv($paid * $percent, 100);

        DB::transaction(function () use ($consultation, $staff, $reason, $refund) {
            $locked = Consultation::whereKey($consultation->id)->lockForUpdate()->firstOrFail();
            abort_unless($locked->isCancellable(), 422, 'This consultation can no longer be cancelled.');
            $locked->update([
                'status' => Consultation::CANCELLED,
                'cancelled_at' => now(),
                'cancelled_by' => $staff?->id,
                'cancel_reason' => $reason,
                'refund_amount' => $refund,
                'hold_expires_at' => null,
            ]);

            $invoice = $consultation->invoice;
            if ($invoice && $invoice->status === InvoiceStatus::Unpaid && $invoice->amount_paid === 0) {
                $invoice->update(['status' => InvoiceStatus::Void, 'voided_at' => now()]);
            }
        });

        $consultation->refresh()->load('user');
        if ($refund > 0) {
            $this->refundAutomatically($consultation, $refund, "Consultation {$consultation->reference} cancelled: {$reason}");
        }

        $consultation->user->notify(new ConsultationNotification(EmailTemplateKey::ConsultationCancelled, $consultation, [
            'reason' => $reason,
            'refund_amount' => $refund > 0 ? Money::format($refund) : ($paid > 0 ? 'No refund (cancelled less than 24 hours before)' : 'Nothing was paid'),
        ]));

        return $consultation;
    }

    /**
     * Releases times held for consultations that weren't paid in time.
     */
    public function expireHolds(): int
    {
        $expired = 0;
        Consultation::query()
            ->where('status', Consultation::PENDING_PAYMENT)
            ->where('hold_expires_at', '<=', now())
            ->with('invoice')
            ->chunkById(100, function ($consultations) use (&$expired) {
                foreach ($consultations as $consultation) {
                    if ($consultation->invoice?->hasPendingTransfer()) {
                        continue;
                    }
                    $consultation->update(['status' => Consultation::EXPIRED]);
                    if ($consultation->invoice && $consultation->invoice->status === InvoiceStatus::Unpaid && $consultation->invoice->amount_paid === 0) {
                        $consultation->invoice->update(['status' => InvoiceStatus::Void, 'voided_at' => now()]);
                    }
                    $expired++;
                }
            });

        return $expired;
    }

    /**
     * Emails customers about tomorrow's consultations (run hourly; each is reminded once).
     */
    public function sendReminders(): int
    {
        $sent = 0;
        Consultation::query()
            ->where('status', Consultation::CONFIRMED)
            ->whereNull('reminded_at')
            ->whereBetween('starts_at', [now()->addHours(2), now()->addDay()])
            ->with('user')
            ->chunkById(100, function ($consultations) use (&$sent) {
                foreach ($consultations as $consultation) {
                    $consultation->update(['reminded_at' => now()]);
                    $consultation->user->notify(new ConsultationNotification(EmailTemplateKey::ConsultationReminder, $consultation));
                    $sent++;
                }
            });

        return $sent;
    }

    private function announceConfirmed(Consultation $consultation): void
    {
        $consultation->loadMissing(['user', 'officer']);
        $consultation->user->notify(new ConsultationNotification(EmailTemplateKey::ConsultationConfirmed, $consultation));

        $recipients = StaffAlerts::recipients('consultations.manage');
        if ($consultation->officer && ! $recipients->contains($consultation->officer)) {
            $recipients->push($consultation->officer);
        }
        Notification::send($recipients, new StaffAlertNotification(
            EmailTemplateKey::StaffNewConsultation,
            ConsultationNotification::consultationVariables($consultation) + [
                'customer_name' => $consultation->user->name,
                'amount' => $consultation->price > 0 ? Money::format($consultation->amountPaid()) : 'Free',
            ],
            FrontendLinks::adminConsultation((string) $consultation->reference),
        ));
    }

    private function refundAutomatically(Consultation $consultation, int $amount, string $reason): void
    {
        $payment = Payment::query()
            ->where('invoice_id', $consultation->invoice_id)
            ->whereIn('status', [PaymentStatus::Success->value, PaymentStatus::PartiallyRefunded->value])
            ->latest('id')
            ->first();
        if (! $payment || $payment->isBankTransfer()) {
            return; // Finance refunds bank transfers by hand.
        }

        try {
            $this->payments->refund($payment, min($amount, $payment->refundable()), $reason, 'gateway', null);
        } catch (HttpException $exception) {
            Log::warning('Automatic consultation refund failed; left for Finance', ['consultation' => $consultation->reference, 'error' => $exception->getMessage()]);
        }
    }
}
