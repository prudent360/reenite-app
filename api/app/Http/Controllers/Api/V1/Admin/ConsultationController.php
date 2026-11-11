<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Consultations\ConsultationService;
use App\Http\Controllers\Controller;
use App\Http\Resources\ConsultationResource;
use App\Models\Consultation;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Consultations for staff. Managers see and assign them all; officers see the ones assigned to them.
 */
class ConsultationController extends Controller
{
    public function __construct(private ConsultationService $consultations) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'filter' => ['nullable', Rule::in(['upcoming', 'awaiting_payment', 'past', 'cancelled'])],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $consultations = $this->visibleTo($request->user())
            ->with(['user', 'officer', 'invoice'])
            ->when($validated['filter'] ?? 'upcoming', fn ($query, string $filter) => match ($filter) {
                'upcoming' => $query->where('status', Consultation::CONFIRMED)->where('ends_at', '>', now())->orderBy('starts_at'),
                'awaiting_payment' => $query->where('status', Consultation::PENDING_PAYMENT)->orderBy('starts_at'),
                'past' => $query->whereIn('status', [Consultation::CONFIRMED, Consultation::COMPLETED, Consultation::NO_SHOW])->where('ends_at', '<=', now())->latest('starts_at'),
                'cancelled' => $query->whereIn('status', [Consultation::CANCELLED, Consultation::EXPIRED])->latest('starts_at'),
            })
            ->when($validated['search'] ?? null, function ($query, string $search) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $search).'%';
                $query->where(fn ($inner) => $inner->where('reference', 'like', $like)
                    ->orWhere('topic', 'like', $like)
                    ->orWhereHas('user', fn ($user) => $user->where('name', 'like', $like)->orWhere('email', 'like', $like)));
            })
            ->paginate(30)
            ->withQueryString();

        return ConsultationResource::collection($consultations)->additional([
            'can_manage' => $request->user()->can('consultations.manage'),
            'officers' => $request->user()->can('consultations.manage') ? $this->officers() : [],
        ]);
    }

    public function show(Request $request, Consultation $consultation): JsonResponse
    {
        $this->authorizeView($request->user(), $consultation);

        return (new ConsultationResource($consultation->load(['user', 'officer', 'type', 'invoice.payments'])))
            ->additional([
                'can_manage' => $request->user()->can('consultations.manage'),
                'officers' => $request->user()->can('consultations.manage') ? $this->officers() : [],
            ])
            ->response();
    }

    /**
     * Managers assign an officer; the officer (or a manager) adds the meeting link and notes.
     */
    public function update(Request $request, Consultation $consultation): JsonResponse
    {
        $this->authorizeView($request->user(), $consultation);
        $manager = $request->user()->can('consultations.manage');
        $validated = $request->validate([
            'assigned_to' => [Rule::prohibitedIf(! $manager), 'nullable', 'integer', Rule::in(collect($this->officers())->pluck('id'))],
            'meeting_details' => ['nullable', 'string', 'max:1000'],
            'staff_notes' => ['nullable', 'string', 'max:5000'],
        ], ['assigned_to.in' => 'Choose a member of staff who takes consultations.']);

        $consultation->update($validated);

        return (new ConsultationResource($consultation->load(['user', 'officer', 'type', 'invoice.payments'])))
            ->additional(['message' => 'Saved.'])
            ->response();
    }

    /**
     * After the session: it happened, or the customer didn't turn up.
     */
    public function outcome(Request $request, Consultation $consultation): JsonResponse
    {
        $this->authorizeView($request->user(), $consultation);
        $validated = $request->validate(['outcome' => ['required', Rule::in([Consultation::COMPLETED, Consultation::NO_SHOW])]]);
        abort_unless($consultation->status === Consultation::CONFIRMED, 422, 'Only confirmed consultations can be marked as done or missed.');
        abort_if($consultation->starts_at->isFuture(), 422, "This consultation hasn't started yet.");

        $consultation->update(['status' => $validated['outcome']]);

        return (new ConsultationResource($consultation->load(['user', 'officer', 'type', 'invoice.payments'])))
            ->additional(['message' => $validated['outcome'] === Consultation::COMPLETED ? 'Marked as done.' : 'Marked as missed.'])
            ->response();
    }

    public function cancel(Request $request, Consultation $consultation): JsonResponse
    {
        abort_unless($request->user()->can('consultations.manage'), 403);
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
            'refund_percent' => ['required', 'integer', 'between:0,100'],
        ]);

        $consultation = $this->consultations->cancel($consultation, $request->user(), $validated['reason'], $validated['refund_percent']);

        return (new ConsultationResource($consultation->load(['user', 'officer', 'type', 'invoice.payments'])))
            ->additional(['message' => 'Consultation cancelled. The customer has been emailed.'])
            ->response();
    }

    /**
     * @return Builder<Consultation>
     */
    private function visibleTo(User $staff): Builder
    {
        return Consultation::query()->when(! $staff->can('consultations.manage'), fn ($query) => $query->where('assigned_to', $staff->id));
    }

    private function authorizeView(User $staff, Consultation $consultation): void
    {
        abort_unless($staff->can('consultations.manage') || $consultation->assigned_to === $staff->id, 404);
    }

    /**
     * Staff who can take consultations.
     *
     * @return list<array{id: int, name: string}>
     */
    private function officers(): array
    {
        return User::query()
            ->where('type', User::TYPE_STAFF)
            ->where('status', User::STATUS_ACTIVE)
            ->get()
            ->filter(fn (User $user) => $user->can('consultations.manage') || $user->can('consultations.view_assigned'))
            ->map(fn (User $user) => ['id' => $user->id, 'name' => $user->name])
            ->values()
            ->all();
    }
}
