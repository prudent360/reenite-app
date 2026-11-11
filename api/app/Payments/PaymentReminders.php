<?php

namespace App\Payments;

use App\Enums\BookingStatus;
use App\Enums\InvoiceStatus;
use App\Models\Booking;
use App\Models\Consultation;
use App\Models\CustomerMembership;
use App\Models\CustomerPass;
use App\Models\Invoice;
use App\Notifications\CheckoutNudgeNotification;
use App\Notifications\InvoiceReminderNotification;
use App\Support\FrontendLinks;
use App\Workspace\Availability;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Chases money owed, politely:
 *  - Invoices: 3 days before they're due, on the day, then 3 and 7 days late. Each once.
 *  - Abandoned checkouts: one email when a booking or consultation hold ran out unpaid, or a pass or
 *    membership was started but not paid within a few hours. Bookings say whether the time is still free.
 */
class PaymentReminders
{
    /** stage => days relative to the due date (negative = before) */
    public const INVOICE_STAGES = ['before' => -3, 'due' => 0, 'late_3' => 3, 'late_7' => 7];

    /** Wait this long after a plan purchase is started before nudging. */
    public const PLAN_NUDGE_AFTER_HOURS = 3;

    public function __construct(private Availability $availability) {}

    /**
     * @return array{invoices: int, nudges: int}
     */
    public function run(): array
    {
        return ['invoices' => $this->remindInvoices(), 'nudges' => $this->nudgeAbandonedCheckouts()];
    }

    public function remindInvoices(): int
    {
        $today = CarbonImmutable::parse(now((string) config('app.display_timezone'))->toDateString());
        $sent = 0;

        Invoice::query()
            ->where('status', InvoiceStatus::Unpaid->value)
            ->whereColumn('amount_paid', '<', 'total')
            ->whereNotNull('due_at')
            ->whereDate('due_at', '<=', $today->addDays(3)->toDateString())
            ->whereDate('due_at', '>=', $today->subDays(8)->toDateString())
            ->where(fn (Builder $query) => self::owed($query))
            ->with(['user', 'items'])
            ->chunkById(100, function ($invoices) use ($today, &$sent) {
                foreach ($invoices as $invoice) {
                    $stage = $this->stageFor($invoice, $today);
                    if ($stage === null || in_array($stage, $invoice->reminders_sent ?? [], true) || ! $invoice->user->isActive() || $invoice->hasPendingTransfer()) {
                        continue;
                    }

                    // Earlier stages count as covered, so a late invoice gets one reminder, not a burst.
                    $stages = array_keys(self::INVOICE_STAGES);
                    $covered = array_slice($stages, 0, array_search($stage, $stages, true) + 1);
                    $invoice->update(['reminders_sent' => array_values(array_unique([...($invoice->reminders_sent ?? []), ...$covered]))]);

                    $days = (int) $today->diffInDays(CarbonImmutable::parse($invoice->due_at->toDateString()), false);
                    $invoice->user->notify(new InvoiceReminderNotification($invoice, match (true) {
                        $days > 1 => "is due in {$days} days",
                        $days === 1 => 'is due tomorrow',
                        $days === 0 => 'is due today',
                        $days === -1 => 'was due yesterday',
                        default => 'was due '.abs($days).' days ago',
                    }));
                    $sent++;
                }
            });

        return $sent;
    }

    /**
     * Invoices that are money owed, as opposed to abandoned checkouts: held bookings and
     * consultations expire on their own, and new plans that were never paid get a nudge instead.
     * Renewals waiting for payment are owed.
     *
     * @param  Builder<Invoice>  $query
     */
    public static function owed(Builder $query): void
    {
        $query->whereNull('source_type')
            ->orWhereNotIn('source_type', [Booking::class, Consultation::class, CustomerPass::class, CustomerMembership::class])
            ->orWhereHasMorph('source', [CustomerPass::class, CustomerMembership::class], fn (Builder $plan) => $plan->whereNotNull('renewal_of_id')->where('status', CustomerPass::PENDING));
    }

    /**
     * The latest stage that has been reached. An invoice created on its due date skips "before"
     * and "due" (the customer has just seen it); one created a day before skips "before".
     */
    private function stageFor(Invoice $invoice, CarbonImmutable $today): ?string
    {
        $due = CarbonImmutable::parse($invoice->due_at->toDateString());
        $created = CarbonImmutable::parse($invoice->created_at->timezone((string) config('app.display_timezone'))->toDateString());
        $daysLate = (int) $due->diffInDays($today, false);

        $reached = null;
        foreach (self::INVOICE_STAGES as $stage => $offset) {
            if ($daysLate >= $offset && $created->lessThan($due->addDays($offset))) {
                $reached = $stage;
            }
        }

        return $reached;
    }

    public function nudgeAbandonedCheckouts(): int
    {
        $sent = 0;

        Booking::query()
            ->where('status', BookingStatus::Expired->value)
            ->whereNull('nudged_at')
            ->where('hold_expires_at', '>=', now()->subDay())
            ->where('starts_at', '>', now()->addHour())
            ->with(['user', 'space.location', 'space.type'])
            ->chunkById(100, function ($bookings) use (&$sent) {
                foreach ($bookings as $booking) {
                    $booking->update(['nudged_at' => now()]);
                    // Someone who booked again since doesn't need reminding.
                    if (! $booking->user || $booking->user->bookings()->where('id', '>', $booking->id)->exists()) {
                        continue;
                    }
                    $timezone = $booking->space->location->timezone ?: (string) config('app.display_timezone');
                    $start = $booking->starts_at->timezone($timezone);
                    $free = $this->availability->hasRoom($booking->space, CarbonImmutable::instance($booking->starts_at), CarbonImmutable::instance($booking->ends_at), $booking->seats);
                    $booking->user->notify(new CheckoutNudgeNotification(
                        "{$booking->space_name} on ".$start->format('D j M, g:ia'),
                        $free ? 'Good news: that time is still free. Book it again in a minute, before someone else does.' : 'That time has since been taken, but there may be another time that suits you.',
                        FrontendLinks::bookSpace($booking->space->slug, $start->toDateString()),
                    ));
                    $sent++;
                }
            });

        Consultation::query()
            ->where('status', Consultation::EXPIRED)
            ->whereNull('nudged_at')
            ->where('hold_expires_at', '>=', now()->subDay())
            ->where('starts_at', '>', now()->addHours(2))
            ->with(['user', 'type'])
            ->chunkById(100, function ($consultations) use (&$sent) {
                foreach ($consultations as $consultation) {
                    $consultation->update(['nudged_at' => now()]);
                    if ($consultation->user->consultations()->where('id', '>', $consultation->id)->exists()) {
                        continue;
                    }
                    $free = ! Consultation::query()->where('consultation_type_id', $consultation->consultation_type_id)->occupying()
                        ->where('starts_at', '<', $consultation->ends_at)->where('ends_at', '>', $consultation->starts_at)->exists();
                    $start = $consultation->starts_at->timezone((string) config('app.display_timezone'));
                    $consultation->user->notify(new CheckoutNudgeNotification(
                        "your {$consultation->name} on ".$start->format('D j M, g:ia'),
                        $free ? 'That time is still free if you want it.' : 'That time has since been taken, but there are other times this week.',
                        FrontendLinks::base().'/dashboard/consultations/book?'.http_build_query(['type' => $consultation->type->slug]),
                    ));
                    $sent++;
                }
            });

        foreach ([CustomerPass::class, CustomerMembership::class] as $model) {
            $model::query()
                ->where('status', CustomerPass::PENDING)
                ->whereNull('renewal_of_id')
                ->whereNull('nudged_at')
                ->whereBetween('created_at', [now()->subDays(3), now()->subHours(self::PLAN_NUDGE_AFTER_HOURS)])
                ->with(['user', 'invoice'])
                ->chunkById(100, function ($plans) use (&$sent, $model) {
                    foreach ($plans as $plan) {
                        $plan->update(['nudged_at' => now()]);
                        if (! $plan->invoice?->isPayable() || $plan->invoice->hasPendingTransfer() || ! $plan->user->isActive()) {
                            continue;
                        }
                        $plan->user->notify(new CheckoutNudgeNotification(
                            "the {$plan->name} ".($model === CustomerPass::class ? 'pass' : 'membership'),
                            'Your invoice is ready whenever you are: pay online in a minute or by bank transfer.',
                            FrontendLinks::invoice($plan->invoice->id),
                        ));
                        $sent++;
                    }
                });
        }

        return $sent;
    }
}
