<?php

namespace App\Appointments;

use App\Enums\EmailTemplateKey;
use App\Models\Appointment;
use App\Models\User;
use App\Notifications\AppointmentNotification;
use App\Notifications\StaffAlertNotification;
use App\Support\FrontendLinks;
use App\Support\StaffAlerts;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Appointments staff book with clients. Clients get a confirmation when booked, a reminder the day
 * before and another about an hour before, each with a link to confirm or ask to reschedule.
 * Afterwards staff record whether the client came on time, late or not at all.
 */
class AppointmentService
{
    /**
     * Day-before reminders only go to appointments booked at least this far ahead; anything
     * sooner has just had its confirmation.
     */
    public const DAY_REMINDER_HOURS = 24;

    /**
     * The "starting soon" reminder goes out this many minutes before the start.
     */
    public const SOON_REMINDER_MINUTES = 60;

    public function __construct(private AppointmentClients $clients) {}

    /**
     * Books an appointment and sends the client their confirmation.
     *
     * @param  array{client_id?: int|null, client?: array{name: string, email: string, phone: string, whatsapp_consent?: bool}|null, title: string, mode: string, meeting_details?: string|null, starts_at: string, duration_minutes: int, assigned_to?: int|null, staff_notes?: string|null}  $data
     */
    public function schedule(array $data, User $staff): Appointment
    {
        $client = filled($data['client_id'] ?? null)
            ? User::where('type', User::TYPE_CUSTOMER)->findOrFail($data['client_id'])
            : $this->clients->resolve($data['client']);

        [$startsAt, $endsAt] = $this->window($data['starts_at'], (int) $data['duration_minutes']);

        $appointment = DB::transaction(function () use ($data, $client, $staff, $startsAt, $endsAt) {
            $this->assertStaffFree($data['assigned_to'] ?? null, $startsAt, $endsAt);

            return Appointment::create([
                'user_id' => $client->id,
                'assigned_to' => $data['assigned_to'] ?? null,
                'created_by' => $staff->id,
                'title' => $data['title'],
                'mode' => $data['mode'],
                'meeting_details' => $data['meeting_details'] ?? null,
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
                'staff_notes' => $data['staff_notes'] ?? null,
            ]);
        });

        $appointment->load(['client', 'assignee']);
        $appointment->client->notify(new AppointmentNotification(EmailTemplateKey::AppointmentScheduled, $appointment));

        return $appointment->refresh();
    }

    /**
     * Edits an upcoming appointment. A new time resets the reminders and the client's answer, and
     * tells the client; other changes (notes, who runs it) are silent.
     *
     * @param  array{title?: string, mode?: string, meeting_details?: string|null, starts_at?: string, duration_minutes?: int, assigned_to?: int|null, staff_notes?: string|null}  $data
     */
    public function update(Appointment $appointment, array $data): Appointment
    {
        $this->assertScheduled($appointment);

        $startsAt = CarbonImmutable::instance($appointment->starts_at);
        $endsAt = CarbonImmutable::instance($appointment->ends_at);
        if (isset($data['starts_at']) || isset($data['duration_minutes'])) {
            [$startsAt, $endsAt] = $this->window(
                $data['starts_at'] ?? $startsAt->timezone((string) config('app.display_timezone'))->format('Y-m-d H:i'),
                (int) ($data['duration_minutes'] ?? $startsAt->diffInMinutes($endsAt)),
            );
        }
        $moved = ! $startsAt->equalTo($appointment->starts_at) || ! $endsAt->equalTo($appointment->ends_at);
        $assignee = array_key_exists('assigned_to', $data) ? $data['assigned_to'] : $appointment->assigned_to;

        DB::transaction(function () use ($appointment, $data, $startsAt, $endsAt, $moved, $assignee) {
            if ($moved || $assignee !== $appointment->assigned_to) {
                $this->assertStaffFree($assignee, $startsAt, $endsAt, $appointment->id);
            }

            $appointment->fill(array_intersect_key($data, array_flip(['title', 'mode', 'meeting_details', 'assigned_to', 'staff_notes'])));
            if ($moved) {
                $appointment->fill([
                    'starts_at' => $startsAt,
                    'ends_at' => $endsAt,
                    'response' => null,
                    'response_note' => null,
                    'responded_at' => null,
                    'reminded_day_at' => null,
                    'reminded_hour_at' => null,
                ]);
            }
            $appointment->save();
        });

        if ($moved) {
            $appointment->load(['client', 'assignee']);
            $appointment->client->notify(new AppointmentNotification(EmailTemplateKey::AppointmentChanged, $appointment));
        }

        return $appointment->refresh();
    }

    public function cancel(Appointment $appointment, string $reason): Appointment
    {
        $this->assertScheduled($appointment);

        $appointment->update(['status' => Appointment::CANCELLED, 'cancelled_at' => now(), 'cancel_reason' => $reason]);
        $appointment->load('client');
        $appointment->client->notify(new AppointmentNotification(EmailTemplateKey::AppointmentCancelled, $appointment, ['reason' => $reason]));

        return $appointment;
    }

    /**
     * Records how it went: attended (with how late, 0 for on time) or a no-show.
     */
    public function recordOutcome(Appointment $appointment, string $outcome, int $minutesLate = 0): Appointment
    {
        abort_if($appointment->status === Appointment::CANCELLED, 422, 'This appointment was cancelled.');
        abort_if($appointment->starts_at->isFuture(), 422, 'You can record how it went once the appointment has started.');

        $appointment->update($outcome === Appointment::NO_SHOW
            ? ['status' => Appointment::NO_SHOW, 'minutes_late' => null]
            : ['status' => Appointment::ATTENDED, 'minutes_late' => max(0, $minutesLate)]);

        return $appointment;
    }

    /**
     * The client's answer from the link in their messages.
     */
    public function respond(Appointment $appointment, string $response, ?string $note): Appointment
    {
        abort_unless($appointment->status === Appointment::SCHEDULED && $appointment->starts_at->isFuture(), 422, 'This appointment can no longer be changed online. Please call us.');

        $appointment->update(['response' => $response, 'response_note' => $note, 'responded_at' => now()]);

        if ($response === Appointment::RESCHEDULE_REQUESTED) {
            $appointment->load(['client', 'assignee', 'creator']);
            $staff = $appointment->assignee ?? $appointment->creator;
            Notification::send(
                $staff && $staff->status === User::STATUS_ACTIVE ? collect([$staff]) : StaffAlerts::recipients('appointments.manage'),
                new StaffAlertNotification(EmailTemplateKey::StaffAppointmentReschedule, AppointmentNotification::appointmentVariables($appointment) + [
                    'client_name' => $appointment->client->name,
                    'client_phone' => (string) $appointment->client->phone,
                    'note' => $note ?: 'No note left.',
                ], FrontendLinks::adminAppointment((string) $appointment->reference)),
            );
        }

        return $appointment;
    }

    /**
     * Sends due reminders. Runs every few minutes from the scheduler.
     *
     * @return array{day: int, soon: int}
     */
    public function sendReminders(): array
    {
        $sent = ['day' => 0, 'soon' => 0];
        $due = fn () => Appointment::query()
            ->where('status', Appointment::SCHEDULED)
            ->where(fn ($query) => $query->whereNull('response')->orWhere('response', '!=', Appointment::RESCHEDULE_REQUESTED))
            ->with(['client', 'assignee']);

        // The day before: within the next 24 hours but more than the "soon" window away.
        $due()->whereNull('reminded_day_at')
            ->whereBetween('starts_at', [now()->addMinutes(self::SOON_REMINDER_MINUTES + 30), now()->addHours(self::DAY_REMINDER_HOURS)])
            ->chunkById(100, function ($appointments) use (&$sent) {
                foreach ($appointments as $appointment) {
                    $appointment->update(['reminded_day_at' => now()]);
                    // Booked less than a day ahead: the confirmation was the reminder.
                    if ($appointment->created_at->lessThanOrEqualTo($appointment->starts_at->copy()->subHours(self::DAY_REMINDER_HOURS))) {
                        $appointment->client->notify(new AppointmentNotification(EmailTemplateKey::AppointmentReminder, $appointment));
                        $sent['day']++;
                    }
                }
            });

        // About an hour before.
        $due()->whereNull('reminded_hour_at')
            ->whereBetween('starts_at', [now(), now()->addMinutes(self::SOON_REMINDER_MINUTES)])
            ->chunkById(100, function ($appointments) use (&$sent) {
                foreach ($appointments as $appointment) {
                    $appointment->update(['reminded_hour_at' => now()]);
                    // Booked within the last hour or so: they've only just been told.
                    if ($appointment->created_at->lessThan(now()->subMinutes(self::SOON_REMINDER_MINUTES))) {
                        $appointment->client->notify(new AppointmentNotification(EmailTemplateKey::AppointmentStartingSoon, $appointment));
                        $sent['soon']++;
                    }
                }
            });

        return $sent;
    }

    /**
     * Turns the chosen local date and time ("2026-11-12 14:30", Lagos time) and length into UTC instants.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    private function window(string $startsAt, int $minutes): array
    {
        $start = CarbonImmutable::createFromFormat('Y-m-d H:i', $startsAt, (string) config('app.display_timezone'));
        if ($start === false) {
            throw ValidationException::withMessages(['starts_at' => 'Choose a valid date and time.']);
        }
        if ($start->isPast()) {
            throw ValidationException::withMessages(['starts_at' => 'Choose a time in the future.']);
        }

        return [$start->utc(), $start->addMinutes($minutes)->utc()];
    }

    private function assertStaffFree(?int $staffId, CarbonImmutable $startsAt, CarbonImmutable $endsAt, ?int $ignoreId = null): void
    {
        if (! $staffId) {
            return;
        }

        $clash = Appointment::query()
            ->where('assigned_to', $staffId)
            ->where('status', Appointment::SCHEDULED)
            ->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))
            ->where('starts_at', '<', $endsAt)
            ->where('ends_at', '>', $startsAt)
            ->with('assignee')
            ->first();

        if ($clash) {
            $time = $clash->starts_at->timezone((string) config('app.display_timezone'))->format('g:ia');
            throw ValidationException::withMessages(['starts_at' => "{$clash->assignee->name} already has an appointment at {$time} ({$clash->title}, {$clash->reference}). Choose another time or person."]);
        }
    }

    private function assertScheduled(Appointment $appointment): void
    {
        if ($appointment->status !== Appointment::SCHEDULED) {
            throw new HttpException(422, 'Only scheduled appointments can be changed.');
        }
    }
}
