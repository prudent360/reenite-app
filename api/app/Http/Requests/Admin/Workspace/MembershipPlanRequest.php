<?php

namespace App\Http\Requests\Admin\Workspace;

use App\Models\MembershipPlan;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MembershipPlanRequest extends FormRequest
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
            'slug' => ['nullable', 'string', 'max:140', 'alpha_dash', Rule::unique('membership_plans', 'slug')->ignore($this->route('membership_plan'))],
            'description' => ['nullable', 'string', 'max:500'],
            'price' => ['required', 'integer', 'min:0', 'max:10000000000'],
            'billing_period' => ['required', Rule::in(MembershipPlan::PERIODS)],
            'booking_discount_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'perks' => ['nullable', 'array', 'max:20'],
            'perks.*' => ['nullable', 'string', 'max:120'],
            'is_featured' => ['boolean'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
        ];
    }
}
