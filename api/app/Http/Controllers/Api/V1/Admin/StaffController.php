<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Notifications\StaffInviteNotification;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
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
     * Emails a fresh invite link to someone who hasn't signed in yet. The old link stops working.
     */
    public function resendInvite(Request $request, User $user): JsonResponse
    {
        $this->assertInvitePending($user);

        $user->notify(new StaffInviteNotification(Password::broker()->createToken($user), $request->user()->name));

        return response()->json(['message' => "A new invite has been sent to {$user->email}."]);
    }

    /**
     * Removes an invite nobody accepted, e.g. a wrong email address. Anyone who has signed in is
     * suspended instead, so their history (orders, check-ins, approvals) keeps their name.
     */
    public function destroy(Request $request, User $user): Response
    {
        abort_if($user->is($request->user()), 422, 'You cannot remove your own account.');
        $this->assertInvitePending($user);

        DB::transaction(function () use ($user) {
            $user->syncRoles([]);
            $user->syncPermissions([]);
            $user->tokens()->delete();
            $user->notifications()->delete();
            DB::table('password_reset_tokens')->where('email', $user->email)->delete();

            try {
                $user->delete();
            } catch (QueryException) {
                abort(422, 'This person already has work recorded against them. Suspend them instead.');
            }
        });

        return response()->noContent();
    }

    private function assertInvitePending(User $user): void
    {
        abort_unless($user->isStaff(), 404);
        abort_if($user->last_login_at !== null, 422, 'This person has already signed in. Suspend them instead, or they can use "Forgot password" on the sign-in page.');
    }

    /**
     * @return list<string>
     */
    private function staffRoleValues(): array
    {
        return array_map(fn (Role $role) => $role->value, Role::staffRoles());
    }
}
