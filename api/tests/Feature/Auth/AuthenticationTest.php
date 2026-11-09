<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_registration_succeeds_even_when_the_mail_server_fails(): void
    {
        // An unreachable SMTP server, like a wrong host or a blocked port on shared hosting.
        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.host' => '127.0.0.1',
            'mail.mailers.smtp.port' => 1,
            'mail.mailers.smtp.timeout' => 1,
        ]);

        $this->postJson('/api/v1/auth/register', [
            'name' => 'Mfon Udo',
            'email' => 'mfon@example.com',
            'password' => 'secret-pass-123',
            'password_confirmation' => 'secret-pass-123',
        ])->assertCreated()->assertJsonStructure(['token']);

        $this->assertDatabaseHas('users', ['email' => 'mfon@example.com']);
    }

    public function test_customer_can_register_and_receives_token(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Aniekan Bassey',
            'email' => 'aniekan@example.com',
            'phone' => '+2348031234567',
            'password' => 'secret-pass-1',
            'password_confirmation' => 'secret-pass-1',
        ]);

        $response->assertCreated()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'type', 'roles']])
            ->assertJsonPath('user.type', 'customer')
            ->assertJsonPath('user.roles.0.name', 'customer')
            ->assertJsonPath('user.email_verified', false);

        $user = User::firstWhere('email', 'aniekan@example.com');
        Notification::assertSentTo($user, VerifyEmailNotification::class);
    }

    public function test_registration_validates_input(): void
    {
        User::factory()->create(['email' => 'taken@example.com']);

        $this->postJson('/api/v1/auth/register', [
            'name' => '',
            'email' => 'taken@example.com',
            'password' => 'short',
            'password_confirmation' => 'different',
        ])->assertUnprocessable()->assertJsonValidationErrors(['name', 'email', 'password']);
    }

    public function test_user_can_login_and_fetch_profile(): void
    {
        $user = User::factory()->create(['email' => 'ime@example.com']);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'IME@example.com',
            'password' => 'password',
        ])->assertOk()->json('token');

        $this->withToken($token)->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.email', 'ime@example.com');

        $this->assertNotNull($user->fresh()->last_login_at);
    }

    public function test_login_fails_with_wrong_password(): void
    {
        User::factory()->create(['email' => 'ime@example.com']);

        $this->postJson('/api/v1/auth/login', ['email' => 'ime@example.com', 'password' => 'wrong'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_suspended_user_cannot_login(): void
    {
        User::factory()->suspended()->create(['email' => 'ime@example.com']);

        $this->postJson('/api/v1/auth/login', ['email' => 'ime@example.com', 'password' => 'password'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_logout_revokes_current_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('web')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertNoContent();

        $this->assertCount(0, $user->tokens()->get());
    }

    public function test_guest_cannot_fetch_profile(): void
    {
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_user_can_update_profile_and_password(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('web')->plainTextToken;
        $user->createToken('other-device');

        $this->withToken($token)->putJson('/api/v1/profile', ['name' => 'New Name', 'phone' => '+2348099999999'])
            ->assertOk()
            ->assertJsonPath('data.name', 'New Name');

        $this->withToken($token)->putJson('/api/v1/profile/password', [
            'current_password' => 'password',
            'password' => 'new-password-1',
            'password_confirmation' => 'new-password-1',
        ])->assertOk();

        $this->assertCount(1, $user->tokens()->get());
    }
}
