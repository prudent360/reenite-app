<?php

namespace App\Http\Controllers\Api\V1\Admin\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Resources\SpaceSeatResource;
use App\Models\Space;
use App\Models\SpaceSeat;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Named seats for shared spaces (hot desks). Customers pick from the active ones when booking.
 */
class SpaceSeatController extends Controller
{
    public function index(Space $space): AnonymousResourceCollection
    {
        return SpaceSeatResource::collection($space->seats()->withCount('bookings')->orderBy('sort_order')->orderBy('id')->get());
    }

    /**
     * Adds a run of numbered seats ("Desk" 1 to 20), carrying on from the highest number already used.
     */
    public function store(Request $request, Space $space): JsonResponse
    {
        $space->loadMissing('type');
        abort_unless($space->isShared(), 422, 'Seats can only be added to shared spaces such as hot desks.');

        $validated = $request->validate([
            'prefix' => ['required', 'string', 'max:30'],
            'count' => ['required', 'integer', 'min:1', 'max:200'],
            'zone' => ['nullable', 'string', 'max:60'],
        ]);

        $prefix = trim($validated['prefix']);
        $existing = $space->seats()->pluck('label');
        $highest = $existing
            ->map(fn (string $label) => preg_match('/^'.preg_quote($prefix, '/').'\s+(\d+)$/i', $label, $match) ? (int) $match[1] : 0)
            ->max() ?? 0;
        $order = (int) $space->seats()->max('sort_order');

        $created = DB::transaction(fn () => collect(range(1, $validated['count']))->map(fn (int $step) => $space->seats()->create([
            'label' => $prefix.' '.($highest + $step),
            'zone' => $validated['zone'] ?? null,
            'sort_order' => $order + $step,
        ])));

        return SpaceSeatResource::collection($created)->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function update(Request $request, Space $space, SpaceSeat $seat): SpaceSeatResource
    {
        $validated = $request->validate([
            'label' => ['sometimes', 'required', 'string', 'max:40', Rule::unique('space_seats', 'label')->where('space_id', $space->id)->ignore($seat->id)],
            'zone' => ['sometimes', 'nullable', 'string', 'max:60'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:100000'],
        ], ['label.unique' => 'Another seat in this space already has that name.']);

        $seat->update($validated);

        return new SpaceSeatResource($seat->loadCount('bookings'));
    }

    /**
     * Seats that have been booked are kept for the booking history; switch them off instead.
     */
    public function destroy(Space $space, SpaceSeat $seat): Response
    {
        if ($seat->bookings()->exists()) {
            throw ValidationException::withMessages(['seat' => "{$seat->label} has bookings, so it can't be deleted. Switch it off instead."]);
        }
        $seat->delete();

        return response()->noContent();
    }
}
