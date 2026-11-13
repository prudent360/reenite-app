<?php

namespace App\Http\Controllers\Api\V1\Admin\Workspace;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Support\FrontendLinks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Staff switch self check-in on for a location and print its QR poster. A new link makes old
 * posters (or a photo of one shared online) stop working.
 */
class SelfCheckInController extends Controller
{
    public function show(Location $location): JsonResponse
    {
        return $this->present($location);
    }

    public function update(Request $request, Location $location): JsonResponse
    {
        $validated = $request->validate(['enabled' => ['required', 'boolean']]);
        $location->update(['self_check_in' => $validated['enabled']]);

        return $this->present($location);
    }

    public function regenerate(Location $location): JsonResponse
    {
        $location->forceFill(['check_in_token' => Location::newCheckInToken()])->save();

        return $this->present($location);
    }

    private function present(Location $location): JsonResponse
    {
        if (! $location->check_in_token) {
            $location->forceFill(['check_in_token' => Location::newCheckInToken()])->save();
        }

        return response()->json(['data' => [
            'location_id' => $location->id,
            'location_name' => $location->name,
            'enabled' => $location->self_check_in,
            'url' => FrontendLinks::selfCheckIn($location->check_in_token),
        ]]);
    }
}
