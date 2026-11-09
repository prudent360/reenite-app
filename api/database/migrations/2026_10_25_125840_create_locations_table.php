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
        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('address');
            $table->string('city');
            $table->string('state');
            $table->string('phone', 40)->nullable();
            $table->string('email')->nullable();
            $table->text('description')->nullable();
            $table->json('amenities')->nullable();
            // Seven entries, ISO weekday 1 (Mon) to 7 (Sun): {day, opens, closes, closed}.
            $table->json('hours');
            $table->string('timezone', 64)->default('Africa/Lagos');
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('locations');
    }
};
