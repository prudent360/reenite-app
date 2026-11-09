<?php

namespace App\Listeners;

use App\Events\InvoicePaid;
use App\Models\Order;
use App\Orders\OrderService;

class StartPaidOrder
{
    public function __construct(private OrderService $orders) {}

    public function handle(InvoicePaid $event): void
    {
        if ($event->invoice->source instanceof Order) {
            $this->orders->markPaid($event->invoice->source);
        }
    }
}
