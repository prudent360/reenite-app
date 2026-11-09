<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case Pending = 'pending';
    case Success = 'success';
    case Failed = 'failed';
    case Abandoned = 'abandoned';
    case AwaitingReview = 'awaiting_review';
    case Rejected = 'rejected';
    case Refunded = 'refunded';
    case PartiallyRefunded = 'partially_refunded';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Success => 'Paid',
            self::Failed => 'Failed',
            self::Abandoned => 'Abandoned',
            self::AwaitingReview => 'Awaiting review',
            self::Rejected => 'Rejected',
            self::Refunded => 'Refunded',
            self::PartiallyRefunded => 'Partly refunded',
        };
    }

    /**
     * Money that reached us (and may since have been partly or fully returned).
     */
    public function isSettled(): bool
    {
        return in_array($this, [self::Success, self::PartiallyRefunded, self::Refunded], true);
    }

    /**
     * Still waiting on the gateway or a reviewer.
     */
    public function isOpen(): bool
    {
        return in_array($this, [self::Pending, self::AwaitingReview], true);
    }
}
