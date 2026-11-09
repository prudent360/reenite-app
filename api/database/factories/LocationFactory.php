<?php

namespace Database\Factories;

use App\Models\Location;
use App\Workspace\OpeningHours;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Location>
 */
class LocationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => 'Reenite '.fake()->unique()->city(),
            'slug' => fake()->unique()->slug(2),
            'address' => fake()->streetAddress(),
            'city' => 'Uyo',
            'state' => 'Akwa Ibom State',
            'phone' => '0916 123 1304',
            'hours' => OpeningHours::defaults(),
            'is_active' => true,
        ];
    }
}
