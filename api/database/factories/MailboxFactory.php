<?php

namespace Database\Factories;

use App\Models\Location;
use App\Models\Mailbox;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Mailbox>
 */
class MailboxFactory extends Factory
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
            'location_id' => Location::factory(),
            'business_name' => fake()->company(),
            'status' => Mailbox::ACTIVE,
            'active_until' => now()->addMonth(),
        ];
    }
}
