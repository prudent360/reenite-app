<?php

namespace App\Payments;

use App\Enums\InvoiceStatus;
use App\Models\Invoice;
use App\Models\Service;
use App\Models\User;
use App\Notifications\InvoiceIssuedNotification;
use Illuminate\Support\Facades\DB;

class InvoiceService
{
    /**
     * Raises an invoice and emails the customer. Lines may reference catalogue services.
     *
     * @param  list<array{description: string, quantity: int, unit_amount: int, service_id?: int|null}>  $items  amounts in kobo
     */
    public function create(User $customer, array $items, ?string $dueAt, ?string $notes, ?User $createdBy, bool $notify = true): Invoice
    {
        $invoice = DB::transaction(function () use ($customer, $items, $dueAt, $notes, $createdBy) {
            $total = collect($items)->sum(fn (array $item) => $item['quantity'] * $item['unit_amount']);

            $invoice = Invoice::create([
                'user_id' => $customer->id,
                'status' => InvoiceStatus::Unpaid,
                'currency' => 'NGN',
                'subtotal' => $total,
                'total' => $total,
                'due_at' => $dueAt,
                'notes' => $notes,
                'created_by' => $createdBy?->id,
            ]);

            foreach (array_values($items) as $position => $item) {
                $invoice->items()->create([
                    'service_id' => isset($item['service_id']) && Service::withTrashed()->whereKey($item['service_id'])->exists() ? $item['service_id'] : null,
                    'description' => $item['description'],
                    'quantity' => $item['quantity'],
                    'unit_amount' => $item['unit_amount'],
                    'amount' => $item['quantity'] * $item['unit_amount'],
                    'sort_order' => $position,
                ]);
            }

            return $invoice;
        });

        if ($notify) {
            $customer->notify(new InvoiceIssuedNotification($invoice));
        }

        return $invoice->refresh();
    }

    public function void(Invoice $invoice): Invoice
    {
        abort_unless($invoice->status === InvoiceStatus::Unpaid && $invoice->amount_paid === 0, 422, 'Only unpaid invoices with no payments can be cancelled.');
        abort_if($invoice->hasPendingTransfer(), 422, 'A bank transfer for this invoice is waiting for review. Approve or reject it first.');

        $invoice->update(['status' => InvoiceStatus::Void, 'voided_at' => now()]);

        return $invoice;
    }
}
