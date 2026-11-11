<?php

namespace App\Workspace;

use App\Models\BlackoutDate;
use App\Models\Booking;
use App\Models\Space;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/**
 * Works out when a space can be booked. Times are read in the location's timezone and
 * returned as UTC instants; every rule from the build plan's availability section lives here.
 */
class Availability
{
    /**
     * Start times offered to customers, every half hour.
     */
    public const SLOT_MINUTES = 30;

    public function __construct(private SeatPlanner $seatPlanner) {}

    /**
     * Turns what the customer picked into the start and end of the booking.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public function window(Space $space, string $date, string $rateUnit, int $quantity, ?string $startTime): array
    {
        $space->loadMissing(['location', 'type']);
        $timezone = $this->timezone($space);
        $day = CarbonImmutable::createFromFormat('!Y-m-d', $date, $timezone);
        if ($day === false) {
            throw ValidationException::withMessages(['date' => 'Choose a valid date.']);
        }

        if ($rateUnit === 'hour') {
            if ($startTime === null || ! preg_match('/^\d{2}:\d{2}$/', $startTime)) {
                throw ValidationException::withMessages(['start_time' => 'Choose a start time.']);
            }
            [$hour, $minute] = array_map('intval', explode(':', $startTime));
            $startsAt = $day->setTime($hour, $minute);

            return [$startsAt->utc(), $startsAt->addHours($quantity)->utc()];
        }

        $opening = $this->hoursFor($space, $day);
        if ($opening === null) {
            throw ValidationException::withMessages(['date' => "{$space->name} is closed on ".$day->format('l, j M').'.']);
        }
        // Customers can arrive later than opening on the first day; it still ends at the same time.
        $startsAt = $this->at($day, $opening['opens']);
        if ($startTime !== null) {
            if (! preg_match('/^\d{2}:\d{2}$/', $startTime)) {
                throw ValidationException::withMessages(['start_time' => 'Choose a start time.']);
            }
            [$hour, $minute] = array_map('intval', explode(':', $startTime));
            $chosen = $day->setTime($hour, $minute);
            if ($chosen->lessThan($startsAt) || $chosen->greaterThanOrEqualTo($this->at($day, $opening['closes']))) {
                throw ValidationException::withMessages(['start_time' => 'On '.$day->format('l').'s, '.$space->name.' is open '.$this->describeHours($opening).'.']);
            }
            $startsAt = $chosen;
        }

        $endsAt = match ($rateUnit) {
            // The last day ends at that day's closing time.
            'day' => $this->closingOfDay($space, $day->addDays($quantity - 1)),
            'week' => $startsAt->addWeeks($quantity),
            'month' => $startsAt->addMonthsNoOverflow($quantity),
            default => throw ValidationException::withMessages(['rate_unit' => 'Choose how you want to book.']),
        };

        return [$startsAt->utc(), $endsAt->utc()];
    }

    /**
     * Throws a validation error naming the first rule the booking breaks.
     */
    public function assertBookable(Space $space, CarbonImmutable $startsAt, CarbonImmutable $endsAt, string $rateUnit, int $seats, ?int $ignoreBookingId = null): void
    {
        $space->loadMissing(['location', 'type']);
        $fail = fn (string $field, string $message) => throw ValidationException::withMessages([$field => $message]);
        $local = $startsAt->setTimezone($this->timezone($space));
        $localEnd = $endsAt->setTimezone($this->timezone($space));

        if ($seats < 1 || $seats > $space->capacity) {
            $fail('seats', "{$space->name} fits up to {$space->capacity} ".($space->capacity === 1 ? 'person' : 'people').'.');
        }
        if ($startsAt->lessThan(now()->addMinutes($space->min_notice_minutes ?? 0))) {
            $fail('start_time', $space->min_notice_minutes
                ? 'Please book at least '.$this->describeMinutes($space->min_notice_minutes).' ahead.'
                : 'That time has already passed.');
        }
        if ($space->advance_booking_days && $startsAt->greaterThan(now()->addDays($space->advance_booking_days)->endOfDay())) {
            $fail('date', "{$space->name} can be booked up to {$space->advance_booking_days} days ahead.");
        }

        if ($rateUnit === 'hour') {
            $minutes = (int) $startsAt->diffInMinutes($endsAt);
            $opening = $this->hoursFor($space, $local->startOfDay());
            if ($opening === null) {
                $fail('date', "{$space->name} is closed on ".$local->format('l, j M').'.');
            }
            if ($local->lessThan($this->at($local->startOfDay(), $opening['opens'])) || $localEnd->greaterThan($this->at($local->startOfDay(), $opening['closes']))) {
                $fail('start_time', 'On '.$local->format('l').'s, '.$space->name.' is open '.$this->describeHours($opening).'.');
            }
            if ($space->min_duration_minutes && $minutes < $space->min_duration_minutes) {
                $fail('quantity', 'The shortest booking is '.$this->describeMinutes($space->min_duration_minutes).'.');
            }
            if ($space->max_duration_minutes && $minutes > $space->max_duration_minutes) {
                $fail('quantity', 'The longest booking is '.$this->describeMinutes($space->max_duration_minutes).'.');
            }
        }

        if ($rateUnit === 'day') {
            for ($day = $local->startOfDay(); $day->lessThan($localEnd); $day = $day->addDay()) {
                if ($this->hoursFor($space, $day) === null) {
                    $fail('quantity', "{$space->name} is closed on ".$day->format('l, j M').'. Choose dates when it is open.');
                }
            }
        }

        $closure = BlackoutDate::query()
            ->where(fn ($query) => $query->where('space_id', $space->id)->orWhere(fn ($location) => $location->whereNull('space_id')->where('location_id', $space->location_id)))
            ->where('starts_at', '<', $endsAt)
            ->where('ends_at', '>', $startsAt)
            ->orderBy('starts_at')
            ->first();
        if ($closure) {
            $fail('date', 'We are closed then'.($closure->reason ? " ({$closure->reason})" : '').'. Please choose another time.');
        }

        if (! $this->hasRoom($space, $startsAt, $endsAt, $seats, $ignoreBookingId)) {
            $fail('start_time', $space->isShared()
                ? "There aren't enough free seats at {$space->name} then. Try fewer people or another time."
                : "{$space->name} is already booked then. Please choose another time.");
        }
    }

    /**
     * Exclusive spaces allow one booking at a time (plus the buffer between bookings);
     * shared spaces allow bookings until their seats run out.
     */
    public function hasRoom(Space $space, CarbonImmutable $startsAt, CarbonImmutable $endsAt, int $seats, ?int $ignoreBookingId = null): bool
    {
        $space->loadMissing('type');
        $overlapping = Booking::query()
            ->where('space_id', $space->id)
            ->when($ignoreBookingId, fn ($query) => $query->whereKeyNot($ignoreBookingId))
            ->occupying()
            ->overlapping($startsAt, $endsAt, $space->isShared() ? 0 : (int) $space->buffer_minutes);

        if (! $space->isShared()) {
            return ! $overlapping->exists();
        }

        // Counts everyone overlapping any part of the range, which can under-count free seats
        // when bookings don't overlap each other; it never over-books.
        if ((int) $overlapping->sum('seats') + $seats > $space->capacity) {
            return false;
        }

        // With named seats set up, there must also be enough free seats.
        return ! $this->seatPlanner->usesSeats($space) || $this->seatPlanner->freeCount($space, $startsAt, $endsAt, $ignoreBookingId) >= $seats;
    }

    /**
     * The day's opening hours and, for hourly bookings, how long a booking could run from each start time.
     *
     * @return array{date: string, closed: bool, reason: string|null, opens: string|null, closes: string|null, starts: list<array{time: string, max_minutes: int}>}
     */
    public function day(Space $space, string $date, int $seats): array
    {
        $space->loadMissing(['location', 'type']);
        $timezone = $this->timezone($space);
        $day = CarbonImmutable::createFromFormat('!Y-m-d', $date, $timezone);
        if ($day === false) {
            throw ValidationException::withMessages(['date' => 'Choose a valid date.']);
        }

        $opening = $this->hoursFor($space, $day);
        $result = ['date' => $day->toDateString(), 'closed' => $opening === null, 'reason' => null, 'opens' => $opening['opens'] ?? null, 'closes' => $opening['closes'] ?? null, 'starts' => []];
        if ($opening === null) {
            $result['reason'] = 'Closed on '.$day->format('l').'s.';

            return $result;
        }

        $opens = $this->at($day, $opening['opens']);
        $closes = $this->at($day, $opening['closes']);
        $closure = BlackoutDate::query()
            ->where(fn ($query) => $query->where('space_id', $space->id)->orWhere(fn ($location) => $location->whereNull('space_id')->where('location_id', $space->location_id)))
            ->where('starts_at', '<', $closes->utc())
            ->where('ends_at', '>', $opens->utc())
            ->orderBy('starts_at')
            ->first();
        if ($closure && $closure->starts_at <= $opens->utc() && $closure->ends_at >= $closes->utc()) {
            return ['closed' => true, 'reason' => $closure->reason ? "Closed: {$closure->reason}." : 'Closed that day.', 'starts' => []] + $result;
        }

        $earliest = now()->addMinutes($space->min_notice_minutes ?? 0);
        $minimum = max(self::SLOT_MINUTES, (int) ($space->min_duration_minutes ?? 60));
        $maximum = $space->max_duration_minutes ?: PHP_INT_MAX;

        // One query for the day; each candidate start is then checked in memory.
        $taken = Booking::query()
            ->where('space_id', $space->id)
            ->occupying()
            ->overlapping($opens->utc(), $closes->utc(), $space->isShared() ? 0 : (int) $space->buffer_minutes)
            ->get(['starts_at', 'ends_at', 'seats']);
        $closures = BlackoutDate::query()
            ->where(fn ($query) => $query->where('space_id', $space->id)->orWhere(fn ($location) => $location->whereNull('space_id')->where('location_id', $space->location_id)))
            ->where('starts_at', '<', $closes->utc())
            ->where('ends_at', '>', $opens->utc())
            ->get(['starts_at', 'ends_at']);

        $free = function (CarbonImmutable $from, CarbonImmutable $to) use ($space, $taken, $closures, $seats): bool {
            if ($closures->contains(fn ($closure) => $closure->starts_at < $to && $closure->ends_at > $from)) {
                return false;
            }
            $buffer = $space->isShared() ? 0 : (int) $space->buffer_minutes;
            $clashing = $taken->filter(fn (Booking $booking) => $booking->starts_at < $to->addMinutes($buffer) && $booking->ends_at > $from->subMinutes($buffer));

            return $space->isShared() ? $clashing->sum('seats') + $seats <= $space->capacity : $clashing->isEmpty();
        };

        for ($start = $opens; $start->addMinutes($minimum)->lessThanOrEqualTo($closes); $start = $start->addMinutes(self::SLOT_MINUTES)) {
            if ($start->utc()->lessThan($earliest)) {
                continue;
            }
            $length = 0;
            for ($end = $start->addMinutes(self::SLOT_MINUTES); $end->lessThanOrEqualTo($closes) && $end->diffInMinutes($start, true) <= $maximum; $end = $end->addMinutes(self::SLOT_MINUTES)) {
                if (! $free($start->utc(), $end->utc())) {
                    break;
                }
                $length = (int) $start->diffInMinutes($end, true);
            }
            if ($length >= $minimum) {
                $result['starts'][] = ['time' => $start->format('H:i'), 'max_minutes' => $length];
            }
        }

        return $result;
    }

    public function timezone(Space $space): string
    {
        return $space->location->timezone ?: (string) config('app.display_timezone');
    }

    /**
     * Opening hours for one date (space hours override the location's), or null when closed.
     *
     * @return array{opens: string, closes: string}|null
     */
    public function hoursFor(Space $space, CarbonImmutable $day): ?array
    {
        $entry = collect($space->effectiveHours())->firstWhere('day', $day->dayOfWeekIso);

        return ! $entry || ($entry['closed'] ?? false) || ! $entry['opens'] || ! $entry['closes']
            ? null
            : ['opens' => $entry['opens'], 'closes' => $entry['closes']];
    }

    private function closingOfDay(Space $space, CarbonImmutable $day): CarbonImmutable
    {
        $opening = $this->hoursFor($space, $day);

        // A closed final day is rejected by assertBookable; end at midnight so the error names it.
        return $opening ? $this->at($day, $opening['closes']) : $day->endOfDay();
    }

    private function at(CarbonImmutable $day, string $time): CarbonImmutable
    {
        [$hour, $minute] = array_map('intval', explode(':', $time));

        return $day->setTime($hour, $minute);
    }

    /**
     * @param  array{opens: string, closes: string}  $opening
     */
    private function describeHours(array $opening): string
    {
        $format = fn (string $time) => CarbonImmutable::createFromFormat('H:i', $time)->format('g:ia');

        return $format($opening['opens']).' to '.$format($opening['closes']);
    }

    private function describeMinutes(int $minutes): string
    {
        return match (true) {
            $minutes % 1440 === 0 => ($minutes / 1440).' '.str('day')->plural($minutes / 1440),
            $minutes % 60 === 0 => ($minutes / 60).' '.str('hour')->plural($minutes / 60),
            default => "{$minutes} minutes",
        };
    }
}
