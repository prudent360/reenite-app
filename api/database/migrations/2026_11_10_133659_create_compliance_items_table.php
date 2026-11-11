<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Deadlines on a business's compliance calendar. Most are worked out from the business's
     * details; customers and staff can add their own.
     */
    public function up(): void
    {
        Schema::create('compliance_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 30); // annual_returns | vat | paye | cit | tcc | personal_tax | custom
            $table->string('title');
            $table->string('period_label', 60)->nullable();
            $table->date('due_on');
            $table->string('status', 20)->default('open'); // open | done | dismissed
            $table->boolean('is_custom')->default(false);
            $table->text('note')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('reminders_sent')->nullable();
            $table->timestamps();

            // Worked-out deadlines are looked up by business, kind and due date (custom ones can share a date).
            $table->index(['business_id', 'kind', 'due_on']);
            $table->index(['status', 'due_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('compliance_items');
    }
};
