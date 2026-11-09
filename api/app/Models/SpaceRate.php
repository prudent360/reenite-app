<?php

namespace App\Models;

use Database\Factories\SpaceRateFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['space_id', 'unit', 'price', 'is_active'])]
class SpaceRate extends Model
{
    /** @use HasFactory<SpaceRateFactory> */
    use HasFactory;

    /** Rate units, shortest first. */
    public const UNITS = ['hour', 'day', 'week', 'month'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'price' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Space, $this>
     */
    public function space(): BelongsTo
    {
        return $this->belongsTo(Space::class);
    }
}
