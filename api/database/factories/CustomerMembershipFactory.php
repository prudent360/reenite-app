<?php

namespace Database\Factories;

use App\Models\CustomerMembership;
use App\Models\MembershipPlan;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CustomerMembership>
 */
class CustomerMembershipFactory extends Factory
{
    /**
     * An active monthly membership with 10% off bookings.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'membership_plan_id' => MembershipPlan::factory(),
            'name' => 'Basic',
            'discount_percent' => 10,
            'billing_period' => 'month',
            'status' => CustomerMembership::ACTIVE,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addMonth(),
        ];
    }
}
