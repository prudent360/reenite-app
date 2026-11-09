<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class SyncServiceStagesRequest extends FormRequest
{
    /**
     * Route middleware already checks the services.manage permission.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * The progress steps an order moves through, in order. At least one is required.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'stages' => ['required', 'array', 'min:1', 'max:20'],
            'stages.*.id' => ['nullable', 'integer'],
            'stages.*.name' => ['required', 'string', 'max:120'],
            'stages.*.description' => ['nullable', 'string', 'max:500'],
            'stages.*.customer_visible' => ['boolean'],
        ];
    }

    /**
     * Friendly names for error messages.
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['stages.*.name' => 'stage name', 'stages.*.description' => 'description'];
    }
}
