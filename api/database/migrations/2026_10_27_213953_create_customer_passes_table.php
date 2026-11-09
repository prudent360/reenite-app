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
        Schema::create('customer_passes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('pass_plan_id')->constrained()->restrictOnDelete();
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            // Snapshot of the plan when bought, so later plan edits don't change a pass already paid for.
            $table->string('name');
            $table->string('credit_type', 10); // visits | hours
            $table->unsignedInteger('credits');
            $table->unsignedInteger('credits_used')->default(0);
            $table->string('period', 10); // week | month
            $table->foreignId('location_id')->nullable()->constrained()->nullOnDelete();
            $table->json('space_type_ids');
            // pending (awaiting payment) | active | expired | cancelled
            $table->string('status', 20)->default('pending');
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customer_passes');
    }
};
