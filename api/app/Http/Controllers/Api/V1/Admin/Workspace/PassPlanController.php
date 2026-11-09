<?php

namespace App\Http\Controllers\Api\V1\Admin\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Workspace\PassPlanRequest;
use App\Http\Resources\PassPlanResource;
use App\Models\PassPlan;
use App\Support\Slug;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class PassPlanController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return PassPlanResource::collection(PassPlan::ordered()->with(['location', 'spaceTypes'])->get());
    }

    public function store(PassPlanRequest $request): JsonResponse
    {
        return (new PassPlanResource($this->save(new PassPlan, $request->validated())))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function update(PassPlanRequest $request, PassPlan $passPlan): PassPlanResource
    {
        return new PassPlanResource($this->save($passPlan, $request->validated()));
    }

    /**
     * Passes customers have bought (Milestone 6) will block this; hide the plan instead.
     */
    public function destroy(PassPlan $passPlan): Response
    {
        $passPlan->delete();

        return response()->noContent();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function save(PassPlan $plan, array $data): PassPlan
    {
        $data['slug'] = Slug::unique(PassPlan::class, $data['slug'] ?? $data['name'], $plan->id);

        DB::transaction(function () use ($plan, $data) {
            $plan->fill(Arr::except($data, 'space_type_ids'))->save();
            $plan->spaceTypes()->sync($data['space_type_ids']);
        });

        return $plan->load(['location', 'spaceTypes']);
    }
}
