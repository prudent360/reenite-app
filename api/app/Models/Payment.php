<?php

namespace App\Models;

use App\Enums\PaymentGatewayCode;
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
    'save_card', 'payment_method_id',
])]
#[Hidden(['proof_path'])]
class Payment extends Model
{
    /** @use HasFactory<PaymentFactory> */
    use HasFactory;

    public const BANK_TRANSFER = 'bank_transfer';

    /** Cash or POS taken at the front desk by staff signed in as the customer. `channel` says which. */
    public const DESK = 'desk';

    /** @var array<string, string> channel => label */
    public const DESK_CHANNELS = ['cash' => 'Cash', 'pos' => 'POS'];

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
            'save_card' => 'boolean',
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

    public function isDesk(): bool
    {
        return $this->gateway === self::DESK;
    }

    /**
     * Paid through a gateway, so it can be refunded through one. Transfers and desk payments are refunded by hand.
     */
    public function isOnline(): bool
    {
        return ! $this->isBankTransfer() && ! $this->isDesk();
    }

    /**
     * "Bank transfer", "Cash at desk", "POS at desk" or the gateway's name.
     */
    public function methodLabel(): string
    {
        return match (true) {
            $this->isBankTransfer() => 'Bank transfer',
            $this->isDesk() => (self::DESK_CHANNELS[$this->channel] ?? 'Paid').' at desk',
            default => PaymentGatewayCode::tryFrom($this->gateway)?->label() ?? ucfirst($this->gateway),
        };
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
