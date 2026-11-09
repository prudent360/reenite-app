<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Everything the live site needs to start, without the demo accounts in DatabaseSeeder:
 * roles, settings, the service catalogue and the workspace. Safe to run again.
 * Create the first admin afterwards with `php artisan app:create-admin`.
 */
class ProductionSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([RolesAndPermissionsSeeder::class, SettingsSeeder::class, ServiceCatalogueSeeder::class, WorkspaceSeeder::class]);
    }
}
