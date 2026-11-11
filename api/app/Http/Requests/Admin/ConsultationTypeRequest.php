<?php

namespace App\Http\Requests\Admin;

use App\Models\ConsultationType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ConsultationTypeRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:2000'],
            'duration_minutes' => ['required', 'integer', Rule::in([15, 30, 45, 60, 90, 120])],
            'price' => ['required', 'integer', 'min:0', 'max:100000000'],
            'mode' => ['required', Rule::in(array_keys(ConsultationType::MODES))],
            'schedule' => ['required', 'array'],
            'schedule.*' => ['array', 'size:2'],
            'schedule.*.*' => ['required', 'date_format:H:i'],
            'notice_hours' => ['required', 'integer', 'between:0,336'],
            'is_active' => ['required', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'duration_minutes.in' => 'Choose 15, 30, 45, 60, 90 or 120 minutes.',
            'schedule.*.*.date_format' => 'Use times like 09:00 or 16:30.',
        ];
    }

    /**
     * Days are ISO weekdays (1 Monday to 7 Sunday), each opening before it closes, with at least one day open.
     *
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validator) {
            $schedule = $this->input('schedule');
            if (! is_array($schedule) || $validator->errors()->has('schedule*')) {
                return;
            }
            if ($schedule === []) {
                $validator->errors()->add('schedule', 'Open at least one day a week.');
            }
            foreach ($schedule as $day => $hours) {
                if (! in_array((string) $day, ['1', '2', '3', '4', '5', '6', '7'], true)) {
                    $validator->errors()->add('schedule', 'Days must be numbered 1 (Monday) to 7 (Sunday).');
                } elseif (is_array($hours) && count($hours) === 2 && strcmp((string) $hours[0], (string) $hours[1]) >= 0) {
                    $validator->errors()->add("schedule.{$day}", 'The closing time must be after the opening time.');
                }
            }
        }];
    }
}
