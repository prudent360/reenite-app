<?php

namespace App\Http\Resources;

use App\Enums\PaymentGatewayCode;
use App\Models\Payment;
use App\Models\Refund;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Money fields are in kobo. Never exposes the stored proof file path.
 *
 * @mixin Payment
 */
class PaymentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'reference' => $this->reference,
            'receipt_number' => $this->receipt_number,
            'invoice_id' => $this->invoice_id,
            'invoice' => $this->whenLoaded('invoice', fn () => [
                'id' => $this->invoice->id,
                'number' => $this->invoice->number,
                'total' => $this->invoice->total,
                'status' => $this->invoice->status->value,
            ]),
            'customer' => $this->whenLoaded('user', fn () => ['id' => $this->user->id, 'name' => $this->user->name, 'email' => $this->user->email, 'phone' => $this->user->phone]),
            'gateway' => $this->gateway,
            'gateway_label' => $this->isBankTransfer() ? 'Bank transfer' : (PaymentGatewayCode::tryFrom($this->gateway)?->label() ?? $this->gateway),
            'mode' => $this->mode,
            'amount' => $this->amount,
            'currency' => $this->currency,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'channel' => $this->channel,
            'amount_refunded' => $this->amount_refunded,
            'refundable' => $this->refundable(),
            'sender_name' => $this->sender_name,
            'transferred_on' => $this->transferred_on?->toDateString(),
            'has_proof' => filled($this->proof_path),
            'proof_name' => $this->proof_name,
            'review_note' => $this->review_note,
            'reviewed_by' => $this->whenLoaded('reviewer', fn () => $this->reviewer?->name),
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'failure_reason' => $this->failure_reason,
            'paid_at' => $this->paid_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'refunds' => $this->whenLoaded('refunds', fn () => $this->refunds->map(fn (Refund $refund) => [
                'id' => $refund->id,
                'amount' => $refund->amount,
                'reason' => $refund->reason,
                'method' => $refund->method,
                'status' => $refund->status,
                'gateway_reference' => $refund->gateway_reference,
                'created_at' => $refund->created_at?->toIso8601String(),
            ])),
        ];
    }
}
