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
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 30)->nullable()->unique(); // BK-2026-000123, set after insert
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('space_id')->constrained()->restrictOnDelete();
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('customer_pass_id')->nullable()->constrained()->nullOnDelete();
            // held | pending_approval | confirmed | checked_in | completed | expired | cancelled
            $table->string('status', 20)->default('held')->index();
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->string('rate_unit', 10); // hour | day | week | month
            $table->unsignedSmallInteger('quantity'); // how many of rate_unit
            $table->unsignedSmallInteger('seats')->default(1);
            // Money in kobo.
            $table->unsignedBigInteger('subtotal')->default(0);
            $table->unsignedBigInteger('addons_total')->default(0);
            $table->unsignedBigInteger('discount')->default(0);
            $table->string('discount_label')->nullable();
            $table->unsignedBigInteger('total')->default(0);
            $table->unsignedInteger('pass_credits_used')->default(0);
            // online | bank_transfer | pass | free; set once the booking is paid for.
            $table->string('paid_via', 20)->nullable();
            $table->timestamp('hold_expires_at')->nullable();
            $table->string('check_in_code', 12)->nullable()->unique();
            $table->timestamp('checked_in_at')->nullable();
            $table->foreignId('checked_in_by')->nullable()->constrained('users')->nullOnDelete();
            // Encrypted; lets a guest open and pay for their booking from the link we email them.
            $table->text('manage_token')->nullable();
            $table->string('space_name');
            $table->string('location_name');
            $table->json('policy_snapshot')->nullable();
            $table->string('notes', 1000)->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('reminder_sent_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('cancel_reason', 500)->nullable();
            $table->unsignedBigInteger('refund_amount')->default(0);
            $table->timestamps();

            // Availability checks look for bookings of one space overlapping a time range.
            $table->index(['space_id', 'starts_at', 'ends_at']);
            $table->index(['user_id', 'starts_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
