<?php

namespace App\Http\Resources;

use App\Models\Location;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Location
 */
class LocationResource extends JsonResource
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
            'address' => $this->address,
            'city' => $this->city,
            'state' => $this->state,
            'phone' => $this->phone,
            'email' => $this->email,
            'description' => $this->description,
            'amenities' => $this->amenities ?? [],
            'hours' => $this->hours,
            'timezone' => $this->timezone,
            'is_active' => $this->is_active,
            'sort_order' => $this->sort_order,
            'spaces_count' => $this->whenCounted('spaces'),
            'spaces' => SpaceResource::collection($this->whenLoaded('spaces')),
        ];
    }
}
