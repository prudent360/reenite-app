<?php

namespace App\Http\Resources;

use App\Models\BlackoutDate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin BlackoutDate
 */
class BlackoutDateResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'location_id' => $this->location_id,
            'space_id' => $this->space_id,
            'location' => $this->whenLoaded('location', fn () => $this->location->name),
            'space' => $this->whenLoaded('space', fn () => $this->space?->name),
            'starts_at' => $this->starts_at->toIso8601String(),
            'ends_at' => $this->ends_at->toIso8601String(),
            'reason' => $this->reason,
        ];
    }
}
