<?php

namespace Database\Factories;

use App\Models\BlackoutDate;
use App\Models\Location;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BlackoutDate>
 */
class BlackoutDateFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'location_id' => Location::factory(),
            'starts_at' => now()->addDays(3)->startOfDay(),
            'ends_at' => now()->addDays(3)->endOfDay(),
            'reason' => 'Public holiday',
        ];
    }
}
