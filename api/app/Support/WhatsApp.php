<?php

namespace App\Support;

use App\Enums\EmailTemplateKey;
use App\Models\User;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * WhatsApp updates through Meta's WhatsApp Cloud API.
 *
 * WhatsApp only lets businesses start a conversation with a message template that Meta has
 * approved. For each event, admins enter the name of their approved template; its body uses
 * {{1}}, {{2}}... for the values listed in EmailTemplateKey::whatsappParameters().
 */
class WhatsApp
{
    public function __construct(private Settings $settings) {}

    public function isConfigured(): bool
    {
        return (bool) $this->settings->get('whatsapp.enabled', false)
            && filled($this->settings->get('whatsapp.phone_number_id'))
            && filled($this->settings->get('whatsapp.access_token'));
    }

    /**
     * The approved template name set up for this event, if any.
     */
    public function templateFor(EmailTemplateKey $key): ?string
    {
        $name = ($this->settings->get('whatsapp.templates', []) ?? [])[$key->value] ?? null;

        return filled($name) && $key->whatsappParameters() !== null ? (string) $name : null;
    }

    public function shouldSend(EmailTemplateKey $key, object $notifiable): bool
    {
        return $notifiable instanceof User
            && $notifiable->wantsWhatsApp()
            && $this->isConfigured()
            && $this->templateFor($key) !== null;
    }

    public function language(): string
    {
        return (string) $this->settings->get('whatsapp.language', 'en');
    }

    /**
     * Sends an approved template. Throws if Meta refuses it.
     *
     * @param  list<string>  $parameters  values for {{1}}, {{2}}...
     *
     * @throws RequestException
     */
    public function send(string $phone, string $template, array $parameters, ?string $language = null): string
    {
        $to = self::normalisePhone($phone);
        abort_unless($to, 422, 'That phone number is not valid for WhatsApp.');

        $components = $parameters === [] ? [] : [[
            'type' => 'body',
            'parameters' => array_map(fn (string $value) => ['type' => 'text', 'text' => self::cleanParameter($value)], $parameters),
        ]];

        $response = Http::withToken((string) $this->settings->get('whatsapp.access_token'))
            ->acceptJson()
            ->timeout(15)
            ->post($this->endpoint(), [
                'messaging_product' => 'whatsapp',
                'to' => $to,
                'type' => 'template',
                'template' => array_filter([
                    'name' => $template,
                    'language' => ['code' => $language ?? $this->language()],
                    'components' => $components ?: null,
                ]),
            ])
            ->throw();

        return (string) $response->json('messages.0.id');
    }

    private function endpoint(): string
    {
        return rtrim((string) config('services.whatsapp.graph_url'), '/').'/'.config('services.whatsapp.graph_version').'/'
            .$this->settings->get('whatsapp.phone_number_id').'/messages';
    }

    /**
     * Nigerian numbers are stored as typed (0803..., +234 803...). WhatsApp wants 2348031234567.
     */
    public static function normalisePhone(string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (str_starts_with($digits, '0') && strlen($digits) === 11) {
            $digits = '234'.substr($digits, 1);
        }

        return strlen($digits) >= 10 && strlen($digits) <= 15 ? $digits : null;
    }

    /**
     * Template values can't contain new lines, tabs or long runs of spaces.
     */
    public static function cleanParameter(string $value): string
    {
        $value = trim((string) preg_replace('/\s+/', ' ', $value));

        return Str::limit($value !== '' ? $value : '-', 900, '...');
    }
}
