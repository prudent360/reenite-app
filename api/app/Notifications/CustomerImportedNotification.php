<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\User;
use App\Support\FrontendLinks;

/**
 * Tells a customer added by import that their account exists, and how to sign in for the first time.
 */
class CustomerImportedNotification extends TemplatedNotification
{
    public function __construct(public string $temporaryPassword) {}

    public function template(): EmailTemplateKey
    {
        return EmailTemplateKey::CustomerImported;
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        return ['email' => $notifiable->email, 'temporary_password' => $this->temporaryPassword];
    }

    protected function actionUrl(User $notifiable): string
    {
        return FrontendLinks::login();
    }
}
