<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 30)->nullable()->unique();
            // The client: a customer account, or a guest record for clients without one.
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->string('mode', 20); // in_person | phone | video
            $table->text('meeting_details')->nullable();
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            // scheduled | attended | no_show | cancelled
            $table->string('status', 20)->default('scheduled');
            // Minutes after the start the client arrived; 0 is on time. Set when marked attended.
            $table->unsignedSmallInteger('minutes_late')->nullable();
            // The client's answer from the link in their messages: confirmed | reschedule_requested
            $table->string('response', 30)->nullable();
            $table->string('response_note', 500)->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->string('response_token', 64);
            $table->timestamp('reminded_day_at')->nullable();
            $table->timestamp('reminded_hour_at')->nullable();
            $table->text('staff_notes')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancel_reason')->nullable();
            $table->timestamps();

            $table->index(['status', 'starts_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('appointments');
    }
};
