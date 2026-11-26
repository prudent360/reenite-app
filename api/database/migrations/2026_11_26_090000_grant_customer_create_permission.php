<?php

use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * Adds the customers.create permission (Operations Managers and Front Desk to start with), so
 * deploying only needs `php artisan migrate`. Super Admins can change who has it afterwards.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('roles')) {
            (new RolesAndPermissionsSeeder)->run();
        }
    }

    public function down(): void
    {
        // Permissions stay; removing them could lock staff out of pages mid-rollback.
    }
};
