<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\EmailTemplate;
use App\Models\User;
use App\Notifications\Channels\WhatsAppChannel;
use App\Support\FrontendLinks;
use App\Support\WhatsApp;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

/**
 * An email whose wording comes from an admin-editable template.
 * If the template is switched off, the email isn't sent.
 * Customers who opted in also get it on WhatsApp, when an approved template is set up for the event.
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
        return array_values(array_filter([
            // Saved first, so a mail or WhatsApp failure never loses the in-app copy.
            $notifiable instanceof User && $this->template()->showsInApp() ? 'database' : null,
            EmailTemplate::for($this->template())->is_enabled ? 'mail' : null,
            app(WhatsApp::class)->shouldSend($this->template(), $notifiable) ? WhatsAppChannel::class : null,
        ]));
    }

    /**
     * Values for the WhatsApp template's {{1}}, {{2}}..., in the order the event lists them.
     *
     * @return list<string>
     */
    public function toWhatsApp(User $notifiable): array
    {
        $values = $this->variables($notifiable) + self::nameVariables($notifiable->name) + ['app_name' => (string) config('app.name')];

        return array_map(fn (string $placeholder) => (string) ($values[$placeholder] ?? ''), $this->template()->whatsappParameters() ?? []);
    }

    public function toMail(User $notifiable): MailMessage
    {
        return EmailTemplate::for($this->template())->toMailMessage(
            $this->variables($notifiable) + self::nameVariables($notifiable->name),
            $this->actionUrl($notifiable),
        );
    }

    /**
     * The copy kept for the bell: the event's name as the title, the email subject as the line under it,
     * and the email button's address as a path on the website, so it opens in the same tab.
     *
     * @return array{event: string, group: string, title: string, body: string, url: ?string}
     */
    public function toDatabase(User $notifiable): array
    {
        $variables = $this->variables($notifiable) + self::nameVariables($notifiable->name) + ['app_name' => (string) config('app.name')];
        $url = $this->actionUrl($notifiable);
        $base = FrontendLinks::base();

        return [
            'event' => $this->template()->value,
            'group' => $this->template()->group(),
            'title' => $this->template()->name(),
            'body' => Str::squish((string) EmailTemplate::interpolate(EmailTemplate::for($this->template())->subject, $variables)),
            'url' => $url !== null && str_starts_with($url, $base.'/') ? Str::after($url, $base) : $url,
        ];
    }

    /**
     * @return array{name: string, first_name: string}
     */
    public static function nameVariables(string $name): array
    {
        return ['name' => $name, 'first_name' => Str::before(trim($name), ' ') ?: $name];
    }
}
