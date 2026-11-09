<?php

namespace Tests\Feature\Settings;

use App\Enums\EmailTemplateKey;
use App\Enums\Role;
use App\Models\EmailTemplate;
use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmailTemplateTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        $this->admin = User::factory()->staff()->create(['name' => 'Ada Admin'])->assignRole(Role::SuperAdmin->value);
    }

    private function payload(array $overrides = []): array
    {
        return $overrides + [
            'subject' => 'Welcome to {{app_name}}, {{first_name}}',
            'heading' => 'Hello {{name}}',
            'body' => "First paragraph.\n\nThe link lasts {{expires_minutes}} minutes.",
            'button_text' => 'Verify now',
            'footer' => 'Thanks!',
            'is_enabled' => true,
        ];
    }

    public function test_templates_are_listed_with_placeholders(): void
    {
        $this->actingAs($this->admin)->getJson('/api/v1/admin/settings/email-templates')
            ->assertOk()
            ->assertJsonCount(count(EmailTemplateKey::cases()), 'data')
            ->assertJsonPath('data.0.key', 'email_verification')
            ->assertJsonPath('data.0.is_customised', false)
            ->assertJsonFragment(['name' => 'expires_minutes']);
    }

    public function test_edits_are_used_by_the_real_email(): void
    {
        $this->actingAs($this->admin)->putJson('/api/v1/admin/settings/email-templates/email_verification', $this->payload())
            ->assertOk()
            ->assertJsonPath('data.is_customised', true);

        $user = User::factory()->unverified()->create(['name' => 'Aniekan Bassey']);
        $mail = (new VerifyEmailNotification)->toMail($user);

        $this->assertSame('Welcome to Reenite, Aniekan', $mail->subject);
        $this->assertSame('Hello Aniekan Bassey', $mail->greeting);
        $this->assertSame(['First paragraph.', 'The link lasts 60 minutes.'], $mail->introLines);
        $this->assertSame('Verify now', $mail->actionText);
    }

    public function test_unknown_placeholders_are_rejected(): void
    {
        $this->actingAs($this->admin)
            ->putJson('/api/v1/admin/settings/email-templates/password_changed', $this->payload(['body' => 'Hi {{role}}']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('body');
    }

    public function test_reset_restores_defaults(): void
    {
        $this->actingAs($this->admin)->putJson('/api/v1/admin/settings/email-templates/password_reset', $this->payload(['subject' => 'Changed']));

        $this->actingAs($this->admin)->postJson('/api/v1/admin/settings/email-templates/password_reset/reset')
            ->assertOk()
            ->assertJsonPath('data.subject', EmailTemplateKey::PasswordReset->defaults()['subject'])
            ->assertJsonPath('data.is_customised', false);
    }

    public function test_preview_renders_unsaved_draft_with_sample_values(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/v1/admin/settings/email-templates/staff_invite/preview', $this->payload(['body' => '{{invited_by}} invited you as {{role}}.']))
            ->assertOk()
            ->assertJsonPath('subject', 'Welcome to Reenite, Aniekan')
            ->assertSee('Ada Admin invited you as Filing Officer.', false);

        $this->assertSame(EmailTemplateKey::StaffInvite->defaults()['subject'], EmailTemplate::for(EmailTemplateKey::StaffInvite)->subject);
    }

    public function test_disabled_template_is_not_sent(): void
    {
        EmailTemplate::where('key', 'email_verification')->update(['is_enabled' => false]);

        $this->assertSame([], (new VerifyEmailNotification)->via(User::factory()->create()));
    }
}
