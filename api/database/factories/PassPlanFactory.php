<?php

namespace Database\Factories;

use App\Models\PassPlan;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PassPlan>
 */
class PassPlanFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => '3 days a week',
            'slug' => fake()->unique()->slug(3),
            'price' => 1_200_000,
            'credit_type' => 'visits',
            'credits' => 3,
            'period' => 'week',
            'is_active' => true,
        ];
    }
}
