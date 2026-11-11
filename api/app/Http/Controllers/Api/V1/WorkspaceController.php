<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\LocationResource;
use App\Http\Resources\MembershipPlanResource;
use App\Http\Resources\PassPlanResource;
use App\Http\Resources\SpaceResource;
use App\Models\Location;
use App\Models\MembershipPlan;
use App\Models\PassPlan;
use App\Models\Space;
use App\Models\SpaceRate;
use App\Workspace\Availability;
use App\Workspace\BookingService;
use App\Workspace\SeatPlanner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * What customers and guests can book: active locations and spaces with their prices.
 */
class WorkspaceController extends Controller
{
    public function index(): JsonResponse
    {
        $locations = Location::active()->ordered()
            ->with(['spaces' => fn ($query) => $query->active()->ordered()->whereHas('type', fn ($type) => $type->where('is_active', true))
                ->with(['type', 'rates' => fn ($rates) => $rates->where('is_active', true)])])
            ->get();

        return response()->json([
            'locations' => LocationResource::collection($locations),
            'pass_plans' => PassPlanResource::collection(PassPlan::ordered()->where('is_active', true)->with(['location', 'spaceTypes'])->get()),
            'memberships' => MembershipPlanResource::collection(MembershipPlan::ordered()->with('mailboxLocation')->where('is_active', true)->get()),
        ]);
    }

    public function space(string $slug): SpaceResource
    {
        $space = Space::active()
            ->where('slug', $slug)
            ->whereHas('location', fn ($query) => $query->where('is_active', true))
            ->with(['location', 'type', 'cancellationPolicy', 'rates' => fn ($rates) => $rates->where('is_active', true), 'addons' => fn ($addons) => $addons->where('is_active', true)])
            ->firstOrFail();

        return new SpaceResource($space);
    }

    /**
     * Where "Book a space" should go: this site, or the separate booking site.
     */
    public function bookingSettings(BookingService $bookings): JsonResponse
    {
        return response()->json([
            'destination' => $bookings->isOpen() ? BookingService::DESTINATION_INTERNAL : BookingService::DESTINATION_EXTERNAL,
            'external_url' => $bookings->externalUrl(),
        ]);
    }

    /**
     * The seats of a hot desk for a chosen time, free or taken. Spaces without named seats return none.
     */
    public function seats(Request $request, Availability $availability, SeatPlanner $seatPlanner, string $slug): JsonResponse
    {
        $validated = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'rate_unit' => ['required', 'string', Rule::in(SpaceRate::UNITS)],
            'quantity' => ['required', 'integer', 'min:1', 'max:90'],
        ]);

        $space = Space::active()
            ->where('slug', $slug)
            ->whereHas('location', fn ($query) => $query->where('is_active', true))
            ->with(['location', 'type'])
            ->firstOrFail();

        if (! $seatPlanner->usesSeats($space)) {
            return response()->json(['data' => ['seats' => [], 'free' => null]]);
        }

        [$startsAt, $endsAt] = $availability->window($space, $validated['date'], $validated['rate_unit'], (int) $validated['quantity'], $validated['start_time'] ?? null);

        return response()->json(['data' => $seatPlanner->seatMap($space, $startsAt, $endsAt)]);
    }

    /**
     * Opening hours and free start times for one day, so the booking form only offers times that work.
     */
    public function availability(Request $request, Availability $availability, string $slug): JsonResponse
    {
        $validated = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'seats' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);

        $space = Space::active()
            ->where('slug', $slug)
            ->whereHas('location', fn ($query) => $query->where('is_active', true))
            ->with(['location', 'type'])
            ->firstOrFail();

        return response()->json(['data' => $availability->day($space, $validated['date'], (int) ($validated['seats'] ?? 1))]);
    }
}
