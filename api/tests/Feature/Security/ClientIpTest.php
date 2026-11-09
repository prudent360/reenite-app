<?php

namespace Tests\Feature\Security;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClientIpTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(array $headers): void
    {
        User::factory()->create(['email' => 'ada@example.com']);

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9'])
            ->withHeaders($headers)
            ->postJson('/api/v1/auth/login', ['email' => 'ada@example.com', 'password' => 'password'])
            ->assertOk();
    }

    public function test_visitor_ip_from_the_website_is_recorded_when_the_key_matches(): void
    {
        config(['app.internal_api_key' => 'shared-secret']);

        $this->signIn(['X-Reenite-Client' => 'shared-secret', 'X-Forwarded-For' => '102.89.1.20', 'User-Agent' => 'Mozilla/5.0 (iPhone)']);

        $log = ActivityLog::sole();
        $this->assertSame('102.89.1.20', $log->ip);
        $this->assertSame('Mozilla/5.0 (iPhone)', $log->user_agent);
    }

    public function test_forwarded_ip_is_ignored_without_the_key(): void
    {
        config(['app.internal_api_key' => 'shared-secret']);

        $this->signIn(['X-Reenite-Client' => 'guess', 'X-Forwarded-For' => '102.89.1.20']);

        $this->assertSame('203.0.113.9', ActivityLog::sole()->ip);
    }
}
