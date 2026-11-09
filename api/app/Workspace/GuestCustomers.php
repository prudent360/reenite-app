<?php

namespace App\Workspace;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * People who book without an account. They get a guest record (so invoices, payments and emails
 * work as usual) that becomes a normal account if they register with the same email.
 */
class GuestCustomers
{
    /**
     * @param  array{name: string, email: string, phone?: string|null}  $details
     */
    public function resolve(array $details): User
    {
        $email = mb_strtolower(trim($details['email']));
        $existing = User::where('email', $email)->first();

        if ($existing && ! $existing->isGuest()) {
            throw ValidationException::withMessages(['email' => 'You already have a Reenite account with this email. Please sign in to book.']);
        }

        $phone = $details['phone'] ?? null;
        // Phone numbers are unique per account; leave it off rather than clash with someone else's.
        if ($phone && User::where('phone', $phone)->when($existing, fn ($query) => $query->whereKeyNot($existing->id))->exists()) {
            $phone = $existing?->phone;
        }

        if ($existing) {
            $existing->update(['name' => $details['name'], 'phone' => $phone ?? $existing->phone]);

            return $existing;
        }

        $guest = User::create([
            'name' => $details['name'],
            'email' => $email,
            'phone' => $phone,
            // Never used to sign in: registering with this email replaces it.
            'password' => Hash::make(Str::random(40)),
            'type' => User::TYPE_CUSTOMER,
            'status' => User::STATUS_GUEST,
        ]);
        $guest->assignRole(Role::Customer->value);

        return $guest;
    }
}
