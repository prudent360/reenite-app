<?php

namespace App\Http\Requests\Admin;

use App\Enums\FieldType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SyncServiceFieldsRequest extends FormRequest
{
    /**
     * Route middleware already checks the services.manage permission.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * The whole intake form in display order. Items with an id are updated, the rest created.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'fields' => ['present', 'array', 'max:60'],
            'fields.*.id' => ['nullable', 'integer'],
            'fields.*.key' => ['required', 'string', 'max:60', 'regex:/^[a-z][a-z0-9_]*$/', 'distinct'],
            'fields.*.label' => ['required', 'string', 'max:200'],
            'fields.*.type' => ['required', Rule::in(FieldType::values())],
            'fields.*.options' => ['nullable', 'array', 'max:50'],
            'fields.*.options.*' => ['string', 'max:150', 'distinct'],
            'fields.*.placeholder' => ['nullable', 'string', 'max:200'],
            'fields.*.help_text' => ['nullable', 'string', 'max:500'],
            'fields.*.is_required' => ['boolean'],
        ];
    }

    /**
     * Dropdowns and multiple-choice fields need at least two options.
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                foreach ($this->input('fields', []) as $index => $field) {
                    $type = FieldType::tryFrom($field['type'] ?? '');
                    if ($type?->needsOptions() && count(array_filter($field['options'] ?? [])) < 2) {
                        $validator->errors()->add("fields.{$index}.options", 'Add at least two options for this field.');
                    }
                }
            },
        ];
    }

    /**
     * Friendly names, so errors read "The question field is required." not "fields.6.label".
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'fields.*.key' => 'key',
            'fields.*.label' => 'question',
            'fields.*.type' => 'answer type',
            'fields.*.options' => 'options',
            'fields.*.options.*' => 'option',
            'fields.*.placeholder' => 'placeholder',
            'fields.*.help_text' => 'help text',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'fields.*.key.regex' => 'Field keys must start with a letter and use lowercase letters, numbers and underscores.',
            'fields.*.key.distinct' => 'Each field needs a unique key.',
        ];
    }
}
