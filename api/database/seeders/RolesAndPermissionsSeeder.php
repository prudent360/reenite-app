<?php

namespace Database\Seeders;

use App\Enums\Role as RoleEnum;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Idempotent: safe to re-run after adding roles or permissions to the enum.
     *
     * Permissions admins can adjust (RoleEnum::adjustablePermissions) only get the enum's defaults the
     * first time the permission or role exists. After that each role keeps what the admin chose, so
     * re-running this from a later migration doesn't undo it.
     */
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $adjustable = array_keys(RoleEnum::adjustablePermissions());
        $existing = Permission::query()->where('guard_name', 'web')->pluck('name')->all();

        foreach (RoleEnum::allPermissions() as $permission) {
            Permission::findOrCreate($permission, 'web');
        }

        foreach (RoleEnum::cases() as $roleEnum) {
            $role = Role::findOrCreate($roleEnum->value, 'web');
            $permissions = array_values(array_diff($roleEnum->permissions(), $adjustable));

            foreach ($adjustable as $permission) {
                $useDefault = $role->wasRecentlyCreated || ! in_array($permission, $existing, true);
                $granted = $useDefault
                    ? in_array($permission, $roleEnum->permissions(), true)
                    : $role->permissions->contains('name', $permission);

                if ($granted) {
                    $permissions[] = $permission;
                }
            }

            $role->syncPermissions($permissions);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
