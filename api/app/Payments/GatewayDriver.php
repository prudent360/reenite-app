<?php

namespace App\Payments;

use App\Models\Payment;
use App\Models\User;
use Illuminate\Http\Request;

interface GatewayDriver
{
    /**
     * Starts a hosted checkout and returns where to send the customer.
     *
     * @throws GatewayException
     */
    public function initialize(Payment $payment, User $customer, string $returnUrl, string $cancelUrl): InitializedPayment;

    /**
     * Asks the gateway, server to server, what happened to the payment.
     *
     * @throws GatewayException
     */
    public function verify(Payment $payment): VerifiedPayment;

    public function hasValidWebhookSignature(Request $request): bool;

    public function webhookNotice(Request $request): ?WebhookNotice;

    /**
     * Refunds part or all of a settled payment. Returns the gateway's refund id.
     *
     * @throws GatewayException
     */
    public function refund(Payment $payment, int $amount): string;
}
