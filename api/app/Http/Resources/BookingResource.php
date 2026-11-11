<?php

namespace App\Http\Resources;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Models\BookingAddon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Booking
 */
class BookingResource extends JsonResource
{
    /**
     * Set by the controller: the refund the customer would get if they cancelled now.
     */
    public ?int $refundPreview = null;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $codeVisible = in_array($this->status, [BookingStatus::Confirmed, BookingStatus::CheckedIn, BookingStatus::Completed], true);

        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'starts_at' => $this->starts_at->toIso8601String(),
            'ends_at' => $this->ends_at->toIso8601String(),
            'rate_unit' => $this->rate_unit,
            'quantity' => $this->quantity,
            'seats' => $this->seats,
            'assigned_seats' => $this->whenLoaded('assignedSeats', fn () => $this->assignedSeats->map(fn ($seat) => [
                'id' => $seat->id,
                'label' => $seat->label,
                'zone' => $seat->zone,
            ])->values()),
            'subtotal' => $this->subtotal,
            'addons_total' => $this->addons_total,
            'discount' => $this->discount,
            'discount_label' => $this->discount_label,
            'total' => $this->total,
            'pass_credits_used' => $this->pass_credits_used,
            'paid_via' => $this->paid_via,
            'hold_expires_at' => $this->hold_expires_at?->toIso8601String(),
            'hold_active' => $this->status === BookingStatus::Held && $this->isOccupying(),
            'check_in_code' => $codeVisible ? $this->check_in_code : null,
            'checked_in_at' => $this->checked_in_at?->toIso8601String(),
            'space_name' => $this->space_name,
            'location_name' => $this->location_name,
            'cancellation_policy' => $this->policy_snapshot['summary'] ?? [],
            'notes' => $this->notes,
            'confirmed_at' => $this->confirmed_at?->toIso8601String(),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancel_reason' => $this->cancel_reason,
            'refund_amount' => $this->refund_amount,
            'can_cancel' => $this->status->isCancellable() && $this->starts_at->isFuture(),
            'refund_preview' => $this->when($this->refundPreview !== null, $this->refundPreview),
            'space' => $this->whenLoaded('space', fn () => [
                'id' => $this->space->id,
                'slug' => $this->space->slug,
                'name' => $this->space->name,
                'photo_url' => $this->space->photoUrl(),
                'location' => $this->space->relationLoaded('location') ? [
                    'name' => $this->space->location->name,
                    'address' => $this->space->location->address,
                    'city' => $this->space->location->city,
                    'timezone' => $this->space->location->timezone,
                ] : null,
            ]),
            'addons' => $this->whenLoaded('addons', fn () => $this->addons->map(fn (BookingAddon $addon) => [
                'name' => $addon->name,
                'quantity' => $addon->quantity,
                'total' => $addon->total,
            ])),
            'invoice' => new InvoiceResource($this->whenLoaded('invoice')),
            'customer' => $this->whenLoaded('user', fn () => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
                'phone' => $this->user->phone,
                'is_guest' => $this->user->isGuest(),
            ]),
            'checked_in_by' => $this->whenLoaded('checkedInBy', fn () => $this->checkedInBy?->name),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
