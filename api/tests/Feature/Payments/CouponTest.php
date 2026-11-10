<?php

namespace Tests\Feature\Payments;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Models\Coupon;
use App\Models\CustomerPass;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\PassPlan;
use App\Models\Payment;
use App\Models\PaymentGateway;
use App\Models\User;
use App\Payments\CouponService;
use App\Support\Settings;
use App\Workspace\BookingService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class CouponTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;

    private Invoice $invoice;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        Notification::fake();

        $this->customer = User::factory()->create();
        $this->invoice = Invoice::factory()->for($this->customer)->create(['subtotal' => 2_000_000, 'total' => 2_000_000]);
    }

    private function apply(string $code, ?Invoice $invoice = null, ?User $customer = null): TestResponse
    {
        $invoice ??= $this->invoice;

        return $this->actingAs($customer ?? $this->customer)->postJson("/api/v1/billing/invoices/{$invoice->id}/coupon", ['code' => $code]);
    }

    public function test_finance_creates_a_code_and_front_desk_cannot(): void
    {
        $finance = User::factory()->staff()->create()->assignRole(Role::Finance->value);
        $frontDesk = User::factory()->staff()->create()->assignRole(Role::FrontDesk->value);
        $coupon = ['code' => ' launch-20 ', 'discount_type' => 'percent', 'discount_value' => 20, 'max_discount' => 500_000, 'applies_to' => 'all', 'is_active' => true];

        $this->actingAs($frontDesk)->postJson('/api/v1/admin/finance/coupons', $coupon)->assertForbidden();
        $this->actingAs($finance)->postJson('/api/v1/admin/finance/coupons', $coupon)
            ->assertCreated()
            ->assertJsonPath('data.code', 'LAUNCH-20')
            ->assertJsonPath('data.label', '20% off (up to ₦5,000)')
            ->assertJsonPath('data.state', 'active');

        $this->actingAs($finance)->postJson('/api/v1/admin/finance/coupons', ['code' => 'launch-20'] + $coupon)->assertJsonValidationErrors('code');
        $this->actingAs($finance)->postJson('/api/v1/admin/finance/coupons', ['code' => 'HALF', 'discount_value' => 150] + $coupon)->assertJsonValidationErrors('discount_value');
    }

    public function test_a_code_lowers_the_invoice_and_the_payment_is_for_the_lower_amount(): void
    {
        Coupon::factory()->create(['code' => 'SAVE10', 'discount_value' => 10]);
        PaymentGateway::where('code', 'paystack')->first()->update([
            'is_enabled' => true, 'mode' => 'test',
            'credentials' => ['test' => ['public_key' => 'pk_test_abc', 'secret_key' => 'sk_test_secret123456789']],
        ]);
        Http::fake([
            'api.paystack.co/transaction/initialize' => Http::response(['status' => true, 'data' => ['authorization_url' => 'https://checkout.paystack.com/abc', 'access_code' => 'abc']]),
            'api.paystack.co/transaction/verify/*' => Http::response(['status' => true, 'data' => ['id' => 1, 'status' => 'success', 'amount' => 1_800_000, 'currency' => 'NGN', 'channel' => 'card']]),
        ]);

        $this->apply('save10')
            ->assertOk()
            ->assertJsonPath('data.coupon_code', 'SAVE10')
            ->assertJsonPath('data.coupon_discount', 200_000)
            ->assertJsonPath('data.total', 1_800_000)
            ->assertJsonPath('data.balance', 1_800_000);

        $reference = $this->actingAs($this->customer)->postJson("/api/v1/billing/invoices/{$this->invoice->id}/pay", ['gateway' => 'paystack'])->assertCreated()->json('reference');
        $this->assertSame(1_800_000, Payment::firstWhere('reference', $reference)->amount);
        $this->actingAs($this->customer)->postJson("/api/v1/billing/payments/{$reference}/verify")->assertOk();

        $this->assertSame(InvoiceStatus::Paid, $this->invoice->refresh()->status);
        $this->apply('SAVE10')->assertJsonValidationErrors(['code' => 'Codes can only be added before anything has been paid on the invoice.']);
    }

    public function test_swapping_codes_does_not_stack_and_removing_restores_the_total(): void
    {
        Coupon::factory()->create(['code' => 'TEN', 'discount_value' => 10]);
        Coupon::factory()->fixed(500_000)->create(['code' => 'FIVEK']);

        $this->apply('TEN')->assertJsonPath('data.total', 1_800_000);
        $this->apply('FIVEK')->assertJsonPath('data.total', 1_500_000)->assertJsonPath('data.coupon_code', 'FIVEK');
        $this->assertDatabaseCount('coupon_redemptions', 1);

        $this->actingAs($this->customer)->deleteJson("/api/v1/billing/invoices/{$this->invoice->id}/coupon")
            ->assertOk()
            ->assertJsonPath('data.total', 2_000_000)
            ->assertJsonPath('data.coupon_code', null);
        $this->assertDatabaseCount('coupon_redemptions', 0);
    }

    public function test_codes_that_cannot_be_used_explain_why(): void
    {
        Coupon::factory()->create(['code' => 'OLD', 'expires_at' => now()->subDay()]);
        Coupon::factory()->create(['code' => 'SOON', 'starts_at' => now()->addDay()]);
        Coupon::factory()->create(['code' => 'DESKS', 'applies_to' => 'bookings']);
        Coupon::factory()->create(['code' => 'BIGSPEND', 'min_spend' => 5_000_000]);
        Coupon::factory()->create(['code' => 'OFF', 'is_active' => false]);

        $this->apply('NOPE')->assertJsonValidationErrors(['code' => "We don't recognise that code. Check the spelling and try again."]);
        $this->apply('OLD')->assertJsonValidationErrors(['code' => 'This code has expired.']);
        $this->apply('OFF')->assertJsonValidationErrors(['code' => 'This code has expired.']);
        $this->apply('SOON')->assertJsonValidationErrors(['code' => "This code can't be used yet."]);
        $this->apply('DESKS')->assertJsonValidationErrors(['code' => 'This code can only be used on workspace bookings.']);
        $this->apply('BIGSPEND')->assertJsonValidationErrors(['code' => 'This code needs a purchase of at least ₦50,000.']);
        $this->assertSame(2_000_000, $this->invoice->refresh()->total);
    }

    public function test_a_code_limited_to_services_works_on_an_order_invoice(): void
    {
        Coupon::factory()->create(['code' => 'BIZ', 'applies_to' => 'services']);
        $this->invoice->source()->associate(Order::factory()->for($this->customer)->create())->save();

        $this->apply('BIZ')->assertOk()->assertJsonPath('data.total', 1_800_000);
    }

    public function test_usage_limits_count_live_invoices_and_free_up_when_one_is_cancelled(): void
    {
        Coupon::factory()->create(['code' => 'ONCE', 'max_uses' => 1, 'max_uses_per_customer' => 1]);
        $second = Invoice::factory()->for($this->customer)->create(['subtotal' => 1_000_000, 'total' => 1_000_000]);
        $otherCustomer = User::factory()->create();
        $theirs = Invoice::factory()->for($otherCustomer)->create(['subtotal' => 1_000_000, 'total' => 1_000_000]);

        $this->apply('ONCE')->assertOk();
        $this->apply('ONCE', $second)->assertJsonValidationErrors(['code' => 'This code has been fully used.']);

        $this->invoice->update(['status' => InvoiceStatus::Void]);
        $this->apply('ONCE', $theirs, $otherCustomer)->assertOk();
    }

    public function test_one_use_per_customer(): void
    {
        Coupon::factory()->create(['code' => 'WELCOME', 'max_uses_per_customer' => 1]);
        $second = Invoice::factory()->for($this->customer)->create();

        $this->apply('WELCOME')->assertOk();
        $this->apply('WELCOME', $second)->assertJsonValidationErrors(['code' => "You've already used this code."]);
    }

    public function test_the_code_is_locked_while_a_card_checkout_is_open(): void
    {
        Coupon::factory()->create(['code' => 'SAVE10']);
        Payment::factory()->create(['invoice_id' => $this->invoice->id, 'user_id' => $this->customer->id, 'status' => PaymentStatus::Pending, 'amount' => 2_000_000]);

        $this->apply('SAVE10')->assertJsonValidationErrors('code');

        $this->travel(CouponService::CHECKOUT_LOCK_MINUTES + 1)->minutes();
        $this->apply('SAVE10')->assertOk();
    }

    public function test_a_full_discount_settles_the_invoice_and_activates_what_it_was_for(): void
    {
        app(Settings::class)->set('workspace.booking_destination', BookingService::DESTINATION_INTERNAL);
        Coupon::factory()->create(['code' => 'FREEPASS', 'discount_value' => 100, 'applies_to' => 'plans']);
        $plan = PassPlan::factory()->create(['price' => 1_200_000]);

        $invoiceId = $this->actingAs($this->customer)->postJson('/api/v1/plans/passes', ['pass_plan_id' => $plan->id])->assertCreated()->json('invoice_id');
        $this->apply('FREEPASS', Invoice::findOrFail($invoiceId))
            ->assertOk()
            ->assertJsonPath('data.status', 'paid')
            ->assertJsonPath('data.total', 0);

        $this->assertSame(CustomerPass::ACTIVE, CustomerPass::firstWhere('invoice_id', $invoiceId)->status);
    }

    public function test_someone_else_cannot_use_a_code_on_my_invoice(): void
    {
        Coupon::factory()->create(['code' => 'SAVE10']);

        $this->apply('SAVE10', customer: User::factory()->create())->assertNotFound();
    }

    public function test_a_used_code_cannot_be_deleted_only_turned_off(): void
    {
        $admin = User::factory()->staff()->create()->assignRole(Role::SuperAdmin->value);
        $coupon = Coupon::factory()->create(['code' => 'SAVE10']);
        $this->apply('SAVE10')->assertOk();

        $this->actingAs($admin)->getJson('/api/v1/admin/finance/coupons')->assertOk()->assertJsonPath('data.0.uses', 1)->assertJsonPath('data.0.paid_uses', 0);
        $this->actingAs($admin)->deleteJson("/api/v1/admin/finance/coupons/{$coupon->id}")->assertUnprocessable();

        $unused = Coupon::factory()->create();
        $this->actingAs($admin)->deleteJson("/api/v1/admin/finance/coupons/{$unused->id}")->assertNoContent();
    }
}
