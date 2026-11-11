<?php

namespace App\Http\Resources;

use App\Models\ConsultationType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ConsultationType
 */
class ConsultationTypeResource extends JsonResource
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
            'duration_minutes' => $this->duration_minutes,
            'price' => $this->price,
            'mode' => $this->mode,
            'mode_label' => $this->modeLabel(),
            // An object, so weekday keys 1 to 7 survive (a plain array with number keys gets renumbered from 0).
            'schedule' => (object) $this->schedule,
            'notice_hours' => $this->notice_hours,
            'is_active' => $this->is_active,
            'sort_order' => $this->sort_order,
            'upcoming_count' => $this->whenCounted('consultations'),
        ];
    }
}
