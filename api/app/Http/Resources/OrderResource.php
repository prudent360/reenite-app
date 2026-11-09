<?php

namespace App\Http\Resources;

use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\OrderFile;
use App\Models\OrderMessage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

/**
 * One order. With ->forStaff() it also includes internal notes, staff-only stages and events.
 *
 * @mixin Order
 */
class OrderResource extends JsonResource
{
    private bool $staffView = false;

    public function forStaff(): static
    {
        $this->staffView = true;

        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $stages = collect($this->stages_snapshot)->map(fn (array $stage, int $index) => $stage + [
            'index' => $index,
            'state' => $this->status->value === 'completed' || $index < $this->current_stage ? 'done' : ($index === $this->current_stage && $this->status->isActive() ? 'current' : 'upcoming'),
        ]);

        return [
            'reference' => $this->reference,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'service' => ['id' => $this->service_id, 'name' => $this->service_name, 'slug' => $this->service?->slug],
            'customer' => $this->when($this->staffView, fn () => $this->whenLoaded('user', fn () => [
                'id' => $this->user->id, 'name' => $this->user->name, 'email' => $this->user->email, 'phone' => $this->user->phone,
            ])),
            'officer' => $this->whenLoaded('assignee', fn () => $this->assignee ? ['id' => $this->assignee->id, 'name' => $this->assignee->name] : null),
            'invoice' => $this->whenLoaded('invoice', fn () => $this->invoice ? [
                'id' => $this->invoice->id,
                'number' => $this->invoice->number,
                'status' => $this->invoice->status->value,
                'total' => $this->invoice->total,
                'balance' => $this->invoice->balance(),
            ] : null),
            'stages' => $this->staffView ? $stages->values() : $stages->where('customer_visible', true)->values(),
            'current_stage' => $this->current_stage,
            'progress' => $this->progress(),
            'paid_at' => $this->paid_at?->toIso8601String(),
            'due_at' => $this->due_at?->toIso8601String(),
            'is_overdue' => $this->isOverdue(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancel_reason' => $this->cancel_reason,
            'created_at' => $this->created_at?->toIso8601String(),
            'answers' => $this->whenLoaded('files', fn () => $this->answerRows()),
            'documents' => $this->whenLoaded('files', fn () => $this->documentChecklist()),
            'deliverables' => $this->whenLoaded('files', fn () => $this->files->where('kind', OrderFile::DELIVERABLE)->values()->map($this->fileArray(...))),
            'outstanding_documents' => $this->whenLoaded('files', fn () => $this->documentChecklist()->filter(fn (array $item) => $item['is_required'] && in_array($item['file']['status'] ?? null, [null, 'rejected'], true))->count()),
            'events' => $this->whenLoaded('events', fn () => $this->events
                ->filter(fn (OrderEvent $event) => $this->staffView || $event->customer_visible)
                ->values()
                ->map(fn (OrderEvent $event) => [
                    'id' => $event->id,
                    'type' => $event->type,
                    'message' => $event->message,
                    'by' => $event->user && ($this->staffView || $event->user->isStaff()) ? $event->user->name : null,
                    'customer_visible' => $event->customer_visible,
                    'created_at' => $event->created_at?->toIso8601String(),
                ])),
            'messages' => $this->whenLoaded('messages', fn () => $this->messages
                ->filter(fn (OrderMessage $message) => $this->staffView || ! $message->is_internal)
                ->values()
                ->map(fn (OrderMessage $message) => [
                    'id' => $message->id,
                    'body' => $message->body,
                    'is_internal' => $message->is_internal,
                    'author' => $message->user?->name,
                    'from_staff' => (bool) $message->user?->isStaff(),
                    'created_at' => $message->created_at?->toIso8601String(),
                ])),
        ];
    }

    /**
     * Share of the stages completed, for progress bars (0-100).
     */
    private function progress(): int
    {
        $count = count($this->stages_snapshot);
        if ($this->status->value === 'completed') {
            return 100;
        }
        if ($count === 0 || ! $this->status->isActive()) {
            return 0;
        }

        return (int) round(($this->current_stage / $count) * 100);
    }

    /**
     * Intake answers with their questions; file questions point at the uploaded file.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function answerRows(): Collection
    {
        return collect($this->form_snapshot)->map(fn (array $field) => [
            'key' => $field['key'],
            'label' => $field['label'],
            'type' => $field['type'],
            'is_required' => $field['is_required'],
            'value' => $field['type'] === 'file' ? null : ($this->answers[$field['key']] ?? null),
            'file' => $field['type'] === 'file' ? $this->latestFile(OrderFile::FIELD, fieldKey: $field['key']) : null,
        ]);
    }

    /**
     * One row per required document, with the most recent upload for it.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function documentChecklist(): Collection
    {
        return collect($this->requirements_snapshot)->map(fn (array $requirement) => $requirement + [
            'file' => $this->latestFile(OrderFile::REQUIREMENT, requirementId: $requirement['id']),
            'history' => $this->files->where('kind', OrderFile::REQUIREMENT)->where('requirement_id', $requirement['id'])->count(),
        ]);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function latestFile(string $kind, ?int $requirementId = null, ?string $fieldKey = null): ?array
    {
        $file = $this->files
            ->where('kind', $kind)
            ->when($requirementId !== null, fn ($files) => $files->where('requirement_id', $requirementId))
            ->when($fieldKey !== null, fn ($files) => $files->where('field_key', $fieldKey))
            ->sortByDesc('id')
            ->first();

        return $file ? $this->fileArray($file) : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function fileArray(OrderFile $file): array
    {
        return [
            'id' => $file->id,
            'kind' => $file->kind,
            'label' => $file->label,
            'name' => $file->original_name,
            'mime' => $file->mime,
            'size' => $file->size,
            'status' => $file->status,
            'review_note' => $file->review_note,
            'created_at' => $file->created_at?->toIso8601String(),
        ];
    }
}
