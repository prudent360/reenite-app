<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\User;

/**
 * "You started booking X but didn't finish paying" with a link straight back to it.
 */
class CheckoutNudgeNotification extends TemplatedNotification
{
    public function __construct(public string $item, public string $detail, public string $url) {}

    public function template(): EmailTemplateKey
    {
        return EmailTemplateKey::CheckoutNudge;
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        return ['item' => $this->item, 'detail' => $this->detail];
    }

    protected function actionUrl(User $notifiable): string
    {
        return $this->url;
    }
}
