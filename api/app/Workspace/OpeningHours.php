<?php

namespace App\Workspace;

use Illuminate\Validation\Rule;

/**
 * Weekly opening hours stored as seven entries, ISO weekday 1 (Monday) to 7 (Sunday).
 */
class OpeningHours
{
    public const DAYS = [1 => 'Monday', 2 => 'Tuesday', 3 => 'Wednesday', 4 => 'Thursday', 5 => 'Friday', 6 => 'Saturday', 7 => 'Sunday'];

    /**
     * Mon to Sat 9am to 8pm, closed Sunday: Reenite Uyo's hours.
     *
     * @return list<array{day: int, opens: string|null, closes: string|null, closed: bool}>
     */
    public static function defaults(): array
    {
        return array_map(
            fn (int $day) => ['day' => $day, 'opens' => $day === 7 ? null : '09:00', 'closes' => $day === 7 ? null : '20:00', 'closed' => $day === 7],
            array_keys(self::DAYS),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public static function rules(string $field, bool $nullable = false): array
    {
        return [
            $field => [$nullable ? 'nullable' : 'required', 'array', 'size:7'],
            "{$field}.*.day" => ['required', 'integer', Rule::in(array_keys(self::DAYS)), 'distinct'],
            "{$field}.*.closed" => ['required', 'boolean'],
            "{$field}.*.opens" => ['exclude_if:'.$field.'.*.closed,true', 'required', 'date_format:H:i'],
            "{$field}.*.closes" => ['exclude_if:'.$field.'.*.closed,true', 'required', 'date_format:H:i', 'after:'.$field.'.*.opens'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function messages(string $field): array
    {
        return [
            "{$field}.*.closes.after" => 'Closing time must be after opening time.',
            "{$field}.*.opens.required" => 'Add an opening time or mark the day closed.',
            "{$field}.*.closes.required" => 'Add a closing time or mark the day closed.',
        ];
    }

    /**
     * Sorts by weekday and blanks the times on closed days.
     *
     * @param  list<array<string, mixed>>|null  $hours
     * @return list<array{day: int, opens: string|null, closes: string|null, closed: bool}>|null
     */
    public static function normalise(?array $hours): ?array
    {
        if ($hours === null) {
            return null;
        }

        return collect($hours)
            ->map(fn (array $entry) => [
                'day' => (int) $entry['day'],
                'opens' => ($entry['closed'] ?? false) ? null : $entry['opens'],
                'closes' => ($entry['closed'] ?? false) ? null : $entry['closes'],
                'closed' => (bool) ($entry['closed'] ?? false),
            ])
            ->sortBy('day')
            ->values()
            ->all();
    }
}
