<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\Role as RoleEnum;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * The permissions a Super Admin can switch on or off per role (RoleEnum::adjustablePermissions),
 * shown on the Staff & Roles page. Super Admins always have everything, so they aren't listed.
 */
class RolePermissionController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->current()]);
    }

    /**
     * Sets which roles have one adjustable permission, e.g.
     * {"permission": "customers.create", "roles": ["operations_manager", "front_desk"]}.
     */
    public function update(Request $request): JsonResponse
    {
        $roles = $this->roleValues();

        $validated = $request->validate([
            'permission' => ['required', 'string', Rule::in(array_keys(RoleEnum::adjustablePermissions()))],
            'roles' => ['present', 'array'],
            'roles.*' => ['string', 'distinct', Rule::in($roles)],
        ]);

        DB::transaction(function () use ($validated, $roles) {
            foreach (Role::query()->whereIn('name', $roles)->where('guard_name', 'web')->get() as $role) {
                $wanted = in_array($role->name, $validated['roles'], true);
                $has = $role->hasPermissionTo($validated['permission']);

                if ($wanted && ! $has) {
                    $role->givePermissionTo($validated['permission']);
                } elseif (! $wanted && $has) {
                    $role->revokePermissionTo($validated['permission']);
                }
            }
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json(['data' => $this->current(), 'message' => 'Permissions saved.']);
    }

    /**
     * @return list<array{name: string, label: string, roles: list<array{name: string, label: string, granted: bool}>}>
     */
    private function current(): array
    {
        $roles = Role::query()->whereIn('name', $this->roleValues())->where('guard_name', 'web')->with('permissions')->get()->keyBy('name');

        return array_map(fn (string $permission, string $label) => [
            'name' => $permission,
            'label' => $label,
            'roles' => array_map(fn (RoleEnum $roleEnum) => [
                'name' => $roleEnum->value,
                'label' => $roleEnum->label(),
                'granted' => (bool) $roles->get($roleEnum->value)?->permissions->contains('name', $permission),
            ], $this->adjustableRoles()),
        ], array_keys(RoleEnum::adjustablePermissions()), RoleEnum::adjustablePermissions());
    }

    /**
     * @return list<RoleEnum>
     */
    private function adjustableRoles(): array
    {
        return array_values(array_filter(RoleEnum::staffRoles(), fn (RoleEnum $role) => $role !== RoleEnum::SuperAdmin));
    }

    /**
     * @return list<string>
     */
    private function roleValues(): array
    {
        return array_map(fn (RoleEnum $role) => $role->value, $this->adjustableRoles());
    }
}
