<?php

namespace Tests\Feature\Payments;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentGateway;
use App\Models\User;
use App\Notifications\PaymentReceiptNotification;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class OnlinePaymentTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;

    private Invoice $invoice;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(SettingsSeeder::class);
        PaymentGateway::where('code', 'paystack')->first()->update([
            'is_enabled' => true,
            'mode' => 'test',
            'credentials' => ['test' => ['public_key' => 'pk_test_abc', 'secret_key' => 'sk_test_secret123456789']],
        ]);
        $this->customer = User::factory()->create();
        $this->invoice = Invoice::factory()->for($this->customer)->create(['total' => 10_500_000, 'subtotal' => 10_500_000]);
        Notification::fake();
    }

    private function fakePaystack(string $status = 'success', ?int $amount = null): void
    {
        Http::fake([
            'api.paystack.co/transaction/initialize' => Http::response(['status' => true, 'data' => ['authorization_url' => 'https://checkout.paystack.com/abc123', 'access_code' => 'abc123']]),
            'api.paystack.co/transaction/verify/*' => Http::response(['status' => true, 'data' => [
                'id' => 4099260516, 'status' => $status, 'amount' => $amount ?? 10_500_000, 'currency' => 'NGN', 'channel' => 'card', 'gateway_response' => 'Approved',
            ]]),
        ]);
    }

    private function startPayment(): string
    {
        return $this->actingAs($this->customer)
            ->postJson("/api/v1/billing/invoices/{$this->invoice->id}/pay", ['gateway' => 'paystack'])
            ->assertCreated()
            ->assertJsonPath('redirect_url', 'https://checkout.paystack.com/abc123')
            ->json('reference');
    }

    public function test_options_only_list_enabled_and_configured_gateways(): void
    {
        $this->actingAs($this->customer)->getJson('/api/v1/billing/options')
            ->assertOk()
            ->assertJsonCount(1, 'gateways')
            ->assertJsonPath('gateways.0.code', 'paystack')
            ->assertJsonPath('bank_transfer.enabled', false)
            ->assertJsonMissing(['secret_key' => 'sk_test_secret123456789']);
    }

    public function test_successful_payment_is_verified_with_the_gateway_and_credits_the_invoice_once(): void
    {
        $this->fakePaystack();
        $reference = $this->startPayment();

        Http::assertSent(fn (Request $request) => str_contains($request->url(), '/transaction/initialize')
            && $request['amount'] === 10_500_000
            && $request['reference'] === $reference
            && str_ends_with($request['callback_url'], "/dashboard/billing/return/{$reference}"));

        // Browser return and a retry: credited exactly once.
        $this->actingAs($this->customer)->postJson("/api/v1/billing/payments/{$reference}/verify")->assertOk()->assertJsonPath('data.status', 'success');
        $this->actingAs($this->customer)->postJson("/api/v1/billing/payments/{$reference}/verify")->assertOk();

        $invoice = $this->invoice->fresh();
        $this->assertSame(InvoiceStatus::Paid, $invoice->status);
        $this->assertSame(10_500_000, $invoice->amount_paid);
        $payment = Payment::firstWhere('reference', $reference);
        $this->assertMatchesRegularExpression('/^RCT-\d{4}-\d{6}$/', $payment->receipt_number);
        $this->assertSame('card', $payment->channel);
        Notification::assertSentToTimes($this->customer, PaymentReceiptNotification::class, 1);

        $this->actingAs($this->customer)->getJson("/api/v1/billing/payments/{$reference}/receipt")
            ->assertOk()
            ->assertJsonPath('payment.receipt_number', $payment->receipt_number)
            ->assertJsonPath('invoice.number', $invoice->number);

        // A paid invoice can't be paid again.
        $this->actingAs($this->customer)->postJson("/api/v1/billing/invoices/{$this->invoice->id}/pay", ['gateway' => 'paystack'])->assertUnprocessable();
    }

    public function test_amount_mismatch_is_never_credited(): void
    {
        $this->fakePaystack(amount: 100);
        $reference = $this->startPayment();

        $this->actingAs($this->customer)->postJson("/api/v1/billing/payments/{$reference}/verify")
            ->assertOk()
            ->assertJsonPath('data.status', 'failed');

        $this->assertSame(InvoiceStatus::Unpaid, $this->invoice->fresh()->status);
        Notification::assertNothingSentTo($this->customer, PaymentReceiptNotification::class);
    }

    public function test_abandoned_payment_leaves_invoice_payable(): void
    {
        $this->fakePaystack('abandoned');
        $reference = $this->startPayment();

        $this->actingAs($this->customer)->postJson("/api/v1/billing/payments/{$reference}/verify")->assertJsonPath('data.status', 'abandoned');

        $this->assertTrue($this->invoice->fresh()->isPayable());
    }

    public function test_customers_cannot_see_or_pay_other_peoples_invoices(): void
    {
        $other = User::factory()->create();

        $this->actingAs($other)->getJson("/api/v1/billing/invoices/{$this->invoice->id}")->assertNotFound();
        $this->actingAs($other)->postJson("/api/v1/billing/invoices/{$this->invoice->id}/pay", ['gateway' => 'paystack'])->assertNotFound();
        $this->actingAs($other)->getJson('/api/v1/billing/invoices')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_disabled_gateway_cannot_be_used(): void
    {
        $this->actingAs($this->customer)
            ->postJson("/api/v1/billing/invoices/{$this->invoice->id}/pay", ['gateway' => 'flutterwave'])
            ->assertUnprocessable();

        $this->assertSame(0, Payment::count());
    }

    public function test_gateway_errors_are_reported_and_the_attempt_marked_failed(): void
    {
        Http::fake(['api.paystack.co/*' => Http::response(['status' => false, 'message' => 'Invalid key'], 401)]);

        $this->actingAs($this->customer)
            ->postJson("/api/v1/billing/invoices/{$this->invoice->id}/pay", ['gateway' => 'paystack'])
            ->assertStatus(502)
            ->assertJsonPath('message', "Paystack couldn't start the payment: Invalid key");

        $this->assertSame(PaymentStatus::Failed, Payment::first()->status);
    }
}
