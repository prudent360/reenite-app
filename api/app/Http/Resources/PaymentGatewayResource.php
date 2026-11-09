<?php

namespace App\Http\Resources;

use App\Models\PaymentGateway;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Never exposes secrets: secret fields come back masked ("sk_test_••••1a2b").
 *
 * @mixin PaymentGateway
 */
class PaymentGatewayResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $masked = $this->maskedCredentials();

        return [
            'code' => $this->code->value,
            'label' => $this->code->label(),
            'description' => $this->code->description(),
            'dashboard_url' => $this->code->dashboardUrl(),
            'is_enabled' => $this->is_enabled,
            'mode' => $this->mode,
            'configured' => ['test' => $this->isConfigured('test'), 'live' => $this->isConfigured('live')],
            'fields' => collect(['test', 'live'])->mapWithKeys(fn (string $mode) => [
                $mode => collect($this->code->credentialFields($mode))->map(fn (array $field) => [
                    'name' => $field['name'],
                    'label' => $field['label'],
                    'secret' => $field['secret'],
                    'required' => $field['required'],
                    'prefix' => $field['prefix'][0] ?? null,
                    'help' => $field['help'],
                    'value' => $masked[$mode][$field['name']] ?? null,
                ])->all(),
            ])->all(),
            'webhook_url' => rtrim((string) config('app.url'), '/').'/api/v1/webhooks/'.$this->code->value,
            'verified_at' => $this->verified_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
