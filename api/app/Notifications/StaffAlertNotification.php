<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\User;

/**
 * Emails to the team (an order assigned to them, a transfer to check, a new booking).
 * The caller supplies the placeholder values and where the button goes.
 */
class StaffAlertNotification extends TemplatedNotification
{
    /**
     * @param  array<string, string>  $values
     */
    public function __construct(public EmailTemplateKey $key, public array $values, public string $url) {}

    public function template(): EmailTemplateKey
    {
        return $this->key;
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        return $this->values;
    }

    protected function actionUrl(User $notifiable): string
    {
        return $this->url;
    }
}
