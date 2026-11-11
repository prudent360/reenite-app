<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\ComplianceItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One deadline on a business's compliance calendar, such as a VAT return or annual returns.
 */
#[Fillable(['business_id', 'kind', 'title', 'period_label', 'due_on', 'status', 'is_custom', 'note', 'completed_at', 'completed_by', 'reminders_sent'])]
class ComplianceItem extends Model
{
    /** @use HasFactory<ComplianceItemFactory> */
    use HasFactory;

    public const OPEN = 'open';

    public const DONE = 'done';

    /** The customer told us it doesn't apply to them. */
    public const DISMISSED = 'dismissed';

    public const STATUSES = [self::OPEN, self::DONE, self::DISMISSED];

    /**
     * What each kind of deadline is, who it's filed with, and the service that does it for them.
     *
     * @var array<string, array{label: string, authority: string, service: string|null}>
     */
    public const KINDS = [
        'annual_returns' => ['label' => 'CAC annual returns', 'authority' => 'Corporate Affairs Commission', 'service' => 'annual-returns-filing'],
        'vat' => ['label' => 'VAT return', 'authority' => 'Nigeria Revenue Service (formerly FIRS)', 'service' => null],
        'paye' => ['label' => 'PAYE remittance', 'authority' => 'State Internal Revenue Service', 'service' => null],
        'cit' => ['label' => 'Company income tax return', 'authority' => 'Nigeria Revenue Service (formerly FIRS)', 'service' => null],
        'personal_tax' => ['label' => "Owner's personal income tax return", 'authority' => 'State Internal Revenue Service', 'service' => null],
        'tcc' => ['label' => 'Tax clearance certificate', 'authority' => 'Nigeria Revenue Service (formerly FIRS)', 'service' => 'tax-clearance-certificate-tcc'],
        'custom' => ['label' => 'Your own reminder', 'authority' => '', 'service' => null],
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'due_on' => 'date',
            'is_custom' => 'boolean',
            'completed_at' => 'datetime',
            'reminders_sent' => 'array',
        ];
    }

    /**
     * @return BelongsTo<Business, $this>
     */
    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function completedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }

    /**
     * Today's date in Lagos, as a plain date (midnight, app timezone) so it compares cleanly with due_on.
     */
    public static function today(): CarbonImmutable
    {
        return CarbonImmutable::parse(now((string) config('app.display_timezone'))->toDateString());
    }

    /**
     * Days until it's due: negative once it's late.
     */
    public function daysLeft(): int
    {
        return (int) round(self::today()->diffInDays(CarbonImmutable::parse($this->due_on->toDateString()), false));
    }

    public function isOverdue(): bool
    {
        return $this->status === self::OPEN && $this->daysLeft() < 0;
    }

    /** overdue | due_soon (within 14 days) | upcoming | done | dismissed */
    public function state(): string
    {
        if ($this->status !== self::OPEN) {
            return $this->status;
        }

        return match (true) {
            $this->daysLeft() < 0 => 'overdue',
            $this->daysLeft() <= 14 => 'due_soon',
            default => 'upcoming',
        };
    }

    /**
     * @param  string  $stage  14d | 3d | overdue
     */
    public function wasReminded(string $stage): bool
    {
        return in_array($stage, $this->reminders_sent ?? [], true);
    }
}
