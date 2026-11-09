<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\EmailTemplate;
use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

/**
 * An email whose wording comes from an admin-editable template.
 * If the template is switched off, the email isn't sent.
 */
abstract class TemplatedNotification extends Notification
{
    abstract public function template(): EmailTemplateKey;

    /**
     * Placeholder values beyond name, first_name and app_name.
     *
     * @return array<string, string>
     */
    abstract protected function variables(User $notifiable): array;

    protected function actionUrl(User $notifiable): ?string
    {
        return null;
    }

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return EmailTemplate::for($this->template())->is_enabled ? ['mail'] : [];
    }

    public function toMail(User $notifiable): MailMessage
    {
        return EmailTemplate::for($this->template())->toMailMessage(
            $this->variables($notifiable) + self::nameVariables($notifiable->name),
            $this->actionUrl($notifiable),
        );
    }

    /**
     * @return array{name: string, first_name: string}
     */
    public static function nameVariables(string $name): array
    {
        return ['name' => $name, 'first_name' => Str::before(trim($name), ' ') ?: $name];
    }
}
