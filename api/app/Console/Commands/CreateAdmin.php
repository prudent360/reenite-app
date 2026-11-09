<?php

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

/** Creates the first Super Admin on a new server. Further staff are invited from Admin > Staff & Roles. */
#[Signature('app:create-admin {email} {--name= : Full name}')]
#[Description('Create a Super Admin account')]
class CreateAdmin extends Command
{
    public function handle(): int
    {
        $email = strtolower((string) $this->argument('email'));
        $name = (string) ($this->option('name') ?: $this->ask('Full name'));
        $password = (string) $this->secret('Password (at least 8 characters, letters and numbers)');

        $validator = Validator::make(
            ['email' => $email, 'name' => $name, 'password' => $password],
            [
                'email' => ['required', 'email', 'unique:users,email'],
                'name' => ['required', 'string', 'max:120'],
                'password' => ['required', Password::defaults()],
            ],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $user = User::forceCreate([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'type' => User::TYPE_STAFF,
            'status' => User::STATUS_ACTIVE,
            'email_verified_at' => now(),
        ]);
        $user->assignRole(Role::SuperAdmin->value);

        $this->info("Super Admin {$email} created. Sign in at the website's /login page.");

        return self::SUCCESS;
    }
}
