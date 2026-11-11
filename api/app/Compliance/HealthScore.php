<?php

namespace App\Compliance;

use App\Models\Business;

/**
 * A 0 to 100 score for how well a business is keeping up: missed deadlines cost the most,
 * deadlines in the next week and missing registration details cost a little.
 * Each point lost comes with a reason the customer can act on.
 */
class HealthScore
{
    public const OVERDUE_PENALTY = 25;

    public const DUE_THIS_WEEK_PENALTY = 5;

    public const MISSING_DETAIL_PENALTY = 10;

    /**
     * Needs the business's open compliance items loaded as `openItems`.
     *
     * @return array{score: int, band: string, label: string, issues: list<array{text: string, points: int, kind: string}>}
     */
    public static function for(Business $business): array
    {
        $issues = [];

        foreach ($business->openItems as $item) {
            $days = $item->daysLeft();
            $period = $item->period_label ? " ({$item->period_label})" : '';
            if ($days < 0) {
                $issues[] = ['text' => "{$item->title}{$period} is overdue", 'points' => self::OVERDUE_PENALTY, 'kind' => 'overdue'];
            } elseif ($days <= 7) {
                $issues[] = ['text' => "{$item->title}{$period} is due ".($days === 0 ? 'today' : ($days === 1 ? 'tomorrow' : "in {$days} days")), 'points' => self::DUE_THIS_WEEK_PENALTY, 'kind' => 'due_soon'];
            }
        }

        if (blank($business->registration_number)) {
            $issues[] = ['text' => 'Add your CAC registration number', 'points' => self::MISSING_DETAIL_PENALTY, 'kind' => 'details'];
        }
        if (! $business->registered_on) {
            $issues[] = ['text' => 'Add your registration date so we can work out your annual returns', 'points' => self::MISSING_DETAIL_PENALTY, 'kind' => 'details'];
        }
        if (blank($business->tin)) {
            $issues[] = ['text' => 'Add your tax identification number (TIN)', 'points' => self::MISSING_DETAIL_PENALTY, 'kind' => 'details'];
        }

        usort($issues, fn (array $a, array $b) => $b['points'] <=> $a['points']);
        $score = max(0, 100 - array_sum(array_column($issues, 'points')));
        [$band, $label] = match (true) {
            $score >= 80 => ['good', 'In good shape'],
            $score >= 50 => ['attention', 'Needs attention'],
            default => ['risk', 'At risk'],
        };

        return ['score' => $score, 'band' => $band, 'label' => $label, 'issues' => $issues];
    }
}
