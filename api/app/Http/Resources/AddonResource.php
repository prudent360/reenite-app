<?php

namespace App\Http\Resources;

use App\Models\Addon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Addon
 */
class AddonResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'price' => $this->price,
            'charge_type' => $this->charge_type,
            'max_quantity' => $this->max_quantity,
            'is_active' => $this->is_active,
            'sort_order' => $this->sort_order,
            'space_ids' => $this->whenLoaded('spaces', fn () => $this->spaces->pluck('id')),
        ];
    }
}
