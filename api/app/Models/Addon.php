<?php

namespace App\Models;

use Database\Factories\AddonFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['name', 'description', 'price', 'charge_type', 'max_quantity', 'is_active', 'sort_order'])]
class Addon extends Model
{
    /** @use HasFactory<AddonFactory> */
    use HasFactory;

    public const CHARGE_TYPES = ['per_booking', 'per_hour', 'per_person'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'price' => 'integer',
            'max_quantity' => 'integer',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /**
     * @return BelongsToMany<Space, $this>
     */
    public function spaces(): BelongsToMany
    {
        return $this->belongsToMany(Space::class);
    }

    /**
     * @param  Builder<Addon>  $query
     */
    public function scopeOrdered(Builder $query): void
    {
        $query->orderBy('sort_order')->orderBy('name');
    }
}
