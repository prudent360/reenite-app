<?php

namespace App\Http\Middleware;

use App\Models\ActivityLog;
use App\Models\User;
use App\Support\Impersonation;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * Applies to requests made by staff signed in as a customer: stops the session the moment the staff
 * member is suspended or loses the permission, keeps them out of the customer's password, profile,
 * signatures and cards, and records every change they make in the activity log under their own name.
 */
class GuardImpersonation
{
    public function handle(Request $request, Closure $next): Response
    {
        $customer = $request->user('sanctum');
        $token = $customer?->currentAccessToken();

        if (! $token instanceof PersonalAccessToken || empty($token->impersonator_id)) {
            return $next($request);
        }

        $staff = User::query()->find($token->impersonator_id);
        if (! Impersonation::allowed($staff)) {
            $token->delete();
            abort(401, 'Your session as this customer has ended.');
        }

        abort_if(
            $request->routeIs(...Impersonation::BLOCKED_ROUTES),
            403,
            "Only {$customer->name} can do this from their own account.",
        );

        $response = $next($request);

        if (in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true) && ! $request->routeIs('v1.auth.impersonation.destroy')) {
            ActivityLog::record(ActivityLog::ADMIN_CHANGE, Str::limit("As {$customer->name}: ".$this->describe($request), 250), $staff, $request, [
                'route' => $request->route()?->getName(),
                'method' => $request->method(),
                'path' => Str::limit('/'.$request->path(), 250, ''),
                'status' => $response->getStatusCode(),
                'properties' => ['as_customer' => $customer->id],
            ]);
        }

        return $response;
    }

    /** "v1.bookings.store" becomes "bookings store". */
    private function describe(Request $request): string
    {
        $name = (string) $request->route()?->getName();

        return $name !== '' ? str_replace(['.', '-', '_'], ' ', Str::after($name, 'v1.')) : $request->method().' /'.$request->path();
    }
}
