<?php

namespace App\Http\Resources;

use App\Models\PassPlan;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PassPlan
 */
class PassPlanResource extends JsonResource
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
            'credit_type' => $this->credit_type,
            'credits' => $this->credits,
            'period' => $this->period,
            'allowance' => $this->allowanceLabel(),
            'location_id' => $this->location_id,
            'location' => $this->whenLoaded('location', fn () => $this->location?->name),
            'space_type_ids' => $this->whenLoaded('spaceTypes', fn () => $this->spaceTypes->pluck('id')),
            'space_types' => $this->whenLoaded('spaceTypes', fn () => $this->spaceTypes->pluck('name')),
            'is_active' => $this->is_active,
            'sort_order' => $this->sort_order,
        ];
    }
}
