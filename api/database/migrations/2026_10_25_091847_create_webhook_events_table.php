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
        Schema::create('webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('gateway', 20);
            // Gateway event id, or a hash of the payload when the gateway doesn't send one.
            $table->string('event_key', 191);
            $table->string('type', 100)->nullable();
            $table->string('payment_reference', 40)->nullable()->index();
            $table->json('payload');
            $table->timestamp('processed_at')->nullable();
            $table->string('error', 500)->nullable();
            $table->timestamps();

            $table->unique(['gateway', 'event_key']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('webhook_events');
    }
};
