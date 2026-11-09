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
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('number', 30)->nullable()->unique(); // INV-2026-000123, set after insert
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            // What the invoice is for (service order, booking...); null for invoices raised by staff.
            $table->nullableMorphs('source');
            $table->string('status', 20)->default('unpaid')->index(); // unpaid | paid | void
            $table->string('currency', 3)->default('NGN');
            // Money in kobo.
            $table->unsignedBigInteger('subtotal')->default(0);
            $table->unsignedBigInteger('total')->default(0);
            $table->unsignedBigInteger('amount_paid')->default(0);
            $table->unsignedBigInteger('amount_refunded')->default(0);
            $table->date('due_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->string('notes', 1000)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
