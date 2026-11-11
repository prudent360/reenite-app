<?php

namespace App\Appointments;

use App\Support\Settings;

/**
 * The timekeeping rule clients see in every appointment message, set in the admin.
 */
class AppointmentSettings
{
    public const DEFAULT_ARRIVE_EARLY = 10;

    public const DEFAULT_GRACE = 15;

    public function __construct(private Settings $settings) {}

    public function arriveEarlyMinutes(): int
    {
        return (int) ($this->settings->get('appointments.arrive_early_minutes', self::DEFAULT_ARRIVE_EARLY) ?? self::DEFAULT_ARRIVE_EARLY);
    }

    public function graceMinutes(): int
    {
        return (int) ($this->settings->get('appointments.grace_minutes', self::DEFAULT_GRACE) ?? self::DEFAULT_GRACE);
    }

    public function update(int $arriveEarly, int $grace): void
    {
        $this->settings->set('appointments.arrive_early_minutes', $arriveEarly);
        $this->settings->set('appointments.grace_minutes', $grace);
    }

    /**
     * e.g. "Please arrive 10 minutes early. If you're more than 15 minutes late, we may need to reschedule."
     */
    public function punctualityMessage(): string
    {
        $early = $this->arriveEarlyMinutes();
        $grace = $this->graceMinutes();

        return trim(implode(' ', array_filter([
            $early > 0 ? "Please arrive {$early} ".($early === 1 ? 'minute' : 'minutes').' early.' : 'Please be on time.',
            $grace > 0 ? "If you're more than {$grace} ".($grace === 1 ? 'minute' : 'minutes').' late, we may need to reschedule.' : null,
        ])));
    }

    /**
     * @return array{arrive_early_minutes: int, grace_minutes: int, message: string}
     */
    public function toArray(): array
    {
        return ['arrive_early_minutes' => $this->arriveEarlyMinutes(), 'grace_minutes' => $this->graceMinutes(), 'message' => $this->punctualityMessage()];
    }
}
