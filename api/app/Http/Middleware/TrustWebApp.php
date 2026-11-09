<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The website calls this API from its own server and passes on each visitor's IP address in
 * X-Forwarded-For. That header is only believed when the request also carries the shared
 * INTERNAL_API_KEY, so someone calling the API directly cannot pretend to be another address.
 */
class TrustWebApp
{
    public function handle(Request $request, Closure $next): Response
    {
        $key = (string) config('app.internal_api_key');
        $sent = (string) $request->header('X-Reenite-Client');

        if ($key !== '' && $sent !== '' && hash_equals($key, $sent)) {
            Request::setTrustedProxies([(string) $request->server('REMOTE_ADDR')], Request::HEADER_X_FORWARDED_FOR);
        }

        return $next($request);
    }
}
