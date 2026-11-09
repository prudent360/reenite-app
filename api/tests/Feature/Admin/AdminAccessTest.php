<?php

namespace Tests\Feature\Admin;

use App\Enums\Role;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAccessTest extends TestCase
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

    public function test_customer_cannot_access_admin_api(): void
    {
        $customer = User::factory()->create()->assignRole(Role::Customer->value);

        $this->actingAs($customer)->getJson('/api/v1/admin/dashboard')->assertForbidden();
    }

    public function test_staff_can_view_dashboard(): void
    {
        User::factory(3)->create();

        $this->actingAs($this->staff(Role::FilingOfficer))
            ->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('stats.customers', 3)
            ->assertJsonPath('stats.staff', 1);
    }

    public function test_dashboard_reports_signups_for_the_last_six_months(): void
    {
        $this->travelTo(now()->setDate(2026, 10, 15));
        User::factory(2)->create(['created_at' => now()->subMonths(1)]);
        User::factory()->create(['created_at' => now()]);
        User::factory()->create(['created_at' => now()->subMonths(8)]);

        $response = $this->actingAs($this->staff(Role::FrontDesk))->getJson('/api/v1/admin/dashboard')->assertOk();

        $this->assertSame(['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'], array_column($response->json('signups_by_month'), 'label'));
        $this->assertSame([0, 0, 0, 0, 2, 1], array_column($response->json('signups_by_month'), 'value'));
        $response->assertJsonPath('stats.new_customers_30d', 3);
    }

    public function test_suspended_staff_is_blocked(): void
    {
        $staff = $this->staff(Role::OperationsManager);
        $staff->update(['status' => User::STATUS_SUSPENDED]);

        $this->actingAs($staff)->getJson('/api/v1/admin/dashboard')->assertForbidden();
    }

    public function test_customer_list_requires_permission(): void
    {
        User::factory(2)->create(['name' => 'Etim Okon']);

        $this->actingAs($this->staff(Role::FrontDesk))
            ->getJson('/api/v1/admin/customers?search=Etim')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->actingAs($this->staff(Role::FrontDesk))
            ->patchJson('/api/v1/admin/customers/'.User::first()->id.'/status', ['status' => 'suspended'])
            ->assertForbidden();
    }

    public function test_operations_manager_can_suspend_customer_and_revoke_tokens(): void
    {
        $customer = User::factory()->create();
        $customer->createToken('web');

        $this->actingAs($this->staff(Role::OperationsManager))
            ->patchJson("/api/v1/admin/customers/{$customer->id}/status", ['status' => 'suspended'])
            ->assertOk()
            ->assertJsonPath('data.status', 'suspended');

        $this->assertCount(0, $customer->tokens()->get());
    }

    public function test_staff_profile_includes_role_permissions(): void
    {
        $this->actingAs($this->staff(Role::FrontDesk))
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.roles.0.name', 'front_desk')
            ->assertJsonFragment(['bookings.checkin']);
    }

    public function test_staff_list_renders_members_of_every_role(): void
    {
        foreach (Role::staffRoles() as $role) {
            $this->staff($role);
        }

        $this->actingAs(User::role(Role::SuperAdmin->value)->first())
            ->getJson('/api/v1/admin/staff')
            ->assertOk()
            ->assertJsonCount(count(Role::staffRoles()), 'data');
    }

    public function test_super_admin_bypasses_permission_checks(): void
    {
        $this->actingAs($this->staff(Role::SuperAdmin))
            ->getJson('/api/v1/admin/staff')
            ->assertOk();
    }
}
