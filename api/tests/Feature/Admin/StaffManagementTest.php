<?php

namespace Tests\Feature\Admin;

use App\Enums\Role;
use App\Models\User;
use App\Notifications\StaffInviteNotification;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class StaffManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        $this->superAdmin = User::factory()->staff()->create()->assignRole(Role::SuperAdmin->value);
    }

    public function test_super_admin_can_invite_staff(): void
    {
        Notification::fake();

        $this->actingAs($this->superAdmin)->postJson('/api/v1/admin/staff', [
            'name' => 'Mfon Udo',
            'email' => 'mfon@reenite.test',
            'role' => 'front_desk',
        ])->assertCreated()
            ->assertJsonPath('data.type', 'staff')
            ->assertJsonPath('data.roles.0.name', 'front_desk');

        Notification::assertSentTo(User::firstWhere('email', 'mfon@reenite.test'), StaffInviteNotification::class, function (StaffInviteNotification $notification, array $channels, User $staff) {
            $mail = $notification->toMail($staff);

            return str_contains(implode(' ', $mail->introLines), 'as Front Desk')
                && str_starts_with($mail->actionUrl, config('app.frontend_url').'/reset-password?');
        });
    }

    public function test_staff_role_cannot_be_customer(): void
    {
        $this->actingAs($this->superAdmin)->postJson('/api/v1/admin/staff', [
            'name' => 'Mfon Udo',
            'email' => 'mfon@reenite.test',
            'role' => 'customer',
        ])->assertUnprocessable()->assertJsonValidationErrors('role');
    }

    public function test_super_admin_can_change_role_and_suspend(): void
    {
        $staff = User::factory()->staff()->create()->assignRole(Role::FrontDesk->value);

        $this->actingAs($this->superAdmin)
            ->patchJson("/api/v1/admin/staff/{$staff->id}", ['role' => 'finance', 'status' => 'suspended'])
            ->assertOk()
            ->assertJsonPath('data.roles.0.name', 'finance')
            ->assertJsonPath('data.status', 'suspended');
    }

    public function test_cannot_suspend_self(): void
    {
        $this->actingAs($this->superAdmin)
            ->patchJson("/api/v1/admin/staff/{$this->superAdmin->id}", ['status' => 'suspended'])
            ->assertUnprocessable();
    }

    public function test_non_super_admin_cannot_manage_staff(): void
    {
        $ops = User::factory()->staff()->create()->assignRole(Role::OperationsManager->value);

        $this->actingAs($ops)->getJson('/api/v1/admin/staff')->assertForbidden();
    }
}
