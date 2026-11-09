<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database. Demo accounts all use the password "password".
     */
    public function run(): void
    {
        $this->call([RolesAndPermissionsSeeder::class, ServiceCatalogueSeeder::class, SettingsSeeder::class, WorkspaceSeeder::class]);

        $staff = [
            ['Ada Super Admin', 'admin@reenite.test', Role::SuperAdmin],
            ['Ime Operations', 'ops@reenite.test', Role::OperationsManager],
            ['Ekemini Filing', 'filing@reenite.test', Role::FilingOfficer],
            ['Uduak Front Desk', 'frontdesk@reenite.test', Role::FrontDesk],
            ['Nsikak Finance', 'finance@reenite.test', Role::Finance],
        ];

        foreach ($staff as [$name, $email, $role]) {
            User::factory()->staff()->create(['name' => $name, 'email' => $email])->assignRole($role->value);
        }

        User::factory()->create([
            'name' => 'Demo Customer',
            'email' => 'customer@reenite.test',
            'phone' => '+2348012345678',
        ])->assignRole(Role::Customer->value);

        User::factory(12)->create()->each(fn (User $user) => $user->assignRole(Role::Customer->value));
    }
}
