<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * Passes and memberships run for one period at a time. A renewal is a new record that follows
 * on from the old one (`renewal_of_id`) and starts when the old period ends.
 */
trait RenewsAutomatically
{
    public function initializeRenewsAutomatically(): void
    {
        $this->mergeCasts([
            'auto_renew' => 'boolean',
            'renewal_notice_at' => 'datetime',
            'renewal_attempts' => 'integer',
            'last_renewal_attempt_at' => 'datetime',
            'nudged_at' => 'datetime',
        ]);
        $this->mergeFillable(['auto_renew', 'renewal_of_id', 'renewal_notice_at', 'renewal_attempts', 'last_renewal_attempt_at', 'renewal_failure', 'nudged_at']);
    }

    /** week | month | quarter | year */
    abstract public function renewalPeriod(): string;

    /**
     * @return BelongsTo<static, $this>
     */
    public function renewalOf(): BelongsTo
    {
        return $this->belongsTo(static::class, 'renewal_of_id');
    }

    /**
     * The next period, once it has been started (paid or waiting for payment).
     *
     * @return HasOne<static, $this>
     */
    public function renewal(): HasOne
    {
        return $this->hasOne(static::class, 'renewal_of_id')->latestOfMany();
    }

    /**
     * When one period that starts at `$start` ends.
     */
    public function periodEndFrom(Carbon $start): Carbon
    {
        return match ($this->renewalPeriod()) {
            'week' => $start->copy()->addWeek(),
            'quarter' => $start->copy()->addMonthsNoOverflow(3),
            'year' => $start->copy()->addYearNoOverflow(),
            default => $start->copy()->addMonthNoOverflow(),
        };
    }
}
