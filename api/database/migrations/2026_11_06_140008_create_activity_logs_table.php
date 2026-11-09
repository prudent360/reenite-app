<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            // auth.login, auth.login_failed, auth.logout or admin.change
            $table->string('event', 40)->index();
            $table->string('description');
            $table->string('route')->nullable();
            $table->string('method', 10)->nullable();
            $table->string('path')->nullable();
            $table->unsignedSmallInteger('status')->nullable();
            $table->json('properties')->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
