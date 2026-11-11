<?php

namespace App\Payments\Drivers;

use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\User;
use App\Payments\ChargesSavedCards;
use App\Payments\InitializedPayment;
use App\Payments\VerifiedPayment;
use App\Payments\WebhookNotice;
use Illuminate\Http\Request;

/**
 * Paystack Standard (hosted checkout). Amounts are sent in kobo.
 *
 * @see https://paystack.com/docs/api/transaction/
 */
class PaystackDriver extends HttpDriver implements ChargesSavedCards
{
    private const BASE = 'https://api.paystack.co';

    public function initialize(Payment $payment, User $customer, string $returnUrl, string $cancelUrl): InitializedPayment
    {
        $response = $this->call(fn ($http) => $http->post(self::BASE.'/transaction/initialize', [
            'email' => $customer->email,
            'amount' => $payment->amount,
            'currency' => $payment->currency,
            'reference' => $payment->reference,
            'callback_url' => $returnUrl,
            'metadata' => [
                'invoice' => $payment->invoice->number,
                'cancel_action' => $cancelUrl,
            ],
        ]), 'start the payment');

        return new InitializedPayment($response->json('data.authorization_url'), $response->json('data.access_code'));
    }

    public function verify(Payment $payment): VerifiedPayment
    {
        $data = $this->call(fn ($http) => $http->get(self::BASE.'/transaction/verify/'.rawurlencode($payment->reference)), 'check the payment')->json('data');

        return $this->toVerified($data);
    }

    /**
     * Charges a saved card for a renewal. Paystack answers straight away.
     *
     * @see https://paystack.com/docs/payments/recurring-charges/
     */
    public function chargeSavedCard(Payment $payment, PaymentMethod $card): VerifiedPayment
    {
        $data = $this->call(fn ($http) => $http->post(self::BASE.'/transaction/charge_authorization', [
            'authorization_code' => $card->authorization_code,
            'email' => $card->email,
            'amount' => $payment->amount,
            'currency' => $payment->currency,
            'reference' => $payment->reference,
            'metadata' => ['invoice' => $payment->invoice->number, 'renewal' => true],
        ]), 'charge the saved card')->json('data');

        return $this->toVerified($data ?? []);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function toVerified(array $data): VerifiedPayment
    {
        $authorization = $data['authorization'] ?? [];
        $reusable = ($authorization['reusable'] ?? false) && ($authorization['channel'] ?? $data['channel'] ?? null) === 'card' && filled($authorization['authorization_code'] ?? null);

        return new VerifiedPayment(
            status: match ($data['status'] ?? null) {
                'success' => 'success',
                'failed', 'reversed' => 'failed',
                'abandoned' => 'abandoned',
                default => 'pending',
            },
            amount: (int) ($data['amount'] ?? 0),
            currency: strtoupper((string) ($data['currency'] ?? '')),
            channel: $data['channel'] ?? null,
            gatewayReference: isset($data['id']) ? (string) $data['id'] : null,
            data: array_filter(['transaction_id' => $data['id'] ?? null, 'paid_at' => $data['paid_at'] ?? null]),
            message: $data['gateway_response'] ?? null,
            reusableCard: $reusable ? [
                'authorization_code' => (string) $authorization['authorization_code'],
                'signature' => $authorization['signature'] ?? null,
                'email' => (string) ($data['customer']['email'] ?? ''),
                'brand' => isset($authorization['card_type']) ? trim((string) $authorization['card_type']) : null,
                'last4' => (string) ($authorization['last4'] ?? ''),
                'exp_month' => isset($authorization['exp_month']) ? (string) $authorization['exp_month'] : null,
                'exp_year' => isset($authorization['exp_year']) ? (string) $authorization['exp_year'] : null,
                'bank' => $authorization['bank'] ?? null,
            ] : null,
        );
    }

    /**
     * Paystack signs the raw body with HMAC-SHA512 using the secret key.
     */
    public function hasValidWebhookSignature(Request $request): bool
    {
        $signature = (string) $request->header('x-paystack-signature');

        foreach ($this->configuredModes() as $mode) {
            if ($signature && hash_equals(hash_hmac('sha512', $request->getContent(), (string) $this->credential('secret_key', $mode)), $signature)) {
                return true;
            }
        }

        return false;
    }

    public function webhookNotice(Request $request): ?WebhookNotice
    {
        $event = (string) $request->input('event');
        $reference = $request->input('data.reference');

        if (! str_starts_with($event, 'charge.') || ! $reference) {
            return null;
        }

        return new WebhookNotice($event.':'.($request->input('data.id') ?? $reference), $event, $reference);
    }

    public function refund(Payment $payment, int $amount): string
    {
        $response = $this->call(fn ($http) => $http->post(self::BASE.'/refund', [
            'transaction' => $payment->reference,
            'amount' => $amount,
        ]), 'refund the payment');

        return (string) $response->json('data.id');
    }
}
