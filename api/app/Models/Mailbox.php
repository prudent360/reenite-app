<?php

namespace App\Models;

use Database\Factories\MailboxFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Virtual office: a customer's mailbox at one of our locations. They use the location's address
 * with their mailbox number, and the front desk logs whatever arrives for them.
 */
#[Fillable(['user_id', 'location_id', 'customer_membership_id', 'business_name', 'status', 'active_until', 'notes', 'opened_by'])]
class Mailbox extends Model
{
    /** @use HasFactory<MailboxFactory> */
    use HasFactory;

    public const ACTIVE = 'active';

    public const CLOSED = 'closed';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['active_until' => 'datetime'];
    }

    /**
     * Numbers follow the id so they're unique and in order: RN-0012.
     */
    protected static function booted(): void
    {
        static::created(function (Mailbox $mailbox) {
            $mailbox->forceFill(['number' => sprintf('RN-%04d', $mailbox->id)])->saveQuietly();
        });
    }

    /**
     * Open, and paid up (or opened by staff with no end date).
     */
    public function isActive(): bool
    {
        return $this->status === self::ACTIVE && ($this->active_until === null || $this->active_until->isFuture());
    }

    /** active | lapsed (the paid period ended) | closed */
    public function state(): string
    {
        return match (true) {
            $this->status === self::CLOSED => 'closed',
            $this->isActive() => 'active',
            default => 'lapsed',
        };
    }

    /**
     * The address customers give out, line by line.
     *
     * @return list<string>
     */
    public function addressLines(): array
    {
        return array_values(array_filter([
            $this->business_name,
            'Mailbox '.$this->number,
            $this->location?->address,
            trim(($this->location?->city ?? '').', '.($this->location?->state ?? ''), ', '),
        ]));
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Location, $this>
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    /**
     * @return BelongsTo<CustomerMembership, $this>
     */
    public function membership(): BelongsTo
    {
        return $this->belongsTo(CustomerMembership::class, 'customer_membership_id');
    }

    /**
     * @return HasMany<MailItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(MailItem::class)->latest('received_at')->latest('id');
    }

    /**
     * Mail still at the front desk.
     *
     * @return HasMany<MailItem, $this>
     */
    public function waitingItems(): HasMany
    {
        return $this->hasMany(MailItem::class)->where('status', MailItem::WAITING);
    }

    /**
     * Waiting mail the customer has asked us to do something with.
     *
     * @return HasMany<MailItem, $this>
     */
    public function requestedItems(): HasMany
    {
        return $this->waitingItems()->whereNotNull('requested_action');
    }
}
