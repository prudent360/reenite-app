<?php

namespace App\Models;

use Database\Factories\ConsultationTypeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A kind of session customers can book with an officer, with its length, price and weekly hours.
 * One session of a type runs at a time.
 */
#[Fillable(['name', 'slug', 'description', 'duration_minutes', 'price', 'mode', 'schedule', 'notice_hours', 'is_active', 'sort_order'])]
class ConsultationType extends Model
{
    /** @use HasFactory<ConsultationTypeFactory> */
    use HasFactory;

    /**
     * @var array<string, string>
     */
    public const MODES = [
        'in_person' => 'In person at our office',
        'video' => 'Video call',
        'phone' => 'Phone call',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'duration_minutes' => 'integer',
            'price' => 'integer',
            'schedule' => 'array',
            'notice_hours' => 'integer',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * @return HasMany<Consultation, $this>
     */
    public function consultations(): HasMany
    {
        return $this->hasMany(Consultation::class);
    }

    /**
     * @param  Builder<self>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }

    /**
     * @param  Builder<self>  $query
     */
    public function scopeOrdered(Builder $query): void
    {
        $query->orderBy('sort_order')->orderBy('name');
    }

    public function modeLabel(): string
    {
        return self::MODES[$this->mode] ?? $this->mode;
    }
}
