<?php

namespace App\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\Invoice;
use App\Models\User;
use App\Support\FrontendLinks;
use App\Support\Money;

/**
 * An unpaid invoice is coming due, or is overdue.
 */
class InvoiceReminderNotification extends BillingNotification
{
    public function __construct(public Invoice $invoice, public string $when) {}

    public function template(): EmailTemplateKey
    {
        return EmailTemplateKey::InvoiceReminder;
    }

    /**
     * @return array<string, string>
     */
    protected function variables(User $notifiable): array
    {
        $this->invoice->loadMissing('items');
        $first = $this->invoice->items->first();

        return [
            'invoice_number' => (string) $this->invoice->number,
            'amount' => Money::format($this->invoice->balance()),
            'due_date' => $this->invoice->due_at?->format('j M Y') ?? 'on receipt',
            'when' => $this->when,
            'for' => $first ? $first->description.($this->invoice->items->count() > 1 ? ' and more' : '') : 'your order',
        ];
    }

    protected function actionUrl(User $notifiable): string
    {
        return FrontendLinks::invoice($this->invoice->id);
    }
}
