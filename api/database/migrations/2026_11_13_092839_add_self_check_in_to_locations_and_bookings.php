<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Self check-in: each location gets a private link (printed as a QR poster at reception) that
 * customers scan to check themselves in. Bookings remember whether staff or the customer did it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            $table->boolean('self_check_in')->default(false)->after('is_active');
            $table->string('check_in_token', 40)->nullable()->unique()->after('self_check_in');
        });

        DB::table('locations')->orderBy('id')->each(function (object $location) {
            DB::table('locations')->where('id', $location->id)->update(['check_in_token' => Str::random(32)]);
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->string('checked_in_via', 10)->nullable()->after('checked_in_by');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('checked_in_via');
        });

        Schema::table('locations', function (Blueprint $table) {
            $table->dropUnique(['check_in_token']);
            $table->dropColumn(['self_check_in', 'check_in_token']);
        });
    }
};
