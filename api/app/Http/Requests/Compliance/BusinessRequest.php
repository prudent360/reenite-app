<?php

namespace App\Http\Requests\Compliance;

use App\Models\Business;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BusinessRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'entity_type' => ['required', Rule::in(array_keys(Business::TYPES))],
            'registration_number' => ['nullable', 'string', 'max:40', 'regex:/^[A-Za-z0-9 \/-]+$/'],
            'registered_on' => ['nullable', 'date', 'before_or_equal:today', 'after:1960-01-01'],
            'tin' => ['nullable', 'string', 'max:30', 'regex:/^[0-9-]+$/'],
            'vat_registered' => ['required', 'boolean'],
            'has_employees' => ['required', 'boolean'],
            'financial_year_end_month' => ['required', 'integer', 'between:1,12'],
            'state' => ['nullable', 'string', 'max:40'],
            'industry' => ['nullable', 'string', 'max:100'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'registration_number.regex' => 'Use letters, numbers and dashes only, e.g. RC 1234567 or BN 3456789.',
            'tin.regex' => 'A TIN is numbers only, e.g. 12345678-0001.',
            'registered_on.before_or_equal' => "The registration date can't be in the future.",
        ];
    }
}
