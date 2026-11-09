<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\User;
use App\Support\FrontendLinks;
use Illuminate\Support\Carbon;

class PasswordChangedNotification extends TemplatedNotification
{
    public function __construct(public Carbon $changedAt) {}

    public function template(): EmailTemplateKey
    {
        return EmailTemplateKey::PasswordChanged;
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        return [
            'changed_at' => $this->changedAt->copy()->timezone((string) config('app.display_timezone'))->format('j M Y, g:ia').' (Lagos time)',
        ];
    }

    protected function actionUrl(User $notifiable): string
    {
        return FrontendLinks::login();
    }
}
