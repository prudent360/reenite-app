<?php

namespace App\Http\Resources;

use App\Models\Mailbox;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Mailbox
 */
class MailboxResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $staff = $request->user()?->isStaff() ?? false;

        return [
            'id' => $this->id,
            'number' => $this->number,
            'business_name' => $this->business_name,
            // active | lapsed (paid period over) | closed
            'state' => $this->state(),
            'status' => $this->status,
            'active_until' => $this->active_until?->toIso8601String(),
            'address_lines' => $this->whenLoaded('location', fn () => $this->addressLines()),
            'location' => $this->whenLoaded('location', fn () => [
                'id' => $this->location->id,
                'name' => $this->location->name,
                'address' => $this->location->address,
                'city' => $this->location->city,
                'state' => $this->location->state,
            ]),
            'membership' => $this->whenLoaded('membership', fn () => $this->membership ? ['id' => $this->membership->id, 'name' => $this->membership->name, 'ends_at' => $this->membership->ends_at?->toIso8601String()] : null),
            'waiting_count' => $this->whenCounted('waitingItems'),
            'request_count' => $this->whenCounted('requestedItems'),
            'notes' => $this->when($staff, $this->notes),
            'customer' => $this->whenLoaded('user', fn () => ['id' => $this->user->id, 'name' => $this->user->name, 'email' => $this->user->email, 'phone' => $this->user->phone]),
            'items' => MailItemResource::collection($this->whenLoaded('items')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
