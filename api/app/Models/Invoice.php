<?php

namespace App\Models;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use Database\Factories\InvoiceFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Money fields are in kobo.
 */
#[Fillable([
    'user_id', 'source_type', 'source_id', 'status', 'currency', 'subtotal', 'total', 'coupon_code', 'coupon_discount',
    'amount_paid', 'amount_refunded', 'due_at', 'paid_at', 'voided_at', 'notes', 'created_by',
])]
class Invoice extends Model
{
    /** @use HasFactory<InvoiceFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => InvoiceStatus::class,
            'subtotal' => 'integer',
            'total' => 'integer',
            'coupon_discount' => 'integer',
            'amount_paid' => 'integer',
            'amount_refunded' => 'integer',
            'due_at' => 'date',
            'paid_at' => 'datetime',
            'voided_at' => 'datetime',
        ];
    }

    /**
     * Numbers follow the id so they're unique and in order: INV-2026-000123.
     */
    protected static function booted(): void
    {
        static::created(function (Invoice $invoice) {
            $invoice->forceFill(['number' => sprintf('INV-%s-%06d', $invoice->created_at->format('Y'), $invoice->id)])->saveQuietly();
        });
    }

    public function balance(): int
    {
        return max(0, $this->total - $this->amount_paid);
    }

    public function isPayable(): bool
    {
        return $this->status === InvoiceStatus::Unpaid && $this->balance() > 0;
    }

    /**
     * A bank transfer is already waiting for a reviewer, so another payment shouldn't start.
     */
    public function hasPendingTransfer(): bool
    {
        return $this->payments()->where('gateway', 'bank_transfer')->where('status', PaymentStatus::AwaitingReview->value)->exists();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return HasMany<InvoiceItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class)->orderBy('sort_order');
    }

    /**
     * @return HasMany<Payment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class)->latest('id');
    }

    /**
     * @return HasOne<CouponRedemption, $this>
     */
    public function couponRedemption(): HasOne
    {
        return $this->hasOne(CouponRedemption::class);
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function source(): MorphTo
    {
        return $this->morphTo();
    }
}
