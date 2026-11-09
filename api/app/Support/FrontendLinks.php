<?php

namespace App\Support;

use App\Models\Booking;
use App\Models\User;
use Illuminate\Support\Facades\URL;

/**
 * Links in emails point at the Next.js frontend, which then calls the API.
 */
class FrontendLinks
{
    public static function base(): string
    {
        return rtrim((string) config('app.frontend_url'), '/');
    }

    public static function verifyEmail(User $user): string
    {
        $signedPath = URL::temporarySignedRoute(
            'v1.auth.verification.verify',
            now()->addMinutes(self::verificationMinutes()),
            ['id' => $user->getKey(), 'hash' => sha1($user->getEmailForVerification())],
            absolute: false,
        );

        return self::base().'/verify-email?'.http_build_query(['link' => $signedPath]);
    }

    public static function resetPassword(User $user, string $token): string
    {
        return self::base().'/reset-password?'.http_build_query(['token' => $token, 'email' => $user->getEmailForPasswordReset()]);
    }

    public static function order(string $reference): string
    {
        return self::base().'/dashboard/orders/'.$reference;
    }

    public static function adminOrder(string $reference): string
    {
        return self::base().'/admin/orders/'.$reference;
    }

    /**
     * The booking page. Carries the booking's private token so guests (and anyone signed out)
     * can open it straight from an email.
     */
    public static function booking(Booking $booking): string
    {
        return self::base().'/bookings/'.$booking->reference.'?'.http_build_query(['token' => $booking->manage_token]);
    }

    /**
     * Where gateways send someone back after paying for a booking.
     */
    public static function bookingPaymentReturn(Booking $booking, string $paymentReference): string
    {
        return self::base().'/bookings/'.$booking->reference.'/return/'.$paymentReference.'?'.http_build_query(['token' => $booking->manage_token]);
    }

    public static function adminBooking(string $reference): string
    {
        return self::base().'/admin/bookings/'.$reference;
    }

    public static function agreement(int $documentId): string
    {
        return self::base().'/dashboard/agreements/'.$documentId;
    }

    public static function workspacePlans(): string
    {
        return self::base().'/dashboard/workspace';
    }

    public static function register(string $email): string
    {
        return self::base().'/register?'.http_build_query(['email' => $email]);
    }

    public static function adminTransfers(): string
    {
        return self::base().'/admin/finance/transfers';
    }

    public static function invoice(int $invoiceId): string
    {
        return self::base().'/dashboard/billing/invoices/'.$invoiceId;
    }

    public static function receipt(string $paymentReference): string
    {
        return self::base().'/dashboard/billing/receipts/'.$paymentReference;
    }

    /**
     * Where gateways send the customer back after paying (or cancelling).
     */
    public static function paymentReturn(string $paymentReference): string
    {
        return self::base().'/dashboard/billing/return/'.$paymentReference;
    }

    public static function login(): string
    {
        return self::base().'/login';
    }

    public static function verificationMinutes(): int
    {
        return (int) config('auth.verification.expire', 60);
    }

    public static function resetMinutes(): int
    {
        return (int) config('auth.passwords.users.expire', 60);
    }
}
