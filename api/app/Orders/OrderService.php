<?php

namespace App\Orders;

use App\Enums\EmailTemplateKey;
use App\Enums\InvoiceStatus;
use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\OrderFile;
use App\Models\Service;
use App\Models\ServiceDocumentRequirement;
use App\Models\ServiceFormField;
use App\Models\ServiceStage;
use App\Models\User;
use App\Notifications\OrderNotification;
use App\Notifications\StaffAlertNotification;
use App\Payments\InvoiceService;
use App\Support\FrontendLinks;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Everything that happens to a service order, from checkout to completion.
 * Each step writes a timeline event; customer-facing steps also send an email.
 */
class OrderService
{
    public function __construct(private InvoiceService $invoices) {}

    /**
     * Creates the order (with snapshots of the form, documents and stages) and its invoice.
     *
     * @param  array<string, mixed>  $answers
     */
    public function create(User $customer, Service $service, array $answers): Order
    {
        abort_unless($service->is_active && $service->category?->is_active, 422, 'This service is not available to order right now.');

        $service->load(['formFields', 'documentRequirements', 'stages']);
        $fields = $service->formFields->map(fn (ServiceFormField $field) => [
            'key' => $field->key,
            'label' => $field->label,
            'type' => $field->type->value,
            'options' => $field->options ?? [],
            'help_text' => $field->help_text,
            'is_required' => $field->is_required,
        ])->values()->all();

        $clean = IntakeAnswers::validate($fields, $answers);

        return DB::transaction(function () use ($customer, $service, $fields, $clean) {
            $order = Order::create([
                'user_id' => $customer->id,
                'service_id' => $service->id,
                'status' => OrderStatus::AwaitingPayment,
                'service_name' => $service->name,
                'form_snapshot' => $fields,
                'requirements_snapshot' => $service->documentRequirements->map(fn (ServiceDocumentRequirement $requirement) => [
                    'id' => $requirement->id,
                    'label' => $requirement->label,
                    'description' => $requirement->description,
                    'is_required' => $requirement->is_required,
                ])->values()->all(),
                'stages_snapshot' => $service->stages->map(fn (ServiceStage $stage) => [
                    'name' => $stage->name,
                    'description' => $stage->description,
                    'customer_visible' => $stage->customer_visible,
                ])->values()->all(),
                'answers' => $clean,
            ]);

            $items = [['description' => $service->name.' (service fee)', 'quantity' => 1, 'unit_amount' => $service->service_fee, 'service_id' => $service->id]];
            if ($service->government_fee > 0) {
                $items[] = ['description' => 'Government fees', 'quantity' => 1, 'unit_amount' => $service->government_fee, 'service_id' => $service->id];
            }
            $items = array_values(array_filter($items, fn (array $item) => $item['unit_amount'] > 0));

            if ($items === []) {
                // A free service: nothing to pay, so it starts straight away.
                $this->event($order, 'created', 'Order placed.', $customer);
                $this->markPaid($order);

                return $order->refresh();
            }

            $invoice = $this->invoices->create($customer, $items, now()->addDays(3)->toDateString(), "For order {$order->reference}", null, notify: false);
            $invoice->source()->associate($order)->save();
            $order->update(['invoice_id' => $invoice->id]);

            $this->event($order, 'created', 'Order placed. Waiting for payment.', $customer);

            return $order->refresh();
        });
    }

    /**
     * Payment confirmed: the order joins the pipeline with a due date from the service turnaround.
     */
    public function markPaid(Order $order): void
    {
        if ($order->status !== OrderStatus::AwaitingPayment) {
            return;
        }

        $turnaround = $order->service?->turnaround_days;
        $order->update([
            'status' => OrderStatus::Received,
            'paid_at' => now(),
            'due_at' => $turnaround ? now()->addWeekdays($turnaround) : null,
        ]);

        $this->event($order, 'paid', 'Payment received. Your order is with our team.');
        $order->user->notify(new OrderNotification(EmailTemplateKey::OrderReceived, $order));
    }

    /**
     * Stores a customer document (for a requirement or a file question) or a Reenite deliverable.
     */
    public function attachFile(Order $order, User $uploader, UploadedFile $file, string $kind, ?int $requirementId = null, ?string $fieldKey = null): OrderFile
    {
        abort_if($order->status === OrderStatus::Cancelled, 422, 'This order was cancelled.');

        $label = match ($kind) {
            OrderFile::REQUIREMENT => collect($order->requirements_snapshot)->firstWhere('id', $requirementId)['label'] ?? abort(422, 'Unknown document.'),
            OrderFile::FIELD => collect($order->form_snapshot)->first(fn (array $field) => $field['key'] === $fieldKey && $field['type'] === 'file')['label'] ?? abort(422, 'Unknown question.'),
            default => pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME),
        };

        $record = $order->files()->create([
            'kind' => $kind,
            'requirement_id' => $requirementId,
            'field_key' => $fieldKey,
            'label' => $label,
            'path' => $file->storeAs("orders/{$order->id}", Str::random(24).'.'.$file->extension(), 'local'),
            'original_name' => $file->getClientOriginalName(),
            'mime' => $file->getMimeType(),
            'size' => $file->getSize(),
            'status' => $kind === OrderFile::DELIVERABLE ? 'accepted' : 'pending',
            'uploaded_by' => $uploader->id,
        ]);

        if ($kind === OrderFile::DELIVERABLE) {
            $this->event($order, 'deliverable', "{$label} is ready to download.", $uploader);
        } else {
            $this->event($order, 'document_uploaded', "Uploaded: {$label}.", $uploader);
            $this->resumeIfWaiting($order, $uploader);
        }

        return $record;
    }

    public function reviewFile(OrderFile $file, User $staff, string $status, ?string $note): OrderFile
    {
        abort_if($file->kind === OrderFile::DELIVERABLE, 422, 'Deliverables are not reviewed.');

        $file->update(['status' => $status, 'review_note' => $note, 'reviewed_by' => $staff->id, 'reviewed_at' => now()]);

        $this->event(
            $file->order,
            'document_reviewed',
            $status === 'accepted' ? "{$file->label} accepted." : "{$file->label} needs replacing".($note ? ": {$note}" : '.'),
            $staff,
        );

        return $file;
    }

    public function assign(Order $order, User $staff, ?User $officer): void
    {
        $order->update(['assigned_to' => $officer?->id]);
        $this->event($order, 'assigned', $officer ? "Assigned to {$officer->name}." : 'Unassigned.', $staff, customerVisible: false);

        // Officers hear about work someone else gives them.
        if ($officer && ! $officer->is($staff)) {
            $officer->notify(new StaffAlertNotification(EmailTemplateKey::StaffOrderAssigned, [
                'order_reference' => (string) $order->reference,
                'service_name' => $order->service_name,
                'customer_name' => $order->user->name,
                'due_date' => $order->due_at?->timezone((string) config('app.display_timezone'))->format('j M Y') ?? 'Not set yet',
                'assigned_by' => $staff->name,
            ], FrontendLinks::adminOrder((string) $order->reference)));
        }
    }

    public function start(Order $order, User $staff): void
    {
        abort_unless($order->status === OrderStatus::Received, 422, 'Only newly received orders can be started.');

        $order->update(['status' => OrderStatus::InProgress, 'started_at' => now(), 'assigned_to' => $order->assigned_to ?? $staff->id]);
        $this->event($order, 'started', 'Your officer has started work on this order.', $staff);
    }

    /**
     * Moves the progress marker. Customers are emailed when the new stage is one they can see.
     */
    public function setStage(Order $order, User $staff, int $index): void
    {
        abort_unless($order->status->isActive(), 422, 'Only active orders can change stage.');
        abort_unless(isset($order->stages_snapshot[$index]), 422, 'Unknown stage.');

        if ($order->status === OrderStatus::Received) {
            $order->started_at = now();
        }
        $order->fill(['current_stage' => $index, 'status' => $order->status === OrderStatus::AwaitingClient ? OrderStatus::AwaitingClient : OrderStatus::InProgress])->save();

        $stage = $order->stages_snapshot[$index];
        $this->event($order, 'stage', "Now at: {$stage['name']}.", $staff, customerVisible: $stage['customer_visible'], data: ['stage' => $index]);

        if ($stage['customer_visible']) {
            $order->user->notify(new OrderNotification(EmailTemplateKey::OrderUpdated, $order, ['stage_name' => $stage['name']]));
        }
    }

    /**
     * Pauses the order until the customer responds; the request is posted in the order chat too.
     */
    public function requestInfo(Order $order, User $staff, string $message): void
    {
        abort_unless($order->status->isActive(), 422, 'Only active orders can request information.');

        $order->update(['status' => OrderStatus::AwaitingClient]);
        $order->messages()->create(['user_id' => $staff->id, 'body' => $message, 'is_internal' => false]);
        $this->event($order, 'info_requested', 'Your officer needs more information.', $staff, data: ['message' => $message]);

        $order->user->notify(new OrderNotification(EmailTemplateKey::InfoRequested, $order->load('assignee'), [
            'message' => $message,
            'officer_name' => Str::before($staff->name, ' '),
        ]));
    }

    public function complete(Order $order, User $staff, ?string $note): void
    {
        abort_unless($order->status->isActive(), 422, 'Only active orders can be completed.');

        $order->update([
            'status' => OrderStatus::Completed,
            'completed_at' => now(),
            'current_stage' => max(0, count($order->stages_snapshot) - 1),
        ]);
        $this->event($order, 'completed', $note ?: 'Order complete. Your documents are ready.', $staff);
        $order->user->notify(new OrderNotification(EmailTemplateKey::OrderCompleted, $order));
    }

    /**
     * Customers can cancel before paying; staff can cancel any open order (refunds are done in Finance).
     */
    public function cancel(Order $order, User $by, string $reason): void
    {
        abort_if($order->status->isClosed(), 422, 'This order is already closed.');
        abort_if(! $by->isStaff() && $order->status !== OrderStatus::AwaitingPayment, 422, 'Paid orders can only be cancelled by our team. Please message your officer.');

        DB::transaction(function () use ($order, $by, $reason) {
            $order->update(['status' => OrderStatus::Cancelled, 'cancelled_at' => now(), 'cancel_reason' => $reason]);

            $invoice = $order->invoice;
            if ($invoice && $invoice->status === InvoiceStatus::Unpaid && $invoice->amount_paid === 0 && ! $invoice->hasPendingTransfer()) {
                $invoice->update(['status' => InvoiceStatus::Void, 'voided_at' => now()]);
            }

            $this->event($order, 'cancelled', "Order cancelled: {$reason}", $by);
        });
    }

    public function postMessage(Order $order, User $author, string $body, bool $internal = false): void
    {
        $order->messages()->create(['user_id' => $author->id, 'body' => $body, 'is_internal' => $internal && $author->isStaff()]);

        if ($author->isStaff() && ! $internal) {
            $order->user->notify(new OrderNotification(EmailTemplateKey::OrderMessage, $order, [
                'message' => $body,
                'officer_name' => Str::before($author->name, ' '),
            ]));
        }

        if (! $author->isStaff()) {
            $this->resumeIfWaiting($order, $author);
        }
    }

    /**
     * A reply or upload from the customer puts a paused order back in progress.
     */
    private function resumeIfWaiting(Order $order, User $actor): void
    {
        if ($order->status === OrderStatus::AwaitingClient && ! $actor->isStaff()) {
            $order->update(['status' => OrderStatus::InProgress]);
            $this->event($order, 'resumed', 'Customer responded. Back in progress.', $actor, customerVisible: false);
        }
    }

    /**
     * @param  array<string, mixed>|null  $data
     */
    private function event(Order $order, string $type, string $message, ?User $user = null, bool $customerVisible = true, ?array $data = null): void
    {
        $order->events()->create([
            'user_id' => $user?->id,
            'type' => $type,
            'message' => $message,
            'data' => $data,
            'customer_visible' => $customerVisible,
        ]);
    }
}
