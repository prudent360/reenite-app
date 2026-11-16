<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_memberships', function (Blueprint $table) {
            // Virtual address application: the name the customer wants on the address, used when the mailbox opens.
            $table->string('mailbox_name', 150)->nullable()->after('name');
        });

        Schema::table('mailboxes', function (Blueprint $table) {
            // Printed on the proof-of-address letter, so anyone can check it on the website.
            $table->string('verification_code', 16)->nullable()->unique()->after('number');
        });

        foreach (DB::table('mailboxes')->pluck('id') as $id) {
            DB::table('mailboxes')->where('id', $id)->update(['verification_code' => strtoupper(Str::random(10))]);
        }
    }

    public function down(): void
    {
        Schema::table('mailboxes', fn (Blueprint $table) => $table->dropColumn('verification_code'));
        Schema::table('customer_memberships', fn (Blueprint $table) => $table->dropColumn('mailbox_name'));
    }
};
