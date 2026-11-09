<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\Invoice;
use App\Models\User;
use App\Support\FrontendLinks;
use App\Support\Money;

class InvoiceIssuedNotification extends BillingNotification
{
    public function __construct(public Invoice $invoice) {}

    public function template(): EmailTemplateKey
    {
        return EmailTemplateKey::InvoiceIssued;
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        return [
            'invoice_number' => (string) $this->invoice->number,
            'amount' => Money::format($this->invoice->balance()),
            'due_date' => $this->invoice->due_at?->format('j M Y') ?? 'on receipt',
        ];
    }

    protected function actionUrl(User $notifiable): string
    {
        return FrontendLinks::invoice($this->invoice->id);
    }
}
