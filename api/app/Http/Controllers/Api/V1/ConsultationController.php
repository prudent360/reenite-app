<?php

namespace App\Http\Controllers\Api\V1;

use App\Consultations\ConsultationService;
use App\Http\Controllers\Controller;
use App\Http\Resources\ConsultationResource;
use App\Http\Resources\ConsultationTypeResource;
use App\Models\Consultation;
use App\Models\ConsultationType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Consultations with an officer. Anyone can see what's offered and when; booking needs an account.
 */
class ConsultationController extends Controller
{
    public function __construct(private ConsultationService $consultations) {}

    public function types(): AnonymousResourceCollection
    {
        return ConsultationTypeResource::collection(ConsultationType::active()->ordered()->get());
    }

    public function slots(Request $request, ConsultationType $type): JsonResponse
    {
        abort_unless($type->is_active, 404);
        $validated = $request->validate(['date' => ['required', 'date_format:Y-m-d']]);

        return response()->json(['data' => $this->consultations->slots($type, $validated['date'])]);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $consultations = $request->user()->consultations()
            ->with('invoice')
            ->orderByRaw("case when status in ('pending_payment', 'confirmed') and ends_at > ? then 0 else 1 end", [now()])
            ->orderBy('starts_at')
            ->limit(100)
            ->get();

        return ConsultationResource::collection($consultations);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'consultation_type_id' => ['required', 'integer', 'exists:consultation_types,id'],
            'starts_at' => ['required', 'date'],
            'topic' => ['required', 'string', 'min:10', 'max:2000'],
        ], [
            'topic.required' => 'Tell us briefly what you want to discuss, so the right officer can prepare.',
            'topic.min' => 'Tell us a little more (at least 10 characters), so the right officer can prepare.',
        ]);

        $consultation = $this->consultations->book(
            $request->user(),
            ConsultationType::findOrFail($validated['consultation_type_id']),
            $validated['starts_at'],
            $validated['topic'],
        );

        return (new ConsultationResource($consultation->load(['invoice', 'user'])))
            ->additional(['message' => $consultation->status === Consultation::CONFIRMED ? "You're booked in." : 'Time held for 30 minutes. Pay to confirm it.'])
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, Consultation $consultation): ConsultationResource
    {
        $this->authorizeOwner($request, $consultation);

        return new ConsultationResource($consultation->load(['invoice.payments', 'user', 'officer', 'type']));
    }

    public function cancel(Request $request, Consultation $consultation): JsonResponse
    {
        $this->authorizeOwner($request, $consultation);
        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:255']]);

        $consultation = $this->consultations->cancel($consultation, null, $validated['reason'] ?? 'Cancelled by the customer');

        return (new ConsultationResource($consultation->load(['invoice.payments', 'user'])))
            ->additional(['message' => 'Consultation cancelled.'])
            ->response();
    }

    private function authorizeOwner(Request $request, Consultation $consultation): void
    {
        abort_unless($consultation->user_id === $request->user()->id, 404);
    }
}
