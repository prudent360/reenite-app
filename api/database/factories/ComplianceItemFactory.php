<?php

namespace Database\Factories;

use App\Models\Business;
use App\Models\ComplianceItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ComplianceItem>
 */
class ComplianceItemFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'business_id' => Business::factory(),
            'kind' => 'custom',
            'title' => 'Renew business permit',
            'due_on' => now()->addDays(20)->toDateString(),
            'status' => ComplianceItem::OPEN,
            'is_custom' => true,
        ];
    }
}
