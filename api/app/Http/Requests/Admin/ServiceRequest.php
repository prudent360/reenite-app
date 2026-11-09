<?php

namespace App\Http\Requests\Admin;

use App\Models\Service;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ServiceRequest extends FormRequest
{
    /**
     * Route middleware already checks the services.manage permission.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Fees arrive in kobo (whole numbers). The ceiling is ₦100m per fee.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        /** @var Service|null $service */
        $service = $this->route('service');

        return [
            'service_category_id' => ['required', 'integer', 'exists:service_categories,id'],
            'name' => ['required', 'string', 'max:150'],
            'slug' => ['nullable', 'string', 'max:170', 'alpha_dash', Rule::unique('services', 'slug')->ignore($service?->id)],
            'summary' => ['required', 'string', 'max:300'],
            'description' => ['nullable', 'string', 'max:10000'],
            'service_fee' => ['required', 'integer', 'min:0', 'max:10000000000'],
            'government_fee' => ['required', 'integer', 'min:0', 'max:10000000000'],
            'turnaround_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'requires_business' => ['boolean'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
        ];
    }
}
