<?php

namespace Database\Factories;

use App\Enums\PaymentStatus;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Payment>
 */
class PaymentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'reference' => Payment::newReference(),
            'invoice_id' => Invoice::factory(),
            'user_id' => fn (array $attributes) => Invoice::find($attributes['invoice_id'])->user_id,
            'gateway' => 'paystack',
            'mode' => 'test',
            'amount' => fn (array $attributes) => Invoice::find($attributes['invoice_id'])->total,
            'currency' => 'NGN',
            'status' => PaymentStatus::Pending,
        ];
    }
}
