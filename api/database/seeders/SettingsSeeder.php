<?php

namespace Database\Seeders;

use App\Enums\EmailTemplateKey;
use App\Enums\PaymentGatewayCode;
use App\Models\EmailTemplate;
use App\Models\PaymentGateway;
use Illuminate\Database\Seeder;

/**
 * Creates the gateway rows (switched off, no keys) and default email templates.
 * Only fills in what's missing, so it never overwrites an admin's changes.
 */
class SettingsSeeder extends Seeder
{
    public function run(): void
    {
        foreach (PaymentGatewayCode::cases() as $order => $code) {
            PaymentGateway::firstOrCreate(['code' => $code->value], ['sort_order' => $order, 'is_enabled' => false, 'mode' => 'test']);
        }

        foreach (EmailTemplateKey::cases() as $key) {
            EmailTemplate::firstOrCreate(['key' => $key->value], $key->defaults() + ['is_enabled' => true]);
        }
    }
}
