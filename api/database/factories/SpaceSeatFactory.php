<?php

namespace Database\Factories;

use App\Models\Space;
use App\Models\SpaceSeat;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SpaceSeat>
 */
class SpaceSeatFactory extends Factory
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
            'label' => 'Desk '.fake()->unique()->numberBetween(1, 9999),
            'zone' => null,
            'is_active' => true,
            'sort_order' => 0,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
