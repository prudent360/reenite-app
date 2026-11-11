<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ComplianceController as CustomerComplianceController;
use App\Http\Controllers\Controller;
use App\Http\Resources\ComplianceItemResource;
use App\Models\Business;
use App\Models\ComplianceItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Customers' deadlines across every business, so officers can see who is about to miss one
 * (and offer to file it) and record filings they did for the customer.
 */
class ComplianceController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            // attention: overdue plus the next 30 days (the default view)
            'filter' => ['nullable', Rule::in(['attention', 'overdue', 'due_soon', 'open', 'done'])],
            'search' => ['nullable', 'string', 'max:100'],
        ]);
        $today = ComplianceItem::today()->toDateString();
        $in30Days = ComplianceItem::today()->addDays(30)->toDateString();

        $items = ComplianceItem::query()
            ->with('business.user')
            ->when($validated['filter'] ?? 'attention', fn ($query, string $filter) => match ($filter) {
                'attention' => $query->where('status', ComplianceItem::OPEN)->whereDate('due_on', '<=', $in30Days),
                'overdue' => $query->where('status', ComplianceItem::OPEN)->whereDate('due_on', '<', $today),
                'due_soon' => $query->where('status', ComplianceItem::OPEN)->whereDate('due_on', '>=', $today)->whereDate('due_on', '<=', $in30Days),
                'open' => $query->where('status', ComplianceItem::OPEN),
                'done' => $query->where('status', ComplianceItem::DONE)->latest('completed_at'),
            })
            ->when($validated['search'] ?? null, function ($query, string $search) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $search).'%';
                $query->whereHas('business', fn ($business) => $business->where('name', 'like', $like)
                    ->orWhere('registration_number', 'like', $like)
                    ->orWhereHas('user', fn ($user) => $user->where('name', 'like', $like)->orWhere('email', 'like', $like)));
            })
            ->orderBy('due_on')
            ->paginate(50)
            ->withQueryString();

        $counts = [
            'overdue' => ComplianceItem::query()->where('status', ComplianceItem::OPEN)->whereDate('due_on', '<', $today)->count(),
            'due_soon' => ComplianceItem::query()->where('status', ComplianceItem::OPEN)->whereDate('due_on', '>=', $today)->whereDate('due_on', '<=', $in30Days)->count(),
            'businesses' => Business::count(),
        ];

        return ComplianceItemResource::collection($items)->additional(['counts' => $counts]);
    }

    /**
     * Staff record that a deadline was dealt with (for example, they filed it for the customer).
     */
    public function update(Request $request, ComplianceItem $item): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(ComplianceItem::STATUSES)],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $item->update(CustomerComplianceController::withCompletion($item, $validated, $request->user()->id));

        return (new ComplianceItemResource($item->load('business.user')))->additional(['message' => 'Saved.'])->response();
    }
}
