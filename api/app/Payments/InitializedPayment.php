<?php

namespace App\Payments;

/**
 * Where to send the customer to pay, plus the gateway's own id for the attempt (if any).
 */
final readonly class InitializedPayment
{
    public function __construct(public string $redirectUrl, public ?string $gatewayReference = null) {}
}
