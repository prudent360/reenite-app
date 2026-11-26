<?php

use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lets staff sign in as a customer: the customer's token remembers which staff member opened it.
 * Also adds the customers.impersonate permission to the live site's roles.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->foreignId('impersonator_id')->nullable()->after('tokenable_id')->constrained('users')->cascadeOnDelete();
        });

        if (Schema::hasTable('roles')) {
            (new RolesAndPermissionsSeeder)->run();
        }
    }

    public function down(): void
    {
        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->dropConstrainedForeignId('impersonator_id');
        });
    }
};
