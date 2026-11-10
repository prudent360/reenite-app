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
        Schema::create('coupon_redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('coupon_id')->constrained()->restrictOnDelete();
            // One code per invoice. A use stops counting once its invoice is void.
            $table->foreignId('invoice_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('amount'); // discount given, kobo
            $table->timestamps();

            $table->index(['coupon_id', 'user_id']);
        });

        Schema::table('invoices', function (Blueprint $table) {
            // Copied from the redemption so invoice pages can show it without another query.
            $table->string('coupon_code', 40)->nullable()->after('total');
            $table->unsignedBigInteger('coupon_discount')->default(0)->after('coupon_code'); // kobo, already taken off total
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['coupon_code', 'coupon_discount']);
        });
        Schema::dropIfExists('coupon_redemptions');
    }
};
