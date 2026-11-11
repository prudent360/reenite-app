<?php

namespace App\Notifications;

use App\Appointments\AppointmentSettings;
use App\Enums\EmailTemplateKey;
use App\Models\Appointment;
use App\Models\Location;
use App\Models\User;
use App\Support\FrontendLinks;

/**
 * Appointment messages to the client (email, and WhatsApp when they've agreed to it).
 * The template decides the wording; the button opens their confirm-or-reschedule page.
 */
class AppointmentNotification extends TemplatedNotification
{
    /**
     * @param  array<string, string>  $extra  e.g. reason
     */
    public function __construct(public EmailTemplateKey $key, public Appointment $appointment, public array $extra = []) {}

    public function template(): EmailTemplateKey
    {
        return $this->key;
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        return $this->extra + self::appointmentVariables($this->appointment);
    }

    protected function actionUrl(User $notifiable): ?string
    {
        return $this->key === EmailTemplateKey::AppointmentCancelled ? null : FrontendLinks::appointment($this->appointment);
    }

    /**
     * Placeholders shared by the client's messages and the staff alert.
     *
     * @return array<string, string>
     */
    public static function appointmentVariables(Appointment $appointment): array
    {
        $timezone = (string) config('app.display_timezone');
        $startsAt = $appointment->starts_at->timezone($timezone);
        $appointment->loadMissing(['client', 'assignee']);

        return [
            'appointment_reference' => (string) $appointment->reference,
            'appointment_title' => $appointment->title,
            'appointment_date' => $startsAt->format('l j F Y'),
            'appointment_time' => $startsAt->format('g:ia').' to '.$appointment->ends_at->timezone($timezone)->format('g:ia'),
            'appointment_mode' => Appointment::MODES[$appointment->mode] ?? $appointment->mode,
            'meeting_details' => self::meetingDetails($appointment),
            'staff_name' => $appointment->assignee?->name ?? 'the '.config('app.name').' team',
            'punctuality' => app(AppointmentSettings::class)->punctualityMessage(),
        ];
    }

    /**
     * Where or how to join: what staff wrote, or a sensible default for the mode.
     */
    public static function meetingDetails(Appointment $appointment): string
    {
        if (filled($appointment->meeting_details)) {
            return (string) $appointment->meeting_details;
        }

        return match ($appointment->mode) {
            'in_person' => ($office = Location::query()->where('is_active', true)->orderBy('id')->first())
                ? "Where: {$office->name}, ".trim($office->address.', '.$office->city, ', ')
                : 'Where: our office (we will confirm the address).',
            'video' => "We'll send you the video call link before the appointment.",
            'phone' => "We'll call you on ".($appointment->client->phone ?: 'the number you gave us').'.',
            default => '',
        };
    }
}
