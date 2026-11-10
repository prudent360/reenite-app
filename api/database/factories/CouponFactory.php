<?php

namespace Database\Factories;

use App\Models\Coupon;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Coupon>
 */
class CouponFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'code' => strtoupper(fake()->unique()->bothify('SAVE##??')),
            'description' => 'Test promotion',
            'discount_type' => Coupon::PERCENT,
            'discount_value' => 10,
            'applies_to' => 'all',
            'max_uses_per_customer' => 1,
            'is_active' => true,
        ];
    }

    /**
     * A fixed amount off, in kobo.
     */
    public function fixed(int $amount): static
    {
        return $this->state(['discount_type' => Coupon::FIXED, 'discount_value' => $amount]);
    }
}
