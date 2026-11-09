<?php

namespace App\Notifications;

use App\Models\Payment;
use App\Support\Money;

/**
 * Shared placeholder values for billing emails.
 */
abstract class BillingNotification extends TemplatedNotification
{
    public static function methodLabel(Payment $payment): string
    {
        return $payment->isBankTransfer() ? 'bank transfer' : ucfirst($payment->gateway);
    }

    /**
     * @return array<string, string>
     */
    protected static function paymentVariables(Payment $payment): array
    {
        return [
            'invoice_number' => (string) $payment->invoice->number,
            'amount' => Money::format($payment->amount),
            'receipt_number' => (string) $payment->receipt_number,
            'payment_method' => self::methodLabel($payment),
        ];
    }
}
