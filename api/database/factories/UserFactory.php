<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'phone' => null,
            'type' => User::TYPE_CUSTOMER,
            'status' => User::STATUS_ACTIVE,
            'avatar_path' => null,
            'email_verified_at' => now(),
            'phone_verified_at' => null,
            'last_login_at' => null,
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
        ];
    }

    /**
     * Indicate that the user is a Reenite staff member.
     */
    public function staff(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => User::TYPE_STAFF,
        ]);
    }

    /**
     * Indicate that the account is suspended.
     */
    public function suspended(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => User::STATUS_SUSPENDED,
        ]);
    }

    /**
     * Someone who booked without creating an account.
     */
    public function guest(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => User::STATUS_GUEST,
            'email_verified_at' => null,
        ]);
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }
}
