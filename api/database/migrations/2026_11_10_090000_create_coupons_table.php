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
        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique(); // stored in capitals
            $table->string('description')->nullable(); // internal note, e.g. "Launch promo"
            $table->string('discount_type', 10); // percent | fixed
            // Percent (1 to 100) or a fixed amount in kobo.
            $table->unsignedBigInteger('discount_value');
            $table->unsignedBigInteger('max_discount')->nullable(); // kobo cap for percent codes
            $table->unsignedBigInteger('min_spend')->nullable(); // kobo
            $table->string('applies_to', 20)->default('all'); // all | services | bookings | plans
            $table->unsignedInteger('max_uses')->nullable(); // across everyone; null = no limit
            $table->unsignedInteger('max_uses_per_customer')->nullable()->default(1);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('coupons');
    }
};
