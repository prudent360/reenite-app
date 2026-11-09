<?php

namespace App\Support;

/**
 * Email delivery settings managed in Admin > Settings > Email.
 * Until an admin saves them once, the server's .env mail configuration is used unchanged.
 */
class MailSettings
{
    /**
     * Presets shown in the admin. All of them work over plain SMTP, so no extra packages are needed.
     *
     * @var array<string, array{label: string, host: string, port: int, encryption: string, username_hint: string}>
     */
    public const PROVIDERS = [
        'resend' => ['label' => 'Resend', 'host' => 'smtp.resend.com', 'port' => 465, 'encryption' => 'ssl', 'username_hint' => 'resend'],
        'mailgun' => ['label' => 'Mailgun', 'host' => 'smtp.mailgun.org', 'port' => 587, 'encryption' => 'tls', 'username_hint' => 'postmaster@your-domain'],
        'zoho' => ['label' => 'Zoho Mail', 'host' => 'smtp.zoho.com', 'port' => 465, 'encryption' => 'ssl', 'username_hint' => 'you@your-domain'],
        'gmail' => ['label' => 'Google Workspace / Gmail', 'host' => 'smtp.gmail.com', 'port' => 587, 'encryption' => 'tls', 'username_hint' => 'you@your-domain (use an app password)'],
        'custom' => ['label' => 'Other SMTP server', 'host' => '', 'port' => 587, 'encryption' => 'tls', 'username_hint' => ''],
    ];

    /**
     * Points Laravel's mailer at the saved settings. With sending switched off, emails are
     * written to the log instead, so nothing reaches customers by accident.
     */
    public static function apply(): void
    {
        $settings = app(Settings::class);

        if (! $settings->get('mail.configured', false)) {
            return;
        }

        config([
            'mail.from.address' => $settings->get('mail.from_address') ?: config('mail.from.address'),
            'mail.from.name' => $settings->get('mail.from_name') ?: config('app.name'),
        ]);

        if (! $settings->get('mail.enabled', false) || ! $settings->get('mail.host')) {
            config(['mail.default' => 'log']);

            return;
        }

        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.url' => null,
            'mail.mailers.smtp.host' => $settings->get('mail.host'),
            'mail.mailers.smtp.port' => (int) $settings->get('mail.port', 587),
            'mail.mailers.smtp.scheme' => $settings->get('mail.encryption') === 'ssl' ? 'smtps' : 'smtp',
            'mail.mailers.smtp.username' => $settings->get('mail.username'),
            'mail.mailers.smtp.password' => $settings->get('mail.password'),
        ]);
    }
}
