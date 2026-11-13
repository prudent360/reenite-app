<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Session tracking: when the "ending soon" and "session ended" messages went out, and who ended
 * a session early from the session monitor.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->timestamp('ending_notice_sent_at')->nullable()->after('reminder_sent_at');
            $table->timestamp('ended_notice_sent_at')->nullable()->after('ending_notice_sent_at');
            $table->timestamp('ended_early_at')->nullable()->after('ended_notice_sent_at');
            $table->foreignId('ended_by')->nullable()->after('ended_early_at')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('ended_by');
            $table->dropColumn(['ending_notice_sent_at', 'ended_notice_sent_at', 'ended_early_at']);
        });
    }
};
