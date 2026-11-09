<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Uploads\UploadGrant;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Lets a browser upload with an UploadGrant in `?upload_grant=` instead of a sign-in token.
 * The grant only signs the person in for the one path it names; the route's own permission
 * checks and validation still run as normal.
 */
class AcceptUploadGrant
{
    public function handle(Request $request, Closure $next): Response
    {
        $value = $request->query('upload_grant');
        if (! is_string($value) || $value === '') {
            return $next($request);
        }

        $grant = UploadGrant::decode($value);
        $path = '/'.Str::after($request->path(), 'api/v1/');

        if (! $grant || $grant->expired() || ! $request->isMethod('POST') || $grant->path !== $path) {
            return response()->json(['message' => 'This upload link has expired. Please try again.'], Response::HTTP_FORBIDDEN);
        }

        if ($grant->userId !== null) {
            $user = User::find($grant->userId);
            if (! $user || ! $user->isActive()) {
                return response()->json(['message' => 'Please sign in again to upload.'], Response::HTTP_FORBIDDEN);
            }
            Auth::guard('sanctum')->setUser($user);
        }

        return $next($request);
    }
}
