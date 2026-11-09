<?php

namespace App\Models;

use Database\Factories\BundleFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['name', 'slug', 'summary', 'description', 'price', 'is_active', 'sort_order'])]
class Bundle extends Model
{
    /** @use HasFactory<BundleFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'price' => 'integer',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /**
     * @return BelongsToMany<Service, $this>
     */
    public function services(): BelongsToMany
    {
        return $this->belongsToMany(Service::class)->withPivot('sort_order')->orderByPivot('sort_order');
    }

    /**
     * Sum of the included services' totals, in kobo, to show the saving.
     */
    public function valueOfServices(): int
    {
        return $this->services->sum(fn (Service $service) => $service->totalFee());
    }

    /**
     * @param  Builder<Bundle>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }
}
