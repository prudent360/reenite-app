<?php

namespace Tests\Feature\Notifications;

use App\Enums\EmailTemplateKey;
use App\Enums\Role;
use App\Models\Business;
use App\Models\ComplianceItem;
use App\Models\Setting;
use App\Models\User;
use App\Notifications\Channels\WhatsAppChannel;
use App\Notifications\ComplianceNotification;
use App\Support\Settings;
use App\Support\WhatsApp;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class WhatsAppTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        $this->admin = User::factory()->staff()->create()->assignRole(Role::SuperAdmin->value);
    }

    private function configure(array $templates = ['compliance_due_soon' => 'deadline_reminder']): void
    {
        $this->actingAs($this->admin)->putJson('/api/v1/admin/settings/whatsapp', [
            'enabled' => true,
            'phone_number_id' => '1234567890',
            'access_token' => 'EAAG-secret-token',
            'language' => 'en',
            'templates' => $templates,
        ])->assertOk();
    }

    private function dueItem(User $customer): ComplianceItem
    {
        $business = Business::factory()->for($customer)->create(['name' => 'Obi Foods Ltd']);

        return ComplianceItem::factory()->for($business)->create(['title' => 'File VAT return', 'due_on' => now()->addDays(3)->toDateString()]);
    }

    public function test_admins_save_settings_without_the_token_ever_coming_back(): void
    {
        $this->actingAs($this->admin)->putJson('/api/v1/admin/settings/whatsapp', ['enabled' => true, 'phone_number_id' => '123', 'language' => 'en', 'templates' => []])
            ->assertUnprocessable();
        $this->actingAs($this->admin)->putJson('/api/v1/admin/settings/whatsapp', ['enabled' => false, 'phone_number_id' => null, 'language' => 'en', 'templates' => ['staff_new_booking' => 'x']])
            ->assertUnprocessable();
        $this->actingAs($this->admin)->putJson('/api/v1/admin/settings/whatsapp', ['enabled' => false, 'phone_number_id' => null, 'language' => 'en', 'templates' => ['booking_confirmed' => 'Booking Confirmed!']])
            ->assertJsonValidationErrors('templates.booking_confirmed');

        $this->configure();

        $this->actingAs($this->admin)->getJson('/api/v1/admin/settings/whatsapp')
            ->assertOk()
            ->assertJsonPath('data.configured', true)
            ->assertJsonPath('data.access_token_set', true)
            ->assertJsonMissingPath('data.access_token')
            ->assertJsonFragment(['key' => 'compliance_due_soon', 'template' => 'deadline_reminder']);
        $this->assertStringNotContainsString('EAAG-secret-token', (string) Setting::where('key', 'whatsapp.access_token')->value('value'));
    }

    public function test_customers_who_opted_in_get_the_template_with_its_values_in_order(): void
    {
        Http::fake(['graph.facebook.com/*' => Http::response(['messages' => [['id' => 'wamid.1']]])]);
        $this->configure();
        $customer = User::factory()->create(['name' => 'Ada Obi', 'phone' => '0803 123 4567']);
        $this->actingAs($customer)->putJson('/api/v1/profile', ['name' => 'Ada Obi', 'phone' => '0803 123 4567', 'whatsapp_updates' => true])
            ->assertOk()
            ->assertJsonPath('data.whatsapp_updates', true);

        $customer->refresh()->notify(new ComplianceNotification(EmailTemplateKey::ComplianceDueSoon, $this->dueItem($customer)));

        Http::assertSent(fn (Request $request) => $request->url() === 'https://graph.facebook.com/v23.0/1234567890/messages'
            && $request->hasHeader('Authorization', 'Bearer EAAG-secret-token')
            && $request['to'] === '2348031234567'
            && $request['template']['name'] === 'deadline_reminder'
            && array_column($request['template']['components'][0]['parameters'], 'text') === ['Ada', 'File VAT return', 'Obi Foods Ltd', now()->addDays(3)->format('l j F Y')]);
    }

    public function test_nothing_goes_to_customers_who_did_not_opt_in_or_events_without_a_template(): void
    {
        Http::fake();
        $this->configure(['booking_confirmed' => 'booking_confirmed']);
        $optedIn = User::factory()->create(['phone' => '08031234567', 'whatsapp_opt_in_at' => now()]);
        $notOptedIn = User::factory()->create(['phone' => '08031234568']);

        $notification = new ComplianceNotification(EmailTemplateKey::ComplianceDueSoon, $this->dueItem($optedIn));
        $this->assertNotContains(WhatsAppChannel::class, $notification->via($optedIn)); // no template for this event
        $this->assertNotContains(WhatsAppChannel::class, (new ComplianceNotification(EmailTemplateKey::ComplianceDueSoon, $this->dueItem($notOptedIn)))->via($notOptedIn));

        $this->actingAs($notOptedIn)->putJson('/api/v1/profile', ['name' => 'X', 'phone' => null, 'whatsapp_updates' => true])->assertJsonValidationErrors('phone');
        Http::assertNothingSent();
    }

    public function test_a_whatsapp_failure_is_logged_and_does_not_throw(): void
    {
        Http::fake(['graph.facebook.com/*' => Http::response(['error' => ['message' => 'Template not approved']], 400)]);
        Log::spy();
        $this->configure();
        $customer = User::factory()->create(['phone' => '08031234567', 'whatsapp_opt_in_at' => now()]);
        $notification = new ComplianceNotification(EmailTemplateKey::ComplianceDueSoon, $this->dueItem($customer));

        // The mail channel runs first, so a WhatsApp error must stay inside its own channel.
        $this->assertSame(['mail', WhatsAppChannel::class], $notification->via($customer));
        app(WhatsAppChannel::class)->send($customer, $notification);

        Http::assertSentCount(1);
        Log::shouldHaveReceived('warning')->once()->withArgs(fn (string $message, array $context) => $message === 'WhatsApp message not sent' && $context['event'] === 'compliance_due_soon');
    }

    public function test_the_test_button_reports_what_meta_said(): void
    {
        Http::fake(['graph.facebook.com/*' => Http::response(['error' => ['message' => 'Invalid OAuth access token', 'error_user_msg' => 'Your access token has expired.']], 401)]);
        $this->configure();

        $this->actingAs($this->admin)->postJson('/api/v1/admin/settings/whatsapp/test', ['to' => '08031234567'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'WhatsApp said: Your access token has expired.');
        Http::assertSent(fn (Request $request) => $request['template']['name'] === 'hello_world' && $request['template']['language']['code'] === 'en_US');
    }

    public function test_phone_numbers_are_put_in_international_format(): void
    {
        $this->assertSame('2348031234567', WhatsApp::normalisePhone('0803 123 4567'));
        $this->assertSame('2348031234567', WhatsApp::normalisePhone('+234 803-123-4567'));
        $this->assertNull(WhatsApp::normalisePhone('12345'));
        $this->assertSame('Line one line two', WhatsApp::cleanParameter("Line one\n\n  line two"));
        $this->assertFalse(app(Settings::class)->get('whatsapp.enabled', false));
    }
}
