<?php

namespace App\Listeners;

use App\Events\InvoicePaid;
use App\Models\Booking;
use App\Models\CustomerMembership;
use App\Models\CustomerPass;
use App\Workspace\BookingService;
use App\Workspace\PlanService;

class ConfirmPaidWorkspacePurchase
{
    public function __construct(private BookingService $bookings, private PlanService $plans) {}

    public function handle(InvoicePaid $event): void
    {
        $source = $event->invoice->source;

        if ($source instanceof Booking) {
            $this->bookings->markPaid($source);
        } elseif ($source instanceof CustomerPass || $source instanceof CustomerMembership) {
            $this->plans->activate($source);
        }
    }
}
