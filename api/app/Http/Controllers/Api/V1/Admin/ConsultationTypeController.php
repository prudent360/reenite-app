<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ConsultationTypeRequest;
use App\Http\Resources\ConsultationTypeResource;
use App\Models\Consultation;
use App\Models\ConsultationType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

/**
 * The consultations customers can book: what they are, how long, the price and weekly hours.
 */
class ConsultationTypeController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return ConsultationTypeResource::collection(
            ConsultationType::ordered()->withCount(['consultations' => fn ($query) => $query->where('status', Consultation::CONFIRMED)->where('starts_at', '>', now())])->get()
        );
    }

    public function store(ConsultationTypeRequest $request): JsonResponse
    {
        $type = ConsultationType::create($request->validated() + ['slug' => $this->uniqueSlug($request->validated('name'))]);

        return (new ConsultationTypeResource($type))->additional(['message' => 'Consultation added.'])->response()->setStatusCode(201);
    }

    public function update(ConsultationTypeRequest $request, ConsultationType $consultationType): JsonResponse
    {
        $consultationType->update($request->validated());

        return (new ConsultationTypeResource($consultationType))->additional(['message' => 'Saved. Existing bookings keep their time and price.'])->response();
    }

    public function destroy(ConsultationType $consultationType): Response
    {
        abort_if($consultationType->consultations()->exists(), 422, 'This consultation has been booked before, so it can only be switched off.');
        $consultationType->delete();

        return response()->noContent();
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'consultation';
        $slug = $base;
        for ($i = 2; ConsultationType::where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }
}
