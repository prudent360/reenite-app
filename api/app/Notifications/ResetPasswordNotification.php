<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\User;
use App\Support\FrontendLinks;

class ResetPasswordNotification extends TemplatedNotification
{
    public function __construct(public string $token) {}

    public function template(): EmailTemplateKey
    {
        return EmailTemplateKey::PasswordReset;
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        return ['expires_minutes' => (string) FrontendLinks::resetMinutes()];
    }

    protected function actionUrl(User $notifiable): string
    {
        return FrontendLinks::resetPassword($notifiable, $this->token);
    }
}
