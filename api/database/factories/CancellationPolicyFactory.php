<?php

namespace Database\Factories;

use App\Models\CancellationPolicy;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CancellationPolicy>
 */
class CancellationPolicyFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => 'Flexible',
            'rules' => [['hours_before' => 24, 'refund_percent' => 100], ['hours_before' => 0, 'refund_percent' => 0]],
            'is_default' => false,
        ];
    }
}
