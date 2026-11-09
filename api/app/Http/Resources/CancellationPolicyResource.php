<?php

namespace App\Http\Resources;

use App\Models\CancellationPolicy;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin CancellationPolicy
 */
class CancellationPolicyResource extends JsonResource
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
            'rules' => collect($this->rules)->sortByDesc('hours_before')->values(),
            'summary' => $this->summary(),
            'is_default' => $this->is_default,
            'spaces_count' => $this->whenCounted('spaces'),
        ];
    }
}
