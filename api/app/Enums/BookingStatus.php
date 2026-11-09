<?php

namespace App\Enums;

enum BookingStatus: string
{
    case Held = 'held';
    case PendingApproval = 'pending_approval';
    case Confirmed = 'confirmed';
    case CheckedIn = 'checked_in';
    case Completed = 'completed';
    case Expired = 'expired';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Held => 'Awaiting payment',
            self::PendingApproval => 'Awaiting approval',
            self::Confirmed => 'Confirmed',
            self::CheckedIn => 'Checked in',
            self::Completed => 'Completed',
            self::Expired => 'Expired',
            self::Cancelled => 'Cancelled',
        };
    }

    /**
     * Statuses that keep the space taken. A held booking only counts until its hold expires.
     *
     * @return list<string>
     */
    public static function occupying(): array
    {
        return [self::Held->value, self::PendingApproval->value, self::Confirmed->value, self::CheckedIn->value];
    }

    public function isCancellable(): bool
    {
        return in_array($this, [self::Held, self::PendingApproval, self::Confirmed], true);
    }

    public function isClosed(): bool
    {
        return in_array($this, [self::Completed, self::Expired, self::Cancelled], true);
    }
}
