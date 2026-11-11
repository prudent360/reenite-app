<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A customer's business: what it is and which taxes it pays decide its compliance deadlines.
     */
    public function up(): void
    {
        Schema::create('businesses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('name');
            $table->string('entity_type', 20); // business_name | company | trustees
            $table->string('registration_number', 40)->nullable(); // BN, RC or IT number
            $table->date('registered_on')->nullable();
            $table->string('tin', 30)->nullable();
            $table->boolean('vat_registered')->default(false);
            $table->boolean('has_employees')->default(false);
            $table->unsignedTinyInteger('financial_year_end_month')->default(12);
            $table->string('state', 40)->nullable();
            $table->string('industry', 100)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('businesses');
    }
};
