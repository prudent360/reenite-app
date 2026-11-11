<?php

namespace App\Models;

use Database\Factories\PaymentMethodFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A card the customer agreed to save for automatic renewals. We hold the gateway's reusable
 * authorisation (encrypted), never the card number.
 */
#[Fillable(['user_id', 'gateway', 'mode', 'authorization_code', 'signature', 'email', 'brand', 'last4', 'exp_month', 'exp_year', 'bank', 'is_default', 'last_used_at'])]
#[Hidden(['authorization_code', 'signature'])]
class PaymentMethod extends Model
{
    /** @use HasFactory<PaymentMethodFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'authorization_code' => 'encrypted',
            'is_default' => 'boolean',
            'last_used_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * "Visa •••• 4081"
     */
    public function label(): string
    {
        return trim(ucfirst((string) $this->brand).' •••• '.$this->last4);
    }

    /**
     * Cards stop working after the end of their expiry month.
     */
    public function isExpired(): bool
    {
        if (! $this->exp_month || ! $this->exp_year) {
            return false;
        }

        return now()->greaterThan(now()->setDate((int) $this->exp_year, (int) $this->exp_month, 1)->endOfMonth());
    }
}
