<?php

namespace Tests\Feature\Settings;

use App\Enums\EmailTemplateKey;
use App\Enums\Role;
use App\Models\BankAccount;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\User;
use App\Notifications\StaffAlertNotification;
use App\Support\Settings;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class StaffAlertTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        Notification::fake();
    }

    public function test_officers_are_emailed_when_given_an_order(): void
    {
        $manager = User::factory()->staff()->create()->assignRole(Role::OperationsManager->value);
        $officer = User::factory()->staff()->create()->assignRole(Role::FilingOfficer->value);
        $order = Order::factory()->create();

        $this->actingAs($manager)->postJson("/api/v1/admin/orders/{$order->reference}/assign", ['user_id' => $officer->id])->assertOk();
        $this->actingAs($manager)->postJson("/api/v1/admin/orders/{$order->reference}/assign", ['user_id' => $manager->id])->assertOk();

        Notification::assertSentTo($officer, StaffAlertNotification::class, fn (StaffAlertNotification $alert) => $alert->key === EmailTemplateKey::StaffOrderAssigned
            && $alert->values['assigned_by'] === $manager->name
            && str_ends_with($alert->url, "/admin/orders/{$order->reference}"));
        Notification::assertNotSentTo($manager, StaffAlertNotification::class);
    }

    public function test_finance_hears_about_transfers_to_check(): void
    {
        Storage::fake('local');
        BankAccount::factory()->create();
        app(Settings::class)->set('bank_transfer.enabled', true);
        $finance = User::factory()->staff()->create()->assignRole(Role::Finance->value);
        $superAdmin = User::factory()->staff()->create()->assignRole(Role::SuperAdmin->value);
        $customer = User::factory()->create();
        $invoice = Invoice::factory()->for($customer)->create();

        $this->actingAs($customer)->post("/api/v1/billing/invoices/{$invoice->id}/bank-transfer", [
            'proof' => UploadedFile::fake()->image('receipt.jpg'),
            'sender_name' => $customer->name,
            'transferred_on' => now()->toDateString(),
        ], ['Accept' => 'application/json'])->assertCreated();

        Notification::assertSentTo($finance, StaffAlertNotification::class, fn (StaffAlertNotification $alert) => $alert->key === EmailTemplateKey::StaffTransferToReview);
        Notification::assertNotSentTo($superAdmin, StaffAlertNotification::class);
    }

    public function test_template_list_is_grouped_with_new_templates(): void
    {
        $admin = User::factory()->staff()->create()->assignRole(Role::SuperAdmin->value);

        $templates = $this->actingAs($admin)->getJson('/api/v1/admin/settings/email-templates')->assertOk()->json('data');

        $this->assertCount(count(EmailTemplateKey::cases()), $templates);
        $this->assertSame(EmailTemplateKey::GROUPS, array_values(array_unique(array_column($templates, 'group'))));

        $this->actingAs($admin)->postJson('/api/v1/admin/settings/email-templates/booking_confirmed/preview', EmailTemplateKey::BookingConfirmed->defaults())
            ->assertOk()
            ->assertJsonPath('subject', fn (string $subject) => str_starts_with($subject, "You're booked: Podcast Studio on"));
    }
}
