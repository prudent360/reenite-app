<?php

namespace Tests\Feature\Payments;

use App\Enums\EmailTemplateKey;
use App\Enums\InvoiceStatus;
use App\Enums\Role;
use App\Events\InvoicePaid;
use App\Models\Booking;
use App\Models\CustomerMembership;
use App\Models\CustomerPass;
use App\Models\Invoice;
use App\Models\MembershipPlan;
use App\Models\PassPlan;
use App\Models\Payment;
use App\Models\PaymentGateway;
use App\Models\PaymentMethod;
use App\Models\User;
use App\Notifications\PlanNotification;
use App\Notifications\RenewalNotification;
use App\Workspace\RenewalService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class RenewalTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;

    private MembershipPlan $plan;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        Notification::fake();
        $this->travelTo('2026-11-11 09:00:00');
        PaymentGateway::where('code', 'paystack')->first()->update([
            'is_enabled' => true, 'mode' => 'test',
            'credentials' => ['test' => ['public_key' => 'pk_test_abc', 'secret_key' => 'sk_test_secret123456789']],
        ]);
        $this->customer = User::factory()->create(['email' => 'ada@example.com']);
        $this->plan = MembershipPlan::factory()->create(['name' => 'Business', 'price' => 5_000_000, 'billing_period' => 'month']);
    }

    private function membership(array $attributes = []): CustomerMembership
    {
        return CustomerMembership::factory()->for($this->customer)->for($this->plan, 'plan')->create($attributes + [
            'name' => 'Business', 'starts_at' => now()->subMonth(), 'ends_at' => now()->addHours(20),
        ]);
    }

    private function card(): PaymentMethod
    {
        return PaymentMethod::factory()->for($this->customer)->create(['brand' => 'visa', 'last4' => '4081', 'email' => 'ada@example.com', 'authorization_code' => 'AUTH_abc123']);
    }

    private function fakeCharge(string $status = 'success', int $amount = 5_000_000): void
    {
        Http::fake(['api.paystack.co/transaction/charge_authorization' => Http::response(['status' => true, 'data' => [
            'id' => 991, 'status' => $status, 'amount' => $amount, 'currency' => 'NGN', 'channel' => 'card', 'gateway_response' => $status === 'success' ? 'Approved' : 'Insufficient Funds',
        ]])]);
    }

    public function test_paying_with_save_card_keeps_the_card_without_the_card_number(): void
    {
        $invoice = Invoice::factory()->for($this->customer)->create(['subtotal' => 1_000_000, 'total' => 1_000_000]);
        Http::fake([
            'api.paystack.co/transaction/initialize' => Http::response(['status' => true, 'data' => ['authorization_url' => 'https://checkout.paystack.com/x', 'access_code' => 'x']]),
            'api.paystack.co/transaction/verify/*' => Http::response(['status' => true, 'data' => [
                'id' => 77, 'status' => 'success', 'amount' => 1_000_000, 'currency' => 'NGN', 'channel' => 'card',
                'customer' => ['email' => 'ada@example.com'],
                'authorization' => ['authorization_code' => 'AUTH_secret999', 'card_type' => 'visa ', 'last4' => '4081', 'exp_month' => '09', 'exp_year' => '2030', 'bank' => 'GTBank', 'channel' => 'card', 'reusable' => true, 'signature' => 'SIG_1'],
            ]]),
        ]);

        $reference = $this->actingAs($this->customer)->postJson("/api/v1/billing/invoices/{$invoice->id}/pay", ['gateway' => 'paystack', 'save_card' => true])->assertCreated()->json('reference');
        $this->actingAs($this->customer)->postJson("/api/v1/billing/payments/{$reference}/verify")->assertOk();
        // The same card again is updated, not saved twice.
        $second = Invoice::factory()->for($this->customer)->create(['subtotal' => 1_000_000, 'total' => 1_000_000]);
        $again = $this->actingAs($this->customer)->postJson("/api/v1/billing/invoices/{$second->id}/pay", ['gateway' => 'paystack', 'save_card' => true])->json('reference');
        $this->actingAs($this->customer)->postJson("/api/v1/billing/payments/{$again}/verify")->assertOk();

        $this->actingAs($this->customer)->getJson('/api/v1/billing/cards')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.label', 'Visa •••• 4081')
            ->assertJsonPath('data.0.expires', '09/30')
            ->assertJsonPath('data.0.is_default', true)
            ->assertJsonMissingPath('data.0.authorization_code');
        $this->assertStringNotContainsString('AUTH_secret999', (string) DB::table('payment_methods')->value('authorization_code'));
        $this->assertSame('AUTH_secret999', PaymentMethod::sole()->authorization_code);
    }

    public function test_paying_without_ticking_save_card_saves_nothing(): void
    {
        $invoice = Invoice::factory()->for($this->customer)->create(['subtotal' => 1_000_000, 'total' => 1_000_000]);
        Http::fake([
            'api.paystack.co/transaction/initialize' => Http::response(['status' => true, 'data' => ['authorization_url' => 'https://checkout.paystack.com/x', 'access_code' => 'x']]),
            'api.paystack.co/transaction/verify/*' => Http::response(['status' => true, 'data' => [
                'id' => 77, 'status' => 'success', 'amount' => 1_000_000, 'currency' => 'NGN', 'channel' => 'card',
                'authorization' => ['authorization_code' => 'AUTH_x', 'last4' => '4081', 'channel' => 'card', 'reusable' => true],
            ]]),
        ]);

        $reference = $this->actingAs($this->customer)->postJson("/api/v1/billing/invoices/{$invoice->id}/pay", ['gateway' => 'paystack'])->json('reference');
        $this->actingAs($this->customer)->postJson("/api/v1/billing/payments/{$reference}/verify")->assertOk();

        $this->assertSame(0, PaymentMethod::count());
    }

    public function test_auto_renew_charges_the_saved_card_the_day_before_and_the_new_period_follows_on(): void
    {
        $this->fakeCharge();
        $card = $this->card();
        $current = $this->membership(['auto_renew' => true]);
        $endsAt = $current->ends_at->copy();

        $this->assertSame(['notices' => 1, 'charged' => 1, 'failed' => 0, 'abandoned' => 0], app(RenewalService::class)->run());

        $renewal = CustomerMembership::where('renewal_of_id', $current->id)->sole();
        $this->assertSame(CustomerMembership::ACTIVE, $renewal->status);
        $this->assertTrue($renewal->starts_at->equalTo($endsAt));
        $this->assertTrue($renewal->ends_at->equalTo($endsAt->copy()->addMonthNoOverflow()));
        $this->assertTrue($renewal->auto_renew);
        $this->assertSame($card->id, Payment::sole()->payment_method_id);
        Http::assertSent(fn (Request $request) => $request['authorization_code'] === 'AUTH_abc123' && $request['amount'] === 5_000_000);
        Notification::assertSentTo($this->customer, RenewalNotification::class, fn (RenewalNotification $mail) => $mail->key === EmailTemplateKey::RenewalUpcoming && $mail->values['card'] === 'Visa •••• 4081');
        Notification::assertSentTo($this->customer, PlanNotification::class, fn (PlanNotification $mail) => $mail->key === EmailTemplateKey::MembershipActivated);

        // Nothing more happens on the next run.
        $this->travel(2)->hours();
        $this->assertSame(['notices' => 0, 'charged' => 0, 'failed' => 0, 'abandoned' => 0], app(RenewalService::class)->run());
        Http::assertSentCount(1);
    }

    public function test_a_declined_card_is_retried_daily_three_times_with_a_pay_link_each_time(): void
    {
        $this->fakeCharge('failed');
        $this->card();
        $current = $this->membership(['auto_renew' => true, 'renewal_notice_at' => now()]);

        app(RenewalService::class)->run();
        $this->assertSame(1, $current->refresh()->renewal_attempts);
        $this->assertSame('Insufficient Funds', $current->renewal_failure);
        $invoiceId = CustomerMembership::where('renewal_of_id', $current->id)->sole()->invoice_id;
        Notification::assertSentTo($this->customer, RenewalNotification::class, fn (RenewalNotification $mail) => $mail->key === EmailTemplateKey::RenewalFailed
            && $mail->invoiceId === $invoiceId && $mail->values['next_try'] === 'We will try again tomorrow.');

        $this->travel(2)->hours();
        app(RenewalService::class)->run();
        $this->assertSame(1, $current->refresh()->renewal_attempts, 'No retry within a day');

        $this->travel(1)->days();
        app(RenewalService::class)->run();
        $this->travel(1)->days();
        app(RenewalService::class)->run();
        $this->travel(1)->days();
        app(RenewalService::class)->run();

        $this->assertSame(3, $current->refresh()->renewal_attempts);
        $this->assertSame(1, CustomerMembership::where('renewal_of_id', $current->id)->count(), 'One renewal invoice, reused');
        Notification::assertSentTo($this->customer, RenewalNotification::class, fn (RenewalNotification $mail) => $mail->values['next_try'] === 'That was our last automatic try.');
        Http::assertSentCount(3);
    }

    public function test_reminders_three_days_before_depend_on_auto_renew(): void
    {
        $this->travelTo(now());
        $manual = $this->membership(['ends_at' => now()->addDays(2)]);
        $pass = CustomerPass::factory()->for($this->customer)->for(PassPlan::factory()->create(['price' => 1_350_000]), 'plan')->create(['name' => 'Flex 3', 'credits' => 3, 'credits_used' => 1, 'ends_at' => now()->addDays(2)]);

        app(RenewalService::class)->run();

        Notification::assertSentTo($this->customer, PlanNotification::class, fn (PlanNotification $mail) => $mail->key === EmailTemplateKey::MembershipRenewalDue && $mail->plan->is($manual));
        Notification::assertSentTo($this->customer, RenewalNotification::class, fn (RenewalNotification $mail) => $mail->key === EmailTemplateKey::PassRenewalDue && $mail->plan->is($pass));
        Notification::assertSentTo($this->customer, PlanNotification::class, fn (PlanNotification $mail) => $mail->key === EmailTemplateKey::PassExpiring);
        $this->assertSame(0, CustomerMembership::whereNotNull('renewal_of_id')->count(), 'Manual renewals wait for the customer');
    }

    public function test_renewing_early_starts_when_the_current_period_ends(): void
    {
        $current = $this->membership(['ends_at' => now()->addDays(10)]);

        $invoiceId = $this->actingAs($this->customer)->postJson("/api/v1/plans/memberships/{$current->id}/renew")->assertCreated()->json('invoice_id');
        $this->assertSame($invoiceId, $this->actingAs($this->customer)->postJson("/api/v1/plans/memberships/{$current->id}/renew")->json('invoice_id'), 'Asking twice reuses the renewal');
        $invoice = Invoice::findOrFail($invoiceId);
        $this->assertSame($current->ends_at->timezone('Africa/Lagos')->toDateString(), $invoice->due_at->toDateString());

        $this->actingAs($this->customer)->getJson('/api/v1/plans')
            ->assertOk()
            ->assertJsonCount(1, 'memberships')
            ->assertJsonPath('memberships.0.renewal.invoice_payable', true)
            ->assertJsonPath('memberships.0.renewal_mode', 'manual');

        $invoice->update(['status' => InvoiceStatus::Paid, 'amount_paid' => $invoice->total, 'paid_at' => now()]);
        InvoicePaid::dispatch($invoice->refresh());

        $renewal = CustomerMembership::where('renewal_of_id', $current->id)->sole();
        $this->assertTrue($renewal->starts_at->equalTo($current->ends_at));
        $this->actingAs($this->customer)->getJson('/api/v1/plans')
            ->assertJsonCount(1, 'memberships')
            ->assertJsonPath('memberships.0.renewal.status', 'active');
        $this->actingAs(User::factory()->create())->postJson("/api/v1/plans/memberships/{$current->id}/renew")->assertNotFound();
    }

    public function test_switching_auto_renew_explains_what_will_happen(): void
    {
        $current = $this->membership(['renewal_attempts' => 3, 'renewal_failure' => 'Declined']);

        $this->actingAs($this->customer)->patchJson("/api/v1/plans/memberships/{$current->id}/auto-renew", ['auto_renew' => true])
            ->assertOk()
            ->assertJsonPath('message', 'Automatic renewal is on. Save a card on your next payment (tick "Save this card"), or we will email you a pay link instead.');
        $this->assertSame(0, $current->refresh()->renewal_attempts);

        $this->card();
        $this->actingAs($this->customer)->patchJson("/api/v1/plans/memberships/{$current->id}/auto-renew", ['auto_renew' => true])
            ->assertJsonPath('message', "Automatic renewal is on. We'll charge your Visa •••• 4081 the day before it ends.");
        $this->actingAs($this->customer)->getJson('/api/v1/plans')->assertJsonPath('memberships.0.renewal_mode', 'card')->assertJsonPath('card.label', 'Visa •••• 4081');
    }

    public function test_auto_renew_without_a_card_sends_a_pay_link_once(): void
    {
        $current = $this->membership(['auto_renew' => true, 'renewal_notice_at' => now()]);

        app(RenewalService::class)->run();
        $this->travel(2)->days();
        app(RenewalService::class)->run();

        Notification::assertSentToTimes($this->customer, RenewalNotification::class, 1);
        $this->assertSame(RenewalService::MAX_ATTEMPTS, $current->refresh()->renewal_attempts);
        Http::assertNothingSent();
    }

    public function test_unpaid_renewals_are_cancelled_two_weeks_after_the_plan_ended(): void
    {
        $current = $this->membership(['ends_at' => now()->addDays(5)]);
        $this->actingAs($this->customer)->postJson("/api/v1/plans/memberships/{$current->id}/renew")->assertCreated();

        $this->travel(5 + RenewalService::ABANDON_DAYS + 1)->days();
        $current->update(['status' => CustomerMembership::EXPIRED]);
        app(RenewalService::class)->run();

        $renewal = CustomerMembership::where('renewal_of_id', $current->id)->sole();
        $this->assertSame(CustomerMembership::CANCELLED, $renewal->status);
        $this->assertSame(InvoiceStatus::Void, $renewal->invoice->status);
    }

    public function test_customers_manage_only_their_own_cards(): void
    {
        $first = $this->card();
        $second = PaymentMethod::factory()->for($this->customer)->create(['is_default' => false, 'last4' => '1111']);
        $theirs = PaymentMethod::factory()->create();

        $this->actingAs($this->customer)->postJson("/api/v1/billing/cards/{$second->id}/default")->assertOk();
        $this->assertFalse($first->refresh()->is_default);
        $this->actingAs($this->customer)->deleteJson("/api/v1/billing/cards/{$second->id}")->assertNoContent();
        $this->assertTrue($first->refresh()->is_default, 'The remaining card becomes the default');
        $this->actingAs($this->customer)->deleteJson("/api/v1/billing/cards/{$theirs->id}")->assertNotFound();
    }

    public function test_finance_sees_upcoming_and_failed_renewals(): void
    {
        $finance = User::factory()->staff()->create()->assignRole(Role::Finance->value);
        $this->card();
        $this->membership(['auto_renew' => true, 'ends_at' => now()->addDays(5)]);
        $this->membership(['renewal_failure' => 'Insufficient Funds', 'ends_at' => now()->addDays(1)]);

        $owed = Invoice::factory()->for($this->customer)->create(['due_at' => now()->subDays(3)->toDateString()]);
        $abandoned = Invoice::factory()->for($this->customer)->create(['due_at' => now()->subDays(3)->toDateString()]);
        $abandoned->source()->associate(Booking::factory()->for($this->customer)->create())->save();

        $this->actingAs($finance)->getJson('/api/v1/admin/finance/renewals')
            ->assertOk()
            ->assertJsonCount(1, 'overdue')
            ->assertJsonPath('overdue.0.id', $owed->id)
            ->assertJsonCount(2, 'upcoming')
            ->assertJsonPath('upcoming.0.failure', 'Insufficient Funds')
            ->assertJsonPath('upcoming.1.card', 'Visa •••• 4081')
            ->assertJsonCount(1, 'failed')
            ->assertJsonPath('stats.renewing_14_days', 10_000_000)
            ->assertJsonPath('stats.auto_renew_share', 50);
    }
}
