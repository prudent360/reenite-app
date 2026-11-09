<?php

namespace Database\Factories;

use App\Enums\InvoiceStatus;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Invoice>
 */
class InvoiceFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $total = fake()->numberBetween(10, 200) * 100_000;

        return [
            'user_id' => User::factory(),
            'status' => InvoiceStatus::Unpaid,
            'currency' => 'NGN',
            'subtotal' => $total,
            'total' => $total,
            'amount_paid' => 0,
            'amount_refunded' => 0,
            'due_at' => now()->addDays(7)->toDateString(),
        ];
    }
}
