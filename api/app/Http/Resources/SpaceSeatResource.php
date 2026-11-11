<?php

namespace App\Http\Resources;

use App\Models\SpaceSeat;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SpaceSeat
 */
class SpaceSeatResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'space_id' => $this->space_id,
            'label' => $this->label,
            'zone' => $this->zone,
            'is_active' => $this->is_active,
            'sort_order' => $this->sort_order,
            'bookings_count' => $this->whenCounted('bookings'),
        ];
    }
}
