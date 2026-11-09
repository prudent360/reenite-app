<?php

namespace Tests\Feature\Orders;

use App\Enums\InvoiceStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use App\Notifications\OrderNotification;
use App\Payments\PaymentService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class OrderingTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;

    private Service $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        Notification::fake();
        Storage::fake('local');

        $this->customer = User::factory()->create();
        $this->service = Service::factory()->create(['slug' => 'ltd', 'service_fee' => 8_000_000, 'government_fee' => 2_500_000, 'turnaround_days' => 10]);
        $this->service->formFields()->createMany([
            ['key' => 'company_name', 'label' => 'Company name', 'type' => 'text', 'is_required' => true, 'sort_order' => 0],
            ['key' => 'share_capital', 'label' => 'Share capital', 'type' => 'select', 'options' => ['1M', '5M'], 'is_required' => true, 'sort_order' => 1],
            ['key' => 'directors', 'label' => 'Directors', 'type' => 'people', 'is_required' => true, 'sort_order' => 2],
            ['key' => 'logo', 'label' => 'Logo', 'type' => 'file', 'is_required' => false, 'sort_order' => 3],
        ]);
        $this->service->documentRequirements()->create(['label' => 'Valid ID', 'is_required' => true]);
        $this->service->stages()->createMany([['name' => 'Documents received', 'sort_order' => 0], ['name' => 'Filed with CAC', 'sort_order' => 1]]);
    }

    private function order(array $answers = []): TestResponse
    {
        return $this->actingAs($this->customer)->postJson('/api/v1/orders', ['service' => 'ltd', 'answers' => $answers + [
            'company_name' => 'Ekpo Ventures Ltd',
            'share_capital' => '1M',
            'directors' => [['full_name' => 'Aniekan Bassey', 'email' => 'aniekan@example.com']],
        ]]);
    }

    public function test_answers_are_validated_against_the_form(): void
    {
        $this->actingAs($this->customer)->postJson('/api/v1/orders', ['service' => 'ltd', 'answers' => [
            'share_capital' => '100M',
            'directors' => [['email' => 'not-an-email']],
        ]])->assertUnprocessable()->assertJsonValidationErrors([
            'answers.company_name', 'answers.share_capital', 'answers.directors.0.full_name', 'answers.directors.0.email',
        ]);

        $this->assertSame(0, Order::count());
    }

    public function test_order_creates_an_invoice_with_fees_split_out_and_snapshots_the_form(): void
    {
        $response = $this->order(['unexpected' => 'ignored'])->assertCreated()
            ->assertJsonPath('data.status', 'awaiting_payment')
            ->assertJsonPath('data.invoice.total', 10_500_000)
            ->assertJsonPath('data.answers.0.value', 'Ekpo Ventures Ltd')
            ->assertJsonPath('data.documents.0.label', 'Valid ID')
            ->assertJsonPath('data.outstanding_documents', 1);

        $order = Order::firstWhere('reference', $response->json('data.reference'));
        $this->assertMatchesRegularExpression('/^RN-\d{4}-\d{6}$/', $order->reference);
        $this->assertArrayNotHasKey('unexpected', $order->answers);
        $this->assertSame([$this->service->name.' (service fee)', 'Government fees'], $order->invoice->items->pluck('description')->all());
        $this->assertSame([8_000_000, 2_500_000], $order->invoice->items->pluck('amount')->all());
        $this->assertTrue($order->invoice->source->is($order));

        // Later catalogue edits don't change the order.
        $this->service->formFields()->delete();
        $this->actingAs($this->customer)->getJson("/api/v1/orders/{$order->reference}")->assertJsonCount(4, 'data.answers');
    }

    public function test_unverified_customers_must_verify_first(): void
    {
        $this->customer->forceFill(['email_verified_at' => null])->save();

        $this->order()->assertForbidden();
    }

    public function test_paying_the_invoice_starts_the_order(): void
    {
        $reference = $this->order()->json('data.reference');
        $order = Order::firstWhere('reference', $reference);

        $payment = Payment::factory()->create(['invoice_id' => $order->invoice_id, 'user_id' => $this->customer->id, 'gateway' => 'bank_transfer', 'status' => PaymentStatus::AwaitingReview, 'amount' => 10_500_000]);
        app(PaymentService::class)->approveTransfer($payment, User::factory()->staff()->create());

        $order->refresh();
        $this->assertSame(OrderStatus::Received, $order->status);
        $this->assertSame(InvoiceStatus::Paid, $order->invoice->status);
        $this->assertTrue($order->due_at->isSameDay(now()->addWeekdays(10)));
        Notification::assertSentTo($this->customer, OrderNotification::class, fn (OrderNotification $notification) => $notification->key->value === 'order_received');
    }

    public function test_documents_upload_and_reupload(): void
    {
        $reference = $this->order()->json('data.reference');

        $this->actingAs($this->customer)->post("/api/v1/orders/{$reference}/files", ['file' => UploadedFile::fake()->create('id.exe', 10), 'requirement_id' => 1], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('file');

        $requirementId = Order::firstWhere('reference', $reference)->requirements_snapshot[0]['id'];
        $this->actingAs($this->customer)->post("/api/v1/orders/{$reference}/files", ['file' => UploadedFile::fake()->image('id.jpg'), 'requirement_id' => $requirementId], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.documents.0.file.status', 'pending')
            ->assertJsonPath('data.outstanding_documents', 0);

        $this->actingAs($this->customer)->post("/api/v1/orders/{$reference}/files", ['file' => UploadedFile::fake()->image('logo.png'), 'field_key' => 'logo'], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.answers.3.file.name', 'logo.png');

        $fileId = Order::firstWhere('reference', $reference)->files()->first()->id;
        $this->actingAs($this->customer)->get("/api/v1/orders/{$reference}/files/{$fileId}")->assertOk();
        $this->actingAs(User::factory()->create())->get("/api/v1/orders/{$reference}/files/{$fileId}")->assertNotFound();

        $this->actingAs($this->customer)->getJson('/api/v1/documents')->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_customer_can_cancel_only_before_paying(): void
    {
        $reference = $this->order()->json('data.reference');

        $this->actingAs($this->customer)->postJson("/api/v1/orders/{$reference}/cancel")->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertSame(InvoiceStatus::Void, Order::firstWhere('reference', $reference)->invoice->status);

        $paid = Order::factory()->for($this->customer)->create();
        $this->actingAs($this->customer)->postJson("/api/v1/orders/{$paid->reference}/cancel")->assertUnprocessable();
    }

    public function test_free_services_start_immediately(): void
    {
        $free = Service::factory()->create(['slug' => 'free-advice', 'service_fee' => 0, 'government_fee' => 0]);

        $this->actingAs($this->customer)->postJson('/api/v1/orders', ['service' => $free->slug, 'answers' => []])
            ->assertCreated()
            ->assertJsonPath('data.status', 'received')
            ->assertJsonPath('data.invoice', null);
    }

    public function test_orders_are_private(): void
    {
        $reference = $this->order()->json('data.reference');

        $this->actingAs(User::factory()->create())->getJson("/api/v1/orders/{$reference}")->assertNotFound();
        $this->actingAs(User::factory()->create())->getJson('/api/v1/orders')->assertJsonCount(0, 'data');
    }
}
