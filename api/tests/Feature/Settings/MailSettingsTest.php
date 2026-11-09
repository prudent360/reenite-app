<?php

namespace Tests\Feature\Settings;

use App\Enums\Role;
use App\Models\User;
use App\Support\MailSettings;
use App\Support\Settings;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class MailSettingsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        $this->admin = User::factory()->staff()->create()->assignRole(Role::SuperAdmin->value);
    }

    private function save(array $overrides = []): TestResponse
    {
        return $this->actingAs($this->admin)->putJson('/api/v1/admin/settings/mail', $overrides + [
            'enabled' => true,
            'provider' => 'resend',
            'host' => 'smtp.resend.com',
            'port' => 465,
            'encryption' => 'ssl',
            'username' => 'resend',
            'password' => 're_secret_api_key_123',
            'from_address' => 'hello@reenite.com',
            'from_name' => 'Reenite',
        ]);
    }

    public function test_settings_are_saved_with_an_encrypted_password_that_is_never_returned(): void
    {
        $this->save()->assertOk()->assertJsonPath('data.password_set', true)->assertJsonMissing(['password' => 're_secret_api_key_123']);

        $this->assertStringNotContainsString('re_secret_api_key_123', (string) DB::table('settings')->where('key', 'mail.password')->value('value'));

        // Blank password keeps the saved one.
        $this->save(['password' => ''])->assertOk();
        $this->assertSame('re_secret_api_key_123', app(Settings::class)->get('mail.password'));
    }

    public function test_saved_settings_drive_the_mailer(): void
    {
        $this->save();
        app()->forgetScopedInstances();

        MailSettings::apply();

        $this->assertSame('smtp', config('mail.default'));
        $this->assertSame('smtp.resend.com', config('mail.mailers.smtp.host'));
        $this->assertSame('smtps', config('mail.mailers.smtp.scheme'));
        $this->assertSame('hello@reenite.com', config('mail.from.address'));
    }

    public function test_switching_sending_off_writes_emails_to_the_log(): void
    {
        $this->save(['enabled' => false]);
        app()->forgetScopedInstances();

        $this->actingAs($this->admin)->postJson('/api/v1/admin/settings/mail/test', ['to' => 'someone@example.com'])
            ->assertOk()
            ->assertJsonPath('delivered', false);

        $this->assertSame('log', config('mail.default'));
    }

    public function test_turning_sending_on_requires_a_password(): void
    {
        $this->save(['password' => null])->assertUnprocessable();
    }
}
