<?php

namespace App\Workspace;

use App\Enums\EmailTemplateKey;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Models\CustomerMembership;
use App\Models\CustomerPass;
use App\Models\PaymentGateway;
use App\Models\PaymentMethod;
use App\Models\User;
use App\Notifications\PlanNotification;
use App\Notifications\RenewalNotification;
use App\Payments\PaymentService;
use App\Support\Money;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Keeps passes and memberships going.
 *
 * Timeline for each active plan, run hourly:
 *  - 3 days before it ends: an email. With auto-renew and a saved card it says when and how much
 *    we'll charge; otherwise it invites the customer to renew (and passes with visits left are
 *    reminded to use them).
 *  - From 1 day before it ends: auto-renew charges the saved card. A failed charge is retried a day
 *    later, up to 3 tries, and the customer is emailed a pay link each time.
 *  - 14 days after it ended, a renewal still unpaid is cancelled and its invoice voided.
 *
 * A paid renewal starts when the current period ends, so renewing early loses nothing.
 */
class RenewalService
{
    public const NOTICE_DAYS = 3;

    public const CHARGE_HOURS_BEFORE = 24;

    public const MAX_ATTEMPTS = 3;

    public const RETRY_HOURS = 24;

    /** How long after a plan ends we keep trying to renew it. */
    public const GRACE_DAYS = 3;

    public const ABANDON_DAYS = 14;

    public function __construct(private PlanService $plans, private PaymentService $payments) {}

    /**
     * Customer asks to renew now (or we start the renewal for auto-renew). Reuses a renewal that
     * is already waiting for payment, so there's never more than one.
     */
    public function startRenewal(CustomerPass|CustomerMembership $plan): CustomerPass|CustomerMembership
    {
        $plan->loadMissing(['plan', 'user', 'renewal']);
        $existing = $plan->renewal;
        if ($existing && in_array($existing->status, [CustomerPass::PENDING, CustomerPass::ACTIVE], true)) {
            abort_if($existing->status === CustomerPass::ACTIVE, 422, 'This has already been renewed.');

            return $existing;
        }
        abort_unless(in_array($plan->status, [CustomerPass::ACTIVE, CustomerPass::EXPIRED], true), 422, 'Only an active or recently ended plan can be renewed.');
        abort_unless($plan->plan?->is_active, 422, "We don't offer {$plan->name} any more. Please choose another plan.");

        return $plan instanceof CustomerPass
            ? $this->plans->buyPass($plan->user, $plan->plan, $plan)
            : $this->plans->buyMembership($plan->user, $plan->plan, $plan);
    }

    /**
     * The card renewals are charged to: the customer's default card for the live gateway mode.
     */
    public function cardFor(User $customer): ?PaymentMethod
    {
        $paystack = PaymentGateway::where('code', 'paystack')->first();
        if (! $paystack?->is_enabled || ! $paystack->isConfigured()) {
            return null;
        }

        return $customer->paymentMethods()
            ->where('gateway', 'paystack')
            ->where('mode', $paystack->mode)
            ->orderByDesc('is_default')
            ->latest('id')
            ->get()
            ->first(fn (PaymentMethod $card) => ! $card->isExpired());
    }

    /**
     * Runs every step that's due. Returns counts for the scheduler log.
     *
     * @return array{notices: int, charged: int, failed: int, abandoned: int}
     */
    public function run(): array
    {
        $result = ['notices' => 0, 'charged' => 0, 'failed' => 0, 'abandoned' => 0];

        foreach ([CustomerPass::class, CustomerMembership::class] as $model) {
            $result['notices'] += $this->sendNotices($model);
            [$charged, $failed] = $this->chargeDue($model);
            $result['charged'] += $charged;
            $result['failed'] += $failed;
            $result['abandoned'] += $this->abandonUnpaid($model);
        }

        return $result;
    }

    /**
     * @param  class-string<CustomerPass|CustomerMembership>  $model
     */
    private function sendNotices(string $model): int
    {
        $sent = 0;
        $model::query()
            ->where('status', CustomerPass::ACTIVE)
            ->whereNull('renewal_notice_at')
            ->whereBetween('ends_at', [now(), now()->addDays(self::NOTICE_DAYS)])
            ->whereDoesntHave('renewal', fn (Builder $query) => $query->whereIn('status', [CustomerPass::ACTIVE]))
            ->with(['user', 'plan'])
            ->chunkById(100, function ($plans) use (&$sent) {
                foreach ($plans as $plan) {
                    $plan->update(['renewal_notice_at' => now()]);
                    if (! $plan->user->isActive() || ! $plan->plan?->is_active) {
                        continue;
                    }
                    $card = $plan->auto_renew ? $this->cardFor($plan->user) : null;
                    $values = $this->values($plan, $card);

                    if ($card) {
                        $plan->user->notify(new RenewalNotification(EmailTemplateKey::RenewalUpcoming, $plan, $values));
                    } elseif ($plan instanceof CustomerMembership) {
                        $plan->user->notify(new PlanNotification(EmailTemplateKey::MembershipRenewalDue, $plan));
                    } else {
                        $plan->user->notify(new RenewalNotification(EmailTemplateKey::PassRenewalDue, $plan, $values));
                        if ($plan->creditsLeft() > 0) {
                            $plan->user->notify(new PlanNotification(EmailTemplateKey::PassExpiring, $plan));
                        }
                    }
                    $sent++;
                }
            });

        return $sent;
    }

    /**
     * @param  class-string<CustomerPass|CustomerMembership>  $model
     * @return array{0: int, 1: int}
     */
    private function chargeDue(string $model): array
    {
        $charged = 0;
        $failed = 0;
        $model::query()
            ->where('auto_renew', true)
            ->whereIn('status', [CustomerPass::ACTIVE, CustomerPass::EXPIRED])
            ->whereBetween('ends_at', [now()->subDays(self::GRACE_DAYS), now()->addHours(self::CHARGE_HOURS_BEFORE)])
            ->where('renewal_attempts', '<', self::MAX_ATTEMPTS)
            ->where(fn (Builder $query) => $query->whereNull('last_renewal_attempt_at')->orWhere('last_renewal_attempt_at', '<=', now()->subHours(self::RETRY_HOURS)))
            ->whereDoesntHave('renewal', fn (Builder $query) => $query->where('status', CustomerPass::ACTIVE))
            ->with(['user', 'plan'])
            ->chunkById(50, function ($plans) use (&$charged, &$failed) {
                foreach ($plans as $plan) {
                    $outcome = $this->attempt($plan);
                    if ($outcome === true) {
                        $charged++;
                    } elseif ($outcome === false) {
                        $failed++;
                    }
                }
            });

        return [$charged, $failed];
    }

    /**
     * One automatic charge. True when renewed, false when the card failed, null when skipped.
     */
    public function attempt(CustomerPass|CustomerMembership $plan): ?bool
    {
        // Claim this attempt first, so two scheduler runs never charge twice.
        $claimed = $plan::query()->whereKey($plan->id)
            ->where('renewal_attempts', $plan->renewal_attempts)
            ->update(['renewal_attempts' => DB::raw('renewal_attempts + 1'), 'last_renewal_attempt_at' => now()]);
        if ($claimed === 0) {
            return null;
        }
        $plan->refresh();

        if (! $plan->user->isActive() || ! $plan->plan?->is_active) {
            $plan->update(['auto_renew' => false, 'renewal_failure' => 'This plan is no longer offered, so it was not renewed.']);

            return null;
        }

        $card = $this->cardFor($plan->user);
        try {
            $renewal = $this->startRenewal($plan);
        } catch (HttpException $exception) {
            $plan->update(['renewal_failure' => $exception->getMessage()]);

            return null;
        }
        $renewal->loadMissing('invoice');

        if (! $card) {
            $plan->update(['renewal_failure' => 'No saved card to charge.', 'renewal_attempts' => self::MAX_ATTEMPTS]);
            $plan->user->notify(new RenewalNotification(EmailTemplateKey::RenewalFailed, $plan, $this->values($plan, null) + [
                'reason' => "There's no saved card on your account.",
                'next_try' => "We won't try again automatically.",
            ], $renewal->invoice_id));

            return false;
        }

        // A renewal already covered by a code or credit is paid without charging anything.
        if (! $renewal->invoice || $renewal->invoice->status === InvoiceStatus::Paid) {
            return true;
        }

        $payment = $this->payments->chargeSavedCard($renewal->invoice, $card);
        if ($payment->status === PaymentStatus::Success) {
            $plan->update(['renewal_failure' => null]);

            return true;
        }

        $plan->update(['renewal_failure' => $payment->failure_reason]);
        $last = $plan->renewal_attempts >= self::MAX_ATTEMPTS;
        Log::info('Automatic renewal failed', ['plan' => $plan::class, 'id' => $plan->id, 'attempt' => $plan->renewal_attempts, 'reason' => $payment->failure_reason]);
        $plan->user->notify(new RenewalNotification(EmailTemplateKey::RenewalFailed, $plan, $this->values($plan, $card) + [
            'reason' => (string) $payment->failure_reason,
            'next_try' => $last ? 'That was our last automatic try.' : 'We will try again tomorrow.',
        ], $renewal->invoice_id));

        return false;
    }

    /**
     * Renewals nobody paid for, two weeks after the plan ended: cancel them so the invoice stops
     * being chased.
     *
     * @param  class-string<CustomerPass|CustomerMembership>  $model
     */
    private function abandonUnpaid(string $model): int
    {
        $count = 0;
        $model::query()
            ->where('status', CustomerPass::PENDING)
            ->whereNotNull('renewal_of_id')
            ->whereHas('renewalOf', fn (Builder $query) => $query->where('ends_at', '<=', now()->subDays(self::ABANDON_DAYS)))
            ->with('invoice')
            ->chunkById(100, function ($renewals) use (&$count) {
                foreach ($renewals as $renewal) {
                    if ($renewal->invoice?->hasPendingTransfer()) {
                        continue;
                    }
                    $renewal->update(['status' => CustomerPass::CANCELLED]);
                    if ($renewal->invoice && $renewal->invoice->status === InvoiceStatus::Unpaid && $renewal->invoice->amount_paid === 0) {
                        $renewal->invoice->update(['status' => InvoiceStatus::Void, 'voided_at' => now()]);
                    }
                    $count++;
                }
            });

        return $count;
    }

    /**
     * @return array{plan_name: string, renews_on: string, amount: string, card: string}
     */
    private function values(CustomerPass|CustomerMembership $plan, ?PaymentMethod $card): array
    {
        /** @var Carbon $ends */
        $ends = $plan->ends_at;

        return [
            'plan_name' => $plan->name,
            'renews_on' => $ends->timezone((string) config('app.display_timezone'))->format('l j F Y'),
            'amount' => Money::format((int) ($plan->plan->price ?? 0)),
            'card' => $card ? $card->label() : 'saved card',
        ];
    }
}
