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
        Schema::create('booking_seat', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            // A seat with bookings can't be deleted, only switched off, so history keeps its label.
            $table->foreignId('space_seat_id')->constrained()->restrictOnDelete();
            $table->timestamps();

            $table->unique(['booking_id', 'space_seat_id']);
            $table->index('space_seat_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('booking_seat');
    }
};
