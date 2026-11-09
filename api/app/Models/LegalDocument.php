<?php

namespace App\Models;

use Database\Factories\LegalDocumentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

/**
 * A PDF Reenite asks clients to sign, e.g. a virtual address agreement. It goes to chosen
 * clients, to everyone with an active membership, or to every client.
 */
#[Fillable(['title', 'description', 'file_path', 'file_name', 'sha256', 'audience', 'is_active', 'created_by'])]
#[Hidden(['file_path'])]
class LegalDocument extends Model
{
    /** @use HasFactory<LegalDocumentFactory> */
    use HasFactory;

    public const SELECTED = 'selected';

    public const MEMBERS = 'members';

    public const ALL = 'all';

    public const AUDIENCES = [self::SELECTED, self::MEMBERS, self::ALL];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /**
     * Active documents this customer is asked to sign.
     *
     * @param  Builder<LegalDocument>  $query
     */
    public function scopeFor(Builder $query, User $customer): void
    {
        $isMember = $customer->activeMembership() !== null;

        $query->where('is_active', true)->where(fn (Builder $inner) => $inner
            ->where('audience', self::ALL)
            ->when($isMember, fn (Builder $members) => $members->orWhere('audience', self::MEMBERS))
            ->orWhere(fn (Builder $selected) => $selected->where('audience', self::SELECTED)->whereHas('recipients', fn (Builder $users) => $users->whereKey($customer->id))));
    }

    /**
     * Customers asked to sign this document right now.
     *
     * @return Collection<int, User>
     */
    public function audienceMembers(): Collection
    {
        $customers = User::query()->where('type', User::TYPE_CUSTOMER)->where('status', User::STATUS_ACTIVE);

        return match ($this->audience) {
            self::ALL => $customers->orderBy('name')->get(),
            self::MEMBERS => $customers->whereHas('memberships', fn (Builder $query) => $query
                ->where('status', CustomerMembership::ACTIVE)->where('starts_at', '<=', now())->where('ends_at', '>', now()))->orderBy('name')->get(),
            default => $this->recipients()->orderBy('name')->get(),
        };
    }

    public function isFor(User $customer): bool
    {
        return self::query()->whereKey($this->id)->for($customer)->exists();
    }

    /**
     * @return BelongsToMany<User, $this>
     */
    public function recipients(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withTimestamps();
    }

    /**
     * @return HasMany<DocumentSignature, $this>
     */
    public function signatures(): HasMany
    {
        return $this->hasMany(DocumentSignature::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
