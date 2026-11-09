<?php

namespace App\Http\Resources;

use App\Models\Service;
use App\Models\ServiceDocumentRequirement;
use App\Models\ServiceFormField;
use App\Models\ServiceStage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Money fields are in kobo.
 *
 * @mixin Service
 */
class ServiceResource extends JsonResource
{
    /**
     * Set by admin endpoints so internal-only stages are included.
     */
    public bool $forStaff = false;

    public function forStaff(): static
    {
        $this->forStaff = true;

        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'service_category_id' => $this->service_category_id,
            'category' => $this->whenLoaded('category', fn () => [
                'id' => $this->category->id,
                'name' => $this->category->name,
                'slug' => $this->category->slug,
            ]),
            'name' => $this->name,
            'slug' => $this->slug,
            'summary' => $this->summary,
            'description' => $this->description,
            'service_fee' => $this->service_fee,
            'government_fee' => $this->government_fee,
            'total_fee' => $this->totalFee(),
            'turnaround_days' => $this->turnaround_days,
            'requires_business' => $this->requires_business,
            'is_active' => $this->is_active,
            'sort_order' => $this->sort_order,
            'form_fields_count' => $this->whenCounted('formFields'),
            'document_requirements_count' => $this->whenCounted('documentRequirements'),
            'stages_count' => $this->whenCounted('stages'),
            'form_fields' => $this->whenLoaded('formFields', fn () => $this->formFields->map(fn (ServiceFormField $field) => [
                'id' => $field->id,
                'key' => $field->key,
                'label' => $field->label,
                'type' => $field->type->value,
                'options' => $field->options ?? [],
                'placeholder' => $field->placeholder,
                'help_text' => $field->help_text,
                'is_required' => $field->is_required,
            ])),
            'document_requirements' => $this->whenLoaded('documentRequirements', fn () => $this->documentRequirements->map(fn (ServiceDocumentRequirement $requirement) => [
                'id' => $requirement->id,
                'label' => $requirement->label,
                'description' => $requirement->description,
                'is_required' => $requirement->is_required,
            ])),
            'stages' => $this->whenLoaded('stages', fn () => $this->stages
                ->filter(fn (ServiceStage $stage) => $this->forStaff || $stage->customer_visible)
                ->values()
                ->map(fn (ServiceStage $stage) => [
                    'id' => $stage->id,
                    'name' => $stage->name,
                    'description' => $stage->description,
                    'customer_visible' => $stage->customer_visible,
                ])),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
