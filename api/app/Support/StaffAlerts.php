<?php

namespace App\Support;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

class StaffAlerts
{
    /**
     * Active staff whose role grants the permission. Super Admins hold every permission
     * implicitly, so they're only used when no other role covers it.
     *
     * @return Collection<int, User>
     */
    public static function recipients(string $permission): Collection
    {
        $staff = User::query()
            ->where('type', User::TYPE_STAFF)
            ->where('status', User::STATUS_ACTIVE)
            ->permission($permission)
            ->get();

        return $staff->isNotEmpty()
            ? $staff
            : User::where('type', User::TYPE_STAFF)->where('status', User::STATUS_ACTIVE)->role(Role::SuperAdmin->value)->get();
    }
}
