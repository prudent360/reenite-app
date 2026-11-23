<?php

namespace Tests\Feature;

use App\Enums\InvoiceStatus;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\Business;
use App\Models\Consultation;
use App\Models\CustomerMembership;
use App\Models\CustomerPass;
use App\Models\Invoice;
use App\Models\Mailbox;
use App\Models\Order;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerProfileTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_staff_see_a_customer_with_their_history(): void
    {
        $frontDesk = User::factory()->staff()->create()->assignRole(Role::FrontDesk->value);
        $customer = User::factory()->create();
        Booking::factory()->for($customer)->create();
        Order::factory()->for($customer)->create();
        Business::factory()->for($customer)->create(['name' => 'Bassey Ventures']);
        Invoice::factory()->for($customer)->create(['status' => InvoiceStatus::Paid, 'total' => 500000, 'amount_paid' => 500000, 'amount_refunded' => 0]);
        Invoice::factory()->for($customer)->create(['status' => InvoiceStatus::Unpaid, 'total' => 300000, 'amount_paid' => 100000, 'amount_refunded' => 0]);
        Invoice::factory()->for($customer)->create(['status' => InvoiceStatus::Void, 'total' => 900000, 'amount_paid' => 0, 'amount_refunded' => 0]);
        Booking::factory()->for(User::factory())->create();
        Consultation::factory()->for($customer)->create();
        CustomerPass::factory()->for($customer)->create();
        CustomerMembership::factory()->for($customer)->create();
        Mailbox::factory()->for($customer)->create();

        $this->actingAs($frontDesk)->getJson("/api/v1/admin/customers/{$customer->id}")
            ->assertOk()
            ->assertJsonPath('data.email', $customer->email)
            ->assertJsonPath('overview.totals.bookings', 1)
            ->assertJsonPath('overview.totals.orders', 1)
            ->assertJsonPath('overview.totals.paid', 600000)
            ->assertJsonPath('overview.totals.outstanding', 200000)
            ->assertJsonCount(1, 'overview.bookings')
            ->assertJsonCount(3, 'overview.invoices')
            ->assertJsonPath('overview.businesses.0.name', 'Bassey Ventures')
            ->assertJsonCount(1, 'overview.consultations')
            ->assertJsonCount(2, 'overview.plans')
            ->assertJsonCount(1, 'overview.mailboxes');
    }

    public function test_staff_accounts_are_not_shown_as_customers(): void
    {
        $admin = User::factory()->staff()->create()->assignRole(Role::SuperAdmin->value);

        $this->actingAs($admin)->getJson("/api/v1/admin/customers/{$admin->id}")->assertNotFound();
    }
}
