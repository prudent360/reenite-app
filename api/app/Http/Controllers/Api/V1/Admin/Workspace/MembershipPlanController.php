<?php

namespace App\Http\Controllers\Api\V1\Admin\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Workspace\MembershipPlanRequest;
use App\Http\Resources\MembershipPlanResource;
use App\Models\MembershipPlan;
use App\Support\Slug;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class MembershipPlanController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return MembershipPlanResource::collection(MembershipPlan::ordered()->get());
    }

    public function store(MembershipPlanRequest $request): JsonResponse
    {
        return (new MembershipPlanResource(MembershipPlan::create($this->data($request))))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function update(MembershipPlanRequest $request, MembershipPlan $membershipPlan): MembershipPlanResource
    {
        $membershipPlan->update($this->data($request, $membershipPlan));

        return new MembershipPlanResource($membershipPlan);
    }

    /**
     * Members on this plan (Milestone 6) will block this; hide the plan instead.
     */
    public function destroy(MembershipPlan $membershipPlan): Response
    {
        $membershipPlan->delete();

        return response()->noContent();
    }

    /**
     * @return array<string, mixed>
     */
    private function data(MembershipPlanRequest $request, ?MembershipPlan $plan = null): array
    {
        $data = $request->validated();
        $data['slug'] = Slug::unique(MembershipPlan::class, $data['slug'] ?? $data['name'], $plan?->id);
        $data['perks'] = array_values(array_filter($data['perks'] ?? []));

        return $data;
    }
}
