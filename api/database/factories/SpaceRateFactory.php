<?php

namespace Database\Factories;

use App\Models\Space;
use App\Models\SpaceRate;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SpaceRate>
 */
class SpaceRateFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'space_id' => Space::factory(),
            'unit' => 'hour',
            'price' => 200_000,
            'is_active' => true,
        ];
    }
}
