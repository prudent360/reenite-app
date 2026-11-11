<?php

namespace App\Http\Resources;

use App\Models\ComplianceItem;
use App\Models\Service;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ComplianceItem
 */
class ComplianceItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $kind = ComplianceItem::KINDS[$this->kind] ?? ComplianceItem::KINDS['custom'];
        $service = $kind['service'] && $this->status === ComplianceItem::OPEN && self::serviceIsLive($kind['service']) ? $kind['service'] : null;

        return [
            'id' => $this->id,
            'business_id' => $this->business_id,
            'kind' => $this->kind,
            'kind_label' => $kind['label'],
            'authority' => $kind['authority'] ?: null,
            'title' => $this->title,
            'period_label' => $this->period_label,
            'due_on' => $this->due_on->toDateString(),
            'days_left' => $this->daysLeft(),
            // overdue | due_soon | upcoming | done | dismissed
            'state' => $this->state(),
            'status' => $this->status,
            'is_custom' => $this->is_custom,
            'note' => $this->note,
            'completed_at' => $this->completed_at?->toIso8601String(),
            'service_slug' => $service,
            'business' => $this->whenLoaded('business', fn () => [
                'id' => $this->business->id,
                'name' => $this->business->name,
                'owner' => $this->business->relationLoaded('user') ? ['id' => $this->business->user->id, 'name' => $this->business->user->name, 'email' => $this->business->user->email] : null,
            ]),
        ];
    }

    /**
     * Live service slugs are looked up once per request, so each item can link to the service that files it.
     */
    private static function serviceIsLive(string $slug): bool
    {
        $live = once(fn () => Service::query()->where('is_active', true)->pluck('slug')->flip()->all());

        return isset($live[$slug]);
    }
}
