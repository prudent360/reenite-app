<?php

namespace App\Http\Controllers\Api\V1\Admin\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Workspace\CancellationPolicyRequest;
use App\Http\Resources\CancellationPolicyResource;
use App\Models\CancellationPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class CancellationPolicyController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return CancellationPolicyResource::collection(CancellationPolicy::withCount('spaces')->orderByDesc('is_default')->orderBy('name')->get());
    }

    public function store(CancellationPolicyRequest $request): JsonResponse
    {
        $policy = $this->save(new CancellationPolicy, $request->validated());

        return (new CancellationPolicyResource($policy))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function update(CancellationPolicyRequest $request, CancellationPolicy $cancellationPolicy): CancellationPolicyResource
    {
        return new CancellationPolicyResource($this->save($cancellationPolicy, $request->validated()));
    }

    /**
     * Spaces on this policy fall back to the default policy.
     */
    public function destroy(CancellationPolicy $cancellationPolicy): Response
    {
        abort_if($cancellationPolicy->is_default, 422, 'Make another policy the default before deleting this one.');

        $cancellationPolicy->delete();

        return response()->noContent();
    }

    /**
     * Only one policy can be the default for new spaces.
     *
     * @param  array<string, mixed>  $data
     */
    private function save(CancellationPolicy $policy, array $data): CancellationPolicy
    {
        $data['rules'] = collect($data['rules'])
            ->map(fn (array $rule) => ['hours_before' => (int) $rule['hours_before'], 'refund_percent' => (int) $rule['refund_percent']])
            ->sortByDesc('hours_before')
            ->values()
            ->all();

        DB::transaction(function () use ($policy, $data) {
            if ($data['is_default'] ?? false) {
                CancellationPolicy::whereKeyNot($policy->id ?? 0)->update(['is_default' => false]);
            }
            $policy->fill($data)->save();
        });

        return $policy->loadCount('spaces');
    }
}
