<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A letter or parcel the front desk received for a mailbox. While it's waiting, the customer
 * can ask us to hold it for collection, forward it, scan it or shred it.
 */
#[Fillable([
    'mailbox_id', 'kind', 'sender', 'description', 'received_at', 'status', 'requested_action', 'request_note',
    'requested_at', 'scan_path', 'scan_name', 'scanned_at', 'handled_note', 'handled_at', 'handled_by', 'logged_by',
])]
class MailItem extends Model
{
    public const KINDS = ['letter' => 'Letter', 'parcel' => 'Parcel', 'official' => 'Official letter'];

    public const WAITING = 'waiting';

    /** How a waiting item can be finished, and the label for each. */
    public const OUTCOMES = ['collected' => 'Collected', 'forwarded' => 'Forwarded', 'shredded' => 'Shredded'];

    /** What a customer can ask for. Scanning keeps the item waiting; the rest finish it. */
    public const ACTIONS = ['collect' => 'Hold for collection', 'forward' => 'Forward it', 'scan' => 'Scan it', 'shred' => 'Shred it'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'received_at' => 'datetime',
            'requested_at' => 'datetime',
            'scanned_at' => 'datetime',
            'handled_at' => 'datetime',
        ];
    }

    public function isWaiting(): bool
    {
        return $this->status === self::WAITING;
    }

    /**
     * @return BelongsTo<Mailbox, $this>
     */
    public function mailbox(): BelongsTo
    {
        return $this->belongsTo(Mailbox::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function handler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function logger(): BelongsTo
    {
        return $this->belongsTo(User::class, 'logged_by');
    }
}
