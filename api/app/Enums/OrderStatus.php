<?php

namespace App\Enums;

enum OrderStatus: string
{
    case AwaitingPayment = 'awaiting_payment';
    case Received = 'received';
    case InProgress = 'in_progress';
    case AwaitingClient = 'awaiting_client';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::AwaitingPayment => 'Awaiting payment',
            self::Received => 'Received',
            self::InProgress => 'In progress',
            self::AwaitingClient => 'Waiting on customer',
            self::Completed => 'Completed',
            self::Cancelled => 'Cancelled',
        };
    }

    /**
     * Paid and not finished: Reenite owes work on it.
     */
    public function isActive(): bool
    {
        return in_array($this, [self::Received, self::InProgress, self::AwaitingClient], true);
    }

    public function isClosed(): bool
    {
        return in_array($this, [self::Completed, self::Cancelled], true);
    }
}
