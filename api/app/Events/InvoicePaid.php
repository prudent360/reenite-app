<?php

namespace App\Events;

use App\Models\Invoice;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Fired once, when an invoice becomes fully paid. Whatever the invoice was for
 * (a service order now, workspace bookings later) reacts to this.
 */
class InvoicePaid
{
    use Dispatchable;

    public function __construct(public Invoice $invoice) {}
}
