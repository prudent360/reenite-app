<?php

namespace App\Http\Controllers\Api\V1\Admin\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Workspace\BlackoutDateRequest;
use App\Http\Resources\BlackoutDateResource;
use App\Models\BlackoutDate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;

class BlackoutDateController extends Controller
{
    /**
     * Upcoming and current closures first; past ones with ?past=1.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $closures = BlackoutDate::query()
            ->with(['location', 'space'])
            ->when($request->boolean('past'), fn ($query) => $query->where('ends_at', '<', now())->latest('starts_at'),
                fn ($query) => $query->where('ends_at', '>=', now())->oldest('starts_at'))
            ->limit(200)
            ->get();

        return BlackoutDateResource::collection($closures);
    }

    public function store(BlackoutDateRequest $request): JsonResponse
    {
        $closure = BlackoutDate::create($this->data($request) + ['created_by' => $request->user()->id]);

        return (new BlackoutDateResource($closure->load(['location', 'space'])))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function update(BlackoutDateRequest $request, BlackoutDate $closure): BlackoutDateResource
    {
        $closure->update($this->data($request));

        return new BlackoutDateResource($closure->load(['location', 'space']));
    }

    public function destroy(BlackoutDate $closure): Response
    {
        $closure->delete();

        return response()->noContent();
    }

    /**
     * Form times are Lagos wall-clock; they're stored in UTC like every other timestamp.
     *
     * @return array<string, mixed>
     */
    private function data(BlackoutDateRequest $request): array
    {
        $zone = (string) config('app.display_timezone');

        return [
            'location_id' => $request->integer('location_id'),
            'space_id' => $request->input('space_id'),
            'starts_at' => Carbon::parse($request->input('starts_at'), $zone)->utc(),
            'ends_at' => Carbon::parse($request->input('ends_at'), $zone)->utc(),
            'reason' => $request->input('reason'),
        ];
    }
}
