<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('consultations', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 30)->nullable()->unique();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('consultation_type_id')->constrained()->restrictOnDelete();
            $table->string('name'); // the type's name when booked
            $table->string('mode', 20);
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->text('topic');
            // pending_payment | confirmed | completed | no_show | cancelled | expired
            $table->string('status', 20);
            $table->timestamp('hold_expires_at')->nullable();
            $table->unsignedBigInteger('price');
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->text('meeting_details')->nullable();
            $table->text('staff_notes')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('reminded_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('cancel_reason')->nullable();
            $table->unsignedBigInteger('refund_amount')->default(0);
            $table->timestamps();

            $table->index(['consultation_type_id', 'starts_at']);
            $table->index(['status', 'starts_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('consultations');
    }
};
