<?php

namespace App\Models;

use Database\Factories\SpaceFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

#[Fillable([
    'location_id', 'space_type_id', 'cancellation_policy_id', 'name', 'slug', 'summary', 'description',
    'capacity', 'amenities', 'hours', 'min_duration_minutes', 'max_duration_minutes', 'buffer_minutes',
    'min_notice_minutes', 'advance_booking_days', 'requires_approval', 'is_active', 'sort_order',
])]
class Space extends Model
{
    /** @use HasFactory<SpaceFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'capacity' => 'integer',
            'amenities' => 'array',
            'hours' => 'array',
            'min_duration_minutes' => 'integer',
            'max_duration_minutes' => 'integer',
            'buffer_minutes' => 'integer',
            'min_notice_minutes' => 'integer',
            'advance_booking_days' => 'integer',
            'requires_approval' => 'boolean',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /**
     * The space's own hours, or the location's when it doesn't override them.
     *
     * @return list<array{day: int, opens: string|null, closes: string|null, closed: bool}>
     */
    public function effectiveHours(): array
    {
        return $this->hours ?? $this->location->hours;
    }

    public function isShared(): bool
    {
        return $this->type->booking_mode === SpaceType::SHARED;
    }

    public function photoUrl(): ?string
    {
        return $this->photo_path ? Storage::disk('public')->url($this->photo_path) : null;
    }

    /**
     * @return BelongsTo<Location, $this>
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    /**
     * @return BelongsTo<SpaceType, $this>
     */
    public function type(): BelongsTo
    {
        return $this->belongsTo(SpaceType::class, 'space_type_id');
    }

    /**
     * @return BelongsTo<CancellationPolicy, $this>
     */
    public function cancellationPolicy(): BelongsTo
    {
        return $this->belongsTo(CancellationPolicy::class);
    }

    /**
     * @return HasMany<SpaceRate, $this>
     */
    public function rates(): HasMany
    {
        return $this->hasMany(SpaceRate::class);
    }

    /**
     * @return BelongsToMany<Addon, $this>
     */
    public function addons(): BelongsToMany
    {
        return $this->belongsToMany(Addon::class)->orderBy('sort_order')->orderBy('name');
    }

    /**
     * @param  Builder<Space>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }

    /**
     * @param  Builder<Space>  $query
     */
    public function scopeOrdered(Builder $query): void
    {
        $query->orderBy('sort_order')->orderBy('name');
    }
}
