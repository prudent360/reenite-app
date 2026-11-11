<?php

namespace App\Models;

use Database\Factories\BusinessFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A customer's business. Its type and taxes decide which deadlines go on its compliance calendar.
 */
#[Fillable(['user_id', 'name', 'entity_type', 'registration_number', 'registered_on', 'tin', 'vat_registered', 'has_employees', 'financial_year_end_month', 'state', 'industry'])]
class Business extends Model
{
    /** @use HasFactory<BusinessFactory> */
    use HasFactory;

    public const BUSINESS_NAME = 'business_name';

    public const COMPANY = 'company';

    public const TRUSTEES = 'trustees';

    /**
     * @var array<string, string>
     */
    public const TYPES = [
        self::BUSINESS_NAME => 'Business Name (BN)',
        self::COMPANY => 'Limited company (LTD)',
        self::TRUSTEES => 'Incorporated Trustees (NGO, church, association)',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'registered_on' => 'date',
            'vat_registered' => 'boolean',
            'has_employees' => 'boolean',
            'financial_year_end_month' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<ComplianceItem, $this>
     */
    public function complianceItems(): HasMany
    {
        return $this->hasMany(ComplianceItem::class);
    }

    /**
     * Deadlines still to deal with, soonest first.
     *
     * @return HasMany<ComplianceItem, $this>
     */
    public function openItems(): HasMany
    {
        return $this->complianceItems()->where('status', ComplianceItem::OPEN)->orderBy('due_on');
    }

    public function typeLabel(): string
    {
        return self::TYPES[$this->entity_type] ?? $this->entity_type;
    }
}
