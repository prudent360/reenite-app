<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Uploads\UploadGrant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UploadGrantController extends Controller
{
    /** A link the browser can post one file to, valid for ten minutes. */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate(['path' => ['required', 'string', 'max:200', 'starts_with:/']]);
        $user = $request->user('sanctum');

        abort_unless(UploadGrant::allows($validated['path'], $user), 403, 'Uploads are not allowed here.');

        $grant = UploadGrant::issue($validated['path'], $user);

        return response()->json([
            'url' => url('/api/v1'.$validated['path']).'?upload_grant='.urlencode($grant->encode()),
            'expires_at' => date(DATE_ATOM, $grant->expiresAt),
        ]);
    }
}
