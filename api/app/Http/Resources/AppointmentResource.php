<?php

namespace App\Http\Resources;

use App\Appointments\AppointmentSettings;
use App\Models\Appointment;
use App\Notifications\AppointmentNotification;
use App\Support\WhatsApp;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Appointment
 */
class AppointmentResource extends JsonResource
{
    /**
     * The client's own page shows only what they need: no staff notes or contact details.
     */
    public bool $forClient = false;

    /**
     * Set by the controller on the detail page: how the client kept past appointments.
     *
     * @var array<string, int|null>|null
     */
    public ?array $history = null;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $base = [
            'reference' => $this->reference,
            'title' => $this->title,
            'mode' => $this->mode,
            'mode_label' => Appointment::MODES[$this->mode] ?? $this->mode,
            'meeting_details' => AppointmentNotification::meetingDetails($this->resource),
            'starts_at' => $this->starts_at->toIso8601String(),
            'ends_at' => $this->ends_at->toIso8601String(),
            'status' => $this->status,
            'status_label' => $this->statusLabel(),
            'response' => $this->response,
            'responded_at' => $this->responded_at?->toIso8601String(),
            'staff_name' => $this->whenLoaded('assignee', fn () => $this->assignee?->name),
            'can_respond' => $this->status === Appointment::SCHEDULED && $this->starts_at->isFuture(),
        ];

        if ($this->forClient) {
            return $base + [
                'client_first_name' => $this->whenLoaded('client', fn () => strtok($this->client->name, ' ')),
                'punctuality' => app(AppointmentSettings::class)->punctualityMessage(),
            ];
        }

        return $base + [
            'id' => $this->id,
            'custom_meeting_details' => $this->meeting_details,
            'duration_minutes' => (int) $this->starts_at->diffInMinutes($this->ends_at),
            'minutes_late' => $this->minutes_late,
            'response_note' => $this->response_note,
            'reminded_day_at' => $this->reminded_day_at?->toIso8601String(),
            'reminded_hour_at' => $this->reminded_hour_at?->toIso8601String(),
            'staff_notes' => $this->staff_notes,
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancel_reason' => $this->cancel_reason,
            'assigned_to' => $this->assigned_to,
            'created_by' => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'client' => $this->whenLoaded('client', fn () => [
                'id' => $this->client->id,
                'name' => $this->client->name,
                'email' => $this->client->email,
                'phone' => $this->client->phone,
                'is_guest' => $this->client->isGuest(),
                'whatsapp' => $this->client->wantsWhatsApp(),
                // Whether WhatsApp sending is switched on at all (Admin > Settings > WhatsApp).
                'whatsapp_live' => app(WhatsApp::class)->isConfigured(),
            ]),
            'history' => $this->when($this->history !== null, $this->history),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
