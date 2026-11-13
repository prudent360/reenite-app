<?php

namespace App\Models;

use Database\Factories\LocationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

#[Fillable(['name', 'slug', 'address', 'city', 'state', 'phone', 'email', 'description', 'amenities', 'hours', 'timezone', 'is_active', 'self_check_in', 'sort_order'])]
#[Hidden(['check_in_token'])]
class Location extends Model
{
    /** @use HasFactory<LocationFactory> */
    use HasFactory;

    /**
     * Every location gets a self check-in link from the start; it only works once switched on.
     */
    protected static function booted(): void
    {
        static::creating(function (Location $location) {
            $location->check_in_token ??= self::newCheckInToken();
        });
    }

    public static function newCheckInToken(): string
    {
        return Str::random(32);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amenities' => 'array',
            'hours' => 'array',
            'is_active' => 'boolean',
            'self_check_in' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /**
     * @return HasMany<Space, $this>
     */
    public function spaces(): HasMany
    {
        return $this->hasMany(Space::class)->orderBy('sort_order')->orderBy('name');
    }

    /**
     * @return HasMany<BlackoutDate, $this>
     */
    public function blackouts(): HasMany
    {
        return $this->hasMany(BlackoutDate::class);
    }

    /**
     * @param  Builder<Location>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }

    /**
     * @param  Builder<Location>  $query
     */
    public function scopeOrdered(Builder $query): void
    {
        $query->orderBy('sort_order')->orderBy('name');
    }
}
