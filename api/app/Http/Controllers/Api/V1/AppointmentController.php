<?php

namespace App\Http\Controllers\Api\V1;

use App\Appointments\AppointmentService;
use App\Http\Controllers\Controller;
use App\Http\Resources\AppointmentResource;
use App\Models\Appointment;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The client's side of an appointment, opened from the private link in their messages.
 * The token in the link stands in for an account.
 */
class AppointmentController extends Controller
{
    public function __construct(private AppointmentService $appointments) {}

    public function show(Request $request, Appointment $appointment): AppointmentResource
    {
        $this->authorizeToken($request, $appointment);

        return $this->forClient($appointment);
    }

    public function respond(Request $request, Appointment $appointment): AppointmentResource
    {
        $this->authorizeToken($request, $appointment);
        $validated = $request->validate([
            'response' => ['required', Rule::in([Appointment::CONFIRMED, Appointment::RESCHEDULE_REQUESTED])],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        return $this->forClient($this->appointments->respond($appointment, $validated['response'], $validated['note'] ?? null));
    }

    private function authorizeToken(Request $request, Appointment $appointment): void
    {
        $token = (string) $request->input('token', '');
        // A wrong token looks the same as a missing appointment, so references can't be probed.
        abort_unless($token !== '' && hash_equals($appointment->response_token, $token), 404);
    }

    private function forClient(Appointment $appointment): AppointmentResource
    {
        $resource = new AppointmentResource($appointment->load(['client', 'assignee']));
        $resource->forClient = true;

        return $resource;
    }
}
