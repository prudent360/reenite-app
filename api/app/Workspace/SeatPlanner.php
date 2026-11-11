<?php

namespace App\Workspace;

use App\Models\Booking;
use App\Models\Space;
use App\Models\SpaceSeat;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Named seats in shared spaces (hot desks). A shared space with active seats gives every
 * booking its own seats: the ones the customer picked, or the first free ones ("any seat").
 * Bookings made before seats were set up have no seats, but still take up places, so they
 * count against the free seats.
 */
class SeatPlanner
{
    /**
     * True when customers can (and bookings do) get named seats in this space.
     */
    public function usesSeats(Space $space): bool
    {
        $space->loadMissing('type');

        return $space->isShared() && $space->seats()->where('is_active', true)->exists();
    }

    /**
     * Every active seat with whether it's free for the whole of the given time.
     *
     * @return array{seats: list<array{id: int, label: string, zone: string|null, available: bool}>, free: int}
     */
    public function seatMap(Space $space, CarbonImmutable $startsAt, CarbonImmutable $endsAt, ?int $ignoreBookingId = null): array
    {
        $taken = $this->takenSeatIds($space, $startsAt, $endsAt, $ignoreBookingId);
        $seats = $this->activeSeats($space)->map(fn (SpaceSeat $seat) => [
            'id' => $seat->id,
            'label' => $seat->label,
            'zone' => $seat->zone,
            'available' => ! $taken->contains($seat->id),
        ])->values()->all();

        return ['seats' => $seats, 'free' => $this->freeCount($space, $startsAt, $endsAt, $ignoreBookingId)];
    }

    /**
     * How many more people fit: active seats, minus seats taken, minus places held by
     * overlapping bookings that never got a seat.
     */
    public function freeCount(Space $space, CarbonImmutable $startsAt, CarbonImmutable $endsAt, ?int $ignoreBookingId = null): int
    {
        $active = $this->activeSeats($space)->pluck('id');
        $taken = $this->takenSeatIds($space, $startsAt, $endsAt, $ignoreBookingId)->intersect($active)->count();
        $unseated = (int) $this->overlapping($space, $startsAt, $endsAt, $ignoreBookingId)->whereDoesntHave('assignedSeats')->sum('seats');

        return max(0, $active->count() - $taken - $unseated);
    }

    /**
     * Checks the seats a customer picked: one per person, all in this space, switched on and free.
     *
     * @param  list<int>  $seatIds
     */
    public function assertChoice(Space $space, CarbonImmutable $startsAt, CarbonImmutable $endsAt, array $seatIds, int $people, ?int $ignoreBookingId = null): void
    {
        $fail = fn (string $message) => throw ValidationException::withMessages(['seat_ids' => $message]);
        $seatIds = array_values(array_unique(array_map('intval', $seatIds)));

        if (! $this->usesSeats($space)) {
            $fail("{$space->name} doesn't have seats to choose from.");
        }
        if (count($seatIds) !== $people) {
            $fail($people === 1 ? 'Choose one seat.' : "Choose {$people} seats, one for each person.");
        }

        $valid = $this->activeSeats($space)->pluck('id');
        if (array_diff($seatIds, $valid->all()) !== []) {
            $fail('One of those seats is no longer available. Please choose again.');
        }

        $taken = $this->takenSeatIds($space, $startsAt, $endsAt, $ignoreBookingId);
        $clash = $this->activeSeats($space)->whereIn('id', $seatIds)->first(fn (SpaceSeat $seat) => $taken->contains($seat->id));
        if ($clash) {
            $fail("{$clash->label} has just been booked for that time. Please choose another seat.");
        }
    }

    /**
     * Gives a new booking its seats: the chosen ones, or the first free ones when none were chosen.
     * Call inside the transaction that locks the space, after the booking passed availability.
     *
     * @param  list<int>  $seatIds
     */
    public function assign(Booking $booking, Space $space, array $seatIds = []): void
    {
        if (! $this->usesSeats($space)) {
            return;
        }

        $startsAt = CarbonImmutable::instance($booking->starts_at);
        $endsAt = CarbonImmutable::instance($booking->ends_at);
        $ids = $seatIds !== []
            ? array_values(array_unique(array_map('intval', $seatIds)))
            : $this->firstFree($space, $startsAt, $endsAt, $booking->seats, $booking->id);

        $booking->assignedSeats()->sync($ids);
    }

    /**
     * A booking paid after its hold ran out keeps its seats if they're still free, and otherwise
     * moves to other free seats. Returns false when there aren't enough free seats left.
     */
    public function reclaim(Booking $booking, Space $space): bool
    {
        if (! $this->usesSeats($space)) {
            return true;
        }

        $startsAt = CarbonImmutable::instance($booking->starts_at);
        $endsAt = CarbonImmutable::instance($booking->ends_at);
        $taken = $this->takenSeatIds($space, $startsAt, $endsAt, $booking->id);
        $active = $this->activeSeats($space)->pluck('id');
        $current = $booking->assignedSeats()->pluck('space_seats.id');

        if ($current->count() === $booking->seats && $current->every(fn (int $id) => $active->contains($id) && ! $taken->contains($id))) {
            return true;
        }

        $free = $this->firstFree($space, $startsAt, $endsAt, $booking->seats, $booking->id);
        if (count($free) < $booking->seats) {
            return false;
        }
        $booking->assignedSeats()->sync($free);

        return true;
    }

    /**
     * Staff moving a booking to different seats.
     *
     * @param  list<int>  $seatIds
     */
    public function move(Booking $booking, array $seatIds): void
    {
        $space = $booking->space()->with('type')->firstOrFail();
        $startsAt = CarbonImmutable::instance($booking->starts_at);
        $endsAt = CarbonImmutable::instance($booking->ends_at);

        $this->assertChoice($space, $startsAt, $endsAt, $seatIds, $booking->seats, $booking->id);
        $booking->assignedSeats()->sync(array_values(array_unique(array_map('intval', $seatIds))));
    }

    /**
     * @return list<int>
     */
    private function firstFree(Space $space, CarbonImmutable $startsAt, CarbonImmutable $endsAt, int $count, ?int $ignoreBookingId): array
    {
        $taken = $this->takenSeatIds($space, $startsAt, $endsAt, $ignoreBookingId);

        return $this->activeSeats($space)
            ->reject(fn (SpaceSeat $seat) => $taken->contains($seat->id))
            ->take($count)
            ->pluck('id')
            ->all();
    }

    /**
     * @return Collection<int, SpaceSeat>
     */
    private function activeSeats(Space $space): Collection
    {
        return $space->seats()->where('is_active', true)->orderBy('sort_order')->orderBy('id')->get();
    }

    /**
     * @return Collection<int, int>
     */
    private function takenSeatIds(Space $space, CarbonImmutable $startsAt, CarbonImmutable $endsAt, ?int $ignoreBookingId): Collection
    {
        return SpaceSeat::query()
            ->where('space_id', $space->id)
            ->whereHas('bookings', fn ($bookings) => $bookings
                ->when($ignoreBookingId, fn ($query) => $query->whereKeyNot($ignoreBookingId))
                ->occupying()
                ->overlapping($startsAt, $endsAt))
            ->pluck('id');
    }

    /**
     * @return Builder<Booking>
     */
    private function overlapping(Space $space, CarbonImmutable $startsAt, CarbonImmutable $endsAt, ?int $ignoreBookingId)
    {
        return Booking::query()
            ->where('space_id', $space->id)
            ->when($ignoreBookingId, fn ($query) => $query->whereKeyNot($ignoreBookingId))
            ->occupying()
            ->overlapping($startsAt, $endsAt);
    }
}
