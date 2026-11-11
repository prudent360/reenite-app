<?php

namespace App\Http\Resources;

use App\Models\CustomerMembership;
use App\Models\CustomerPass;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Money fields are in kobo.
 *
 * @mixin Invoice
 */
class InvoiceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'currency' => $this->currency,
            'subtotal' => $this->subtotal,
            'total' => $this->total,
            'coupon_code' => $this->coupon_code,
            'coupon_discount' => $this->coupon_discount,
            'accepts_coupon' => $this->isPayable() && $this->amount_paid === 0,
            'amount_paid' => $this->amount_paid,
            'amount_refunded' => $this->amount_refunded,
            'balance' => $this->balance(),
            'is_payable' => $this->isPayable(),
            // A pass or membership, which can renew automatically on a saved card.
            'for_plan' => in_array($this->source_type, [CustomerPass::class, CustomerMembership::class], true),
            'has_pending_transfer' => $this->whenLoaded('payments', fn () => $this->payments->contains(
                fn ($payment) => $payment->isBankTransfer() && $payment->status->value === 'awaiting_review',
            )),
            'due_at' => $this->due_at?->toDateString(),
            'is_overdue' => $this->isPayable() && $this->due_at?->isPast() && ! $this->due_at->isToday(),
            'paid_at' => $this->paid_at?->toIso8601String(),
            'voided_at' => $this->voided_at?->toIso8601String(),
            'notes' => $this->notes,
            'customer' => $this->whenLoaded('user', fn () => ['id' => $this->user->id, 'name' => $this->user->name, 'email' => $this->user->email, 'phone' => $this->user->phone]),
            'created_by' => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn (InvoiceItem $item) => [
                'id' => $item->id,
                'service_id' => $item->service_id,
                'description' => $item->description,
                'quantity' => $item->quantity,
                'unit_amount' => $item->unit_amount,
                'amount' => $item->amount,
            ])),
            'payments' => PaymentResource::collection($this->whenLoaded('payments')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
