<?php

namespace App\Payments;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Events\InvoicePaid;
use App\Models\Booking;
use App\Models\Consultation;
use App\Models\Coupon;
use App\Models\CouponRedemption;
use App\Models\CustomerMembership;
use App\Models\CustomerPass;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Applying and removing discount codes. The discount comes off the invoice total, and every
 * payment is for the invoice balance, so card payments, transfers and refunds all follow it.
 */
class CouponService
{
    /**
     * Minutes after starting a card payment during which the code can't change, so a checkout
     * already open at the gateway is never for a different amount than the invoice.
     */
    public const CHECKOUT_LOCK_MINUTES = 15;

    /**
     * Applies a code to an unpaid invoice, replacing any code already on it. A code that covers
     * the whole amount settles the invoice at once.
     */
    public function apply(Invoice $invoice, string $code, User $customer): Invoice
    {
        $code = Coupon::normalizeCode($code);

        $becamePaid = DB::transaction(function () use ($invoice, $code, $customer) {
            $locked = Invoice::whereKey($invoice->id)->lockForUpdate()->firstOrFail();
            $this->assertChangeable($locked);

            $coupon = Coupon::where('code', $code)->lockForUpdate()->first();
            if (! $coupon) {
                $this->fail("We don't recognise that code. Check the spelling and try again.");
            }

            // The amount before any code, so swapping codes doesn't stack them.
            $amount = $locked->total + $locked->coupon_discount;
            $this->assertUsable($coupon, $locked, $customer, $amount);

            $discount = $coupon->discountOn($amount);
            if ($discount < 1) {
                $this->fail("This code doesn't take anything off this invoice.");
            }

            CouponRedemption::updateOrCreate(
                ['invoice_id' => $locked->id],
                ['coupon_id' => $coupon->id, 'user_id' => $customer->id, 'amount' => $discount],
            );

            $total = $amount - $discount;
            $locked->update(['coupon_code' => $coupon->code, 'coupon_discount' => $discount, 'total' => $total]);

            if ($total === 0) {
                $locked->update(['status' => InvoiceStatus::Paid, 'paid_at' => now()]);

                return true;
            }

            return false;
        });

        $invoice->refresh();

        // Whatever the invoice was for (a booking, an order, a pass) now goes ahead as if paid.
        if ($becamePaid) {
            InvoicePaid::dispatch($invoice);
        }

        return $invoice;
    }

    public function remove(Invoice $invoice): Invoice
    {
        DB::transaction(function () use ($invoice) {
            $locked = Invoice::whereKey($invoice->id)->lockForUpdate()->firstOrFail();
            if ($locked->coupon_discount === 0 && $locked->coupon_code === null) {
                return;
            }
            $this->assertChangeable($locked);

            $locked->couponRedemption()->delete();
            $locked->update(['coupon_code' => null, 'total' => $locked->total + $locked->coupon_discount, 'coupon_discount' => 0]);
        });

        return $invoice->refresh();
    }

    /** The kind of purchase an invoice is for, in the terms a coupon's `applies_to` uses. */
    public static function purchaseKind(Invoice $invoice): ?string
    {
        return match ($invoice->source_type) {
            Order::class, Consultation::class => 'services',
            Booking::class => 'bookings',
            CustomerPass::class, CustomerMembership::class => 'plans',
            default => null,
        };
    }

    private function assertChangeable(Invoice $invoice): void
    {
        if (! $invoice->isPayable() || $invoice->amount_paid > 0) {
            $this->fail('Codes can only be added before anything has been paid on the invoice.');
        }
        if ($invoice->hasPendingTransfer()) {
            $this->fail("We're checking a bank transfer for this invoice, so the code can't change now.");
        }

        $checkoutOpen = $invoice->payments()
            ->where('status', PaymentStatus::Pending->value)
            ->where('created_at', '>', now()->subMinutes(self::CHECKOUT_LOCK_MINUTES))
            ->exists();
        if ($checkoutOpen) {
            $this->fail('You started a card payment a few minutes ago. Finish it, or try the code again in '.self::CHECKOUT_LOCK_MINUTES.' minutes.');
        }
    }

    private function assertUsable(Coupon $coupon, Invoice $invoice, User $customer, int $amount): void
    {
        if (! $coupon->is_active || $coupon->expires_at?->isPast()) {
            $this->fail('This code has expired.');
        }
        if ($coupon->starts_at?->isFuture()) {
            $this->fail("This code can't be used yet.");
        }
        if ($coupon->applies_to !== 'all' && $coupon->applies_to !== self::purchaseKind($invoice)) {
            $this->fail('This code can only be used on '.match ($coupon->applies_to) {
                'services' => 'business services',
                'bookings' => 'workspace bookings',
                'plans' => 'passes and memberships',
                default => 'other purchases',
            }.'.');
        }
        if ($coupon->min_spend !== null && $amount < $coupon->min_spend) {
            $this->fail('This code needs a purchase of at least '.Money::format($coupon->min_spend).'.');
        }

        $otherUses = $coupon->liveRedemptions()->where('invoice_id', '!=', $invoice->id);
        if ($coupon->max_uses !== null && (clone $otherUses)->count() >= $coupon->max_uses) {
            $this->fail('This code has been fully used.');
        }
        if ($coupon->max_uses_per_customer !== null && (clone $otherUses)->where('user_id', $customer->id)->count() >= $coupon->max_uses_per_customer) {
            $this->fail("You've already used this code.");
        }
    }

    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['code' => $message]);
    }
}
