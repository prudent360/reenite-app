<?php

namespace App\Http\Controllers\Api\V1\Admin\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Workspace\LocationRequest;
use App\Http\Resources\LocationResource;
use App\Models\Location;
use App\Support\Slug;
use App\Workspace\OpeningHours;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class LocationController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return LocationResource::collection(Location::ordered()->withCount('spaces')->get());
    }

    public function store(LocationRequest $request): JsonResponse
    {
        $location = Location::create($this->data($request));

        return (new LocationResource($location->loadCount('spaces')))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Location $location): LocationResource
    {
        return new LocationResource($location->load(['spaces.type', 'spaces.rates'])->loadCount('spaces'));
    }

    public function update(LocationRequest $request, Location $location): LocationResource
    {
        $location->update($this->data($request, $location));

        return new LocationResource($location->loadCount('spaces'));
    }

    /**
     * Locations with spaces can't be deleted; hide them instead so history stays intact.
     */
    public function destroy(Location $location): Response
    {
        abort_if($location->spaces()->exists(), 422, 'Delete or move the spaces at this location first, or hide the location instead.');

        $location->delete();

        return response()->noContent();
    }

    /**
     * @return array<string, mixed>
     */
    private function data(LocationRequest $request, ?Location $location = null): array
    {
        $data = $request->validated();
        $data['slug'] = Slug::unique(Location::class, $data['slug'] ?? $data['name'], $location?->id);
        $data['hours'] = OpeningHours::normalise($data['hours']);
        $data['amenities'] = array_values(array_filter($data['amenities'] ?? []));

        return $data;
    }
}
