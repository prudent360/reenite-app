<?php

namespace App\Payments;

use App\Enums\PaymentGatewayCode;
use App\Models\PaymentGateway;
use App\Payments\Drivers\FlutterwaveDriver;
use App\Payments\Drivers\PaystackDriver;
use App\Payments\Drivers\StripeDriver;

class GatewayManager
{
    /**
     * A driver for the gateway. `$mode` defaults to the gateway's current mode; pass a payment's
     * own mode when verifying or refunding, since the gateway may have switched since.
     */
    public function driver(PaymentGateway $gateway, ?string $mode = null): GatewayDriver
    {
        $mode ??= $gateway->mode;

        return match ($gateway->code) {
            PaymentGatewayCode::Paystack => new PaystackDriver($gateway, $mode),
            PaymentGatewayCode::Flutterwave => new FlutterwaveDriver($gateway, $mode),
            PaymentGatewayCode::Stripe => new StripeDriver($gateway, $mode),
        };
    }

    public function for(string $code, ?string $mode = null): GatewayDriver
    {
        return $this->driver(PaymentGateway::where('code', $code)->firstOrFail(), $mode);
    }
}
