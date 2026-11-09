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
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 30)->nullable()->unique(); // RN-2026-000123, set after insert
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('service_id')->constrained()->restrictOnDelete();
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            // awaiting_payment | received | in_progress | awaiting_client | completed | cancelled
            $table->string('status', 20)->default('awaiting_payment')->index();
            // Snapshots, so later catalogue edits never change an existing order.
            $table->string('service_name');
            $table->json('form_snapshot');
            $table->json('requirements_snapshot');
            $table->json('stages_snapshot');
            $table->json('answers');
            $table->unsignedSmallInteger('current_stage')->default(0);
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('due_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancel_reason', 500)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
