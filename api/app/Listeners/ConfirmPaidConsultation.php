<?php

namespace App\Listeners;

use App\Consultations\ConsultationService;
use App\Events\InvoicePaid;
use App\Models\Consultation;

class ConfirmPaidConsultation
{
    public function __construct(private ConsultationService $consultations) {}

    public function handle(InvoicePaid $event): void
    {
        if ($event->invoice->source instanceof Consultation) {
            $this->consultations->markPaid($event->invoice->source);
        }
    }
}
