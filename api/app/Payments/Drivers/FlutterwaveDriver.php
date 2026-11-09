<?php

namespace App\Payments\Drivers;

use App\Models\Payment;
use App\Models\User;
use App\Payments\GatewayException;
use App\Payments\InitializedPayment;
use App\Payments\VerifiedPayment;
use App\Payments\WebhookNotice;
use Illuminate\Http\Request;

/**
 * Flutterwave Standard (v3). Amounts are sent in naira, not kobo.
 *
 * @see https://developer.flutterwave.com/docs/collecting-payments/standard
 */
class FlutterwaveDriver extends HttpDriver
{
    private const BASE = 'https://api.flutterwave.com/v3';

    public function initialize(Payment $payment, User $customer, string $returnUrl, string $cancelUrl): InitializedPayment
    {
        $response = $this->call(fn ($http) => $http->post(self::BASE.'/payments', [
            'tx_ref' => $payment->reference,
            'amount' => $payment->amount / 100,
            'currency' => $payment->currency,
            'redirect_url' => $returnUrl,
            'customer' => array_filter(['email' => $customer->email, 'name' => $customer->name, 'phonenumber' => $customer->phone]),
            'customizations' => ['title' => config('app.name'), 'description' => 'Invoice '.$payment->invoice->number],
            'meta' => ['invoice' => $payment->invoice->number],
        ]), 'start the payment');

        return new InitializedPayment($response->json('data.link'));
    }

    public function verify(Payment $payment): VerifiedPayment
    {
        $response = $this->call(
            fn ($http) => $http->get(self::BASE.'/transactions/verify_by_reference', ['tx_ref' => $payment->reference]),
            'check the payment',
        );
        $data = $response->json('data') ?? [];

        return new VerifiedPayment(
            status: match ($data['status'] ?? null) {
                'successful' => 'success',
                'failed' => 'failed',
                'cancelled' => 'abandoned',
                default => 'pending',
            },
            amount: (int) round(((float) ($data['amount'] ?? 0)) * 100),
            currency: strtoupper((string) ($data['currency'] ?? '')),
            channel: $data['payment_type'] ?? null,
            gatewayReference: isset($data['id']) ? (string) $data['id'] : null,
            data: array_filter(['transaction_id' => $data['id'] ?? null, 'flw_ref' => $data['flw_ref'] ?? null]),
            message: $data['processor_response'] ?? null,
        );
    }

    /**
     * Flutterwave sends the secret hash you chose in the "verif-hash" header.
     */
    public function hasValidWebhookSignature(Request $request): bool
    {
        $received = (string) $request->header('verif-hash');

        foreach (['live', 'test'] as $mode) {
            $expected = $this->credential('webhook_secret', $mode);
            if ($expected && $received && hash_equals($expected, $received)) {
                return true;
            }
        }

        return false;
    }

    public function webhookNotice(Request $request): ?WebhookNotice
    {
        $reference = $request->input('data.tx_ref') ?? $request->input('txRef');
        if (! $reference) {
            return null;
        }

        $type = (string) ($request->input('event') ?? $request->input('event.type') ?? 'charge.completed');

        return new WebhookNotice($type.':'.($request->input('data.id') ?? $request->input('id') ?? $reference), $type, $reference);
    }

    public function refund(Payment $payment, int $amount): string
    {
        $transactionId = $payment->gateway_data['transaction_id'] ?? $payment->gateway_reference;
        if (! $transactionId) {
            throw new GatewayException('This payment has no Flutterwave transaction id, so it must be refunded manually.');
        }

        $response = $this->call(
            fn ($http) => $http->post(self::BASE.'/transactions/'.rawurlencode((string) $transactionId).'/refund', ['amount' => $amount / 100]),
            'refund the payment',
        );

        return (string) $response->json('data.id');
    }
}
