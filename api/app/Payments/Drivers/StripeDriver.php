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
 * Stripe Checkout Sessions. Stripe takes form-encoded requests; NGN amounts are in kobo.
 *
 * @see https://docs.stripe.com/api/checkout/sessions
 */
class StripeDriver extends HttpDriver
{
    private const BASE = 'https://api.stripe.com/v1';

    /**
     * Seconds a signed webhook stays valid, to stop replayed requests.
     */
    private const SIGNATURE_TOLERANCE = 300;

    public function initialize(Payment $payment, User $customer, string $returnUrl, string $cancelUrl): InitializedPayment
    {
        $separator = str_contains($returnUrl, '?') ? '&' : '?';

        $response = $this->call(fn ($http) => $http->asForm()->post(self::BASE.'/checkout/sessions', [
            'mode' => 'payment',
            'success_url' => $returnUrl.$separator.'session_id={CHECKOUT_SESSION_ID}',
            'cancel_url' => $cancelUrl,
            'customer_email' => $customer->email,
            'client_reference_id' => $payment->reference,
            'metadata' => ['reference' => $payment->reference, 'invoice' => $payment->invoice->number],
            'payment_intent_data' => ['metadata' => ['reference' => $payment->reference]],
            'line_items' => [[
                'quantity' => 1,
                'price_data' => [
                    'currency' => strtolower($payment->currency),
                    'unit_amount' => $payment->amount,
                    'product_data' => ['name' => config('app.name').' invoice '.$payment->invoice->number],
                ],
            ]],
        ]), 'start the payment');

        return new InitializedPayment($response->json('url'), $response->json('id'));
    }

    public function verify(Payment $payment): VerifiedPayment
    {
        if (! $payment->gateway_reference) {
            throw new GatewayException('This Stripe payment was never started.');
        }

        $session = $this->call(fn ($http) => $http->get(self::BASE.'/checkout/sessions/'.rawurlencode($payment->gateway_reference)), 'check the payment')->json();

        return new VerifiedPayment(
            status: match (true) {
                ($session['payment_status'] ?? null) === 'paid' => 'success',
                ($session['status'] ?? null) === 'expired' => 'abandoned',
                default => 'pending',
            },
            amount: (int) ($session['amount_total'] ?? 0),
            currency: strtoupper((string) ($session['currency'] ?? '')),
            channel: 'card',
            gatewayReference: $session['id'] ?? $payment->gateway_reference,
            data: array_filter(['payment_intent' => $session['payment_intent'] ?? null]),
        );
    }

    /**
     * Stripe-Signature: t=timestamp,v1=HMAC-SHA256("{t}.{body}") with the endpoint's signing secret.
     */
    public function hasValidWebhookSignature(Request $request): bool
    {
        $parts = collect(explode(',', (string) $request->header('Stripe-Signature')))
            ->mapToGroups(function (string $part) {
                [$key, $value] = array_pad(explode('=', trim($part), 2), 2, '');

                return [$key => $value];
            });

        $timestamp = (int) ($parts->get('t')?->first() ?? 0);
        if (! $timestamp || abs(time() - $timestamp) > self::SIGNATURE_TOLERANCE) {
            return false;
        }

        foreach (['live', 'test'] as $mode) {
            $secret = $this->credential('webhook_secret', $mode);
            if (! $secret) {
                continue;
            }
            $expected = hash_hmac('sha256', $timestamp.'.'.$request->getContent(), $secret);
            foreach ($parts->get('v1', collect()) as $signature) {
                if (hash_equals($expected, $signature)) {
                    return true;
                }
            }
        }

        return false;
    }

    public function webhookNotice(Request $request): ?WebhookNotice
    {
        $type = (string) $request->input('type');
        $reference = $request->input('data.object.client_reference_id') ?? $request->input('data.object.metadata.reference');

        if (! str_starts_with($type, 'checkout.session.') || ! $reference || ! $request->input('id')) {
            return null;
        }

        return new WebhookNotice((string) $request->input('id'), $type, $reference);
    }

    public function refund(Payment $payment, int $amount): string
    {
        $intent = $payment->gateway_data['payment_intent'] ?? null;
        if (! $intent) {
            throw new GatewayException('This payment has no Stripe payment intent, so it must be refunded manually.');
        }

        $response = $this->call(
            fn ($http) => $http->asForm()->post(self::BASE.'/refunds', ['payment_intent' => $intent, 'amount' => $amount]),
            'refund the payment',
        );

        return (string) $response->json('id');
    }
}
