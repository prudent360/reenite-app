<?php

namespace App\Models;

use Database\Factories\ServiceFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'service_category_id', 'name', 'slug', 'summary', 'description',
    'service_fee', 'government_fee', 'turnaround_days', 'requires_business', 'is_active', 'sort_order',
])]
class Service extends Model
{
    /** @use HasFactory<ServiceFactory> */
    use HasFactory, SoftDeletes;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'service_fee' => 'integer',
            'government_fee' => 'integer',
            'turnaround_days' => 'integer',
            'requires_business' => 'boolean',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /**
     * What the customer pays in total, in kobo.
     */
    public function totalFee(): int
    {
        return $this->service_fee + $this->government_fee;
    }

    /**
     * @return BelongsTo<ServiceCategory, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(ServiceCategory::class, 'service_category_id');
    }

    /**
     * @return HasMany<ServiceFormField, $this>
     */
    public function formFields(): HasMany
    {
        return $this->hasMany(ServiceFormField::class)->orderBy('sort_order');
    }

    /**
     * @return HasMany<ServiceDocumentRequirement, $this>
     */
    public function documentRequirements(): HasMany
    {
        return $this->hasMany(ServiceDocumentRequirement::class)->orderBy('sort_order');
    }

    /**
     * @return HasMany<ServiceStage, $this>
     */
    public function stages(): HasMany
    {
        return $this->hasMany(ServiceStage::class)->orderBy('sort_order');
    }

    /**
     * @return BelongsToMany<Bundle, $this>
     */
    public function bundles(): BelongsToMany
    {
        return $this->belongsToMany(Bundle::class);
    }

    /**
     * @param  Builder<Service>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }
}
