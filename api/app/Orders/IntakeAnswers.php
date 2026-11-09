<?php

namespace App\Orders;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * Validates a customer's answers against the intake form as it was when they ordered.
 * File questions are answered by uploading, so they're not part of the answers payload.
 */
class IntakeAnswers
{
    /**
     * @param  list<array<string, mixed>>  $fields  form snapshot
     * @param  array<string, mixed>  $answers
     * @return array<string, mixed> clean answers keyed by field key
     */
    public static function validate(array $fields, array $answers): array
    {
        $rules = [];
        $attributes = [];

        foreach ($fields as $field) {
            if ($field['type'] === 'file') {
                continue;
            }
            $key = "answers.{$field['key']}";
            $presence = $field['is_required'] ? 'required' : 'nullable';
            $attributes[$key] = strtolower($field['label']);

            $rules[$key] = match ($field['type']) {
                'textarea' => [$presence, 'string', 'max:10000'],
                'number' => [$presence, 'numeric'],
                'email' => [$presence, 'email', 'max:255'],
                'phone' => [$presence, 'string', 'regex:/^\+?[0-9\s-]{7,20}$/'],
                'date' => [$presence, 'date'],
                'select', 'radio' => [$presence, Rule::in($field['options'] ?? [])],
                'checkbox' => $field['is_required'] ? ['accepted'] : ['nullable', 'boolean'],
                'people' => [$presence, 'array', $field['is_required'] ? 'min:1' : 'min:0', 'max:20'],
                default => [$presence, 'string', 'max:2000'],
            };

            if ($field['type'] === 'people') {
                $rules["{$key}.*.full_name"] = ['required', 'string', 'max:150'];
                $rules["{$key}.*.email"] = ['nullable', 'email', 'max:255'];
                $rules["{$key}.*.phone"] = ['nullable', 'string', 'max:20'];
                $rules["{$key}.*.id_number"] = ['nullable', 'string', 'max:50'];
                $attributes["{$key}.*.full_name"] = 'full name';
            }
        }

        $validated = Validator::make(['answers' => $answers], $rules, [], $attributes)->validate();

        // Keep only known keys, in form order.
        return collect($fields)
            ->reject(fn (array $field) => $field['type'] === 'file')
            ->mapWithKeys(fn (array $field) => [$field['key'] => $validated['answers'][$field['key']] ?? null])
            ->all();
    }
}
