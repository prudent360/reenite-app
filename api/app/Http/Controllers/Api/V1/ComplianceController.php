<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ComplianceItemResource;
use App\Models\Business;
use App\Models\ComplianceItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/**
 * The customer's compliance calendar across all their businesses: mark deadlines done or not
 * applicable, and add their own reminders.
 */
class ComplianceController extends Controller
{
    /**
     * Open deadlines across every business, soonest (and overdue) first.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $items = ComplianceItem::query()
            ->whereIn('business_id', $request->user()->businesses()->select('id'))
            ->where('status', ComplianceItem::OPEN)
            ->with('business')
            ->orderBy('due_on')
            ->limit(200)
            ->get();

        return ComplianceItemResource::collection($items);
    }

    public function store(Request $request, Business $business): JsonResponse
    {
        abort_unless($business->user_id === $request->user()->id, 404);
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'due_on' => ['required', 'date', 'after_or_equal:today', 'before:+5 years'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $item = $business->complianceItems()->create($validated + ['kind' => 'custom', 'is_custom' => true, 'status' => ComplianceItem::OPEN]);

        return (new ComplianceItemResource($item))->additional(['message' => 'Reminder added.'])->response()->setStatusCode(201);
    }

    /**
     * Mark done, not applicable or open again. Custom reminders can also be renamed and moved.
     */
    public function update(Request $request, ComplianceItem $item): JsonResponse
    {
        $this->authorizeOwner($request, $item);
        $validated = $request->validate([
            'status' => ['sometimes', Rule::in(ComplianceItem::STATUSES)],
            'note' => ['nullable', 'string', 'max:1000'],
            'title' => [Rule::prohibitedIf(! $item->is_custom), 'sometimes', 'string', 'max:150'],
            'due_on' => [Rule::prohibitedIf(! $item->is_custom), 'sometimes', 'date'],
        ]);

        $changes = self::withCompletion($item, $validated, $request->user()->id);
        if (isset($changes['due_on']) && $changes['due_on'] !== $item->due_on->toDateString()) {
            $changes['reminders_sent'] = null; // a moved reminder is reminded about afresh
        }
        $item->update($changes);

        return (new ComplianceItemResource($item))->additional(['message' => match ($item->status) {
            ComplianceItem::DONE => 'Marked done. Nice work.',
            ComplianceItem::DISMISSED => "Marked as not applying to you. We won't remind you about it.",
            default => 'Saved.',
        }])->response();
    }

    public function destroy(Request $request, ComplianceItem $item): Response
    {
        $this->authorizeOwner($request, $item);
        abort_unless($item->is_custom, 422, "Deadlines we worked out can't be deleted. Mark it as not applying to you instead.");
        $item->delete();

        return response()->noContent();
    }

    /**
     * Records who finished it and when, or clears that when it's reopened.
     *
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    public static function withCompletion(ComplianceItem $item, array $validated, int $userId): array
    {
        if (! isset($validated['status']) || $validated['status'] === $item->status) {
            return $validated;
        }

        return $validated + ($validated['status'] === ComplianceItem::DONE
            ? ['completed_at' => now(), 'completed_by' => $userId]
            : ['completed_at' => null, 'completed_by' => null]);
    }

    private function authorizeOwner(Request $request, ComplianceItem $item): void
    {
        $item->loadMissing('business');
        abort_unless($item->business->user_id === $request->user()->id, 404);
    }
}
