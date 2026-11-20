<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Notifications\PasswordChangedNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class ProfileController extends Controller
{
    public function update(Request $request): UserResource
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:20', 'regex:/^\+?[0-9\s-]{7,20}$/', Rule::unique('users', 'phone')->ignore($user->id), 'required_if_accepted:whatsapp_updates'],
            'whatsapp_updates' => ['sometimes', 'boolean'],
        ], ['phone.required_if_accepted' => 'Add your phone number to get updates on WhatsApp.']);

        if (($validated['phone'] ?? null) !== $user->phone) {
            $user->phone_verified_at = null;
        }
        if (array_key_exists('whatsapp_updates', $validated)) {
            // Keep the original date of agreement while they stay opted in.
            $user->whatsapp_opt_in_at = $validated['whatsapp_updates'] ? ($user->whatsapp_opt_in_at ?? now()) : null;
        }

        $user->fill(collect($validated)->except('whatsapp_updates')->all())->save();

        return new UserResource($user);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $user = $request->user();
        $user->forceFill(['password' => $validated['password'], 'must_change_password' => false])->save();

        // Keep the current device signed in, revoke the rest.
        $user->tokens()->where('id', '!=', $user->currentAccessToken()->id)->delete();
        $user->notify(new PasswordChangedNotification(now()));

        return response()->json(['message' => 'Password updated.']);
    }

    /**
     * First sign-in after an import: swap the temporary password for one of their own.
     * They have just signed in with the temporary one, so it isn't asked for again.
     */
    public function replaceTemporaryPassword(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->must_change_password, 409, 'Your password has already been set. Change it from Settings.');

        $validated = $request->validate([
            'password' => ['required', 'confirmed', Password::defaults(), function (string $attribute, string $value, \Closure $fail) use ($user): void {
                if (Hash::check($value, $user->password)) {
                    $fail('Choose a new password, not the temporary one you were given.');
                }
            }],
        ]);

        $user->forceFill(['password' => $validated['password'], 'must_change_password' => false])->save();
        $user->tokens()->where('id', '!=', $user->currentAccessToken()->id)->delete();

        return response()->json(['message' => 'Your password is set.', 'user' => new UserResource($user)]);
    }
}
