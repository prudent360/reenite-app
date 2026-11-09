<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\User;
use App\Support\FrontendLinks;

class VerifyEmailNotification extends TemplatedNotification
{
    public function template(): EmailTemplateKey
    {
        return EmailTemplateKey::EmailVerification;
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        return ['expires_minutes' => (string) FrontendLinks::verificationMinutes()];
    }

    protected function actionUrl(User $notifiable): string
    {
        return FrontendLinks::verifyEmail($notifiable);
    }
}
