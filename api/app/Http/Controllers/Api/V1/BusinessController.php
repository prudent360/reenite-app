<?php

namespace App\Http\Controllers\Api\V1;

use App\Compliance\ComplianceCalendar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Compliance\BusinessRequest;
use App\Http\Resources\BusinessResource;
use App\Http\Resources\ComplianceItemResource;
use App\Models\Business;
use App\Models\ComplianceItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * The signed-in customer's businesses, each with its health score and compliance calendar.
 * Someone else's business returns 404.
 */
class BusinessController extends Controller
{
    public function __construct(private ComplianceCalendar $calendar) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        return BusinessResource::collection($request->user()->businesses()->with('openItems')->orderBy('name')->get());
    }

    public function store(BusinessRequest $request): JsonResponse
    {
        abort_if($request->user()->businesses()->count() >= 20, 422, 'You can add up to 20 businesses. Contact us if you need more.');

        $business = $request->user()->businesses()->create($request->validated());
        $this->calendar->refresh($business);

        return (new BusinessResource($business->load('openItems')))
            ->additional(['message' => "{$business->name} added. We've worked out its deadlines."])
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, Business $business): JsonResponse
    {
        $this->authorizeOwner($request, $business);

        // Everything still open, plus what was dealt with in the last year.
        $items = $business->complianceItems()
            ->where(fn ($query) => $query->where('status', ComplianceItem::OPEN)->orWhereDate('due_on', '>=', now()->subYear()->toDateString()))
            ->orderBy('due_on')
            ->get();

        return (new BusinessResource($business->load('openItems')))
            ->additional(['items' => ComplianceItemResource::collection($items)])
            ->response();
    }

    public function update(BusinessRequest $request, Business $business): JsonResponse
    {
        $this->authorizeOwner($request, $business);

        $business->update($request->validated());
        $this->calendar->refresh($business);

        return (new BusinessResource($business->load('openItems')))
            ->additional(['message' => 'Saved. Your deadlines are up to date.'])
            ->response();
    }

    public function destroy(Request $request, Business $business): Response
    {
        $this->authorizeOwner($request, $business);
        $business->delete();

        return response()->noContent();
    }

    private function authorizeOwner(Request $request, Business $business): void
    {
        abort_unless($business->user_id === $request->user()->id, 404);
    }
}
