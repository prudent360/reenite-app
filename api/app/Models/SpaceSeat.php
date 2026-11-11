<?php

namespace App\Models;

use Database\Factories\SpaceSeatFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * One named seat in a shared space (a hot desk), so customers can pick where they sit.
 * A shared space with no seats set up works as before: people book a number of places.
 */
#[Fillable(['space_id', 'label', 'zone', 'is_active', 'sort_order'])]
class SpaceSeat extends Model
{
    /** @use HasFactory<SpaceSeatFactory> */
    use HasFactory;

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
     * @return BelongsTo<Space, $this>
     */
    public function space(): BelongsTo
    {
        return $this->belongsTo(Space::class);
    }

    /**
     * @return BelongsToMany<Booking, $this>
     */
    public function bookings(): BelongsToMany
    {
        return $this->belongsToMany(Booking::class, 'booking_seat')->withTimestamps();
    }
}
