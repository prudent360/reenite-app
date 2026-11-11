<?php

namespace App\Http\Resources;

use App\Models\Consultation;
use App\Models\ConsultationType;
use App\Notifications\ConsultationNotification;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Consultation
 */
class ConsultationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $staff = $request->user()?->isStaff() ?? false;
        $confirmed = in_array($this->status, [Consultation::CONFIRMED, Consultation::COMPLETED], true);

        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'name' => $this->name,
            'mode' => $this->mode,
            'mode_label' => ConsultationType::MODES[$this->mode] ?? $this->mode,
            'starts_at' => $this->starts_at->toIso8601String(),
            'ends_at' => $this->ends_at->toIso8601String(),
            'topic' => $this->topic,
            'status' => $this->status,
            'status_label' => Consultation::STATUS_LABELS[$this->status] ?? $this->status,
            'hold_expires_at' => $this->hold_expires_at?->toIso8601String(),
            'price' => $this->price,
            // Customers see how to join once it's confirmed.
            'meeting_details' => $confirmed || $staff ? ($this->relationLoaded('user') ? ConsultationNotification::meetingDetails($this->resource) : $this->meeting_details) : null,
            'hold_active' => $this->status === Consultation::PENDING_PAYMENT && $this->hold_expires_at?->isFuture() === true,
            'is_upcoming' => in_array($this->status, [Consultation::PENDING_PAYMENT, Consultation::CONFIRMED], true) && $this->ends_at->isFuture(),
            'has_started' => $this->starts_at->isPast(),
            'can_cancel' => $this->isCancellable() && $this->starts_at->isFuture(),
            'free_cancel_until' => $this->starts_at->copy()->subHours(Consultation::FREE_CANCEL_HOURS)->toIso8601String(),
            'free_cancel' => now()->diffInHours($this->starts_at, false) >= Consultation::FREE_CANCEL_HOURS,
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancel_reason' => $this->cancel_reason,
            'refund_amount' => $this->refund_amount,
            'invoice' => new InvoiceResource($this->whenLoaded('invoice')),
            'officer' => $this->whenLoaded('officer', fn () => $this->officer ? ['id' => $this->officer->id, 'name' => $this->officer->name] : null),
            'type' => $this->whenLoaded('type', fn () => ['id' => $this->type->id, 'slug' => $this->type->slug, 'name' => $this->type->name]),
            // Staff only
            'staff_notes' => $this->when($staff, $this->staff_notes),
            'raw_meeting_details' => $this->when($staff, $this->meeting_details),
            'customer' => $this->when($staff && $this->relationLoaded('user'), fn () => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
                'phone' => $this->user->phone,
            ]),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
