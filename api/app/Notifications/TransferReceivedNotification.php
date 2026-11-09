<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\Payment;
use App\Models\User;
use App\Support\FrontendLinks;

class TransferReceivedNotification extends BillingNotification
{
    public function __construct(public Payment $payment) {}

    public function template(): EmailTemplateKey
    {
        return EmailTemplateKey::TransferReceived;
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        return self::paymentVariables($this->payment) + [
        ];
    }

    protected function actionUrl(User $notifiable): string
    {
        return FrontendLinks::invoice($this->payment->invoice_id);
    }
}
