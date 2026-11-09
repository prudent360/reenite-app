<?php

namespace Database\Factories;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Service;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'service_id' => Service::factory(),
            'status' => OrderStatus::Received,
            'service_name' => fn (array $attributes) => Service::find($attributes['service_id'])->name,
            'form_snapshot' => [],
            'requirements_snapshot' => [['id' => 1, 'label' => 'Valid ID', 'description' => null, 'is_required' => true]],
            'stages_snapshot' => [
                ['name' => 'Documents received', 'description' => null, 'customer_visible' => true],
                ['name' => 'Internal check', 'description' => null, 'customer_visible' => false],
                ['name' => 'Filed with CAC', 'description' => null, 'customer_visible' => true],
            ],
            'answers' => [],
            'paid_at' => now(),
            'due_at' => now()->addWeekdays(7),
        ];
    }
}
