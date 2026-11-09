<?php

namespace App\Models;

use App\Enums\EmailTemplateKey;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Str;

#[Fillable(['key', 'subject', 'heading', 'body', 'button_text', 'footer', 'is_enabled', 'updated_by'])]
class EmailTemplate extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'key' => EmailTemplateKey::class,
            'is_enabled' => 'boolean',
        ];
    }

    /**
     * The saved template, or one built from the defaults if it hasn't been seeded yet.
     */
    public static function for(EmailTemplateKey $key): self
    {
        return self::firstWhere('key', $key->value) ?? new self(['key' => $key, 'is_enabled' => true, ...$key->defaults()]);
    }

    /**
     * Replaces {{placeholders}}. Unknown placeholders are left as typed so mistakes are visible.
     *
     * @param  array<string, string>  $variables
     */
    public static function interpolate(?string $text, array $variables): ?string
    {
        if ($text === null) {
            return null;
        }

        return preg_replace_callback('/\{\{\s*([a-z_]+)\s*\}\}/', fn (array $match) => $variables[$match[1]] ?? $match[0], $text);
    }

    /**
     * Builds the email. Paragraphs are separated by blank lines; the button links to `$actionUrl`.
     *
     * @param  array<string, string>  $variables
     */
    public function toMailMessage(array $variables, ?string $actionUrl = null): MailMessage
    {
        $variables += ['app_name' => (string) config('app.name')];

        $message = (new MailMessage)
            ->subject(self::interpolate($this->subject, $variables))
            ->greeting(self::interpolate($this->heading, $variables));

        foreach (preg_split('/\R{2,}/', trim(self::interpolate($this->body, $variables))) as $paragraph) {
            $message->line(Str::squish($paragraph));
        }

        if ($actionUrl && $this->button_text) {
            $message->action(self::interpolate($this->button_text, $variables), $actionUrl);
        }

        if ($this->footer) {
            $message->line(self::interpolate($this->footer, $variables));
        }

        return $message->salutation('The '.$variables['app_name'].' team');
    }
}
