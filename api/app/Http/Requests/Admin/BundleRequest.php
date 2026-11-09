<?php

namespace App\Http\Requests\Admin;

use App\Models\Bundle;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BundleRequest extends FormRequest
{
    /**
     * Route middleware already checks the services.manage permission.
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
        /** @var Bundle|null $bundle */
        $bundle = $this->route('bundle');

        return [
            'name' => ['required', 'string', 'max:150'],
            'slug' => ['nullable', 'string', 'max:170', 'alpha_dash', Rule::unique('bundles', 'slug')->ignore($bundle?->id)],
            'summary' => ['required', 'string', 'max:300'],
            'description' => ['nullable', 'string', 'max:10000'],
            'price' => ['required', 'integer', 'min:0', 'max:10000000000'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'service_ids' => ['required', 'array', 'min:2', 'max:20'],
            'service_ids.*' => ['integer', 'distinct', Rule::exists('services', 'id')->whereNull('deleted_at')],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'service_ids.min' => 'A bundle needs at least two services.',
        ];
    }
}
