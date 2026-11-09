<?php

namespace Database\Factories;

use App\Models\Service;
use App\Models\ServiceCategory;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Service>
 */
class ServiceFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->words(3, true);

        return [
            'service_category_id' => ServiceCategory::factory(),
            'name' => ucwords($name),
            'slug' => Str::slug($name),
            'summary' => fake()->sentence(),
            'description' => fake()->paragraph(),
            'service_fee' => fake()->numberBetween(10, 200) * 100_000,
            'government_fee' => fake()->numberBetween(0, 50) * 100_000,
            'turnaround_days' => fake()->numberBetween(1, 21),
            'requires_business' => false,
            'is_active' => true,
            'sort_order' => 0,
        ];
    }

    /**
     * Indicate that the service is hidden from customers.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => ['is_active' => false]);
    }
}
