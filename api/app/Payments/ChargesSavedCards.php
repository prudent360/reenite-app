<?php

namespace App\Payments;

use App\Models\Payment;
use App\Models\PaymentMethod;

/**
 * Gateways that can charge a card the customer saved earlier, without them being present
 * (used for automatic renewals).
 */
interface ChargesSavedCards
{
    /**
     * @throws GatewayException
     */
    public function chargeSavedCard(Payment $payment, PaymentMethod $card): VerifiedPayment;
}
