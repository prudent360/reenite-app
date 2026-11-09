<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Notifications\StaffInviteNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StaffController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $staff = User::where('type', User::TYPE_STAFF)->with(['roles.permissions', 'permissions'])->orderBy('name')->get();

        return UserResource::collection($staff);
    }

    /**
     * Creates the account with a random password and emails a "set your password" link as the invite.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:20', 'unique:users,phone'],
            'role' => ['required', Rule::in($this->staffRoleValues())],
        ]);

        $staff = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'password' => Str::password(32),
            'type' => User::TYPE_STAFF,
            'status' => User::STATUS_ACTIVE,
        ]);

        $staff->forceFill(['email_verified_at' => now()])->save();
        $staff->assignRole($validated['role']);

        $staff->notify(new StaffInviteNotification(Password::broker()->createToken($staff), $request->user()->name));

        return (new UserResource($staff->load('roles')))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function update(Request $request, User $user): UserResource
    {
        abort_unless($user->isStaff(), 404);

        $validated = $request->validate([
            'role' => ['sometimes', Rule::in($this->staffRoleValues())],
            'status' => ['sometimes', Rule::in([User::STATUS_ACTIVE, User::STATUS_SUSPENDED])],
        ]);

        abort_if(
            $user->is($request->user()) && ($validated['status'] ?? null) === User::STATUS_SUSPENDED,
            422,
            'You cannot suspend your own account.',
        );

        if (isset($validated['role'])) {
            $user->syncRoles([$validated['role']]);
        }

        if (isset($validated['status'])) {
            $user->update(['status' => $validated['status']]);

            if ($validated['status'] === User::STATUS_SUSPENDED) {
                $user->tokens()->delete();
            }
        }

        return new UserResource($user->load('roles'));
    }

    /**
     * @return list<string>
     */
    private function staffRoleValues(): array
    {
        return array_map(fn (Role $role) => $role->value, Role::staffRoles());
    }
}
