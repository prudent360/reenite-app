<?php

namespace Tests\Feature\Payments;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Models\BankAccount;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Notifications\PaymentReceiptNotification;
use App\Notifications\TransferReceivedNotification;
use App\Notifications\TransferRejectedNotification;
use App\Support\Settings;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class BankTransferTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;

    private User $finance;

    private Invoice $invoice;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        Storage::fake('local');
        Notification::fake();

        BankAccount::factory()->create();
        app(Settings::class)->set('bank_transfer.enabled', true);

        $this->customer = User::factory()->create();
        $this->finance = User::factory()->staff()->create()->assignRole(Role::Finance->value);
        $this->invoice = Invoice::factory()->for($this->customer)->create();
    }

    private function submit(array $overrides = []): TestResponse
    {
        return $this->actingAs($this->customer)->post("/api/v1/billing/invoices/{$this->invoice->id}/bank-transfer", $overrides + [
            'proof' => UploadedFile::fake()->image('receipt.jpg'),
            'sender_name' => 'Aniekan Bassey',
            'transferred_on' => now()->toDateString(),
        ], ['Accept' => 'application/json']);
    }

    public function test_proof_upload_waits_for_review_and_blocks_double_payment(): void
    {
        $reference = $this->submit()->assertCreated()->assertJsonPath('data.status', 'awaiting_review')->json('data.reference');

        $payment = Payment::firstWhere('reference', $reference);
        Storage::disk('local')->assertExists($payment->proof_path);
        Notification::assertSentTo($this->customer, TransferReceivedNotification::class);

        $this->submit()->assertUnprocessable();
        $this->actingAs($this->customer)->getJson("/api/v1/billing/payments/{$reference}/proof")->assertOk();
        $this->actingAs(User::factory()->create())->getJson("/api/v1/billing/payments/{$reference}/proof")->assertNotFound();
    }

    public function test_upload_validation(): void
    {
        $this->submit(['proof' => UploadedFile::fake()->create('virus.exe', 10), 'transferred_on' => now()->addDay()->toDateString()])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['proof', 'transferred_on']);
    }

    public function test_finance_approves_a_transfer(): void
    {
        $reference = $this->submit()->json('data.reference');

        $this->actingAs($this->finance)->getJson('/api/v1/admin/finance/payments?status=awaiting_review')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($this->finance)->get("/api/v1/admin/finance/payments/{$reference}/proof")->assertOk();

        $this->actingAs($this->finance)->postJson("/api/v1/admin/finance/payments/{$reference}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'success')
            ->assertJsonPath('data.reviewed_by', $this->finance->name);

        $this->assertSame(InvoiceStatus::Paid, $this->invoice->fresh()->status);
        Notification::assertSentTo($this->customer, PaymentReceiptNotification::class);

        // Approving twice does nothing more.
        $this->actingAs($this->finance)->postJson("/api/v1/admin/finance/payments/{$reference}/approve")->assertUnprocessable();
        $this->assertSame($this->invoice->total, $this->invoice->fresh()->amount_paid);
    }

    public function test_finance_rejects_a_transfer_with_a_reason(): void
    {
        $reference = $this->submit()->json('data.reference');

        $this->actingAs($this->finance)->postJson("/api/v1/admin/finance/payments/{$reference}/reject", [])->assertUnprocessable();
        $this->actingAs($this->finance)->postJson("/api/v1/admin/finance/payments/{$reference}/reject", ['reason' => 'No matching credit in our account.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected');

        $this->assertTrue($this->invoice->fresh()->isPayable());
        Notification::assertSentTo($this->customer, TransferRejectedNotification::class, function (TransferRejectedNotification $notification) {
            return str_contains(implode(' ', $notification->toMail($this->customer)->introLines), 'No matching credit in our account.');
        });
    }

    public function test_only_reviewers_can_approve(): void
    {
        $reference = $this->submit()->json('data.reference');
        $frontDesk = User::factory()->staff()->create()->assignRole(Role::FrontDesk->value);

        $this->actingAs($frontDesk)->postJson("/api/v1/admin/finance/payments/{$reference}/approve")->assertForbidden();
        $this->actingAs($this->customer)->postJson("/api/v1/admin/finance/payments/{$reference}/approve")->assertForbidden();
        $this->assertSame(PaymentStatus::AwaitingReview, Payment::firstWhere('reference', $reference)->status);
    }

    public function test_transfer_is_unavailable_when_switched_off(): void
    {
        app(Settings::class)->set('bank_transfer.enabled', false);

        $this->submit()->assertUnprocessable();
    }
}
