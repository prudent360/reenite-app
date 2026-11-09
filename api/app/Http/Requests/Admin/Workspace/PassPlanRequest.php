<?php

namespace App\Http\Requests\Admin\Workspace;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PassPlanRequest extends FormRequest
{
    /**
     * Route middleware already checks the workspace.manage permission.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:140', 'alpha_dash', Rule::unique('pass_plans', 'slug')->ignore($this->route('pass_plan'))],
            'description' => ['nullable', 'string', 'max:500'],
            'location_id' => ['nullable', 'integer', Rule::exists('locations', 'id')],
            'price' => ['required', 'integer', 'min:0', 'max:10000000000'],
            'credit_type' => ['required', Rule::in(['visits', 'hours'])],
            'credits' => ['required', 'integer', 'min:1', 'max:1000'],
            'period' => ['required', Rule::in(['week', 'month'])],
            'space_type_ids' => ['required', 'array', 'min:1'],
            'space_type_ids.*' => ['integer', Rule::exists('space_types', 'id')],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['space_type_ids.required' => 'Choose at least one type of space this pass can be used on.'];
    }
}
