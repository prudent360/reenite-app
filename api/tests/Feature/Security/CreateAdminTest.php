<?php

namespace Tests\Feature\Security;

use App\Enums\Role;
use App\Models\User;
use Database\Seeders\ProductionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CreateAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_production_seed_has_no_demo_accounts_and_the_first_admin_can_be_created(): void
    {
        $this->seed(ProductionSeeder::class);
        $this->assertSame(0, User::count());

        $this->artisan('app:create-admin', ['email' => 'Founder@Reenite.com', '--name' => 'Reenite Founder'])
            ->expectsQuestion('Password (at least 8 characters, letters and numbers)', 'strongpass123')
            ->assertSuccessful();

        $admin = User::sole();
        $this->assertSame('founder@reenite.com', $admin->email);
        $this->assertTrue($admin->isStaff());
        $this->assertTrue($admin->hasRole(Role::SuperAdmin->value));
        $this->assertTrue(Hash::check('strongpass123', $admin->password));
        $this->assertNotNull($admin->email_verified_at);
    }

    public function test_it_refuses_a_short_password(): void
    {
        $this->seed(ProductionSeeder::class);

        $this->artisan('app:create-admin', ['email' => 'founder@reenite.com', '--name' => 'Founder'])
            ->expectsQuestion('Password (at least 8 characters, letters and numbers)', 'short')
            ->assertFailed();

        $this->assertSame(0, User::count());
    }
}
