<?php

namespace App\Models;

use App\Enums\BookingStatus;
use Carbon\CarbonImmutable;
use Database\Factories\BookingFactory;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * A reservation of a space. Money fields are in kobo; times are stored in UTC.
 */
#[Fillable([
    'user_id', 'space_id', 'invoice_id', 'customer_pass_id', 'status', 'starts_at', 'ends_at', 'rate_unit',
    'quantity', 'seats', 'subtotal', 'addons_total', 'discount', 'discount_label', 'total', 'pass_credits_used',
    'paid_via', 'hold_expires_at', 'check_in_code', 'checked_in_at', 'checked_in_by', 'checked_in_via', 'manage_token', 'nudged_at',
    'space_name', 'location_name', 'policy_snapshot', 'notes', 'confirmed_at', 'reminder_sent_at', 'ending_notice_sent_at', 'ended_notice_sent_at', 'ended_early_at', 'ended_by',
    'cancelled_at', 'cancelled_by', 'cancel_reason', 'refund_amount',
])]
#[Hidden(['manage_token'])]
class Booking extends Model
{
    /** @use HasFactory<BookingFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => BookingStatus::class,
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'quantity' => 'integer',
            'seats' => 'integer',
            'subtotal' => 'integer',
            'addons_total' => 'integer',
            'discount' => 'integer',
            'total' => 'integer',
            'pass_credits_used' => 'integer',
            'refund_amount' => 'integer',
            'hold_expires_at' => 'datetime',
            'checked_in_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'reminder_sent_at' => 'datetime',
            'ending_notice_sent_at' => 'datetime',
            'ended_notice_sent_at' => 'datetime',
            'ended_early_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'nudged_at' => 'datetime',
            'manage_token' => 'encrypted',
            'policy_snapshot' => 'array',
        ];
    }

    /**
     * References follow the id: BK-2026-000123.
     */
    protected static function booted(): void
    {
        static::created(function (Booking $booking) {
            $booking->forceFill(['reference' => sprintf('BK-%s-%06d', $booking->created_at->format('Y'), $booking->id)])->saveQuietly();
        });
    }

    public function getRouteKeyName(): string
    {
        return 'reference';
    }

    /**
     * Short code staff type in (or scan) at the front desk. Avoids look-alike characters.
     */
    public static function newCheckInCode(): string
    {
        do {
            $code = collect(range(1, 6))->map(fn () => Str::of('ABCDEFGHJKMNPQRSTUVWXYZ23456789')->charAt(random_int(0, 30)))->implode('');
        } while (self::where('check_in_code', $code)->exists());

        return $code;
    }

    /**
     * Whether this booking still blocks its time slot for other people.
     */
    public function isOccupying(): bool
    {
        if ($this->status === BookingStatus::Held) {
            return $this->hold_expires_at === null || $this->hold_expires_at->isFuture();
        }

        return in_array($this->status->value, BookingStatus::occupying(), true);
    }

    /**
     * What the customer is charged: the invoice total, which is lower than the booking total
     * when a discount code was used.
     */
    public function chargedAmount(): int
    {
        $this->loadMissing('invoice');

        return $this->invoice->total ?? $this->total;
    }

    public function matchesManageToken(?string $token): bool
    {
        return $token !== null && $this->manage_token !== null && hash_equals($this->manage_token, $token);
    }

    /**
     * Bookings that block other bookings: live holds plus approved, confirmed and checked-in ones.
     *
     * @param  Builder<Booking>  $query
     */
    public function scopeOccupying(Builder $query): void
    {
        $query->where(fn (Builder $inner) => $inner
            ->whereIn('status', [BookingStatus::PendingApproval->value, BookingStatus::Confirmed->value, BookingStatus::CheckedIn->value])
            ->orWhere(fn (Builder $held) => $held->where('status', BookingStatus::Held->value)->where('hold_expires_at', '>', now())));
    }

    /**
     * Bookings overlapping a time range, widened on both sides by a buffer.
     *
     * @param  Builder<Booking>  $query
     */
    public function scopeOverlapping(Builder $query, DateTimeInterface $startsAt, DateTimeInterface $endsAt, int $bufferMinutes = 0): void
    {
        $query->where('starts_at', '<', CarbonImmutable::instance($endsAt)->addMinutes($bufferMinutes))
            ->where('ends_at', '>', CarbonImmutable::instance($startsAt)->subMinutes($bufferMinutes));
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Space, $this>
     */
    public function space(): BelongsTo
    {
        return $this->belongsTo(Space::class);
    }

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    /**
     * @return BelongsTo<CustomerPass, $this>
     */
    public function customerPass(): BelongsTo
    {
        return $this->belongsTo(CustomerPass::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function checkedInBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_in_by');
    }

    /**
     * @return HasMany<BookingAddon, $this>
     */
    public function addons(): HasMany
    {
        return $this->hasMany(BookingAddon::class);
    }

    /**
     * The named seats this booking holds (hot desks with seats set up). The `seats` column is the
     * number of people; this is which seats they sit in.
     *
     * @return BelongsToMany<SpaceSeat, $this>
     */
    public function assignedSeats(): BelongsToMany
    {
        return $this->belongsToMany(SpaceSeat::class, 'booking_seat')->withTimestamps()->orderBy('sort_order')->orderBy('space_seats.id');
    }

    /**
     * Seat labels for display, e.g. "Desk 4, Desk 5".
     */
    public function seatLabels(): string
    {
        return $this->assignedSeats->pluck('label')->implode(', ');
    }
}
