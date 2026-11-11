<?php

namespace App\Models;

use Database\Factories\AppointmentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * A meeting staff book with a client: a consultation in the office, a call or a video meeting.
 * The client gets a confirmation and two reminders, can confirm or ask to reschedule from a
 * private link, and staff record whether they came on time.
 */
#[Fillable([
    'user_id', 'assigned_to', 'created_by', 'title', 'mode', 'meeting_details', 'starts_at', 'ends_at', 'status',
    'minutes_late', 'response', 'response_note', 'responded_at', 'response_token', 'reminded_day_at', 'reminded_hour_at',
    'staff_notes', 'cancelled_at', 'cancel_reason',
])]
class Appointment extends Model
{
    /** @use HasFactory<AppointmentFactory> */
    use HasFactory;

    public const SCHEDULED = 'scheduled';

    public const ATTENDED = 'attended';

    public const NO_SHOW = 'no_show';

    public const CANCELLED = 'cancelled';

    public const CONFIRMED = 'confirmed';

    public const RESCHEDULE_REQUESTED = 'reschedule_requested';

    /** @var array<string, string> */
    public const MODES = ['in_person' => 'In person', 'phone' => 'Phone call', 'video' => 'Video call'];

    protected static function booted(): void
    {
        static::creating(function (Appointment $appointment) {
            $appointment->response_token ??= Str::random(48);
        });
        static::created(function (Appointment $appointment) {
            $appointment->forceFill(['reference' => sprintf('AP-%s-%06d', $appointment->created_at->format('Y'), $appointment->id)])->saveQuietly();
        });
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'responded_at' => 'datetime',
            'reminded_day_at' => 'datetime',
            'reminded_hour_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'minutes_late' => 'integer',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'reference';
    }

    /**
     * @param  Builder<Appointment>  $query
     */
    public function scopeUpcoming(Builder $query): void
    {
        $query->where('status', self::SCHEDULED)->where('ends_at', '>', now());
    }

    public function statusLabel(): string
    {
        return match ($this->status) {
            self::SCHEDULED => $this->ends_at->isPast() ? 'Needs outcome' : 'Scheduled',
            self::ATTENDED => $this->minutes_late > 0 ? "Attended, {$this->minutes_late} min late" : 'Attended on time',
            self::NO_SHOW => 'No-show',
            self::CANCELLED => 'Cancelled',
            default => Str::headline($this->status),
        };
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
