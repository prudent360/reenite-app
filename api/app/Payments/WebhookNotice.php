<?php

namespace App\Payments;

/**
 * What a webhook is about. Payments are always re-verified with the gateway's API,
 * so only identifiers are taken from the payload.
 */
final readonly class WebhookNotice
{
    public function __construct(public string $key, public string $type, public ?string $reference) {}
}
