<?php

namespace App\Payments;

use App\Enums\EmailTemplateKey;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Events\InvoicePaid;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentGateway;
use App\Models\Refund;
use App\Models\User;
use App\Notifications\PaymentReceiptNotification;
use App\Notifications\StaffAlertNotification;
use App\Notifications\TransferReceivedNotification;
use App\Notifications\TransferRejectedNotification;
use App\Support\FrontendLinks;
use App\Support\Money;
use App\Support\Settings;
use App\Support\StaffAlerts;
use Closure;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Every rule about moving money lives here. Amounts always come from the invoice,
 * and a payment only becomes "success" after the gateway (or a Finance reviewer) confirms it.
 */
class PaymentService
{
    public function __construct(private GatewayManager $gateways, private Settings $settings) {}

    /**
     * Creates a pending payment for the invoice balance and returns the gateway checkout URL.
     * Pass `$returnUrlFor` and `$cancelUrl` to send the customer somewhere other than their billing
     * pages afterwards (guests paying for a booking have no dashboard).
     *
     * @param  (Closure(Payment): string)|null  $returnUrlFor
     * @return array{payment: Payment, redirect_url: string}
     */
    public function startOnlinePayment(Invoice $invoice, string $gatewayCode, User $customer, ?Closure $returnUrlFor = null, ?string $cancelUrl = null): array
    {
        $this->assertPayable($invoice);

        $gateway = PaymentGateway::where('code', $gatewayCode)->first();
        abort_unless($gateway?->is_enabled && $gateway->isConfigured(), 422, 'That payment method is not available right now.');

        $payment = Payment::create([
            'reference' => Payment::newReference(),
            'invoice_id' => $invoice->id,
            'user_id' => $customer->id,
            'gateway' => $gateway->code->value,
            'mode' => $gateway->mode,
            'amount' => $invoice->balance(),
            'currency' => $invoice->currency,
            'status' => PaymentStatus::Pending,
        ]);

        try {
            $result = $this->gateways->driver($gateway)->initialize(
                $payment,
                $customer,
                $returnUrlFor ? $returnUrlFor($payment) : FrontendLinks::paymentReturn($payment->reference),
                $cancelUrl ?? FrontendLinks::invoice($invoice->id),
            );
        } catch (GatewayException $exception) {
            $payment->update(['status' => PaymentStatus::Failed, 'failure_reason' => $exception->getMessage()]);
            abort(502, $exception->getMessage());
        }

        $payment->update(['gateway_reference' => $result->gatewayReference]);

        return ['payment' => $payment, 'redirect_url' => $result->redirectUrl];
    }

    /**
     * Checks an online payment with its gateway and records the outcome. Safe to call
     * repeatedly (browser return, webhook, retries): settled payments are left alone.
     */
    public function confirm(Payment $payment): Payment
    {
        if ($payment->isBankTransfer() || $payment->status !== PaymentStatus::Pending) {
            return $payment;
        }

        $verified = $this->gateways->for($payment->gateway, $payment->mode)->verify($payment);

        if ($verified->status === 'success') {
            if ($verified->amount !== $payment->amount || $verified->currency !== $payment->currency) {
                // Never credit a payment for the wrong amount; flag it for Finance instead.
                Log::warning('Payment amount mismatch', ['reference' => $payment->reference, 'expected' => $payment->amount, 'got' => $verified->amount, 'currency' => $verified->currency]);
                $payment->update([
                    'status' => PaymentStatus::Failed,
                    'failure_reason' => 'Amount or currency did not match the invoice ('.Money::format($verified->amount).' '.$verified->currency.'). Finance has been alerted.',
                    'gateway_data' => $verified->data,
                ]);

                return $payment;
            }

            return $this->markSucceeded($payment, [
                'channel' => $verified->channel,
                'gateway_reference' => $verified->gatewayReference ?? $payment->gateway_reference,
                'gateway_data' => $verified->data,
            ]);
        }

        if (in_array($verified->status, ['failed', 'abandoned'], true)) {
            $payment->update([
                'status' => $verified->status === 'failed' ? PaymentStatus::Failed : PaymentStatus::Abandoned,
                'failure_reason' => $verified->message,
            ]);
        }

        return $payment;
    }

    /**
     * Records proof of a bank transfer for Finance to review.
     */
    public function submitBankTransfer(Invoice $invoice, User $customer, UploadedFile $proof, string $senderName, string $transferredOn): Payment
    {
        abort_unless($this->settings->get('bank_transfer.enabled', false), 422, 'Bank transfer is not available right now.');
        $this->assertPayable($invoice);

        $payment = Payment::create([
            'reference' => Payment::newReference(),
            'invoice_id' => $invoice->id,
            'user_id' => $customer->id,
            'gateway' => Payment::BANK_TRANSFER,
            'mode' => 'live',
            'amount' => $invoice->balance(),
            'currency' => $invoice->currency,
            'status' => PaymentStatus::AwaitingReview,
            'sender_name' => $senderName,
            'transferred_on' => $transferredOn,
            'proof_name' => $proof->getClientOriginalName(),
        ]);

        $payment->update(['proof_path' => $proof->storeAs('payment-proofs', $payment->reference.'.'.$proof->extension(), 'local')]);

        $customer->notify(new TransferReceivedNotification($payment));
        Notification::send(StaffAlerts::recipients('payments.verify'), new StaffAlertNotification(EmailTemplateKey::StaffTransferToReview, [
            'invoice_number' => $invoice->number,
            'amount' => Money::format($payment->amount),
            'customer_name' => $customer->name,
        ], FrontendLinks::adminTransfers()));

        return $payment;
    }

    public function approveTransfer(Payment $payment, User $reviewer, ?string $note = null): Payment
    {
        abort_unless($payment->isBankTransfer() && $payment->status === PaymentStatus::AwaitingReview, 422, 'Only transfers awaiting review can be approved.');

        return $this->markSucceeded($payment, ['channel' => 'bank_transfer', 'review_note' => $note], $reviewer);
    }

    public function rejectTransfer(Payment $payment, User $reviewer, string $reason): Payment
    {
        abort_unless($payment->isBankTransfer() && $payment->status === PaymentStatus::AwaitingReview, 422, 'Only transfers awaiting review can be rejected.');

        $payment->update([
            'status' => PaymentStatus::Rejected,
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
            'review_note' => $reason,
        ]);

        $payment->user->notify(new TransferRejectedNotification($payment));

        return $payment;
    }

    /**
     * Refunds through the gateway, or records a refund paid back by other means (manual).
     * `$staff` is null when the system refunds automatically, e.g. a customer cancelling a booking.
     */
    public function refund(Payment $payment, int $amount, string $reason, string $method, ?User $staff): Refund
    {
        abort_if($amount < 1 || $amount > $payment->refundable(), 422, 'Refund must be between ₦0.01 and '.Money::format($payment->refundable()).'.');
        abort_if($method === 'gateway' && $payment->isBankTransfer(), 422, 'Bank transfers are refunded manually.');

        $gatewayReference = null;
        if ($method === 'gateway') {
            try {
                $gatewayReference = $this->gateways->for($payment->gateway, $payment->mode)->refund($payment, $amount);
            } catch (GatewayException $exception) {
                abort(502, $exception->getMessage());
            }
        }

        return DB::transaction(function () use ($payment, $amount, $reason, $method, $staff, $gatewayReference) {
            $payment = Payment::whereKey($payment->id)->lockForUpdate()->firstOrFail();
            $invoice = Invoice::whereKey($payment->invoice_id)->lockForUpdate()->firstOrFail();

            $refund = $payment->refunds()->create([
                'amount' => $amount,
                'reason' => $reason,
                'method' => $method,
                'status' => 'processed',
                'gateway_reference' => $gatewayReference,
                'processed_by' => $staff?->id,
            ]);

            $refunded = $payment->amount_refunded + $amount;
            $payment->update([
                'amount_refunded' => $refunded,
                'status' => $refunded >= $payment->amount ? PaymentStatus::Refunded : PaymentStatus::PartiallyRefunded,
            ]);
            $invoice->update(['amount_refunded' => $invoice->amount_refunded + $amount]);

            return $refund;
        });
    }

    /**
     * The single place a payment becomes successful. Locks the payment and invoice so a
     * browser return and a webhook arriving together can't both credit the invoice.
     *
     * @param  array<string, mixed>  $attributes
     */
    private function markSucceeded(Payment $payment, array $attributes, ?User $reviewer = null): Payment
    {
        // null = already settled before; 'payment_settled' = credited; 'invoice_paid' = credited and invoice now fully paid.
        $outcome = DB::transaction(function () use ($payment, $attributes, $reviewer) {
            $locked = Payment::whereKey($payment->id)->lockForUpdate()->firstOrFail();
            if ($locked->status->isSettled()) {
                return null;
            }

            $invoice = Invoice::whereKey($locked->invoice_id)->lockForUpdate()->firstOrFail();

            $locked->fill(array_filter($attributes, fn ($value) => $value !== null) + [
                'status' => PaymentStatus::Success,
                'paid_at' => now(),
                'receipt_number' => sprintf('RCT-%s-%06d', now()->format('Y'), $locked->id),
            ]);
            if ($reviewer) {
                $locked->fill(['reviewed_by' => $reviewer->id, 'reviewed_at' => now()]);
            }
            $locked->save();

            $paid = $invoice->amount_paid + $locked->amount;
            $becamePaid = $paid >= $invoice->total && $invoice->status !== InvoiceStatus::Paid;
            $invoice->update([
                'amount_paid' => $paid,
                'status' => $paid >= $invoice->total ? InvoiceStatus::Paid : $invoice->status,
                'paid_at' => $paid >= $invoice->total ? now() : $invoice->paid_at,
            ]);

            return $becamePaid ? 'invoice_paid' : 'payment_settled';
        });

        $payment->refresh();

        // Confirm what was paid for first, then email the receipt.
        if ($outcome === 'invoice_paid') {
            InvoicePaid::dispatch($payment->invoice);
        }
        if ($outcome) {
            $payment->user->notify(new PaymentReceiptNotification($payment));
        }

        return $payment;
    }

    private function assertPayable(Invoice $invoice): void
    {
        if (! $invoice->isPayable()) {
            throw new HttpException(422, $invoice->status === InvoiceStatus::Paid ? 'This invoice is already paid.' : 'This invoice can no longer be paid.');
        }
        if ($invoice->hasPendingTransfer()) {
            throw new HttpException(422, "We're still checking a bank transfer for this invoice. We'll email you as soon as it's confirmed.");
        }
    }
}
