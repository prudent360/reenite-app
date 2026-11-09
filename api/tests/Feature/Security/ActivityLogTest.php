<?php

namespace Tests\Feature\Security;

use App\Enums\Role;
use App\Models\ActivityLog;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class ActivityLogTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function staff(Role $role): User
    {
        return User::factory()->staff()->create()->assignRole($role->value);
    }

    public function test_admin_changes_are_logged_with_field_names_but_no_secrets(): void
    {
        $admin = $this->staff(Role::SuperAdmin);
        $customer = User::factory()->create()->assignRole(Role::Customer->value);

        $this->actingAs($admin)
            ->patchJson("/api/v1/admin/customers/{$customer->id}/status", ['status' => User::STATUS_SUSPENDED, 'api_secret' => 'x'])
            ->assertOk();

        $log = ActivityLog::sole();
        $this->assertSame(ActivityLog::ADMIN_CHANGE, $log->event);
        $this->assertSame($admin->id, $log->user_id);
        $this->assertSame('Changed customers status', $log->description);
        $this->assertSame('PATCH', $log->method);
        $this->assertSame(200, $log->status);
        $this->assertSame(['status'], $log->properties['fields']);
        $this->assertEquals(['user' => $customer->id], $log->properties['subject']);
    }

    public function test_reads_are_not_logged(): void
    {
        $this->actingAs($this->staff(Role::SuperAdmin))->getJson('/api/v1/admin/customers')->assertOk();

        $this->assertDatabaseCount('activity_logs', 0);
    }

    public function test_sign_ins_and_failures_are_logged(): void
    {
        $user = User::factory()->create(['email' => 'ada@example.com']);

        $this->postJson('/api/v1/auth/login', ['email' => 'ada@example.com', 'password' => 'wrong'])->assertUnprocessable();
        $this->postJson('/api/v1/auth/login', ['email' => 'ada@example.com', 'password' => 'password'])->assertOk();

        $this->assertSame(
            [ActivityLog::LOGIN_FAILED, ActivityLog::LOGIN],
            ActivityLog::orderBy('id')->pluck('event')->all(),
        );
        $this->assertSame($user->id, ActivityLog::firstWhere('event', ActivityLog::LOGIN)->user_id);
        $this->assertSame('ada@example.com', ActivityLog::firstWhere('event', ActivityLog::LOGIN_FAILED)->properties['email']);
    }

    public function test_only_super_admins_can_read_the_log(): void
    {
        ActivityLog::create(['event' => ActivityLog::LOGIN, 'description' => 'Signed in']);

        $this->actingAs($this->staff(Role::OperationsManager))->getJson('/api/v1/admin/activity')->assertForbidden();

        $this->actingAs($this->staff(Role::SuperAdmin))
            ->getJson('/api/v1/admin/activity?event=auth.login')
            ->assertOk()
            ->assertJsonPath('data.0.description', 'Signed in');
    }

    public function test_one_email_is_locked_after_thirty_attempts_an_hour(): void
    {
        RateLimiter::clear('hour|ada@example.com');
        User::factory()->create(['email' => 'ada@example.com']);

        foreach (range(1, 30) as $attempt) {
            // A different address each time, so only the hourly per-email limit applies.
            $this->withServerVariables(['REMOTE_ADDR' => "10.0.0.{$attempt}"])
                ->postJson('/api/v1/auth/login', ['email' => 'ada@example.com', 'password' => 'wrong'])
                ->assertUnprocessable();
        }

        $this->withServerVariables(['REMOTE_ADDR' => '10.0.1.1'])
            ->postJson('/api/v1/auth/login', ['email' => 'ada@example.com', 'password' => 'password'])
            ->assertTooManyRequests();
    }

    public function test_old_entries_are_pruned(): void
    {
        $old = ActivityLog::create(['event' => ActivityLog::LOGIN, 'description' => 'Old']);
        $old->forceFill(['created_at' => now()->subYear()->subDay()])->save();
        ActivityLog::create(['event' => ActivityLog::LOGIN, 'description' => 'Recent']);

        $this->artisan('model:prune', ['--model' => [ActivityLog::class]])->assertSuccessful();

        $this->assertSame(['Recent'], ActivityLog::pluck('description')->all());
    }
}
