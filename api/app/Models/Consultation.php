<?php

namespace App\Models;

use Database\Factories\ConsultationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A session a customer booked with one of our officers.
 */
#[Fillable([
    'user_id', 'consultation_type_id', 'name', 'mode', 'starts_at', 'ends_at', 'topic', 'status', 'hold_expires_at', 'price',
    'invoice_id', 'assigned_to', 'meeting_details', 'staff_notes', 'confirmed_at', 'reminded_at', 'cancelled_at', 'cancelled_by',
    'cancel_reason', 'refund_amount', 'nudged_at',
])]
class Consultation extends Model
{
    /** @use HasFactory<ConsultationFactory> */
    use HasFactory;

    /** Waiting for payment; the time is held until hold_expires_at. */
    public const PENDING_PAYMENT = 'pending_payment';

    public const CONFIRMED = 'confirmed';

    public const COMPLETED = 'completed';

    public const NO_SHOW = 'no_show';

    public const CANCELLED = 'cancelled';

    /** Not paid in time, so the time was released. */
    public const EXPIRED = 'expired';

    /**
     * @var array<string, string>
     */
    public const STATUS_LABELS = [
        self::PENDING_PAYMENT => 'Awaiting payment',
        self::CONFIRMED => 'Confirmed',
        self::COMPLETED => 'Completed',
        self::NO_SHOW => 'Missed',
        self::CANCELLED => 'Cancelled',
        self::EXPIRED => 'Expired',
    ];

    /** How long an unpaid consultation keeps its time. */
    public const HOLD_MINUTES = 30;

    /** Cancelling at least this long before gets a full refund; later gets none. */
    public const FREE_CANCEL_HOURS = 24;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'hold_expires_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'reminded_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'nudged_at' => 'datetime',
            'price' => 'integer',
            'refund_amount' => 'integer',
        ];
    }

    /**
     * References follow the id: CN-2026-000012.
     */
    protected static function booted(): void
    {
        static::created(function (Consultation $consultation) {
            $consultation->forceFill(['reference' => sprintf('CN-%s-%06d', $consultation->created_at->format('Y'), $consultation->id)])->saveQuietly();
        });
    }

    public function getRouteKeyName(): string
    {
        return 'reference';
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<ConsultationType, $this>
     */
    public function type(): BelongsTo
    {
        return $this->belongsTo(ConsultationType::class, 'consultation_type_id');
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
    public function officer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /**
     * Consultations that take up their time: confirmed, or awaiting payment with the hold still on.
     *
     * @param  Builder<self>  $query
     */
    public function scopeOccupying(Builder $query): void
    {
        $query->where(fn ($inner) => $inner->where('status', self::CONFIRMED)
            ->orWhere(fn ($held) => $held->where('status', self::PENDING_PAYMENT)->where('hold_expires_at', '>', now())));
    }

    public function isCancellable(): bool
    {
        return in_array($this->status, [self::PENDING_PAYMENT, self::CONFIRMED], true);
    }

    /**
     * What the customer actually paid, after any discount code and earlier refunds.
     */
    public function amountPaid(): int
    {
        $this->loadMissing('invoice');

        return $this->invoice ? max(0, $this->invoice->amount_paid - $this->invoice->amount_refunded) : 0;
    }
}
