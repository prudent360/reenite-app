<?php

namespace App\Http\Controllers\Api\V1\Admin\Settings;

use App\Enums\EmailTemplateKey;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Settings;
use App\Support\WhatsApp;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;

/**
 * WhatsApp Cloud API settings: the business phone number ID, access token, and the approved
 * template to use for each event.
 */
class WhatsAppSettingsController extends Controller
{
    public function __construct(private Settings $settings, private WhatsApp $whatsApp) {}

    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->current()]);
    }

    /**
     * A blank access token keeps the saved one.
     */
    public function update(Request $request): JsonResponse
    {
        $events = collect(EmailTemplateKey::cases())->filter(fn (EmailTemplateKey $key) => $key->whatsappParameters() !== null)->map->value->values()->all();
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'phone_number_id' => ['required_if:enabled,true', 'nullable', 'string', 'max:40', 'regex:/^[0-9]+$/'],
            'access_token' => ['nullable', 'string', 'max:1000'],
            'language' => ['required', 'string', 'max:10', 'regex:/^[a-z]{2,3}(_[A-Z]{2})?$/'],
            'templates' => ['present', 'array'],
            'templates.*' => ['nullable', 'string', 'max:512', 'regex:/^[a-z0-9_]+$/'],
        ], [
            'phone_number_id.required_if' => 'Enter the phone number ID from Meta to turn WhatsApp on.',
            'phone_number_id.regex' => 'The phone number ID is numbers only (it is not the phone number itself).',
            'language.regex' => 'Use a language code like en or en_US, matching your templates.',
            'templates.*.regex' => 'Template names are lowercase letters, numbers and underscores, exactly as in Meta.',
        ]);

        abort_if(array_diff(array_keys($validated['templates']), $events) !== [], 422, 'One of the events cannot be sent on WhatsApp.');
        if ($validated['enabled'] && ! filled($validated['access_token'] ?? null) && ! filled($this->settings->get('whatsapp.access_token'))) {
            abort(422, 'Enter the access token to turn WhatsApp on.');
        }

        $this->settings->set('whatsapp.enabled', $validated['enabled']);
        $this->settings->set('whatsapp.phone_number_id', $validated['phone_number_id'] ?? null);
        $this->settings->set('whatsapp.language', $validated['language']);
        $this->settings->set('whatsapp.templates', array_filter($validated['templates'], 'filled'));
        if (filled($validated['access_token'] ?? null)) {
            $this->settings->set('whatsapp.access_token', $validated['access_token'], encrypted: true);
        }

        return response()->json(['data' => $this->current(), 'message' => 'WhatsApp settings saved.']);
    }

    /**
     * Sends one template to a number, to check the settings and a template work.
     * Meta's ready-made "hello_world" template (English, en_US) works on every new account.
     */
    public function test(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'to' => ['required', 'string', 'max:20', 'regex:/^\+?[0-9\s-]{7,20}$/'],
            'event' => ['nullable', Rule::in(collect(EmailTemplateKey::cases())->filter(fn (EmailTemplateKey $key) => $key->whatsappParameters() !== null)->map->value->values()->all())],
        ]);
        abort_unless(filled($this->settings->get('whatsapp.phone_number_id')) && filled($this->settings->get('whatsapp.access_token')), 422, 'Save the phone number ID and access token first.');

        $key = isset($validated['event']) ? EmailTemplateKey::from($validated['event']) : null;
        $template = $key ? $this->whatsApp->templateFor($key) : 'hello_world';
        abort_unless($template, 422, 'Enter and save the template name for that event first.');
        $parameters = $key ? array_map(fn (string $placeholder) => $this->sample($placeholder), $key->whatsappParameters() ?? []) : [];

        try {
            $this->whatsApp->send($validated['to'], $template, $parameters, $key ? null : 'en_US');
        } catch (RequestException $exception) {
            $error = $exception->response->json('error.error_user_msg') ?? $exception->response->json('error.message') ?? 'Meta refused the message.';
            abort(422, "WhatsApp said: {$error}");
        }

        return response()->json(['message' => "Test message sent to {$validated['to']}. It can take a minute to arrive."]);
    }

    private function sample(string $placeholder): string
    {
        return Arr::get([
            'first_name' => 'Ada', 'space_name' => 'Meeting Room', 'booking_date' => 'Thursday 12 November 2026', 'booking_time' => '10:00am to 12:00pm',
            'check_in_code' => 'K7Q2MX', 'invoice_number' => 'INV-2026-000123', 'amount' => '₦20,000', 'due_date' => '12 Nov 2026',
            'service_name' => 'Business Name registration', 'order_reference' => 'RN-2026-000041', 'stage_name' => 'Filed with CAC',
            'mail_kind' => 'letter', 'sender' => 'Corporate Affairs Commission', 'mailbox_number' => 'RN-0012',
            'deadline' => 'File VAT return', 'business_name' => 'Obi Foods Ltd', 'consultation_name' => 'Tax and compliance review',
            'consultation_date' => 'Thursday 12 November 2026', 'consultation_time' => '10:00am to 11:00am',
        ], $placeholder, 'Sample');
    }

    /**
     * @return array<string, mixed>
     */
    private function current(): array
    {
        $templates = $this->settings->get('whatsapp.templates', []) ?? [];

        return [
            'enabled' => (bool) $this->settings->get('whatsapp.enabled', false),
            'phone_number_id' => $this->settings->get('whatsapp.phone_number_id'),
            'access_token_set' => filled($this->settings->get('whatsapp.access_token')),
            'language' => $this->settings->get('whatsapp.language', 'en'),
            'configured' => $this->whatsApp->isConfigured(),
            'opted_in_customers' => User::query()->where('type', User::TYPE_CUSTOMER)->whereNotNull('whatsapp_opt_in_at')->whereNotNull('phone')->count(),
            'events' => collect(EmailTemplateKey::cases())
                ->filter(fn (EmailTemplateKey $key) => $key->whatsappParameters() !== null)
                ->map(fn (EmailTemplateKey $key) => [
                    'key' => $key->value,
                    'name' => $key->name(),
                    'group' => $key->group(),
                    'template' => $templates[$key->value] ?? null,
                    'parameters' => array_map(fn (string $placeholder) => ['key' => $placeholder, 'label' => $key->placeholders()[$placeholder] ?? $placeholder], $key->whatsappParameters() ?? []),
                ])
                ->values(),
        ];
    }
}
