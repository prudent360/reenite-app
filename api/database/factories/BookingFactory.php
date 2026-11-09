<?php

namespace Database\Factories;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Models\Space;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Booking>
 */
class BookingFactory extends Factory
{
    /**
     * A confirmed two-hour booking tomorrow morning.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $startsAt = now()->addDay()->setTime(10, 0);

        return [
            'user_id' => User::factory(),
            'space_id' => Space::factory(),
            'status' => BookingStatus::Confirmed,
            'starts_at' => $startsAt,
            'ends_at' => $startsAt->copy()->addHours(2),
            'rate_unit' => 'hour',
            'quantity' => 2,
            'seats' => 1,
            'subtotal' => 400_000,
            'total' => 400_000,
            'paid_via' => 'online',
            'check_in_code' => fn () => Booking::newCheckInCode(),
            'space_name' => fn (array $attributes) => Space::find($attributes['space_id'])->name,
            'location_name' => 'Reenite Uyo',
            'confirmed_at' => now(),
        ];
    }

    /**
     * Waiting for payment, with the hold still running.
     */
    public function held(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => BookingStatus::Held,
            'hold_expires_at' => now()->addMinutes(15),
            'paid_via' => null,
            'check_in_code' => null,
            'confirmed_at' => null,
        ]);
    }
}
