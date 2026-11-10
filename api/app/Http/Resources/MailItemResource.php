<?php

namespace App\Http\Resources;

use App\Models\MailItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin MailItem
 */
class MailItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'kind_label' => MailItem::KINDS[$this->kind] ?? ucfirst($this->kind),
            'sender' => $this->sender,
            'description' => $this->description,
            'received_at' => $this->received_at->toIso8601String(),
            // waiting | collected | forwarded | shredded
            'status' => $this->status,
            'status_label' => $this->isWaiting() ? 'At the front desk' : (MailItem::OUTCOMES[$this->status] ?? ucfirst($this->status)),
            'requested_action' => $this->requested_action,
            'request_label' => $this->requested_action ? MailItem::ACTIONS[$this->requested_action] ?? null : null,
            'request_note' => $this->request_note,
            'requested_at' => $this->requested_at?->toIso8601String(),
            'has_scan' => $this->scan_path !== null,
            'scanned_at' => $this->scanned_at?->toIso8601String(),
            'handled_at' => $this->handled_at?->toIso8601String(),
            'handled_note' => $this->handled_note,
            'handled_by' => $this->whenLoaded('handler', fn () => $this->handler?->name),
            'logged_by' => $this->whenLoaded('logger', fn () => $this->logger?->name),
            'mailbox' => $this->whenLoaded('mailbox', fn () => [
                'id' => $this->mailbox->id,
                'number' => $this->mailbox->number,
                'business_name' => $this->mailbox->business_name,
                'customer' => $this->mailbox->relationLoaded('user') ? ['id' => $this->mailbox->user->id, 'name' => $this->mailbox->user->name, 'email' => $this->mailbox->user->email] : null,
            ]),
        ];
    }
}
