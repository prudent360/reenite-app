<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\Booking;
use App\Models\User;
use App\Support\FrontendLinks;
use App\Support\Money;

/**
 * Booking emails. One class serves every booking template; the template decides the wording.
 */
class BookingNotification extends TemplatedNotification
{
    /**
     * @param  array<string, string>  $extra  e.g. refund_amount, reason, hold_expires
     */
    public function __construct(public EmailTemplateKey $key, public Booking $booking, public array $extra = []) {}

    public function template(): EmailTemplateKey
    {
        return $this->key;
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        return $this->extra + self::bookingVariables($this->booking) + [
            'amount' => Money::format($this->booking->total),
            'check_in_code' => (string) $this->booking->check_in_code,
            'cancellation_policy' => implode(' ', $this->booking->policy_snapshot['summary'] ?? []) ?: 'Contact us to change or cancel.',
            'email' => $notifiable->email,
        ];
    }

    protected function actionUrl(User $notifiable): string
    {
        return $this->key === EmailTemplateKey::GuestAccountInvite
            ? FrontendLinks::register($notifiable->email)
            : FrontendLinks::booking($this->booking);
    }

    /**
     * Placeholders shared by customer and staff booking emails.
     *
     * @return array<string, string>
     */
    public static function bookingVariables(Booking $booking): array
    {
        $booking->loadMissing('space.location');
        $timezone = $booking->space->location->timezone ?: (string) config('app.display_timezone');
        $startsAt = $booking->starts_at->timezone($timezone);
        $endsAt = $booking->ends_at->timezone($timezone);

        return [
            'booking_reference' => (string) $booking->reference,
            'space_name' => $booking->space_name,
            'location_name' => $booking->location_name,
            'location_address' => trim($booking->space->location->address.', '.$booking->space->location->city, ', '),
            'booking_date' => $startsAt->isSameDay($endsAt) || $endsAt->format('H:i') === '00:00' && $endsAt->copy()->subMinute()->isSameDay($startsAt)
                ? $startsAt->format('l j F Y')
                : $startsAt->format('j M Y').' to '.$endsAt->format('j M Y'),
            'booking_time' => $startsAt->format('g:ia').' to '.$endsAt->format('g:ia'),
            'guests' => $booking->seats.' '.($booking->seats === 1 ? 'person' : 'people'),
        ];
    }
}
