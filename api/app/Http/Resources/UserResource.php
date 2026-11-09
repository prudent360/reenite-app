<?php

namespace App\Http\Resources;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * @mixin User
 */
class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // Strict mode forbids lazy loading; staff need roles with their permissions.
        $this->resource->loadMissing($this->isStaff() ? ['roles.permissions', 'permissions'] : ['roles']);

        $roles = $this->getRoleNames();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'type' => $this->type,
            'status' => $this->status,
            'avatar_url' => $this->avatar_path ? Storage::url($this->avatar_path) : null,
            'email_verified' => $this->hasVerifiedEmail(),
            'roles' => $roles->map(fn (string $name) => [
                'name' => $name,
                'label' => Role::tryFrom($name)?->label() ?? $name,
            ])->values(),
            'permissions' => $this->when(
                $this->isStaff(),
                fn () => $this->isSuperAdmin() ? ['*'] : $this->getAllPermissions()->pluck('name')->values(),
            ),
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
