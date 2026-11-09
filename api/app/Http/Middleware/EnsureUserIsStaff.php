<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsStaff
{
    /**
     * Only allow active staff accounts through to the admin API.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->isStaff() || ! $user->isActive()) {
            abort(Response::HTTP_FORBIDDEN, 'This area is for Reenite staff only.');
        }

        return $next($request);
    }
}
