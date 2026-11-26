<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Staff signing in as a customer to help them, e.g. booking a space for a walk-in. The customer's
 * token carries the staff member's id (impersonator_id) and expires after a few hours.
 */
class Impersonation
{
    public const TOKEN_NAME = 'staff-sign-in';

    public const HOURS = 2;

    /**
     * Routes staff can't use as the customer: their password, email and profile, legal
     * signatures (only the customer can sign) and their saved cards.
     *
     * @var list<string>
     */
    public const BLOCKED_ROUTES = ['v1.profile.*', 'v1.agreements.sign', 'v1.billing.cards.*', 'v1.plans.auto-renew'];

    /**
     * The staff member behind this request, when it comes from a staff sign-in.
     */
    public static function staff(Request $request): ?User
    {
        $token = $request->user()?->currentAccessToken();
        if (! $token instanceof PersonalAccessToken || empty($token->impersonator_id)) {
            return null;
        }

        return User::query()->find($token->impersonator_id);
    }

    /**
     * Whether this staff member may (still) sign in as customers.
     */
    public static function allowed(?User $staff): bool
    {
        return $staff !== null && $staff->isStaff() && $staff->isActive() && $staff->can('customers.impersonate');
    }
}
