<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'order_id', 'kind', 'requirement_id', 'field_key', 'label', 'path', 'original_name', 'mime', 'size',
    'status', 'review_note', 'uploaded_by', 'reviewed_by', 'reviewed_at',
])]
#[Hidden(['path'])]
class OrderFile extends Model
{
    public const REQUIREMENT = 'requirement';

    public const FIELD = 'field';

    public const DELIVERABLE = 'deliverable';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'requirement_id' => 'integer',
            'size' => 'integer',
            'reviewed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
