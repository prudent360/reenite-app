<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class SyncServiceRequirementsRequest extends FormRequest
{
    /**
     * Route middleware already checks the services.manage permission.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * The full list of documents the customer must upload, in display order.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'requirements' => ['present', 'array', 'max:30'],
            'requirements.*.id' => ['nullable', 'integer'],
            'requirements.*.label' => ['required', 'string', 'max:200'],
            'requirements.*.description' => ['nullable', 'string', 'max:500'],
            'requirements.*.is_required' => ['boolean'],
        ];
    }

    /**
     * Friendly names for error messages.
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['requirements.*.label' => 'document', 'requirements.*.description' => 'guidance'];
    }
}
