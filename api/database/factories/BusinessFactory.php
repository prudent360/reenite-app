<?php

namespace Database\Factories;

use App\Models\Business;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Business>
 */
class BusinessFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'name' => fake()->company(),
            'entity_type' => Business::BUSINESS_NAME,
            'registration_number' => 'BN '.fake()->numerify('#######'),
            'registered_on' => fake()->dateTimeBetween('-3 years', '-2 months')->format('Y-m-d'),
            'tin' => fake()->numerify('########-0001'),
            'vat_registered' => false,
            'has_employees' => false,
            'financial_year_end_month' => 12,
            'state' => 'Akwa Ibom',
        ];
    }

    public function company(): static
    {
        return $this->state(fn () => ['entity_type' => Business::COMPANY, 'registration_number' => 'RC '.fake()->numerify('#######')]);
    }
}
