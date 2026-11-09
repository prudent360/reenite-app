<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Notifications\PasswordChangedNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class ProfileController extends Controller
{
    public function update(Request $request): UserResource
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:20', 'regex:/^\+?[0-9\s-]{7,20}$/', Rule::unique('users', 'phone')->ignore($user->id)],
        ]);

        if (($validated['phone'] ?? null) !== $user->phone) {
            $user->phone_verified_at = null;
        }

        $user->fill($validated)->save();

        return new UserResource($user);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $user = $request->user();
        $user->update(['password' => $validated['password']]);

        // Keep the current device signed in, revoke the rest.
        $user->tokens()->where('id', '!=', $user->currentAccessToken()->id)->delete();
        $user->notify(new PasswordChangedNotification(now()));

        return response()->json(['message' => 'Password updated.']);
    }
}
