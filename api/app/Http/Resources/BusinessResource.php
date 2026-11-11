<?php

namespace App\Http\Resources;

use App\Compliance\HealthScore;
use App\Models\Business;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Business
 */
class BusinessResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'entity_type' => $this->entity_type,
            'entity_type_label' => $this->typeLabel(),
            'registration_number' => $this->registration_number,
            'registered_on' => $this->registered_on?->toDateString(),
            'tin' => $this->tin,
            'vat_registered' => $this->vat_registered,
            'has_employees' => $this->has_employees,
            'financial_year_end_month' => $this->financial_year_end_month,
            'state' => $this->state,
            'industry' => $this->industry,
            'health' => $this->whenLoaded('openItems', fn () => HealthScore::for($this->resource)),
            'next_deadlines' => $this->whenLoaded('openItems', fn () => ComplianceItemResource::collection($this->openItems->take(3))),
            'owner' => $this->whenLoaded('user', fn () => ['id' => $this->user->id, 'name' => $this->user->name, 'email' => $this->user->email]),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
