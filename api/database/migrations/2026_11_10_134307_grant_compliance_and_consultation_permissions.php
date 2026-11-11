<?php

use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * Adds the compliance.manage, consultations.manage and consultations.view_assigned permissions to the live site's roles, so deploying
 * only needs `php artisan migrate`. The seeder is idempotent.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('roles')) {
            (new RolesAndPermissionsSeeder)->run();
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Permissions stay; removing them could lock staff out of pages mid-rollback.
    }
};
