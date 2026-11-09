<?php

namespace Database\Factories;

use App\Models\BankAccount;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BankAccount>
 */
class BankAccountFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'bank_name' => fake()->randomElement(['Zenith Bank', 'Access Bank', 'Guaranty Trust Bank (GTBank)', 'First Bank of Nigeria']),
            'account_name' => 'Reenite Limited',
            'account_number' => fake()->numerify('##########'),
            'is_active' => true,
            'sort_order' => 0,
        ];
    }
}
