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
        Schema::table('membership_plans', function (Blueprint $table) {
            // Virtual office: the membership gives the customer a mailbox at this location's address.
            $table->foreignId('mailbox_location_id')->nullable()->after('perks')->constrained('locations')->nullOnDelete();
        });

        Schema::create('mailboxes', function (Blueprint $table) {
            $table->id();
            $table->string('number', 20)->nullable()->unique(); // RN-0012, set after insert
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('location_id')->constrained()->restrictOnDelete();
            $table->foreignId('customer_membership_id')->nullable()->constrained()->nullOnDelete();
            $table->string('business_name', 150); // the name mail is addressed to
            $table->string('status', 20)->default('active'); // active | closed
            // When the paid-for period ends; null = no end date (opened by staff).
            $table->timestamp('active_until')->nullable();
            $table->string('notes', 500)->nullable(); // staff only
            $table->foreignId('opened_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'location_id']);
        });

        Schema::create('mail_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mailbox_id')->constrained()->restrictOnDelete();
            $table->string('kind', 20); // letter | parcel | official
            $table->string('sender', 150)->nullable();
            $table->string('description', 500)->nullable();
            $table->timestamp('received_at');
            // waiting (at the front desk) | collected | forwarded | shredded
            $table->string('status', 20)->default('waiting')->index();
            // What the customer asked for while it's waiting: collect | forward | scan | shred.
            $table->string('requested_action', 20)->nullable()->index();
            $table->string('request_note', 500)->nullable(); // e.g. the forwarding address
            $table->timestamp('requested_at')->nullable();
            $table->string('scan_path')->nullable(); // private disk
            $table->string('scan_name')->nullable();
            $table->timestamp('scanned_at')->nullable();
            $table->string('handled_note', 500)->nullable();
            $table->timestamp('handled_at')->nullable();
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('logged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('mail_items');
        Schema::dropIfExists('mailboxes');
        Schema::table('membership_plans', function (Blueprint $table) {
            $table->dropConstrainedForeignId('mailbox_location_id');
        });
    }
};
