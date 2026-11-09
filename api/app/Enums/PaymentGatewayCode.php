<?php

namespace App\Enums;

/**
 * Supported online payment gateways and what each one needs to be configured.
 */
enum PaymentGatewayCode: string
{
    case Paystack = 'paystack';
    case Flutterwave = 'flutterwave';
    case Stripe = 'stripe';

    public function label(): string
    {
        return match ($this) {
            self::Paystack => 'Paystack',
            self::Flutterwave => 'Flutterwave',
            self::Stripe => 'Stripe',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::Paystack => 'Cards, bank transfer, USSD and Opay for Nigerian customers.',
            self::Flutterwave => 'Cards, bank transfer, USSD and mobile money across Africa.',
            self::Stripe => 'Cards and wallets for customers paying from abroad.',
        };
    }

    public function dashboardUrl(): string
    {
        return match ($this) {
            self::Paystack => 'https://dashboard.paystack.com/#/settings/developers',
            self::Flutterwave => 'https://app.flutterwave.com/dashboard/settings/apis',
            self::Stripe => 'https://dashboard.stripe.com/apikeys',
        };
    }

    /**
     * Credential fields per mode. `prefix` is what a valid key starts with, so obvious
     * mistakes (a live key in test mode, a public key in the secret field) are caught early.
     *
     * @return list<array{name: string, label: string, secret: bool, required: bool, prefix: list<string>|null, help: string|null}>
     */
    public function credentialFields(string $mode): array
    {
        $live = $mode === 'live';

        return match ($this) {
            self::Paystack => [
                ['name' => 'public_key', 'label' => 'Public key', 'secret' => false, 'required' => true, 'prefix' => [$live ? 'pk_live_' : 'pk_test_'], 'help' => null],
                ['name' => 'secret_key', 'label' => 'Secret key', 'secret' => true, 'required' => true, 'prefix' => [$live ? 'sk_live_' : 'sk_test_'], 'help' => 'Also used to verify webhook signatures.'],
            ],
            self::Flutterwave => [
                ['name' => 'public_key', 'label' => 'Public key', 'secret' => false, 'required' => true, 'prefix' => [$live ? 'FLWPUBK-' : 'FLWPUBK_TEST-'], 'help' => null],
                ['name' => 'secret_key', 'label' => 'Secret key', 'secret' => true, 'required' => true, 'prefix' => [$live ? 'FLWSECK-' : 'FLWSECK_TEST-'], 'help' => null],
                ['name' => 'webhook_secret', 'label' => 'Webhook secret hash', 'secret' => true, 'required' => false, 'prefix' => null, 'help' => 'The secret hash you set under Webhooks in your Flutterwave dashboard.'],
            ],
            self::Stripe => [
                ['name' => 'public_key', 'label' => 'Publishable key', 'secret' => false, 'required' => true, 'prefix' => [$live ? 'pk_live_' : 'pk_test_'], 'help' => null],
                ['name' => 'secret_key', 'label' => 'Secret key', 'secret' => true, 'required' => true, 'prefix' => [$live ? 'sk_live_' : 'sk_test_', $live ? 'rk_live_' : 'rk_test_'], 'help' => null],
                ['name' => 'webhook_secret', 'label' => 'Webhook signing secret', 'secret' => true, 'required' => false, 'prefix' => ['whsec_'], 'help' => 'From the webhook endpoint you create in Stripe.'],
            ],
        };
    }

    /**
     * Read-only endpoint used by "Test connection": succeeds only with a valid secret key.
     */
    public function verificationUrl(): string
    {
        return match ($this) {
            self::Paystack => 'https://api.paystack.co/balance',
            self::Flutterwave => 'https://api.flutterwave.com/v3/balances',
            self::Stripe => 'https://api.stripe.com/v1/balance',
        };
    }
}
