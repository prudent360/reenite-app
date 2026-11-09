<?php

namespace App\Http\Resources;

use App\Models\SpaceType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SpaceType
 */
class SpaceTypeResource extends JsonResource
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
            'icon' => $this->icon,
            'booking_mode' => $this->booking_mode,
            'is_active' => $this->is_active,
            'sort_order' => $this->sort_order,
            'spaces_count' => $this->whenCounted('spaces'),
        ];
    }
}
