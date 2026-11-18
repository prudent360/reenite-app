<?php

namespace App\Support;

use App\Enums\Role;
use App\Models\User;
use App\Notifications\StaffAlertNotification;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Collection as BaseCollection;
use Illuminate\Support\Facades\Notification;

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
            : self::superAdmins();
    }

    /**
     * Sends the alert to the people who handle it. Super Admins who aren't among them still see it
     * under the bell, without the extra email, so the owner always knows what's happening.
     *
     * @param  BaseCollection<int, User>  $recipients
     */
    public static function send(BaseCollection $recipients, StaffAlertNotification $alert): void
    {
        Notification::send($recipients, $alert);

        $owners = self::superAdmins()->reject(fn (User $admin) => $recipients->contains('id', $admin->id));
        if ($owners->isNotEmpty()) {
            Notification::send($owners, (clone $alert)->inAppOnly());
        }
    }

    /**
     * @return Collection<int, User>
     */
    private static function superAdmins(): Collection
    {
        return User::where('type', User::TYPE_STAFF)->where('status', User::STATUS_ACTIVE)->role(Role::SuperAdmin->value)->get();
    }
}
