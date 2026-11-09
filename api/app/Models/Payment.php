<?php

namespace App\Models;

use App\Enums\PaymentStatus;
use Database\Factories\PaymentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * Money fields are in kobo.
 */
#[Fillable([
    'reference', 'receipt_number', 'invoice_id', 'user_id', 'gateway', 'mode', 'amount', 'currency', 'status',
    'gateway_reference', 'channel', 'gateway_data', 'amount_refunded', 'proof_path', 'proof_name',
    'sender_name', 'transferred_on', 'reviewed_by', 'reviewed_at', 'review_note', 'failure_reason', 'paid_at',
])]
#[Hidden(['proof_path'])]
class Payment extends Model
{
    /** @use HasFactory<PaymentFactory> */
    use HasFactory;

    public const BANK_TRANSFER = 'bank_transfer';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => PaymentStatus::class,
            'amount' => 'integer',
            'amount_refunded' => 'integer',
            'gateway_data' => 'array',
            'transferred_on' => 'date',
            'reviewed_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    /**
     * Unguessable reference sent to gateways, e.g. RNP-7KQ2M9XW4T1B.
     */
    public static function newReference(): string
    {
        do {
            $reference = 'RNP-'.Str::upper(Str::random(12));
        } while (self::where('reference', $reference)->exists());

        return $reference;
    }

    public function refundable(): int
    {
        return $this->status->isSettled() ? max(0, $this->amount - $this->amount_refunded) : 0;
    }

    public function isBankTransfer(): bool
    {
        return $this->gateway === self::BANK_TRANSFER;
    }

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
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
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * @return HasMany<Refund, $this>
     */
    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class)->latest('id');
    }
}
