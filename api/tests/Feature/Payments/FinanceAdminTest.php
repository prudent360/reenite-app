<?php

namespace Tests\Feature\Payments;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentGateway;
use App\Models\Service;
use App\Models\User;
use App\Notifications\InvoiceIssuedNotification;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class FinanceAdminTest extends TestCase
{
    use RefreshDatabase;

    private User $finance;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        Notification::fake();
        $this->finance = User::factory()->staff()->create()->assignRole(Role::Finance->value);
    }

    private function paidPayment(array $attributes = []): Payment
    {
        $payment = Payment::factory()->create($attributes + ['status' => PaymentStatus::Success, 'paid_at' => now(), 'receipt_number' => 'RCT-2026-000001']);
        $payment->invoice->update(['status' => InvoiceStatus::Paid, 'amount_paid' => $payment->amount]);

        return $payment;
    }

    public function test_finance_raises_an_invoice_and_the_customer_is_emailed(): void
    {
        $customer = User::factory()->create();
        $service = Service::factory()->create();

        $response = $this->actingAs($this->finance)->postJson('/api/v1/admin/finance/invoices', [
            'customer_id' => $customer->id,
            'items' => [
                ['description' => 'LTD registration', 'quantity' => 1, 'unit_amount' => 8_000_000, 'service_id' => $service->id],
                ['description' => 'CAC filing fee', 'quantity' => 2, 'unit_amount' => 1_250_000],
            ],
            'due_at' => now()->addWeek()->toDateString(),
        ])->assertCreated()
            ->assertJsonPath('data.total', 10_500_000)
            ->assertJsonPath('data.items.1.amount', 2_500_000)
            ->assertJsonPath('data.customer.id', $customer->id);

        $this->assertMatchesRegularExpression('/^INV-\d{4}-\d{6}$/', $response->json('data.number'));
        Notification::assertSentTo($customer, InvoiceIssuedNotification::class);
    }

    public function test_invoices_cannot_be_raised_for_staff_or_with_bad_lines(): void
    {
        $this->actingAs($this->finance)->postJson('/api/v1/admin/finance/invoices', [
            'customer_id' => $this->finance->id,
            'items' => [['description' => '', 'quantity' => 0, 'unit_amount' => -1]],
        ])->assertUnprocessable()->assertJsonValidationErrors(['customer_id', 'items.0.description', 'items.0.quantity', 'items.0.unit_amount']);
    }

    public function test_void_only_unpaid_invoices(): void
    {
        $unpaid = Invoice::factory()->create();
        $this->actingAs($this->finance)->postJson("/api/v1/admin/finance/invoices/{$unpaid->id}/void")->assertOk()->assertJsonPath('data.status', 'void');

        $paid = $this->paidPayment()->invoice;
        $this->actingAs($this->finance)->postJson("/api/v1/admin/finance/invoices/{$paid->id}/void")->assertUnprocessable();

        $customer = $unpaid->user;
        $this->actingAs($customer)->postJson("/api/v1/billing/invoices/{$unpaid->id}/pay", ['gateway' => 'paystack'])->assertUnprocessable();
    }

    public function test_manual_and_gateway_refunds(): void
    {
        PaymentGateway::where('code', 'paystack')->first()->update(['credentials' => ['test' => ['public_key' => 'pk_test_x', 'secret_key' => 'sk_test_y']]]);
        Http::fake(['api.paystack.co/refund' => Http::response(['status' => true, 'data' => ['id' => 555, 'status' => 'pending']])]);
        $payment = $this->paidPayment(['amount' => 1_000_000]);
        $payment->invoice->update(['total' => 1_000_000, 'subtotal' => 1_000_000, 'amount_paid' => 1_000_000]);

        $this->actingAs($this->finance)->postJson("/api/v1/admin/finance/payments/{$payment->reference}/refunds", [
            'amount' => 400_000, 'reason' => 'Name rejected by CAC', 'method' => 'gateway',
        ])->assertOk()->assertJsonPath('data.status', 'partially_refunded')->assertJsonPath('data.refunds.0.gateway_reference', '555');

        Http::assertSent(fn ($request) => $request['transaction'] === $payment->reference && $request['amount'] === 400_000);

        $this->actingAs($this->finance)->postJson("/api/v1/admin/finance/payments/{$payment->reference}/refunds", [
            'amount' => 700_000, 'reason' => 'Too much', 'method' => 'manual',
        ])->assertUnprocessable();

        $this->actingAs($this->finance)->postJson("/api/v1/admin/finance/payments/{$payment->reference}/refunds", [
            'amount' => 600_000, 'reason' => 'Rest refunded by transfer', 'method' => 'manual',
        ])->assertOk()->assertJsonPath('data.status', 'refunded')->assertJsonPath('data.refundable', 0);

        $this->assertSame(1_000_000, $payment->invoice->fresh()->amount_refunded);
    }

    public function test_ops_manager_cannot_refund_and_summary_reports_revenue(): void
    {
        $payment = $this->paidPayment(['amount' => 2_000_000]);
        $ops = User::factory()->staff()->create()->assignRole(Role::OperationsManager->value);

        $this->actingAs($ops)->postJson("/api/v1/admin/finance/payments/{$payment->reference}/refunds", ['amount' => 1, 'reason' => 'x', 'method' => 'manual'])->assertForbidden();

        $response = $this->actingAs($this->finance)->getJson('/api/v1/admin/finance/summary')->assertOk()->assertJsonPath('collected_30d', 2_000_000);
        $this->assertSame(2_000_000, collect($response->json('revenue_by_month'))->last()['value']);
    }
}
