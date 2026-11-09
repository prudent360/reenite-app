<?php

namespace App\Http\Requests\Admin\Workspace;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BlackoutDateRequest extends FormRequest
{
    /**
     * Route middleware already checks the workspace.manage permission.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Times are Lagos wall-clock times from the admin's form.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'location_id' => ['required', 'integer', Rule::exists('locations', 'id')],
            'space_id' => ['nullable', 'integer', Rule::exists('spaces', 'id')->where('location_id', $this->integer('location_id'))],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'reason' => ['required', 'string', 'max:200'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['space_id.exists' => 'That space is not at the chosen location.'];
    }
}
