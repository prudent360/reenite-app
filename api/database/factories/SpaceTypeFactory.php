<?php

namespace Database\Factories;

use App\Models\SpaceType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SpaceType>
 */
class SpaceTypeFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->words(2, true),
            'slug' => fake()->unique()->slug(2),
            'booking_mode' => SpaceType::EXCLUSIVE,
            'is_active' => true,
        ];
    }
}
