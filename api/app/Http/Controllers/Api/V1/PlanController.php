<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CustomerMembership;
use App\Models\CustomerPass;
use App\Models\MembershipPlan;
use App\Models\PassPlan;
use App\Models\PaymentMethod;
use App\Workspace\PlanService;
use App\Workspace\RenewalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

/**
 * The signed-in customer's passes and memberships, and buying new ones. Buying creates an
 * invoice; the plan starts once it's paid.
 */
class PlanController extends Controller
{
    public function __construct(private PlanService $plans, private RenewalService $renewals) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $card = $this->renewals->cardFor($user);
        // Current plans, new ones waiting for payment, and ones that ended recently (they can still be renewed).
        // A renewal shows on its own once it has started; until then it shows under the plan it renews.
        $visible = fn ($query) => $query->whereNull('renewal_of_id')->orWhere(fn ($started) => $started->where('status', CustomerPass::ACTIVE)->where('starts_at', '<=', now()));
        $recent = fn ($query) => $query->whereIn('status', [CustomerPass::ACTIVE, CustomerPass::PENDING])
            ->orWhere(fn ($ended) => $ended->where('status', CustomerPass::EXPIRED)->where('ends_at', '>', now()->subDays(RenewalService::ABANDON_DAYS)));
        $load = ['invoice', 'plan', 'renewal.invoice'];

        $passes = $user->passes()->where($recent)->where($visible)->with($load)->latest('id')->get();
        $memberships = $user->memberships()->where($recent)->where($visible)->with($load)->latest('id')->get();

        return response()->json([
            'passes' => $passes->reject(fn (CustomerPass $pass) => $this->supersededBy($pass, $passes))->values()
                ->map(fn (CustomerPass $pass) => $this->planData($pass, $card) + [
                    'credit_type' => $pass->credit_type,
                    'credits' => $pass->credits,
                    'credits_left' => $pass->creditsLeft(),
                    'period' => $pass->period,
                ]),
            'memberships' => $memberships->reject(fn (CustomerMembership $membership) => $this->supersededBy($membership, $memberships))->values()
                ->map(fn (CustomerMembership $membership) => $this->planData($membership, $card) + [
                    'discount_percent' => $membership->discount_percent,
                    'billing_period' => $membership->billing_period,
                ]),
            'card' => $card ? ['id' => $card->id, 'label' => $card->label()] : null,
        ]);
    }

    /**
     * Customers switch automatic renewal on or off. Turning it on resets the attempt count.
     */
    public function autoRenew(Request $request, string $kind, int $id): JsonResponse
    {
        $plan = $this->ownedPlan($request, $kind, $id);
        $validated = $request->validate(['auto_renew' => ['required', 'boolean']]);
        $plan->update($validated['auto_renew'] ? ['auto_renew' => true, 'renewal_attempts' => 0, 'renewal_failure' => null] : ['auto_renew' => false]);
        $plan->renewal()->where('status', CustomerPass::PENDING)->update(['auto_renew' => $validated['auto_renew']]);
        $card = $this->renewals->cardFor($request->user());

        return response()->json(['message' => match (true) {
            ! $validated['auto_renew'] => "Automatic renewal is off. We'll remind you before it ends.",
            $card !== null => "Automatic renewal is on. We'll charge your {$card->label()} the day before it ends.",
            default => 'Automatic renewal is on. Save a card on your next payment (tick "Save this card"), or we will email you a pay link instead.',
        }]);
    }

    /**
     * Renew now: creates (or reuses) the next period's invoice for the customer to pay.
     */
    public function renew(Request $request, string $kind, int $id): JsonResponse
    {
        $renewal = $this->renewals->startRenewal($this->ownedPlan($request, $kind, $id));

        return response()->json(['invoice_id' => $renewal->invoice_id], Response::HTTP_CREATED);
    }

    private function ownedPlan(Request $request, string $kind, int $id): CustomerPass|CustomerMembership
    {
        $relation = match ($kind) {
            'passes' => $request->user()->passes(),
            'memberships' => $request->user()->memberships(),
            default => abort(404),
        };

        return $relation->whereKey($id)->firstOrFail();
    }

    /**
     * An ended plan that has since been renewed is shown through its renewal instead.
     *
     * @param  Collection<int, CustomerPass|CustomerMembership>  $all
     */
    private function supersededBy(CustomerPass|CustomerMembership $plan, $all): bool
    {
        return $plan->status === CustomerPass::EXPIRED && $all->contains(fn ($other) => $other->renewal_of_id === $plan->id);
    }

    /**
     * @return array<string, mixed>
     */
    private function planData(CustomerPass|CustomerMembership $plan, ?PaymentMethod $card): array
    {
        $renewal = $plan->renewal && in_array($plan->renewal->status, [CustomerPass::PENDING, CustomerPass::ACTIVE], true) ? $plan->renewal : null;

        return [
            'id' => $plan->id,
            'name' => $plan->name,
            'status' => $plan->status,
            'starts_at' => $plan->starts_at?->toIso8601String(),
            'ends_at' => $plan->ends_at?->toIso8601String(),
            'invoice_id' => $plan->invoice_id,
            'invoice_payable' => (bool) $plan->invoice?->isPayable(),
            'is_renewal' => $plan->renewal_of_id !== null,
            'auto_renew' => $plan->auto_renew,
            'renewal_price' => $plan->plan?->is_active ? $plan->plan->price : null,
            'renewal_failure' => $plan->renewal_failure,
            // What happens when it ends: renews with the saved card, waits for the customer, or nothing (plan no longer offered).
            'renewal_mode' => match (true) {
                ! $plan->plan?->is_active => 'unavailable',
                $plan->auto_renew && $card !== null => 'card',
                default => 'manual',
            },
            'renewal' => $renewal ? [
                'id' => $renewal->id,
                'status' => $renewal->status,
                'starts_at' => $renewal->starts_at?->toIso8601String(),
                'invoice_id' => $renewal->invoice_id,
                'invoice_payable' => (bool) $renewal->invoice?->isPayable(),
            ] : null,
        ];
    }

    public function buyPass(Request $request): JsonResponse
    {
        $validated = $request->validate(['pass_plan_id' => ['required', 'integer', Rule::exists('pass_plans', 'id')->where('is_active', true)]]);
        $pass = $this->plans->buyPass($request->user(), PassPlan::findOrFail($validated['pass_plan_id']));

        return response()->json(['invoice_id' => $pass->invoice_id], Response::HTTP_CREATED);
    }

    public function buyMembership(Request $request): JsonResponse
    {
        $validated = $request->validate(['membership_plan_id' => ['required', 'integer', Rule::exists('membership_plans', 'id')->where('is_active', true)]]);
        $membership = $this->plans->buyMembership($request->user(), MembershipPlan::findOrFail($validated['membership_plan_id']));

        return response()->json(['invoice_id' => $membership->invoice_id], Response::HTTP_CREATED);
    }
}
