<?php

namespace Database\Factories;

use App\Models\PaymentMethod;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PaymentMethod>
 */
class PaymentMethodFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'gateway' => 'paystack',
            'mode' => 'test',
            'authorization_code' => 'AUTH_'.fake()->bothify('??########'),
            'signature' => 'SIG_'.fake()->bothify('##########'),
            'email' => fake()->safeEmail(),
            'brand' => 'visa',
            'last4' => fake()->numerify('####'),
            'exp_month' => '12',
            'exp_year' => (string) (now()->year + 2),
            'bank' => 'Test Bank',
            'is_default' => true,
        ];
    }
}
