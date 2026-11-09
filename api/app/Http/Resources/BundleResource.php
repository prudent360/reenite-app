<?php

namespace App\Http\Resources;

use App\Models\Bundle;
use App\Models\Service;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Money fields are in kobo.
 *
 * @mixin Bundle
 */
class BundleResource extends JsonResource
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
            'price' => $this->price,
            'value_of_services' => $this->whenLoaded('services', fn () => $this->valueOfServices()),
            'is_active' => $this->is_active,
            'sort_order' => $this->sort_order,
            'services' => $this->whenLoaded('services', fn () => $this->services->map(fn (Service $service) => [
                'id' => $service->id,
                'name' => $service->name,
                'slug' => $service->slug,
                'total_fee' => $service->totalFee(),
                'is_active' => $service->is_active,
            ])),
        ];
    }
}
