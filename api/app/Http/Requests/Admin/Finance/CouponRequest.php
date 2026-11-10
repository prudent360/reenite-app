<?php

namespace App\Http\Requests\Admin\Finance;

use App\Models\Coupon;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CouponRequest extends FormRequest
{
    /**
     * Route middleware already checks the coupons.manage permission.
     */
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('code'))) {
            $this->merge(['code' => Coupon::normalizeCode($this->input('code'))]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $percent = $this->input('discount_type') === Coupon::PERCENT;

        return [
            'code' => ['required', 'string', 'min:3', 'max:40', 'regex:/^[A-Z0-9_-]+$/', Rule::unique('coupons', 'code')->ignore($this->route('coupon'))],
            'description' => ['nullable', 'string', 'max:255'],
            'discount_type' => ['required', Rule::in(Coupon::TYPES)],
            'discount_value' => ['required', 'integer', 'min:1', $percent ? 'max:100' : 'max:10000000000'],
            'max_discount' => ['nullable', 'integer', 'min:1', 'max:10000000000'],
            'min_spend' => ['nullable', 'integer', 'min:1', 'max:10000000000'],
            'applies_to' => ['required', Rule::in(Coupon::APPLIES_TO)],
            'max_uses' => ['nullable', 'integer', 'min:1', 'max:1000000'],
            'max_uses_per_customer' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => array_values(array_filter(['nullable', 'date', $this->filled('starts_at') ? 'after:starts_at' : null])),
            'is_active' => ['boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'code.regex' => 'Use only letters, numbers, dashes and underscores (no spaces).',
            'code.unique' => 'Another coupon already uses this code.',
            'discount_value.max' => 'A percentage discount can be at most 100%.',
            'expires_at.after' => 'The end date must be after the start date.',
        ];
    }
}
