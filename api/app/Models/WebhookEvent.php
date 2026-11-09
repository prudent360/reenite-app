<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Every gateway webhook received, kept for audit and so repeats are ignored.
 */
#[Fillable(['gateway', 'event_key', 'type', 'payment_reference', 'payload', 'processed_at', 'error'])]
class WebhookEvent extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'processed_at' => 'datetime',
        ];
    }
}
