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
        Schema::create('pass_plan_space_type', function (Blueprint $table) {
            $table->foreignId('pass_plan_id')->constrained()->cascadeOnDelete();
            $table->foreignId('space_type_id')->constrained()->cascadeOnDelete();
            $table->primary(['pass_plan_id', 'space_type_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pass_plan_space_type');
    }
};
