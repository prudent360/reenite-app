<?php

namespace App\Workspace;

use App\Enums\EmailTemplateKey;
use App\Models\CustomerMembership;
use App\Models\CustomerPass;
use App\Models\MembershipPlan;
use App\Models\PassPlan;
use App\Models\User;
use App\Notifications\PlanNotification;
use App\Payments\InvoiceService;
use Illuminate\Support\Facades\DB;

/**
 * Buying flexible passes and memberships. Each purchase covers one period from when it's paid.
 * A renewal is a new purchase linked to the current one; it starts when the current one ends.
 */
class PlanService
{
    public function __construct(private InvoiceService $invoices, private BookingService $bookings, private MailboxService $mailboxes) {}

    /**
     * Creates the pass (waiting for payment) and its invoice.
     */
    public function buyPass(User $customer, PassPlan $plan, ?CustomerPass $renewalOf = null): CustomerPass
    {
        // Renewing an existing plan doesn't depend on whether new bookings are taken on this site.
        if (! $renewalOf) {
            $this->bookings->assertOpen();
        }
        abort_unless($plan->is_active, 422, 'This pass is not available right now.');
        $plan->loadMissing('spaceTypes');

        return DB::transaction(function () use ($customer, $plan, $renewalOf) {
            $pass = CustomerPass::create([
                'user_id' => $customer->id,
                'pass_plan_id' => $plan->id,
                'name' => $plan->name,
                'credit_type' => $plan->credit_type,
                'credits' => $plan->credits,
                'period' => $plan->period,
                'location_id' => $plan->location_id,
                'space_type_ids' => $plan->spaceTypes->pluck('id')->all(),
                'status' => CustomerPass::PENDING,
                'renewal_of_id' => $renewalOf?->id,
                'auto_renew' => $renewalOf->auto_renew ?? false,
            ]);

            $invoice = $this->invoices->create($customer, [['description' => "{$plan->name} pass (".$plan->allowanceLabel().')'.($renewalOf ? ' renewal' : ''), 'quantity' => 1, 'unit_amount' => $plan->price]], $this->dueDate($renewalOf), $renewalOf ? 'Pass renewal' : 'Flexible pass', null, notify: false);
            $invoice->source()->associate($pass)->save();
            $pass->update(['invoice_id' => $invoice->id]);

            return $pass->refresh();
        });
    }

    public function buyMembership(User $customer, MembershipPlan $plan, ?CustomerMembership $renewalOf = null): CustomerMembership
    {
        if (! $renewalOf) {
            $this->bookings->assertOpen();
        }
        abort_unless($plan->is_active, 422, 'This membership is not available right now.');

        return DB::transaction(function () use ($customer, $plan, $renewalOf) {
            $membership = CustomerMembership::create([
                'user_id' => $customer->id,
                'membership_plan_id' => $plan->id,
                'name' => $plan->name,
                'discount_percent' => $plan->booking_discount_percent,
                'billing_period' => $plan->billing_period,
                'status' => CustomerMembership::PENDING,
                'renewal_of_id' => $renewalOf?->id,
                'auto_renew' => $renewalOf->auto_renew ?? false,
            ]);

            $invoice = $this->invoices->create($customer, [['description' => "{$plan->name} membership (1 {$plan->billing_period})".($renewalOf ? ' renewal' : ''), 'quantity' => 1, 'unit_amount' => $plan->price]], $this->dueDate($renewalOf), $renewalOf ? 'Membership renewal' : 'Membership', null, notify: false);
            $invoice->source()->associate($membership)->save();
            $membership->update(['invoice_id' => $invoice->id]);

            return $membership->refresh();
        });
    }

    /**
     * A renewal is due when the current period ends; a new purchase is due today.
     */
    private function dueDate(CustomerPass|CustomerMembership|null $renewalOf): string
    {
        return ($renewalOf?->ends_at && $renewalOf->ends_at->isFuture() ? $renewalOf->ends_at : now())
            ->timezone((string) config('app.display_timezone'))->toDateString();
    }

    /**
     * Paid: the period starts now, or for a renewal paid early, when the current period ends.
     */
    public function activate(CustomerPass|CustomerMembership $plan): void
    {
        if ($plan->status !== CustomerPass::PENDING) {
            return;
        }

        $plan->loadMissing('renewalOf');
        $previousEnd = $plan->renewalOf?->ends_at;
        $startsAt = $previousEnd && $previousEnd->isFuture() ? $previousEnd->copy() : now();
        $endsAt = $plan->periodEndFrom($startsAt);
        $plan->update(['status' => CustomerPass::ACTIVE, 'starts_at' => $startsAt, 'ends_at' => $endsAt, 'renewal_failure' => null]);
        if ($plan instanceof CustomerMembership) {
            // Virtual office plans open (or extend) the member's mailbox.
            $this->mailboxes->openForMembership($plan);
        }

        $plan->loadMissing('user');
        $plan->user->notify(new PlanNotification($plan instanceof CustomerPass ? EmailTemplateKey::PassActivated : EmailTemplateKey::MembershipActivated, $plan));
    }

    /**
     * Ends passes and memberships whose period is over.
     */
    public function expireEnded(): int
    {
        return CustomerPass::where('status', CustomerPass::ACTIVE)->where('ends_at', '<=', now())->update(['status' => CustomerPass::EXPIRED, 'updated_at' => now()])
            + CustomerMembership::where('status', CustomerMembership::ACTIVE)->where('ends_at', '<=', now())->update(['status' => CustomerMembership::EXPIRED, 'updated_at' => now()]);
    }
}
