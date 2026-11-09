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
 * Buying flexible passes and memberships. Each purchase covers one period from when it's paid;
 * customers buy again to renew.
 */
class PlanService
{
    public function __construct(private InvoiceService $invoices, private BookingService $bookings) {}

    /**
     * Creates the pass (waiting for payment) and its invoice.
     */
    public function buyPass(User $customer, PassPlan $plan): CustomerPass
    {
        $this->bookings->assertOpen();
        abort_unless($plan->is_active, 422, 'This pass is not available right now.');
        $plan->loadMissing('spaceTypes');

        return DB::transaction(function () use ($customer, $plan) {
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
            ]);

            $invoice = $this->invoices->create($customer, [['description' => "{$plan->name} pass (".$plan->allowanceLabel().')', 'quantity' => 1, 'unit_amount' => $plan->price]], now()->toDateString(), 'Flexible pass', null, notify: false);
            $invoice->source()->associate($pass)->save();
            $pass->update(['invoice_id' => $invoice->id]);

            return $pass->refresh();
        });
    }

    public function buyMembership(User $customer, MembershipPlan $plan): CustomerMembership
    {
        $this->bookings->assertOpen();
        abort_unless($plan->is_active, 422, 'This membership is not available right now.');

        return DB::transaction(function () use ($customer, $plan) {
            $membership = CustomerMembership::create([
                'user_id' => $customer->id,
                'membership_plan_id' => $plan->id,
                'name' => $plan->name,
                'discount_percent' => $plan->booking_discount_percent,
                'billing_period' => $plan->billing_period,
                'status' => CustomerMembership::PENDING,
            ]);

            $invoice = $this->invoices->create($customer, [['description' => "{$plan->name} membership (1 {$plan->billing_period})", 'quantity' => 1, 'unit_amount' => $plan->price]], now()->toDateString(), 'Membership', null, notify: false);
            $invoice->source()->associate($membership)->save();
            $membership->update(['invoice_id' => $invoice->id]);

            return $membership->refresh();
        });
    }

    /**
     * Paid: the period starts now.
     */
    public function activate(CustomerPass|CustomerMembership $plan): void
    {
        if ($plan->status !== CustomerPass::PENDING) {
            return;
        }

        $startsAt = now();
        $endsAt = match ($plan instanceof CustomerPass ? $plan->period : $plan->billing_period) {
            'week' => $startsAt->copy()->addWeek(),
            'quarter' => $startsAt->copy()->addMonthsNoOverflow(3),
            'year' => $startsAt->copy()->addYearNoOverflow(),
            default => $startsAt->copy()->addMonthNoOverflow(),
        };
        $plan->update(['status' => CustomerPass::ACTIVE, 'starts_at' => $startsAt, 'ends_at' => $endsAt]);

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
