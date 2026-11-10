<?php

namespace App\Models;

use App\Enums\InvoiceStatus;
use App\Support\Money;
use Database\Factories\CouponFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A discount code customers enter when paying. It comes off the invoice, so it works the same
 * for service orders, bookings, passes, memberships and invoices raised by staff.
 * Money fields are in kobo.
 */
#[Fillable([
    'code', 'description', 'discount_type', 'discount_value', 'max_discount', 'min_spend', 'applies_to',
    'max_uses', 'max_uses_per_customer', 'starts_at', 'expires_at', 'is_active', 'created_by',
])]
class Coupon extends Model
{
    /** @use HasFactory<CouponFactory> */
    use HasFactory;

    public const PERCENT = 'percent';

    public const FIXED = 'fixed';

    public const TYPES = [self::PERCENT, self::FIXED];

    /** What a code can be used on, matched against what the invoice is for. */
    public const APPLIES_TO = ['all', 'services', 'bookings', 'plans'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'discount_value' => 'integer',
            'max_discount' => 'integer',
            'min_spend' => 'integer',
            'max_uses' => 'integer',
            'max_uses_per_customer' => 'integer',
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public static function normalizeCode(string $code): string
    {
        return strtoupper(trim($code));
    }

    /**
     * The discount on an amount (kobo), never more than the amount itself.
     */
    public function discountOn(int $amount): int
    {
        $discount = $this->discount_type === self::PERCENT
            ? intdiv($amount * $this->discount_value, 100)
            : $this->discount_value;

        if ($this->discount_type === self::PERCENT && $this->max_discount !== null) {
            $discount = min($discount, $this->max_discount);
        }

        return max(0, min($discount, $amount));
    }

    /** "15% off", "15% off (up to ₦5,000)", "₦2,000 off". */
    public function label(): string
    {
        if ($this->discount_type === self::FIXED) {
            return Money::format($this->discount_value).' off';
        }

        return $this->discount_value.'% off'.($this->max_discount !== null ? ' (up to '.Money::format($this->max_discount).')' : '');
    }

    /**
     * Uses that count towards the limits: redemptions on invoices that haven't been cancelled.
     *
     * @return HasMany<CouponRedemption, $this>
     */
    public function liveRedemptions(): HasMany
    {
        return $this->redemptions()->whereHas('invoice', fn ($query) => $query->where('status', '!=', InvoiceStatus::Void->value));
    }

    /**
     * @return HasMany<CouponRedemption, $this>
     */
    public function redemptions(): HasMany
    {
        return $this->hasMany(CouponRedemption::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
