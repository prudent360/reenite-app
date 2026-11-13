<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\User;
use App\Notifications\Channels\WhatsAppChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * A message staff send to customers they picked on the Customers page. Queued, so sending to
 * many people doesn't hold up the page. Goes by email, WhatsApp (to customers who opted in),
 * or both, as staff chose; a copy always lands under the bell in the app.
 */
class CustomerMessageNotification extends TemplatedNotification implements ShouldQueue
{
    use Queueable;

    public const EMAIL = 'email';

    public const WHATSAPP = 'whatsapp';

    /**
     * @param  list<string>  $channels  email and/or whatsapp
     */
    public function __construct(public string $subject, public string $message, public array $channels) {}

    public function template(): EmailTemplateKey
    {
        return EmailTemplateKey::CustomerMessage;
    }

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return array_values(array_filter(parent::via($notifiable), fn (string $channel) => match ($channel) {
            'mail' => in_array(self::EMAIL, $this->channels, true),
            WhatsAppChannel::class => in_array(self::WHATSAPP, $this->channels, true),
            default => true,
        }));
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        return ['subject' => $this->subject, 'message' => $this->message];
    }
}
