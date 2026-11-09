<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Crypt;

/**
 * Key/value application settings managed from the admin console.
 * Bound as a scoped singleton, so values are read once per request.
 */
class Settings
{
    /**
     * @var array<string, mixed>|null
     */
    private ?array $values = null;

    public function get(string $key, mixed $default = null): mixed
    {
        return array_key_exists($key, $this->all()) ? $this->all()[$key] : $default;
    }

    /**
     * Saves a value. Pass `$encrypted` for secrets such as SMTP passwords.
     */
    public function set(string $key, mixed $value, bool $encrypted = false): void
    {
        $json = json_encode($value);

        Setting::updateOrCreate(['key' => $key], [
            'value' => $encrypted ? Crypt::encryptString($json) : $json,
            'is_encrypted' => $encrypted,
        ]);

        $this->values = null;
    }

    /**
     * @return array<string, mixed>
     */
    private function all(): array
    {
        if ($this->values !== null) {
            return $this->values;
        }

        try {
            $rows = Setting::all();
        } catch (QueryException) {
            // Table not migrated yet (fresh install): fall back to defaults.
            return $this->values = [];
        }

        return $this->values = $rows->mapWithKeys(fn (Setting $setting) => [
            $setting->key => json_decode($setting->is_encrypted ? Crypt::decryptString($setting->value) : (string) $setting->value, true),
        ])->all();
    }
}
