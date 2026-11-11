<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\Consultation;
use App\Models\ConsultationType;
use App\Models\Location;
use App\Models\User;
use App\Support\FrontendLinks;

/**
 * Consultation emails to the customer. The template decides the wording.
 */
class ConsultationNotification extends TemplatedNotification
{
    /**
     * @param  array<string, string>  $extra  e.g. refund_amount, reason
     */
    public function __construct(public EmailTemplateKey $key, public Consultation $consultation, public array $extra = []) {}

    public function template(): EmailTemplateKey
    {
        return $this->key;
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        return $this->extra + self::consultationVariables($this->consultation);
    }

    protected function actionUrl(User $notifiable): string
    {
        return $this->key === EmailTemplateKey::ConsultationCancelled
            ? FrontendLinks::consultations()
            : FrontendLinks::consultation((string) $this->consultation->reference);
    }

    /**
     * Placeholders shared by customer and staff consultation emails.
     *
     * @return array<string, string>
     */
    public static function consultationVariables(Consultation $consultation): array
    {
        $timezone = (string) config('app.display_timezone');
        $startsAt = $consultation->starts_at->timezone($timezone);
        $consultation->loadMissing('user');

        return [
            'consultation_reference' => (string) $consultation->reference,
            'consultation_name' => $consultation->name,
            'consultation_date' => $startsAt->format('l j F Y'),
            'consultation_time' => $startsAt->format('g:ia').' to '.$consultation->ends_at->timezone($timezone)->format('g:ia'),
            'consultation_mode' => ConsultationType::MODES[$consultation->mode] ?? $consultation->mode,
            'meeting_details' => self::meetingDetails($consultation),
            'topic' => $consultation->topic,
        ];
    }

    /**
     * Where or how to join: what staff wrote, or a sensible default for the mode.
     */
    public static function meetingDetails(Consultation $consultation): string
    {
        if (filled($consultation->meeting_details)) {
            return (string) $consultation->meeting_details;
        }

        return match ($consultation->mode) {
            'in_person' => ($office = Location::query()->where('is_active', true)->orderBy('id')->first())
                ? "Where: {$office->name}, ".trim($office->address.', '.$office->city, ', ')
                : 'Where: our office (we will confirm the address).',
            'video' => "We'll email you the video call link before the session.",
            'phone' => 'We\'ll call you on '.($consultation->user->phone ?: 'the phone number on your account').'.',
            default => '',
        };
    }
}
