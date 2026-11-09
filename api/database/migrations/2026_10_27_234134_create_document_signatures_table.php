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
        Schema::create('document_signatures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('legal_document_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('signer_name');
            $table->string('signature_path');
            // Audit trail: when, from where, and exactly which file was signed.
            $table->timestamp('signed_at');
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 500)->nullable();
            $table->char('document_sha256', 64);
            // Reenite's signatory at the time of signing, so later changes don't alter signed copies.
            $table->string('signatory_name');
            $table->string('signatory_title')->nullable();
            $table->string('signatory_signature_path');
            $table->timestamps();

            $table->unique(['legal_document_id', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('document_signatures');
    }
};
