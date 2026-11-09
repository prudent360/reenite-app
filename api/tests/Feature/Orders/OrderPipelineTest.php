<?php

namespace Tests\Feature\Orders;

use App\Enums\OrderStatus;
use App\Enums\Role;
use App\Models\Order;
use App\Models\User;
use App\Notifications\OrderNotification;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OrderPipelineTest extends TestCase
{
    use RefreshDatabase;

    private User $ops;

    private User $officer;

    private Order $order;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        Notification::fake();
        Storage::fake('local');

        $this->ops = User::factory()->staff()->create()->assignRole(Role::OperationsManager->value);
        $this->officer = User::factory()->staff()->create(['name' => 'Ekemini Udo'])->assignRole(Role::FilingOfficer->value);
        $this->order = Order::factory()->create();
    }

    private function sentKeys(): array
    {
        return Notification::sent($this->order->user, OrderNotification::class)->map(fn (OrderNotification $notification) => $notification->key->value)->all();
    }

    public function test_filing_officers_only_see_orders_assigned_to_them(): void
    {
        $url = "/api/v1/admin/orders/{$this->order->reference}";

        $this->actingAs($this->officer)->getJson($url)->assertNotFound();
        $this->actingAs($this->officer)->getJson('/api/v1/admin/orders')->assertJsonCount(0, 'data');

        $this->actingAs($this->officer)->postJson("{$url}/assign", ['user_id' => $this->officer->id])->assertForbidden();
        $this->actingAs($this->ops)->postJson("{$url}/assign", ['user_id' => $this->officer->id])->assertOk()->assertJsonPath('data.officer.name', 'Ekemini Udo');

        $this->actingAs($this->officer)->getJson($url)->assertOk();
        $this->actingAs($this->officer)->getJson('/api/v1/admin/orders?assigned=me')->assertJsonCount(1, 'data');
        $this->actingAs(User::factory()->staff()->create()->assignRole(Role::FrontDesk->value))->getJson($url)->assertForbidden();
    }

    public function test_full_pipeline_with_customer_emails(): void
    {
        $this->order->update(['assigned_to' => $this->officer->id]);
        $url = "/api/v1/admin/orders/{$this->order->reference}";
        $customer = $this->order->user;

        $this->actingAs($this->officer)->postJson("{$url}/start")->assertOk()->assertJsonPath('data.status', 'in_progress');

        // A staff-only stage doesn't email the customer; a visible one does.
        $this->actingAs($this->officer)->postJson("{$url}/stage", ['index' => 1])->assertOk();
        $this->assertNotContains('order_updated', $this->sentKeys());
        $this->actingAs($this->officer)->postJson("{$url}/stage", ['index' => 2])->assertOk();
        $this->assertContains('order_updated', $this->sentKeys());

        // Request info pauses the order; the customer's reply resumes it.
        $this->actingAs($this->officer)->postJson("{$url}/request-info", ['message' => 'Please upload a clearer ID.'])
            ->assertOk()->assertJsonPath('data.status', 'awaiting_client');
        $this->assertContains('info_requested', $this->sentKeys());
        $this->actingAs($customer)->postJson("/api/v1/orders/{$this->order->reference}/messages", ['body' => 'Done, uploaded again.'])
            ->assertOk()->assertJsonPath('data.status', 'in_progress');

        // Internal notes stay internal.
        $this->actingAs($this->officer)->postJson("{$url}/messages", ['body' => 'Customer is a repeat client.', 'internal' => true])->assertOk();
        $customerView = $this->actingAs($customer)->getJson("/api/v1/orders/{$this->order->reference}")->json('data');
        $this->assertNotContains('Customer is a repeat client.', array_column($customerView['messages'], 'body'));
        $this->assertNotContains('Internal check', array_column($customerView['stages'], 'name'));

        // Deliverable + completion.
        $this->actingAs($this->officer)->post("{$url}/files", ['file' => UploadedFile::fake()->create('CAC-Certificate.pdf', 120, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.deliverables.0.name', 'CAC-Certificate.pdf');
        $this->actingAs($this->officer)->postJson("{$url}/complete")->assertOk()->assertJsonPath('data.status', 'completed')->assertJsonPath('data.progress', 100);
        $this->assertContains('order_completed', $this->sentKeys());

        $deliverableId = $this->order->files()->where('kind', 'deliverable')->first()->id;
        $this->actingAs($customer)->get("/api/v1/orders/{$this->order->reference}/files/{$deliverableId}")->assertOk();
    }

    public function test_document_review_requires_a_reason_to_reject(): void
    {
        $file = $this->order->files()->create([
            'kind' => 'requirement', 'requirement_id' => 1, 'label' => 'Valid ID', 'path' => 'x.jpg', 'original_name' => 'id.jpg', 'status' => 'pending',
        ]);
        $url = "/api/v1/admin/orders/{$this->order->reference}/files/{$file->id}/review";

        $this->actingAs($this->ops)->postJson($url, ['status' => 'rejected'])->assertUnprocessable()->assertJsonValidationErrors('note');
        $this->actingAs($this->ops)->postJson($url, ['status' => 'rejected', 'note' => 'Photo is blurry'])
            ->assertOk()
            ->assertJsonPath('data.documents.0.file.status', 'rejected')
            ->assertJsonPath('data.outstanding_documents', 1);
    }

    public function test_cancel_requires_manage_permission_and_closed_orders_stay_closed(): void
    {
        $this->order->update(['assigned_to' => $this->officer->id]);
        $url = "/api/v1/admin/orders/{$this->order->reference}";

        $this->actingAs($this->officer)->postJson("{$url}/cancel", ['reason' => 'x'])->assertForbidden();
        $this->actingAs($this->ops)->postJson("{$url}/cancel", ['reason' => 'Customer withdrew'])->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->actingAs($this->ops)->postJson("{$url}/start")->assertUnprocessable();
    }

    public function test_summary_counts_overdue_and_unassigned(): void
    {
        Order::factory()->create(['due_at' => now()->subDay(), 'status' => OrderStatus::InProgress]);

        $this->actingAs($this->ops)->getJson('/api/v1/admin/orders/summary')
            ->assertOk()
            ->assertJsonPath('overdue', 1)
            ->assertJsonPath('unassigned', 2)
            ->assertJsonPath('by_status.received', 1);
    }
}
