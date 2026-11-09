<?php

namespace App\Http\Requests\Admin\Workspace;

use App\Workspace\OpeningHours;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LocationRequest extends FormRequest
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
            'slug' => ['nullable', 'string', 'max:140', 'alpha_dash', Rule::unique('locations', 'slug')->ignore($this->route('location'))],
            'address' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:100'],
            'state' => ['required', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'amenities' => ['nullable', 'array', 'max:30'],
            'amenities.*' => ['nullable', 'string', 'max:80'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_active' => ['boolean'],
        ] + OpeningHours::rules('hours');
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return OpeningHours::messages('hours');
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['hours.*.opens' => 'opening time', 'hours.*.closes' => 'closing time'];
    }
}
