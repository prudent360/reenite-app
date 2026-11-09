<?php

namespace App\Http\Requests\Admin\Workspace;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CancellationPolicyRequest extends FormRequest
{
    /**
     * Route middleware already checks the workspace.manage permission.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Each rule: cancelling at least hours_before the start refunds refund_percent.
     * A 0-hour rule is required so every cancellation has an answer.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_default' => ['boolean'],
            'rules' => ['required', 'array', 'min:1', 'max:10', function (string $attribute, mixed $value, \Closure $fail) {
                if (is_array($value) && ! collect($value)->contains(fn ($rule) => (int) ($rule['hours_before'] ?? -1) === 0)) {
                    $fail('Add a rule for 0 hours: what happens when someone cancels at the last minute.');
                }
            }],
            'rules.*.hours_before' => ['required', 'integer', 'min:0', 'max:8760', 'distinct'],
            'rules.*.refund_percent' => ['required', 'integer', 'min:0', 'max:100'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['rules.*.hours_before' => 'hours before', 'rules.*.refund_percent' => 'refund percentage'];
    }
}
