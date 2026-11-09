<?php

namespace App\Models;

use Database\Factories\CustomerPassFactory;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A flexible pass a customer bought, e.g. 3 visits a week. It covers one period from
 * when it's paid for; buying again starts a new period.
 */
#[Fillable([
    'user_id', 'pass_plan_id', 'invoice_id', 'name', 'credit_type', 'credits', 'credits_used', 'period',
    'location_id', 'space_type_ids', 'status', 'starts_at', 'ends_at',
])]
class CustomerPass extends Model
{
    /** @use HasFactory<CustomerPassFactory> */
    use HasFactory;

    public const PENDING = 'pending';

    public const ACTIVE = 'active';

    public const EXPIRED = 'expired';

    public const CANCELLED = 'cancelled';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'credits' => 'integer',
            'credits_used' => 'integer',
            'space_type_ids' => 'array',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }

    public function creditsLeft(): int
    {
        return max(0, $this->credits - $this->credits_used);
    }

    /**
     * Whether this pass can pay for time in this space between these times.
     */
    public function covers(Space $space, DateTimeInterface $startsAt, DateTimeInterface $endsAt): bool
    {
        return $this->status === self::ACTIVE
            && in_array($space->space_type_id, $this->space_type_ids, true)
            && ($this->location_id === null || $this->location_id === $space->location_id)
            && $this->starts_at <= $startsAt
            && $this->ends_at >= $endsAt;
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<PassPlan, $this>
     */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(PassPlan::class, 'pass_plan_id');
    }

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    /**
     * @return HasMany<Booking, $this>
     */
    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }
}
