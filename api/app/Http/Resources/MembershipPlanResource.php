<?php

namespace App\Http\Resources;

use App\Models\MembershipPlan;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin MembershipPlan
 */
class MembershipPlanResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'price' => $this->price,
            'billing_period' => $this->billing_period,
            'booking_discount_percent' => $this->booking_discount_percent,
            'perks' => $this->perks ?? [],
            'is_featured' => $this->is_featured,
            'is_active' => $this->is_active,
            'sort_order' => $this->sort_order,
        ];
    }
}
