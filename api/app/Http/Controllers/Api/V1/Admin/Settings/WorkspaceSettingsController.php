<?php

namespace App\Http\Controllers\Api\V1\Admin\Settings;

use App\Http\Controllers\Controller;
use App\Support\Settings;
use App\Workspace\BookingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The switch that decides where people book spaces: this site, or the separate booking site.
 */
class WorkspaceSettingsController extends Controller
{
    public function __construct(private Settings $settings, private BookingService $bookings) {}

    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->current()]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'destination' => ['required', Rule::in([BookingService::DESTINATION_EXTERNAL, BookingService::DESTINATION_INTERNAL])],
            'external_url' => ['required', 'url:https', 'max:255'],
        ], ['external_url.url' => 'Enter the full address of the booking site, starting with https://.']);

        $this->settings->set('workspace.booking_destination', $validated['destination']);
        $this->settings->set('workspace.external_booking_url', rtrim($validated['external_url'], '/'));

        return response()->json([
            'data' => $this->current(),
            'message' => $validated['destination'] === BookingService::DESTINATION_INTERNAL
                ? 'Bookings now happen on this site.'
                : 'Bookings now go to '.$validated['external_url'].'.',
        ]);
    }

    /**
     * @return array{destination: string, external_url: string}
     */
    private function current(): array
    {
        return [
            'destination' => $this->bookings->isOpen() ? BookingService::DESTINATION_INTERNAL : BookingService::DESTINATION_EXTERNAL,
            'external_url' => $this->bookings->externalUrl(),
        ];
    }
}
