<?php

namespace App\Http\Controllers\Api\V1\Admin\Settings;

use App\Http\Controllers\Controller;
use App\Support\MailSettings;
use App\Support\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

class MailSettingsController extends Controller
{
    public function __construct(private Settings $settings) {}

    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->current()]);
    }

    /**
     * A blank password keeps the saved one.
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'provider' => ['required', Rule::in(array_keys(MailSettings::PROVIDERS))],
            'host' => ['required_if:enabled,true', 'nullable', 'string', 'max:255', 'regex:/^[A-Za-z0-9.-]+$/'],
            'port' => ['required_if:enabled,true', 'nullable', 'integer', 'min:1', 'max:65535'],
            'encryption' => ['required', Rule::in(['tls', 'ssl'])],
            'username' => ['nullable', 'string', 'max:255'],
            'password' => ['nullable', 'string', 'max:500'],
            'from_address' => ['required', 'email', 'max:255'],
            'from_name' => ['required', 'string', 'max:100'],
        ], [
            'host.required_if' => 'Enter the SMTP host to turn sending on.',
            'port.required_if' => 'Enter the SMTP port to turn sending on.',
        ]);

        if ($validated['enabled'] && ! filled($validated['password'] ?? null) && ! filled($this->settings->get('mail.password'))) {
            abort(422, 'Enter the SMTP password (or API key) to turn sending on.');
        }

        foreach (['enabled', 'provider', 'host', 'port', 'encryption', 'username', 'from_address', 'from_name'] as $key) {
            $this->settings->set("mail.{$key}", $validated[$key] ?? null);
        }
        if (filled($validated['password'] ?? null)) {
            $this->settings->set('mail.password', $validated['password'], encrypted: true);
        }
        $this->settings->set('mail.configured', true);

        return response()->json(['data' => $this->current(), 'message' => 'Email settings saved.']);
    }

    /**
     * Sends a short test message with the saved settings and reports what happened.
     */
    public function test(Request $request): JsonResponse
    {
        $validated = $request->validate(['to' => ['required', 'email']]);

        MailSettings::apply();
        Mail::purge(config('mail.default'));

        try {
            Mail::raw(
                'This is a test email from '.config('app.name').". If you're reading it, your email settings work.",
                fn ($message) => $message->to($validated['to'])->subject(config('app.name').' test email'),
            );
        } catch (TransportExceptionInterface $exception) {
            abort(422, 'Sending failed: '.$exception->getMessage());
        }

        $logged = config('mail.default') === 'log';

        return response()->json([
            'message' => $logged
                ? 'Sending is switched off, so the test email was written to the server log instead of being delivered.'
                : "Test email sent to {$validated['to']}. Check the inbox (and spam folder).",
            'delivered' => ! $logged,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function current(): array
    {
        $configured = (bool) $this->settings->get('mail.configured', false);

        return [
            'configured' => $configured,
            'enabled' => (bool) $this->settings->get('mail.enabled', false),
            'provider' => $this->settings->get('mail.provider', 'resend'),
            'host' => $this->settings->get('mail.host'),
            'port' => $this->settings->get('mail.port'),
            'encryption' => $this->settings->get('mail.encryption', 'ssl'),
            'username' => $this->settings->get('mail.username'),
            'password_set' => filled($this->settings->get('mail.password')),
            'from_address' => $this->settings->get('mail.from_address', config('mail.from.address')),
            'from_name' => $this->settings->get('mail.from_name', config('app.name')),
            // Until saved here, the server's .env decides how mail is sent.
            'server_mailer' => $configured ? null : config('mail.default'),
            'providers' => collect(MailSettings::PROVIDERS)->map(fn (array $provider, string $key) => ['key' => $key] + $provider)->values(),
        ];
    }
}
