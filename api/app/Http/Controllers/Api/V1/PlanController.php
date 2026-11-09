<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CustomerMembership;
use App\Models\CustomerPass;
use App\Models\MembershipPlan;
use App\Models\PassPlan;
use App\Workspace\PlanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/**
 * The signed-in customer's passes and memberships, and buying new ones. Buying creates an
 * invoice; the plan starts once it's paid.
 */
class PlanController extends Controller
{
    public function __construct(private PlanService $plans) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'passes' => $user->passes()->whereIn('status', [CustomerPass::ACTIVE, CustomerPass::PENDING])->with('invoice')->latest('id')->get()
                ->map(fn (CustomerPass $pass) => [
                    'id' => $pass->id,
                    'name' => $pass->name,
                    'status' => $pass->status,
                    'credit_type' => $pass->credit_type,
                    'credits' => $pass->credits,
                    'credits_left' => $pass->creditsLeft(),
                    'period' => $pass->period,
                    'starts_at' => $pass->starts_at?->toIso8601String(),
                    'ends_at' => $pass->ends_at?->toIso8601String(),
                    'invoice_id' => $pass->invoice_id,
                    'invoice_payable' => (bool) $pass->invoice?->isPayable(),
                ]),
            'memberships' => $user->memberships()->whereIn('status', [CustomerMembership::ACTIVE, CustomerMembership::PENDING])->with('invoice')->latest('id')->get()
                ->map(fn (CustomerMembership $membership) => [
                    'id' => $membership->id,
                    'name' => $membership->name,
                    'status' => $membership->status,
                    'discount_percent' => $membership->discount_percent,
                    'billing_period' => $membership->billing_period,
                    'starts_at' => $membership->starts_at?->toIso8601String(),
                    'ends_at' => $membership->ends_at?->toIso8601String(),
                    'invoice_id' => $membership->invoice_id,
                    'invoice_payable' => (bool) $membership->invoice?->isPayable(),
                ]),
        ]);
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
