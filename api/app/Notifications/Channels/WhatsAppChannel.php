<?php

namespace App\Notifications\Channels;

use App\Models\User;
use App\Notifications\TemplatedNotification;
use App\Support\WhatsApp;
use Illuminate\Support\Facades\Log;

/**
 * Delivers a templated notification on WhatsApp as well as by email. A WhatsApp failure is
 * logged and never stops the email or the work that sent it.
 */
class WhatsAppChannel
{
    public function __construct(private WhatsApp $whatsApp) {}

    public function send(User $notifiable, TemplatedNotification $notification): void
    {
        $template = $this->whatsApp->templateFor($notification->template());
        if (! $template || ! $notifiable->wantsWhatsApp()) {
            return;
        }

        try {
            $this->whatsApp->send((string) $notifiable->phone, $template, $notification->toWhatsApp($notifiable));
        } catch (\Throwable $exception) {
            Log::warning('WhatsApp message not sent', [
                'event' => $notification->template()->value,
                'user' => $notifiable->id,
                'error' => $exception->getMessage(),
            ]);
        }
    }
}
