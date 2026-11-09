<?php

namespace App\Models;

use Database\Factories\SpaceTypeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'slug', 'description', 'icon', 'booking_mode', 'is_active', 'sort_order'])]
class SpaceType extends Model
{
    /** @use HasFactory<SpaceTypeFactory> */
    use HasFactory;

    /** One booking at a time, e.g. a studio or private office. */
    public const EXCLUSIVE = 'exclusive';

    /** Many bookings at once up to the space's capacity, e.g. hot desks. */
    public const SHARED = 'shared';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /**
     * @return HasMany<Space, $this>
     */
    public function spaces(): HasMany
    {
        return $this->hasMany(Space::class);
    }

    /**
     * @param  Builder<SpaceType>  $query
     */
    public function scopeOrdered(Builder $query): void
    {
        $query->orderBy('sort_order')->orderBy('name');
    }
}
