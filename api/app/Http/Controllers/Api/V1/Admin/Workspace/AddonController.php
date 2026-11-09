<?php

namespace App\Http\Controllers\Api\V1\Admin\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Workspace\AddonRequest;
use App\Http\Resources\AddonResource;
use App\Models\Addon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class AddonController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return AddonResource::collection(Addon::ordered()->with('spaces:id')->get());
    }

    public function store(AddonRequest $request): JsonResponse
    {
        return (new AddonResource($this->save(new Addon, $request->validated())))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function update(AddonRequest $request, Addon $addon): AddonResource
    {
        return new AddonResource($this->save($addon, $request->validated()));
    }

    public function destroy(Addon $addon): Response
    {
        $addon->delete();

        return response()->noContent();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function save(Addon $addon, array $data): Addon
    {
        DB::transaction(function () use ($addon, $data) {
            $addon->fill(Arr::except($data, 'space_ids'))->save();
            $addon->spaces()->sync($data['space_ids'] ?? []);
        });

        return $addon->load('spaces:id');
    }
}
