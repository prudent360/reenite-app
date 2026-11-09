<?php

namespace App\Http\Controllers\Api\V1\Admin\Settings;

use App\Enums\EmailTemplateKey;
use App\Http\Controllers\Controller;
use App\Http\Resources\EmailTemplateResource;
use App\Models\EmailTemplate;
use App\Notifications\TemplatedNotification;
use App\Support\FrontendLinks;
use App\Support\MailSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Validator;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

class EmailTemplateController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return EmailTemplateResource::collection(array_map($this->template(...), EmailTemplateKey::cases()));
    }

    public function update(Request $request, EmailTemplateKey $key): EmailTemplateResource
    {
        $template = $this->template($key);
        $template->fill($this->validated($request, $key) + ['updated_by' => $request->user()->id])->save();

        return new EmailTemplateResource($template);
    }

    public function reset(Request $request, EmailTemplateKey $key): EmailTemplateResource
    {
        $template = $this->template($key);
        $template->fill($key->defaults() + ['updated_by' => $request->user()->id])->save();

        return new EmailTemplateResource($template);
    }

    /**
     * Renders unsaved edits exactly as the email will look, with sample values.
     */
    public function preview(Request $request, EmailTemplateKey $key): JsonResponse
    {
        $draft = new EmailTemplate($this->validated($request, $key) + ['key' => $key]);
        $message = $draft->toMailMessage($this->sampleVariables($key, $request->user()->name), FrontendLinks::base());

        return response()->json(['subject' => $message->subject, 'html' => (string) $message->render()]);
    }

    /**
     * Sends the saved template, filled with sample values, to the signed-in admin.
     */
    public function test(Request $request, EmailTemplateKey $key): JsonResponse
    {
        $message = $this->template($key)->toMailMessage($this->sampleVariables($key, $request->user()->name), FrontendLinks::base());

        MailSettings::apply();
        Mail::purge(config('mail.default'));

        try {
            Mail::html((string) $message->render(), fn ($mail) => $mail->to($request->user()->email)->subject('[Test] '.$message->subject));
        } catch (TransportExceptionInterface $exception) {
            abort(422, 'Sending failed: '.$exception->getMessage());
        }

        return response()->json([
            'message' => config('mail.default') === 'log'
                ? 'Sending is switched off, so the test was written to the server log.'
                : "Test sent to {$request->user()->email}.",
        ]);
    }

    private function template(EmailTemplateKey $key): EmailTemplate
    {
        return EmailTemplate::firstOrCreate(['key' => $key->value], $key->defaults() + ['is_enabled' => true]);
    }

    /**
     * @return array{subject: string, heading: string, body: string, button_text: string|null, footer: string|null, is_enabled: bool}
     */
    private function validated(Request $request, EmailTemplateKey $key): array
    {
        $allowed = array_keys($key->placeholders() + ['app_name' => '']);

        $validated = validator($request->all(), [
            'subject' => ['required', 'string', 'max:200'],
            'heading' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:5000'],
            'button_text' => ['nullable', 'string', 'max:60'],
            'footer' => ['nullable', 'string', 'max:500'],
            'is_enabled' => ['boolean'],
        ])->after(function (Validator $validator) use ($request, $allowed) {
            foreach (['subject', 'heading', 'body', 'button_text', 'footer'] as $field) {
                preg_match_all('/\{\{\s*([a-z_]+)\s*\}\}/', (string) $request->input($field), $matches);
                $unknown = array_diff($matches[1], $allowed);
                if ($unknown) {
                    $validator->errors()->add($field, 'Unknown placeholder: {{'.implode('}}, {{', $unknown).'}}. Use one of the listed placeholders.');
                }
            }
        })->validate();

        return $validated + ['is_enabled' => true];
    }

    /**
     * @return array<string, string>
     */
    private function sampleVariables(EmailTemplateKey $key, string $adminName): array
    {
        $samples = [
            'expires_minutes' => '60',
            'role' => 'Filing Officer',
            'invited_by' => $adminName,
            'changed_at' => now()->timezone((string) config('app.display_timezone'))->format('j M Y, g:ia').' (Lagos time)',
            'invoice_number' => 'INV-2026-000184',
            'amount' => '₦105,000',
            'due_date' => now()->addDays(7)->format('j M Y'),
            'receipt_number' => 'RCT-2026-000231',
            'payment_method' => 'Paystack',
            'reason' => 'The amount on the receipt did not match the invoice.',
            'order_reference' => 'RN-2026-000184',
            'service_name' => 'Limited Liability Company (LTD)',
            'stage_name' => 'Filed with CAC',
            'message' => 'Please upload a clearer passport photograph. The current one is blurry.',
            'officer_name' => 'Ekemini',
            'booking_reference' => 'BK-2026-000042',
            'space_name' => 'Podcast Studio',
            'location_name' => 'Reenite Uyo',
            'location_address' => '162 Oron Road, Opposite Kilimanjaro, Uyo',
            'booking_date' => now()->addDays(2)->format('l j M Y'),
            'booking_time' => '10:00am to 12:00pm',
            'guests' => '2',
            'check_in_code' => 'K7Q4-2M',
            'cancellation_policy' => 'Full refund if cancelled 24+ hours before. No refund after that.',
            'hold_expires' => now()->addMinutes(30)->format('g:ia'),
            'refund_amount' => '₦14,000',
            'email' => 'aniekan@example.com',
            'pass_name' => '3 days a week',
            'allowance' => '3 visits a week',
            'valid_until' => now()->addDays(6)->format('j M Y'),
            'credits_left' => '2 visits',
            'plan_name' => 'Pro',
            'discount' => '15%',
            'renews_on' => now()->addMonth()->format('j M Y'),
            'customer_name' => 'Aniekan Bassey',
            'assigned_by' => $adminName,
        ];

        return array_intersect_key($samples, $key->placeholders()) + TemplatedNotification::nameVariables('Aniekan Bassey');
    }
}
