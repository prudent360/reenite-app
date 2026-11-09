<?php

namespace App\Payments\Drivers;

use App\Models\PaymentGateway;
use App\Payments\GatewayDriver;
use App\Payments\GatewayException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Shared plumbing: credentials for one mode, an authenticated HTTP client and error handling.
 */
abstract class HttpDriver implements GatewayDriver
{
    /**
     * @param  string  $mode  test | live, the mode whose keys are used
     */
    public function __construct(protected PaymentGateway $gateway, protected string $mode) {}

    protected function credential(string $name, ?string $mode = null): ?string
    {
        return $this->gateway->credentialsFor($mode ?? $this->mode)[$name] ?? null;
    }

    protected function http(): PendingRequest
    {
        $secret = $this->credential('secret_key');

        if (! $secret) {
            throw new GatewayException("{$this->gateway->code->label()} isn't set up for {$this->mode} mode yet.");
        }

        return Http::withToken($secret)->acceptJson()->timeout(20);
    }

    /**
     * Sends a request and turns network or gateway failures into a GatewayException.
     *
     * @param  callable(PendingRequest): Response  $send
     */
    protected function call(callable $send, string $action): Response
    {
        $label = $this->gateway->code->label();

        try {
            $response = $send($this->http());
        } catch (ConnectionException) {
            throw new GatewayException("Couldn't reach {$label} to {$action}. Please try again.");
        }

        if ($response->failed()) {
            $detail = $response->json('message') ?? $response->json('error.message');
            throw new GatewayException("{$label} couldn't {$action}".($detail ? ": {$detail}" : '.'));
        }

        return $response;
    }

    /**
     * Webhooks can arrive for either mode on the same URL; try every mode with keys saved.
     *
     * @return list<string>
     */
    protected function configuredModes(): array
    {
        return array_values(array_filter(['live', 'test'], fn (string $mode) => filled($this->credential('secret_key', $mode))));
    }
}
