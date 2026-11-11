<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Paid sessions customers can book with an officer, e.g. "Tax advice, 45 minutes".
     */
    public function up(): void
    {
        Schema::create('consultation_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('duration_minutes');
            $table->unsignedBigInteger('price'); // kobo; 0 means free
            $table->string('mode', 20); // in_person | video | phone
            // Weekly hours in Lagos time, keyed by ISO weekday: {"1": ["09:00", "16:00"], ...}
            $table->json('schedule');
            $table->unsignedSmallInteger('notice_hours')->default(12);
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('consultation_types');
    }
};
