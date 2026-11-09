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
     */
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (RoleEnum::allPermissions() as $permission) {
            Permission::findOrCreate($permission, 'web');
        }

        foreach (RoleEnum::cases() as $roleEnum) {
            Role::findOrCreate($roleEnum->value, 'web')->syncPermissions($roleEnum->permissions());
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
