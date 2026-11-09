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
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 40)->unique(); // our reference, sent to the gateway
            $table->string('receipt_number', 30)->nullable()->unique();
            $table->foreignId('invoice_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('gateway', 20)->index(); // paystack | flutterwave | stripe | bank_transfer
            $table->string('mode', 10)->default('test'); // gateway mode at the time of payment
            $table->unsignedBigInteger('amount'); // kobo
            $table->string('currency', 3)->default('NGN');
            // pending | success | failed | abandoned | awaiting_review | rejected | refunded | partially_refunded
            $table->string('status', 20)->default('pending')->index();
            $table->string('gateway_reference')->nullable()->index(); // e.g. Flutterwave id, Stripe session/payment intent
            $table->string('channel', 30)->nullable(); // card, bank, ussd, transfer...
            $table->json('gateway_data')->nullable(); // minimal verified details, no card data
            $table->unsignedBigInteger('amount_refunded')->default(0);
            // Bank transfer proof
            $table->string('proof_path')->nullable();
            $table->string('proof_name')->nullable();
            $table->string('sender_name', 150)->nullable();
            $table->date('transferred_on')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('review_note', 500)->nullable();
            $table->string('failure_reason', 500)->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
