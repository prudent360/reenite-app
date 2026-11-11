<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Appointments\AppointmentClients;
use App\Appointments\AppointmentService;
use App\Appointments\AppointmentSettings;
use App\Http\Controllers\Controller;
use App\Http\Resources\AppointmentResource;
use App\Models\Appointment;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Appointments staff book with clients, plus the client picker, staff list and timekeeping rule.
 */
class AppointmentController extends Controller
{
    public function __construct(private AppointmentService $appointments, private AppointmentClients $clients) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'filter' => ['nullable', Rule::in(['upcoming', 'attention', 'past', 'cancelled'])],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $appointments = Appointment::query()
            ->with(['client', 'assignee'])
            ->when($validated['filter'] ?? 'upcoming', fn ($query, string $filter) => match ($filter) {
                'upcoming' => $query->upcoming()->orderBy('starts_at'),
                // Clients asking for a new time, and finished appointments nobody has marked yet.
                'attention' => $query->where('status', Appointment::SCHEDULED)
                    ->where(fn ($inner) => $inner->where('response', Appointment::RESCHEDULE_REQUESTED)->orWhere('ends_at', '<=', now()))
                    ->orderBy('starts_at'),
                'past' => $query->whereIn('status', [Appointment::ATTENDED, Appointment::NO_SHOW])->latest('starts_at'),
                'cancelled' => $query->where('status', Appointment::CANCELLED)->latest('starts_at'),
            })
            ->when($validated['search'] ?? null, function ($query, string $search) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $search).'%';
                $query->where(fn ($inner) => $inner->where('reference', 'like', $like)
                    ->orWhere('title', 'like', $like)
                    ->orWhereHas('client', fn ($client) => $client->where('name', 'like', $like)->orWhere('email', 'like', $like)->orWhere('phone', 'like', $like)));
            })
            ->paginate(30)
            ->withQueryString();

        return AppointmentResource::collection($appointments)->additional([
            'counts' => [
                'today' => Appointment::upcoming()->whereBetween('starts_at', [now()->startOfDay(), now()->endOfDay()])->count(),
                'attention' => Appointment::where('status', Appointment::SCHEDULED)
                    ->where(fn ($inner) => $inner->where('response', Appointment::RESCHEDULE_REQUESTED)->orWhere('ends_at', '<=', now()))
                    ->count(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules(creating: true), [
            'client.phone.regex' => 'Enter a valid phone number.',
            'client_id.required_without' => 'Choose a client or add a new one.',
        ]);

        $appointment = $this->appointments->schedule($validated, $request->user());

        return (new AppointmentResource($appointment->load(['client', 'assignee', 'creator'])))->response()->setStatusCode(201);
    }

    public function show(Appointment $appointment): AppointmentResource
    {
        $resource = new AppointmentResource($appointment->load(['client', 'assignee', 'creator']));
        $resource->history = $this->clients->history($appointment->client);

        return $resource;
    }

    public function update(Request $request, Appointment $appointment): AppointmentResource
    {
        $validated = $request->validate($this->rules(creating: false));

        return $this->show($this->appointments->update($appointment, $validated));
    }

    public function cancel(Request $request, Appointment $appointment): AppointmentResource
    {
        $validated = $request->validate(['reason' => ['required', 'string', 'max:255']], ['reason.required' => 'Say why, so the client knows.']);

        return $this->show($this->appointments->cancel($appointment, $validated['reason']));
    }

    public function outcome(Request $request, Appointment $appointment): AppointmentResource
    {
        $validated = $request->validate([
            'outcome' => ['required', Rule::in([Appointment::ATTENDED, Appointment::NO_SHOW])],
            'minutes_late' => ['nullable', 'integer', 'min:0', 'max:600'],
        ]);

        return $this->show($this->appointments->recordOutcome($appointment, $validated['outcome'], (int) ($validated['minutes_late'] ?? 0)));
    }

    /**
     * Existing clients for the picker: customers and guests, matched by name, email or phone.
     */
    public function clients(Request $request): JsonResponse
    {
        $validated = $request->validate(['search' => ['required', 'string', 'min:2', 'max:100']]);
        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $validated['search']).'%';

        $clients = User::query()
            ->where('type', User::TYPE_CUSTOMER)
            ->where(fn ($query) => $query->where('name', 'like', $like)->orWhere('email', 'like', $like)->orWhere('phone', 'like', $like))
            ->orderBy('name')
            ->limit(10)
            ->get();

        return response()->json(['data' => $clients->map(fn (User $client) => [
            'id' => $client->id,
            'name' => $client->name,
            'email' => $client->email,
            'phone' => $client->phone,
            'is_guest' => $client->isGuest(),
            'history' => $this->clients->history($client),
        ])]);
    }

    /**
     * Staff who can run appointments, for the "with" picker.
     */
    public function staff(): JsonResponse
    {
        $staff = User::query()
            ->where('type', User::TYPE_STAFF)
            ->where('status', User::STATUS_ACTIVE)
            ->orderBy('name')
            ->get()
            ->filter(fn (User $user) => $user->can('appointments.manage'))
            ->map(fn (User $user) => ['id' => $user->id, 'name' => $user->name])
            ->values();

        return response()->json(['data' => $staff]);
    }

    public function settings(AppointmentSettings $settings): JsonResponse
    {
        return response()->json(['data' => $settings->toArray()]);
    }

    public function updateSettings(Request $request, AppointmentSettings $settings): JsonResponse
    {
        $validated = $request->validate([
            'arrive_early_minutes' => ['required', 'integer', 'min:0', 'max:120'],
            'grace_minutes' => ['required', 'integer', 'min:0', 'max:120'],
        ]);
        $settings->update($validated['arrive_early_minutes'], $validated['grace_minutes']);

        return response()->json(['data' => $settings->toArray(), 'message' => 'Timekeeping rule saved.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';
        $staffRule = Rule::exists('users', 'id')->where('type', User::TYPE_STAFF)->where('status', User::STATUS_ACTIVE);

        return array_filter([
            'client_id' => $creating ? ['nullable', 'required_without:client', 'integer', Rule::exists('users', 'id')->where('type', User::TYPE_CUSTOMER)] : null,
            'client' => $creating ? ['nullable', 'required_without:client_id', 'array'] : null,
            'client.name' => $creating ? ['required_with:client', 'string', 'max:120'] : null,
            'client.email' => $creating ? ['required_with:client', 'string', 'lowercase', 'email', 'max:255'] : null,
            'client.phone' => $creating ? ['required_with:client', 'string', 'max:20', 'regex:/^\+?[0-9\s-]{7,20}$/'] : null,
            'client.whatsapp_consent' => $creating ? ['nullable', 'boolean'] : null,
            'title' => [$required, 'string', 'max:160'],
            'mode' => [$required, Rule::in(array_keys(Appointment::MODES))],
            'meeting_details' => ['nullable', 'string', 'max:1000'],
            'starts_at' => [$required, 'date_format:Y-m-d H:i'],
            'duration_minutes' => [$required, 'integer', 'min:5', 'max:480'],
            'assigned_to' => ['nullable', 'integer', $staffRule],
            'staff_notes' => ['nullable', 'string', 'max:2000'],
        ]);
    }
}
