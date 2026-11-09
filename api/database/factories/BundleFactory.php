<?php

namespace Database\Factories;

use App\Models\Bundle;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Bundle>
 */
class BundleFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->words(2, true).' pack';

        return [
            'name' => ucwords($name),
            'slug' => Str::slug($name),
            'summary' => fake()->sentence(),
            'description' => fake()->paragraph(),
            'price' => fake()->numberBetween(100, 500) * 100_000,
            'is_active' => true,
            'sort_order' => 0,
        ];
    }
}
