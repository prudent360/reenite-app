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
        Schema::create('payment_gateways', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique(); // paystack | flutterwave | stripe
            $table->boolean('is_enabled')->default(false);
            $table->string('mode', 10)->default('test'); // test | live
            // Encrypted JSON: {test: {public_key, secret_key, webhook_secret}, live: {...}}
            $table->text('credentials')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamp('verified_at')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payment_gateways');
    }
};
