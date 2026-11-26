<?php

namespace Tests\Feature\Admin;

use App\Enums\Role;
use App\Models\User;
use App\Notifications\CustomerAddedNotification;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Spatie\Permission\Models\Role as RoleModel;
use Tests\TestCase;

class AddCustomerTest extends TestCase
{
    use RefreshDatabase;

    private User $frontDesk;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        $this->frontDesk = User::factory()->staff()->create(['name' => 'Ime Front'])->assignRole(Role::FrontDesk->value);
        Notification::fake();
    }

    private function staffWith(Role $role): User
    {
        return User::factory()->staff()->create()->assignRole($role->value);
    }

    public function test_front_desk_can_add_a_customer_who_gets_a_set_password_link(): void
    {
        $this->actingAs($this->frontDesk)->postJson('/api/v1/admin/customers', [
            'name' => 'Ada Bassey',
            'email' => ' ADA@Example.com ',
            'phone' => '08011112222',
        ])->assertCreated()
            ->assertJsonPath('data.type', 'customer')
            ->assertJsonPath('data.email', 'ada@example.com');

        $customer = User::firstWhere('email', 'ada@example.com');
        $this->assertTrue($customer->hasRole(Role::Customer->value));
        $this->assertSame([User::STATUS_ACTIVE, '08011112222', false], [$customer->status, $customer->phone, $customer->must_change_password]);
        $this->assertNotNull($customer->email_verified_at);

        Notification::assertSentTo($customer, CustomerAddedNotification::class, function (CustomerAddedNotification $notification) use ($customer) {
            $mail = $notification->toMail($customer);

            return $notification->addedBy === 'Ime Front'
                && str_contains(implode(' ', $mail->introLines), 'Ime Front has created')
                && str_starts_with($mail->actionUrl, config('app.frontend_url').'/reset-password?');
        });
    }

    public function test_the_emailed_link_lets_the_customer_set_a_password(): void
    {
        $this->actingAs($this->frontDesk)->postJson('/api/v1/admin/customers', ['name' => 'Ada Bassey', 'email' => 'ada@example.com'])->assertCreated();
        $customer = User::firstWhere('email', 'ada@example.com');

        $token = null;
        Notification::assertSentTo($customer, CustomerAddedNotification::class, function (CustomerAddedNotification $notification) use (&$token) {
            $token = $notification->token;

            return true;
        });

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'email' => 'ada@example.com',
            'password' => 'A-new-passw0rd!',
            'password_confirmation' => 'A-new-passw0rd!',
        ])->assertOk();

        $this->assertTrue(Hash::check('A-new-passw0rd!', $customer->fresh()->password));
    }

    public function test_a_guest_with_the_same_email_becomes_a_full_account(): void
    {
        $guest = User::factory()->create(['email' => 'guest@example.com', 'status' => User::STATUS_GUEST, 'phone' => '08099998888']);

        $this->actingAs($this->frontDesk)->postJson('/api/v1/admin/customers', ['name' => 'Guest Person', 'email' => 'guest@example.com'])
            ->assertCreated()
            ->assertJsonPath('data.id', $guest->id);

        $guest->refresh();
        $this->assertSame([User::STATUS_ACTIVE, 'Guest Person', '08099998888'], [$guest->status, $guest->name, $guest->phone]);
        $this->assertSame(1, User::where('email', 'guest@example.com')->count());
    }

    public function test_existing_accounts_and_phone_numbers_are_refused(): void
    {
        User::factory()->create(['email' => 'taken@example.com', 'phone' => '08030000000']);

        $this->actingAs($this->frontDesk)->postJson('/api/v1/admin/customers', [
            'name' => 'Someone',
            'email' => 'taken@example.com',
            'phone' => '08030000000',
        ])->assertUnprocessable()->assertJsonValidationErrors(['email', 'phone']);

        $this->actingAs($this->frontDesk)->postJson('/api/v1/admin/customers', ['name' => 'Someone', 'email' => 'new@example.com', 'phone' => 'call me'])
            ->assertUnprocessable()->assertJsonValidationErrors(['phone']);

        Notification::assertNothingSent();
    }

    public function test_roles_without_the_permission_cannot_add_customers(): void
    {
        foreach ([Role::Finance, Role::FilingOfficer] as $role) {
            $this->actingAs($this->staffWith($role))->postJson('/api/v1/admin/customers', ['name' => 'Ada', 'email' => 'ada@example.com'])->assertForbidden();
        }

        $this->actingAs(User::factory()->create()->assignRole(Role::Customer->value))
            ->postJson('/api/v1/admin/customers', ['name' => 'Ada', 'email' => 'ada@example.com'])->assertForbidden();

        $this->assertDatabaseMissing('users', ['email' => 'ada@example.com']);
    }

    public function test_super_admin_chooses_which_roles_can_add_customers(): void
    {
        $superAdmin = $this->staffWith(Role::SuperAdmin);

        $response = $this->actingAs($superAdmin)->getJson('/api/v1/admin/role-permissions')->assertOk();
        $roles = collect($response->json('data.0.roles'))->pluck('granted', 'name');
        $this->assertSame('customers.create', $response->json('data.0.name'));
        $this->assertSame(['operations_manager' => true, 'filing_officer' => false, 'front_desk' => true, 'finance' => false], $roles->all());

        $this->actingAs($superAdmin)->putJson('/api/v1/admin/role-permissions', [
            'permission' => 'customers.create',
            'roles' => ['finance'],
        ])->assertOk()->assertJsonPath('data.0.roles.3', ['name' => 'finance', 'label' => 'Finance', 'granted' => true]);

        $this->actingAs($this->frontDesk)->postJson('/api/v1/admin/customers', ['name' => 'Ada', 'email' => 'ada@example.com'])->assertForbidden();
        $this->actingAs($this->staffWith(Role::Finance))->postJson('/api/v1/admin/customers', ['name' => 'Ada', 'email' => 'ada@example.com'])->assertCreated();
        $this->actingAs($this->staffWith(Role::OperationsManager))->postJson('/api/v1/admin/customers', ['name' => 'Emeka', 'email' => 'emeka@example.com'])->assertForbidden();
    }

    public function test_the_choice_survives_the_seeder_running_again(): void
    {
        RoleModel::findByName(Role::FrontDesk->value, 'web')->revokePermissionTo('customers.create');
        RoleModel::findByName(Role::Finance->value, 'web')->givePermissionTo('customers.create');

        $this->seed(RolesAndPermissionsSeeder::class);

        $this->assertFalse(RoleModel::findByName(Role::FrontDesk->value, 'web')->hasPermissionTo('customers.create'));
        $this->assertTrue(RoleModel::findByName(Role::Finance->value, 'web')->hasPermissionTo('customers.create'));
        $this->assertTrue(RoleModel::findByName(Role::FrontDesk->value, 'web')->hasPermissionTo('bookings.checkin'));
    }

    public function test_only_super_admins_can_change_permissions_and_input_is_checked(): void
    {
        $this->actingAs($this->staffWith(Role::OperationsManager))->getJson('/api/v1/admin/role-permissions')->assertForbidden();
        $this->actingAs($this->staffWith(Role::OperationsManager))
            ->putJson('/api/v1/admin/role-permissions', ['permission' => 'customers.create', 'roles' => ['front_desk']])->assertForbidden();

        $superAdmin = $this->staffWith(Role::SuperAdmin);
        $this->actingAs($superAdmin)->putJson('/api/v1/admin/role-permissions', ['permission' => 'customers.create', 'roles' => ['super_admin']])
            ->assertUnprocessable()->assertJsonValidationErrors(['roles.0']);
        $this->actingAs($superAdmin)->putJson('/api/v1/admin/role-permissions', ['permission' => 'settings.manage', 'roles' => ['front_desk']])
            ->assertUnprocessable()->assertJsonValidationErrors(['permission']);
        $this->actingAs($superAdmin)->putJson('/api/v1/admin/role-permissions', ['permission' => 'customers.create'])
            ->assertUnprocessable()->assertJsonValidationErrors(['roles']);

        $this->actingAs($superAdmin)->putJson('/api/v1/admin/role-permissions', ['permission' => 'customers.create', 'roles' => []])->assertOk();
        $this->assertFalse(RoleModel::findByName(Role::FrontDesk->value, 'web')->hasPermissionTo('customers.create'));
    }
}
