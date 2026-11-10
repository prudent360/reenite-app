<?php

namespace App\Http\Resources;

use App\Models\Coupon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Money fields are in kobo.
 *
 * @mixin Coupon
 */
class CouponResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $expired = $this->expires_at?->isPast() ?? false;

        return [
            'id' => $this->id,
            'code' => $this->code,
            'description' => $this->description,
            'discount_type' => $this->discount_type,
            'discount_value' => $this->discount_value,
            'max_discount' => $this->max_discount,
            'min_spend' => $this->min_spend,
            'label' => $this->label(),
            'applies_to' => $this->applies_to,
            'max_uses' => $this->max_uses,
            'max_uses_per_customer' => $this->max_uses_per_customer,
            'starts_at' => $this->starts_at?->toIso8601String(),
            'expires_at' => $this->expires_at?->toIso8601String(),
            'is_active' => $this->is_active,
            // active | scheduled | expired | used_up | off
            'state' => match (true) {
                ! $this->is_active => 'off',
                $expired => 'expired',
                $this->starts_at?->isFuture() ?? false => 'scheduled',
                $this->max_uses !== null && ($this->uses_count ?? 0) >= $this->max_uses => 'used_up',
                default => 'active',
            },
            'uses' => (int) ($this->uses_count ?? 0),
            'paid_uses' => (int) ($this->paid_uses_count ?? 0),
            'discount_given' => (int) ($this->discount_given ?? 0),
            'created_by' => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
