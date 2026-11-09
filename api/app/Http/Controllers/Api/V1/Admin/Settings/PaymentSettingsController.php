<?php

namespace App\Http\Controllers\Api\V1\Admin\Settings;

use App\Enums\PaymentGatewayCode;
use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentGatewayResource;
use App\Models\BankAccount;
use App\Models\PaymentGateway;
use App\Support\Settings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PaymentSettingsController extends Controller
{
    public function __construct(private Settings $settings) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'gateways' => PaymentGatewayResource::collection($this->gateways()),
            'bank_transfer' => $this->bankTransfer(),
        ]);
    }

    /**
     * Saves mode, on/off and keys. Blank key fields keep the stored value, so admins
     * never have to re-enter secrets they can't see.
     */
    public function updateGateway(Request $request, PaymentGateway $gateway): PaymentGatewayResource
    {
        $validated = $request->validate([
            'is_enabled' => ['required', 'boolean'],
            'mode' => ['required', Rule::in(['test', 'live'])],
            'credentials' => ['nullable', 'array'],
            'credentials.test' => ['nullable', 'array'],
            'credentials.live' => ['nullable', 'array'],
            'credentials.*.*' => ['nullable', 'string', 'max:500'],
        ]);

        $credentials = $gateway->credentials ?? [];
        $changedModes = [];

        foreach (['test', 'live'] as $mode) {
            foreach ($gateway->code->credentialFields($mode) as $field) {
                $value = trim((string) ($validated['credentials'][$mode][$field['name']] ?? ''));
                if ($value === '') {
                    continue;
                }
                if ($field['prefix'] && ! Str::startsWith($value, $field['prefix'])) {
                    throw ValidationException::withMessages([
                        "credentials.{$mode}.{$field['name']}" => "This doesn't look like a {$mode} {$field['label']}. It should start with {$field['prefix'][0]}",
                    ]);
                }
                if (($credentials[$mode][$field['name']] ?? null) !== $value) {
                    $credentials[$mode][$field['name']] = $value;
                    $changedModes[$mode] = true;
                }
            }
        }

        $gateway->fill([
            'mode' => $validated['mode'],
            'credentials' => $credentials,
            'updated_by' => $request->user()->id,
        ]);

        if ($validated['is_enabled'] && ! $gateway->isConfigured()) {
            throw ValidationException::withMessages([
                'is_enabled' => "Add your {$validated['mode']} keys before turning {$gateway->code->label()} on.",
            ]);
        }

        // A new mode or new keys haven't been tested yet.
        if ($gateway->isDirty('mode') || isset($changedModes[$validated['mode']])) {
            $gateway->verified_at = null;
        }

        $gateway->is_enabled = $validated['is_enabled'];
        $gateway->save();

        return new PaymentGatewayResource($gateway);
    }

    /**
     * Calls a read-only gateway endpoint with the current mode's secret key.
     */
    public function testGateway(PaymentGateway $gateway): JsonResponse
    {
        $secret = $gateway->credentialsFor()['secret_key'] ?? null;
        $label = $gateway->code->label();

        abort_unless($secret, 422, "Save your {$gateway->mode} secret key first.");

        try {
            $response = Http::withToken($secret)->acceptJson()->timeout(10)->get($gateway->code->verificationUrl());
        } catch (ConnectionException) {
            abort(502, "Couldn't reach {$label}. Check the server's internet connection and try again.");
        }

        if ($response->status() === 401 || $response->status() === 403) {
            abort(422, "{$label} rejected the {$gateway->mode} secret key. Copy it again from your {$label} dashboard.");
        }

        abort_unless($response->successful(), 502, "{$label} returned an unexpected error ({$response->status()}). Try again shortly.");

        $gateway->forceFill(['verified_at' => now()])->save();

        return response()->json([
            'message' => "Connected to {$label} in {$gateway->mode} mode.",
            'gateway' => new PaymentGatewayResource($gateway),
        ]);
    }

    public function updateBankTransfer(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'instructions' => ['nullable', 'string', 'max:2000'],
        ]);

        if ($validated['enabled'] && ! BankAccount::active()->exists()) {
            throw ValidationException::withMessages(['enabled' => 'Add at least one active bank account before turning on bank transfer.']);
        }

        $this->settings->set('bank_transfer.enabled', $validated['enabled']);
        $this->settings->set('bank_transfer.instructions', $validated['instructions'] ?? null);

        return response()->json(['bank_transfer' => $this->bankTransfer()]);
    }

    /**
     * All supported gateways, creating rows for any that are missing.
     *
     * @return Collection<int, PaymentGateway>
     */
    private function gateways()
    {
        foreach (PaymentGatewayCode::cases() as $order => $code) {
            PaymentGateway::firstOrCreate(['code' => $code->value], ['sort_order' => $order]);
        }

        return PaymentGateway::orderBy('sort_order')->get();
    }

    /**
     * @return array<string, mixed>
     */
    private function bankTransfer(): array
    {
        return [
            'enabled' => (bool) $this->settings->get('bank_transfer.enabled', false),
            'instructions' => $this->settings->get('bank_transfer.instructions'),
            'accounts' => BankAccount::orderBy('sort_order')->orderBy('id')->get(['id', 'bank_name', 'account_name', 'account_number', 'is_active', 'sort_order']),
        ];
    }
}
