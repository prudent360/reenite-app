<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Enums\Role;
use App\Models\User;
use App\Support\FrontendLinks;

/**
 * Welcomes a new staff member with a link to set their password (a password-reset token).
 */
class StaffInviteNotification extends TemplatedNotification
{
    public function __construct(public string $token, public string $invitedBy) {}

    public function template(): EmailTemplateKey
    {
        return EmailTemplateKey::StaffInvite;
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        $role = $notifiable->getRoleNames()->first();

        return [
            'role' => Role::tryFrom((string) $role)?->label() ?? 'a team member',
            'invited_by' => $this->invitedBy,
            'expires_minutes' => (string) FrontendLinks::resetMinutes(),
        ];
    }

    protected function actionUrl(User $notifiable): string
    {
        return FrontendLinks::resetPassword($notifiable, $this->token);
    }
}
