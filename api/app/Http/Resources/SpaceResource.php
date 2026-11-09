<?php

namespace App\Http\Resources;

use App\Models\Space;
use App\Models\SpaceRate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Space
 */
class SpaceResource extends JsonResource
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
            'summary' => $this->summary,
            'description' => $this->description,
            'capacity' => $this->capacity,
            'amenities' => $this->amenities ?? [],
            'hours' => $this->hours,
            'uses_location_hours' => $this->hours === null,
            'min_duration_minutes' => $this->min_duration_minutes,
            'max_duration_minutes' => $this->max_duration_minutes,
            'buffer_minutes' => $this->buffer_minutes,
            'min_notice_minutes' => $this->min_notice_minutes,
            'advance_booking_days' => $this->advance_booking_days,
            'requires_approval' => $this->requires_approval,
            'photo_url' => $this->photoUrl(),
            'is_active' => $this->is_active,
            'sort_order' => $this->sort_order,
            'location_id' => $this->location_id,
            'space_type_id' => $this->space_type_id,
            'cancellation_policy_id' => $this->cancellation_policy_id,
            'location' => $this->whenLoaded('location', fn () => ['id' => $this->location->id, 'name' => $this->location->name, 'slug' => $this->location->slug]),
            'type' => new SpaceTypeResource($this->whenLoaded('type')),
            'cancellation_policy' => new CancellationPolicyResource($this->whenLoaded('cancellationPolicy')),
            'rates' => $this->whenLoaded('rates', fn () => $this->rates
                ->sortBy(fn (SpaceRate $rate) => array_search($rate->unit, SpaceRate::UNITS, true))
                ->map(fn (SpaceRate $rate) => ['unit' => $rate->unit, 'price' => $rate->price, 'is_active' => $rate->is_active])
                ->values()),
            'addons' => AddonResource::collection($this->whenLoaded('addons')),
        ];
    }
}
