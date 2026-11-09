<?php

namespace Database\Factories;

use App\Models\CustomerPass;
use App\Models\PassPlan;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CustomerPass>
 */
class CustomerPassFactory extends Factory
{
    /**
     * An active "3 visits a week" pass that started today.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'pass_plan_id' => PassPlan::factory(),
            'name' => '3 days a week',
            'credit_type' => 'visits',
            'credits' => 3,
            'credits_used' => 0,
            'period' => 'week',
            'space_type_ids' => [],
            'status' => CustomerPass::ACTIVE,
            'starts_at' => now()->startOfDay(),
            'ends_at' => now()->startOfDay()->addWeek(),
        ];
    }
}
