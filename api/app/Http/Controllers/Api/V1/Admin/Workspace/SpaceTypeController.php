<?php

namespace App\Http\Controllers\Api\V1\Admin\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Workspace\SpaceTypeRequest;
use App\Http\Resources\SpaceTypeResource;
use App\Models\SpaceType;
use App\Support\Slug;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class SpaceTypeController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return SpaceTypeResource::collection(SpaceType::ordered()->withCount('spaces')->get());
    }

    public function store(SpaceTypeRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['slug'] = Slug::unique(SpaceType::class, $data['slug'] ?? $data['name']);

        return (new SpaceTypeResource(SpaceType::create($data)->loadCount('spaces')))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function update(SpaceTypeRequest $request, SpaceType $spaceType): SpaceTypeResource
    {
        $data = $request->validated();
        $data['slug'] = Slug::unique(SpaceType::class, $data['slug'] ?? $data['name'], $spaceType->id);
        $spaceType->update($data);

        return new SpaceTypeResource($spaceType->loadCount('spaces'));
    }

    public function destroy(SpaceType $spaceType): Response
    {
        abort_if($spaceType->spaces()->exists(), 422, 'Spaces use this type. Change their type first, or hide it instead.');

        $spaceType->delete();

        return response()->noContent();
    }
}
