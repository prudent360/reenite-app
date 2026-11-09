<?php

namespace App\Http\Resources;

use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ActivityLog */
class ActivityLogResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'event' => $this->event,
            'description' => $this->description,
            'route' => $this->route,
            'method' => $this->method,
            'path' => $this->path,
            'status' => $this->status,
            'succeeded' => $this->status === null || $this->status < 400,
            'properties' => $this->properties ?? (object) [],
            'ip' => $this->ip,
            'user_agent' => $this->user_agent,
            'user' => $this->user ? [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
                'type' => $this->user->type,
            ] : null,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
