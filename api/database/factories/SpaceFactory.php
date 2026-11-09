<?php

namespace Database\Factories;

use App\Models\Location;
use App\Models\Space;
use App\Models\SpaceType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Space>
 */
class SpaceFactory extends Factory
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
            'space_type_id' => SpaceType::factory(),
            'name' => fake()->unique()->words(2, true),
            'slug' => fake()->unique()->slug(2),
            'capacity' => 1,
            'is_active' => true,
        ];
    }
}
