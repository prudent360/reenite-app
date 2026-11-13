<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Location;
use App\Models\User;
use App\Workspace\BookingService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Self check-in from the QR poster at a location's reception. The private token in the poster's
 * link is the location; signed-in customers pick their booking, everyone else types the code
 * from their confirmation.
 */
class SelfCheckInController extends Controller
{
    public function __construct(private BookingService $bookings) {}

    public function show(Request $request, string $token): JsonResponse
    {
        $location = $this->location($token);
        $customer = $this->customer($request);

        $bookings = $customer
            ? $this->atLocation($location)
                ->where('user_id', $customer->id)
                ->whereIn('status', [BookingStatus::Confirmed->value, BookingStatus::CheckedIn->value])
                ->where('ends_at', '>', now())
                ->where('starts_at', '<=', now()->addHours(12))
                ->with('assignedSeats')
                ->orderBy('starts_at')
                ->get()
                ->map(fn (Booking $booking) => $this->summary($booking))
                ->all()
            : [];

        return response()->json(['data' => [
            'location' => ['name' => $location->name, 'address' => $location->address, 'city' => $location->city],
            'signed_in' => $customer !== null,
            'customer_name' => $customer?->name,
            'opens_minutes_before' => BookingService::SELF_CHECK_IN_MINUTES,
            'bookings' => $bookings,
        ]]);
    }

    /**
     * Checks in by booking reference (signed-in owner) or by the code from the confirmation.
     */
    public function store(Request $request, string $token): JsonResponse
    {
        $location = $this->location($token);
        $validated = $request->validate([
            'reference' => ['required_without:code', 'nullable', 'string', 'max:30'],
            'code' => ['required_without:reference', 'nullable', 'string', 'max:12'],
        ]);

        $customer = $this->customer($request);
        $booking = filled($validated['reference'] ?? null) && $customer
            ? $this->atLocation($location)->where('user_id', $customer->id)->where('reference', $validated['reference'])->first()
            : $this->atLocation($location)->where('check_in_code', mb_strtoupper(trim((string) ($validated['code'] ?? ''))))->first();

        if (! $booking) {
            throw ValidationException::withMessages(['code' => "We couldn't find a booking with that code at {$location->name}. Check your confirmation, or ask at the front desk."]);
        }

        $this->bookings->selfCheckIn($booking);

        return response()->json([
            'data' => $this->summary($booking->load('assignedSeats')),
            'message' => "You're checked in. Welcome to {$location->name}.",
        ]);
    }

    private function location(string $token): Location
    {
        $location = Location::query()->where('check_in_token', $token)->where('is_active', true)->first();
        abort_unless($location && $location->self_check_in, 404, "Self check-in isn't available here. Please check in at the front desk.");

        return $location;
    }

    /**
     * @return Builder<Booking>
     */
    private function atLocation(Location $location): Builder
    {
        return Booking::query()->whereHas('space', fn (Builder $space) => $space->where('location_id', $location->id));
    }

    private function customer(Request $request): ?User
    {
        $user = $request->user('sanctum');

        return $user instanceof User ? $user : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(Booking $booking): array
    {
        $opensAt = $booking->starts_at->copy()->subMinutes(BookingService::SELF_CHECK_IN_MINUTES);

        return [
            'reference' => $booking->reference,
            'space_name' => $booking->space_name,
            'seats' => $booking->assignedSeats->pluck('label')->all(),
            'people' => $booking->seats,
            'status' => $booking->status->value,
            'starts_at' => $booking->starts_at->toIso8601String(),
            'ends_at' => $booking->ends_at->toIso8601String(),
            'checked_in_at' => $booking->checked_in_at?->toIso8601String(),
            'opens_at' => $opensAt->toIso8601String(),
            'can_check_in' => $booking->status === BookingStatus::Confirmed && $opensAt->isPast() && $booking->ends_at->isFuture(),
        ];
    }
}
