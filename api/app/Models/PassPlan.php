<?php

namespace App\Models;

use Database\Factories\PassPlanFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * A flexible plan such as "3 days a week" or "12 days a month": a number of
 * visits (or hours) to use within each week or month, on the allowed space types.
 */
#[Fillable(['location_id', 'name', 'slug', 'description', 'price', 'credit_type', 'credits', 'period', 'is_active', 'sort_order'])]
class PassPlan extends Model
{
    /** @use HasFactory<PassPlanFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'price' => 'integer',
            'credits' => 'integer',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /**
     * "3 visits a week", "10 hours a month".
     */
    public function allowanceLabel(): string
    {
        $unit = $this->credit_type === 'hours' ? 'hour' : 'visit';

        return $this->credits.' '.($this->credits === 1 ? $unit : "{$unit}s").' a '.$this->period;
    }

    /**
     * @return BelongsTo<Location, $this>
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    /**
     * @return BelongsToMany<SpaceType, $this>
     */
    public function spaceTypes(): BelongsToMany
    {
        return $this->belongsToMany(SpaceType::class);
    }

    /**
     * @param  Builder<PassPlan>  $query
     */
    public function scopeOrdered(Builder $query): void
    {
        $query->orderBy('sort_order')->orderBy('name');
    }
}
