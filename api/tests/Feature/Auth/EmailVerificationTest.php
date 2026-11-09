<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class EmailVerificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_verification_link_from_email_verifies_user(): void
    {
        Notification::fake();
        $user = User::factory()->unverified()->create();

        $this->actingAs($user)->postJson('/api/v1/auth/email/resend')->assertOk();

        $link = null;
        Notification::assertSentTo($user, VerifyEmailNotification::class, function (VerifyEmailNotification $notification) use ($user, &$link) {
            $url = $notification->toMail($user)->actionUrl;
            parse_str((string) parse_url($url, PHP_URL_QUERY), $query);
            $link = $query['link'] ?? null;

            return str_starts_with($url, config('app.frontend_url').'/verify-email?');
        });

        $this->getJson($link)->assertOk();

        $this->assertTrue($user->fresh()->hasVerifiedEmail());
    }

    public function test_tampered_verification_link_is_rejected(): void
    {
        $user = User::factory()->unverified()->create();

        $this->getJson("/api/v1/auth/email/verify/{$user->id}/".sha1($user->email).'?expires=9999999999&signature=fake')
            ->assertForbidden();

        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }
}
