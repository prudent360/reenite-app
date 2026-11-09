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
        Schema::create('spaces', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->restrictOnDelete();
            $table->foreignId('space_type_id')->constrained()->restrictOnDelete();
            $table->foreignId('cancellation_policy_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('summary', 300)->nullable();
            $table->text('description')->nullable();
            $table->unsignedInteger('capacity')->default(1);
            $table->json('amenities')->nullable();
            // Null means the location's opening hours apply.
            $table->json('hours')->nullable();
            $table->unsignedInteger('min_duration_minutes')->default(60);
            $table->unsignedInteger('max_duration_minutes')->nullable();
            $table->unsignedInteger('buffer_minutes')->default(0);
            $table->unsignedInteger('min_notice_minutes')->default(60);
            $table->unsignedInteger('advance_booking_days')->default(90);
            $table->boolean('requires_approval')->default(false);
            $table->string('photo_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['location_id', 'is_active', 'sort_order']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('spaces');
    }
};
