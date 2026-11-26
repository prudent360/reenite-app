<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\User;
use App\Support\FrontendLinks;

/**
 * Tells a customer a staff member added that their account exists, with a link to set their
 * password (a password-reset token).
 */
class CustomerAddedNotification extends TemplatedNotification
{
    public function __construct(public string $token, public string $addedBy) {}

    public function template(): EmailTemplateKey
    {
        return EmailTemplateKey::CustomerAdded;
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        return [
            'email' => $notifiable->email,
            'added_by' => $this->addedBy,
            'expires_minutes' => (string) FrontendLinks::resetMinutes(),
        ];
    }

    protected function actionUrl(User $notifiable): string
    {
        return FrontendLinks::resetPassword($notifiable, $this->token);
    }
}
