<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Saved cards for automatic renewals, auto-renew on passes and memberships, and the
     * bookkeeping for payment reminders and "finish your booking" nudges.
     */
    public function up(): void
    {
        // A reusable card authorisation from the gateway. We never see or store the card number.
        Schema::create('payment_methods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('gateway', 20);
            $table->string('mode', 10)->default('test');
            $table->text('authorization_code'); // encrypted
            $table->string('signature', 100)->nullable(); // the gateway's fingerprint for the card, to avoid saving it twice
            $table->string('email');
            $table->string('brand', 30)->nullable();
            $table->string('last4', 4);
            $table->string('exp_month', 2)->nullable();
            $table->string('exp_year', 4)->nullable();
            $table->string('bank', 100)->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'gateway', 'mode']);
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->boolean('save_card')->default(false)->after('gateway_data');
            // Set when we charged a saved card (an automatic renewal), rather than the customer paying at checkout.
            $table->foreignId('payment_method_id')->nullable()->after('save_card')->constrained()->nullOnDelete();
        });

        foreach (['customer_memberships', 'customer_passes'] as $plans) {
            Schema::table($plans, function (Blueprint $table) use ($plans) {
                $table->boolean('auto_renew')->default(false)->after('status');
                // The period this one follows on from, when it's a renewal.
                $table->foreignId('renewal_of_id')->nullable()->after('auto_renew')->constrained($plans)->nullOnDelete();
                $table->timestamp('renewal_notice_at')->nullable();
                $table->unsignedTinyInteger('renewal_attempts')->default(0);
                $table->timestamp('last_renewal_attempt_at')->nullable();
                $table->string('renewal_failure', 255)->nullable();
                $table->timestamp('nudged_at')->nullable();
            });
        }

        Schema::table('invoices', function (Blueprint $table) {
            $table->json('reminders_sent')->nullable()->after('notes');
        });

        foreach (['bookings', 'consultations'] as $held) {
            Schema::table($held, function (Blueprint $table) {
                // When we emailed about an unpaid hold that ran out, so it happens once.
                $table->timestamp('nudged_at')->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (['bookings', 'consultations'] as $held) {
            Schema::table($held, fn (Blueprint $table) => $table->dropColumn('nudged_at'));
        }
        Schema::table('invoices', fn (Blueprint $table) => $table->dropColumn('reminders_sent'));
        foreach (['customer_memberships', 'customer_passes'] as $plans) {
            Schema::table($plans, function (Blueprint $table) {
                $table->dropConstrainedForeignId('renewal_of_id');
                $table->dropColumn(['auto_renew', 'renewal_notice_at', 'renewal_attempts', 'last_renewal_attempt_at', 'renewal_failure', 'nudged_at']);
            });
        }
        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('payment_method_id');
            $table->dropColumn('save_card');
        });
        Schema::dropIfExists('payment_methods');
    }
};
