<?php

namespace Tests\Feature\Payments;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentGateway;
use App\Models\WebhookEvent;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class WebhookTest extends TestCase
{
    use RefreshDatabase;

    private const PAYSTACK_SECRET = 'sk_test_webhook_secret_123456';

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(SettingsSeeder::class);
        Notification::fake();
    }

    private function postSigned(string $url, array $payload, array $headers): TestResponse
    {
        return $this->call('POST', $url, [], [], [], $this->transformHeadersToServerVars($headers + ['CONTENT_TYPE' => 'application/json', 'Accept' => 'application/json']), json_encode($payload));
    }

    public function test_paystack_webhook_confirms_payment_once_and_rejects_bad_signatures(): void
    {
        PaymentGateway::where('code', 'paystack')->first()->update(['credentials' => ['test' => ['public_key' => 'pk_test_x', 'secret_key' => self::PAYSTACK_SECRET]]]);
        $payment = Payment::factory()->create();
        Http::fake(['api.paystack.co/transaction/verify/*' => Http::response(['status' => true, 'data' => [
            'id' => 1, 'status' => 'success', 'amount' => $payment->amount, 'currency' => 'NGN', 'channel' => 'bank',
        ]])]);

        $payload = ['event' => 'charge.success', 'data' => ['id' => 1, 'reference' => $payment->reference]];
        $body = json_encode($payload);

        $this->postSigned('/api/v1/webhooks/paystack', $payload, ['x-paystack-signature' => hash_hmac('sha512', $body, 'wrong')])->assertStatus(401);
        $this->assertSame(PaymentStatus::Pending, $payment->fresh()->status);

        $signature = hash_hmac('sha512', $body, self::PAYSTACK_SECRET);
        $this->postSigned('/api/v1/webhooks/paystack', $payload, ['x-paystack-signature' => $signature])->assertOk()->assertJsonPath('message', 'OK');
        $this->postSigned('/api/v1/webhooks/paystack', $payload, ['x-paystack-signature' => $signature])->assertOk()->assertJsonPath('message', 'Already processed.');

        $this->assertSame(PaymentStatus::Success, $payment->fresh()->status);
        $this->assertSame(InvoiceStatus::Paid, $payment->invoice->fresh()->status);
        $this->assertSame(1, WebhookEvent::count());
        Http::assertSentCount(1);
    }

    public function test_flutterwave_webhook_requires_the_secret_hash(): void
    {
        PaymentGateway::where('code', 'flutterwave')->first()->update(['credentials' => ['test' => [
            'public_key' => 'FLWPUBK_TEST-x', 'secret_key' => 'FLWSECK_TEST-y', 'webhook_secret' => 'my-chosen-hash',
        ]]]);
        $payment = Payment::factory()->create(['gateway' => 'flutterwave']);
        Http::fake(['api.flutterwave.com/v3/transactions/verify_by_reference*' => Http::response(['status' => 'success', 'data' => [
            'id' => 77, 'tx_ref' => $payment->reference, 'status' => 'successful', 'amount' => $payment->amount / 100, 'currency' => 'NGN', 'payment_type' => 'card',
        ]])]);
        $payload = ['event' => 'charge.completed', 'data' => ['id' => 77, 'tx_ref' => $payment->reference, 'status' => 'successful']];

        $this->postSigned('/api/v1/webhooks/flutterwave', $payload, ['verif-hash' => 'guess'])->assertStatus(401);
        $this->postSigned('/api/v1/webhooks/flutterwave', $payload, ['verif-hash' => 'my-chosen-hash'])->assertOk();

        $payment->refresh();
        $this->assertSame(PaymentStatus::Success, $payment->status);
        $this->assertSame('77', (string) $payment->gateway_data['transaction_id']);
    }

    public function test_stripe_webhook_checks_signature_and_timestamp(): void
    {
        PaymentGateway::where('code', 'stripe')->first()->update(['credentials' => ['test' => [
            'public_key' => 'pk_test_s', 'secret_key' => 'sk_test_s', 'webhook_secret' => 'whsec_test123',
        ]]]);
        $payment = Payment::factory()->create(['gateway' => 'stripe', 'gateway_reference' => 'cs_test_1']);
        Http::fake(['api.stripe.com/v1/checkout/sessions/*' => Http::response([
            'id' => 'cs_test_1', 'payment_status' => 'paid', 'status' => 'complete', 'amount_total' => $payment->amount, 'currency' => 'ngn', 'payment_intent' => 'pi_123',
        ])]);
        $payload = ['id' => 'evt_1', 'type' => 'checkout.session.completed', 'data' => ['object' => ['id' => 'cs_test_1', 'client_reference_id' => $payment->reference]]];
        $body = json_encode($payload);

        $stale = time() - 3600;
        $this->postSigned('/api/v1/webhooks/stripe', $payload, ['Stripe-Signature' => "t={$stale},v1=".hash_hmac('sha256', "{$stale}.{$body}", 'whsec_test123')])->assertStatus(401);

        $now = time();
        $this->postSigned('/api/v1/webhooks/stripe', $payload, ['Stripe-Signature' => "t={$now},v1=".hash_hmac('sha256', "{$now}.{$body}", 'whsec_test123')])->assertOk();

        $payment->refresh();
        $this->assertSame(PaymentStatus::Success, $payment->status);
        $this->assertSame('pi_123', $payment->gateway_data['payment_intent']);
    }

    public function test_gateway_outage_leaves_event_for_retry(): void
    {
        PaymentGateway::where('code', 'paystack')->first()->update(['credentials' => ['test' => ['public_key' => 'pk_test_x', 'secret_key' => self::PAYSTACK_SECRET]]]);
        $payment = Payment::factory()->create();
        Http::fake(['api.paystack.co/*' => Http::response(['message' => 'Server error'], 500)]);
        $payload = ['event' => 'charge.success', 'data' => ['id' => 9, 'reference' => $payment->reference]];

        $this->postSigned('/api/v1/webhooks/paystack', $payload, ['x-paystack-signature' => hash_hmac('sha512', json_encode($payload), self::PAYSTACK_SECRET)])->assertStatus(503);

        $this->assertNull(WebhookEvent::first()->processed_at);
        $this->assertSame(PaymentStatus::Pending, $payment->fresh()->status);
        $this->assertTrue(Invoice::find($payment->invoice_id)->isPayable());
    }
}
