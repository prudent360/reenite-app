<?php

namespace App\Models;

use Database\Factories\MembershipPlanFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['name', 'slug', 'description', 'price', 'billing_period', 'booking_discount_percent', 'perks', 'mailbox_location_id', 'is_featured', 'is_active', 'sort_order'])]
class MembershipPlan extends Model
{
    /** @use HasFactory<MembershipPlanFactory> */
    use HasFactory;

    public const PERIODS = ['month', 'quarter', 'year'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'price' => 'integer',
            'booking_discount_percent' => 'integer',
            'perks' => 'array',
            'is_featured' => 'boolean',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /**
     * Virtual office: where members get a mailbox. Null when the plan has no mailbox.
     *
     * @return BelongsTo<Location, $this>
     */
    public function mailboxLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'mailbox_location_id');
    }

    /**
     * @param  Builder<MembershipPlan>  $query
     */
    public function scopeOrdered(Builder $query): void
    {
        $query->orderBy('sort_order')->orderBy('name');
    }
}
