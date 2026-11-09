<?php

namespace App\Models;

use App\Enums\PaymentGatewayCode;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

#[Fillable(['code', 'is_enabled', 'mode', 'credentials', 'sort_order', 'verified_at', 'updated_by'])]
#[Hidden(['credentials'])]
class PaymentGateway extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'code' => PaymentGatewayCode::class,
            'is_enabled' => 'boolean',
            'credentials' => 'encrypted:array',
            'sort_order' => 'integer',
            'verified_at' => 'datetime',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function credentialsFor(?string $mode = null): array
    {
        return $this->credentials[$mode ?? $this->mode] ?? [];
    }

    /**
     * True when every required key for the mode is present.
     */
    public function isConfigured(?string $mode = null): bool
    {
        $mode ??= $this->mode;
        $values = $this->credentialsFor($mode);

        return collect($this->code->credentialFields($mode))
            ->where('required', true)
            ->every(fn (array $field) => filled($values[$field['name']] ?? null));
    }

    /**
     * Credentials safe to show in the admin: public keys in full, secrets as "sk_test_••••1a2b".
     *
     * @return array<string, array<string, string|null>>
     */
    public function maskedCredentials(): array
    {
        return collect(['test', 'live'])->mapWithKeys(fn (string $mode) => [
            $mode => collect($this->code->credentialFields($mode))->mapWithKeys(function (array $field) use ($mode) {
                $value = $this->credentialsFor($mode)[$field['name']] ?? null;

                return [$field['name'] => $value && $field['secret'] ? self::mask($value) : $value];
            })->all(),
        ])->all();
    }

    /**
     * Keeps a known key prefix (sk_test_, FLWSECK_TEST-, whsec_...) and the last 4 characters.
     * Short values are hidden completely.
     */
    public static function mask(string $value): string
    {
        if (Str::length($value) <= 12) {
            return '••••••••';
        }

        $prefix = Str::match('/^((?:pk|sk|rk)_(?:test|live)_|FLW(?:PUBK|SECK)(?:_TEST)?-|whsec_)/', $value);

        return $prefix.'••••'.Str::substr($value, -4);
    }
}
