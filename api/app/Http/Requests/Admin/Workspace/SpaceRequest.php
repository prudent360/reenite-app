<?php

namespace App\Http\Requests\Admin\Workspace;

use App\Models\Addon;
use App\Models\SpaceRate;
use App\Workspace\OpeningHours;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SpaceRequest extends FormRequest
{
    /**
     * Route middleware already checks the workspace.manage permission.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Rates are per seat on shared spaces. At least one active rate is required to book.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'location_id' => ['required', 'integer', Rule::exists('locations', 'id')],
            'space_type_id' => ['required', 'integer', Rule::exists('space_types', 'id')],
            'cancellation_policy_id' => ['nullable', 'integer', Rule::exists('cancellation_policies', 'id')],
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:140', 'alpha_dash', Rule::unique('spaces', 'slug')->ignore($this->route('space'))],
            'summary' => ['nullable', 'string', 'max:300'],
            'description' => ['nullable', 'string', 'max:5000'],
            'capacity' => ['required', 'integer', 'min:1', 'max:10000'],
            'amenities' => ['nullable', 'array', 'max:30'],
            'amenities.*' => ['nullable', 'string', 'max:80'],
            'min_duration_minutes' => ['required', 'integer', 'min:15', 'max:525600'],
            'max_duration_minutes' => ['nullable', 'integer', 'gte:min_duration_minutes', 'max:525600'],
            'buffer_minutes' => ['required', 'integer', 'min:0', 'max:1440'],
            'min_notice_minutes' => ['required', 'integer', 'min:0', 'max:43200'],
            'advance_booking_days' => ['required', 'integer', 'min:1', 'max:730'],
            'requires_approval' => ['boolean'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'rates' => ['required', 'array', 'min:1', 'max:4'],
            'rates.*.unit' => ['required', Rule::in(SpaceRate::UNITS), 'distinct'],
            'rates.*.price' => ['required', 'integer', 'min:0', 'max:10000000000'],
            'rates.*.is_active' => ['boolean'],
            'addon_ids' => ['nullable', 'array'],
            'addon_ids.*' => ['integer', Rule::exists(Addon::class, 'id')],
        ] + OpeningHours::rules('hours', nullable: true);
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return OpeningHours::messages('hours');
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'rates.*.price' => 'price',
            'rates.*.unit' => 'rate',
            'hours.*.opens' => 'opening time',
            'hours.*.closes' => 'closing time',
            'max_duration_minutes' => 'longest booking',
            'min_duration_minutes' => 'shortest booking',
        ];
    }
}
