<?php

namespace App\Http\Requests\Admin\Workspace;

use App\Models\Addon;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AddonRequest extends FormRequest
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
            'description' => ['nullable', 'string', 'max:300'],
            'price' => ['required', 'integer', 'min:0', 'max:10000000000'],
            'charge_type' => ['required', Rule::in(Addon::CHARGE_TYPES)],
            'max_quantity' => ['required', 'integer', 'min:1', 'max:1000'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'space_ids' => ['nullable', 'array'],
            'space_ids.*' => ['integer', Rule::exists('spaces', 'id')],
        ];
    }
}
