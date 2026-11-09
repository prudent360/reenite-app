<?php

namespace App\Payments;

/**
 * The gateway's server-side answer about a payment. `status` is one of
 * success | failed | abandoned | pending. Amounts are in kobo.
 */
final readonly class VerifiedPayment
{
    /**
     * @param  array<string, mixed>  $data  minimal details worth keeping (ids, channel, paid time), never card data
     */
    public function __construct(
        public string $status,
        public int $amount,
        public string $currency,
        public ?string $channel = null,
        public ?string $gatewayReference = null,
        public array $data = [],
        public ?string $message = null,
    ) {}
}
