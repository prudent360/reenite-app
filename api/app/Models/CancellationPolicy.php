<?php

namespace App\Models;

use Database\Factories\CancellationPolicyFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'description', 'rules', 'is_default'])]
class CancellationPolicy extends Model
{
    /** @use HasFactory<CancellationPolicyFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'rules' => 'array',
            'is_default' => 'boolean',
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
     * Percentage refunded when cancelling this many hours before the start.
     */
    public function refundPercentFor(float $hoursBefore): int
    {
        foreach (collect($this->rules)->sortByDesc('hours_before') as $rule) {
            if ($hoursBefore >= $rule['hours_before']) {
                return (int) $rule['refund_percent'];
            }
        }

        return 0;
    }

    /**
     * One sentence per rule, for customers: "Full refund up to 48 hours before".
     *
     * @return list<string>
     */
    public function summary(): array
    {
        return collect($this->rules)
            ->sortByDesc('hours_before')
            ->map(function (array $rule) {
                $refund = match ((int) $rule['refund_percent']) {
                    100 => 'Full refund',
                    0 => 'No refund',
                    default => "{$rule['refund_percent']}% refund",
                };

                return (int) $rule['hours_before'] === 0
                    ? "{$refund} after that"
                    : "{$refund} if cancelled {$rule['hours_before']}+ hours before";
            })
            ->values()
            ->all();
    }
}
