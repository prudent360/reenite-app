<?php

namespace App\Appointments;

use App\Enums\Role;
use App\Models\Appointment;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Clients staff book appointments for. Someone with an account is used as they are; anyone else
 * gets a guest record, which becomes a normal account if they ever register with the same email.
 */
class AppointmentClients
{
    /**
     * @param  array{name: string, email: string, phone: string, whatsapp_consent?: bool}  $details
     */
    public function resolve(array $details): User
    {
        $email = mb_strtolower(trim($details['email']));
        $phone = trim($details['phone']);
        $client = User::where('email', $email)->first();

        if ($client?->isStaff()) {
            throw ValidationException::withMessages(['client.email' => 'That email belongs to a staff account. Use the client\'s own email.']);
        }

        $phoneTaken = User::where('phone', $phone)->when($client, fn ($query) => $query->whereKeyNot($client->id))->first();
        if ($phoneTaken) {
            throw ValidationException::withMessages(['client.phone' => "That phone number is already saved for {$phoneTaken->name}. Choose them from the client list instead."]);
        }

        if ($client) {
            // Keep a registered customer's own details; fill in a guest's with the latest.
            $client->isGuest()
                ? $client->update(['name' => $details['name'], 'phone' => $phone])
                : $client->update(['phone' => $client->phone ?: $phone]);
        } else {
            $client = User::create([
                'name' => $details['name'],
                'email' => $email,
                'phone' => $phone,
                // Never used to sign in: registering with this email replaces it.
                'password' => Hash::make(Str::random(40)),
                'type' => User::TYPE_CUSTOMER,
                'status' => User::STATUS_GUEST,
            ]);
            $client->assignRole(Role::Customer->value);
        }

        if (($details['whatsapp_consent'] ?? false) && $client->whatsapp_opt_in_at === null) {
            $client->forceFill(['whatsapp_opt_in_at' => now()])->save();
        }

        return $client;
    }

    /**
     * How the client has kept past appointments, so staff can spot habitual lateness.
     *
     * @return array{total: int, on_time: int, late: int, no_show: int, cancelled: int, average_minutes_late: int|null}
     */
    public function history(User $client): array
    {
        $past = Appointment::where('user_id', $client->id)->whereIn('status', [Appointment::ATTENDED, Appointment::NO_SHOW, Appointment::CANCELLED])->get(['status', 'minutes_late']);
        $late = $past->where('status', Appointment::ATTENDED)->where('minutes_late', '>', 0);

        return [
            'total' => $past->whereIn('status', [Appointment::ATTENDED, Appointment::NO_SHOW])->count(),
            'on_time' => $past->where('status', Appointment::ATTENDED)->where('minutes_late', 0)->count(),
            'late' => $late->count(),
            'no_show' => $past->where('status', Appointment::NO_SHOW)->count(),
            'cancelled' => $past->where('status', Appointment::CANCELLED)->count(),
            'average_minutes_late' => $late->isNotEmpty() ? (int) round($late->avg('minutes_late')) : null,
        ];
    }
}
