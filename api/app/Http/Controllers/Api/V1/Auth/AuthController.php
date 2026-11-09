<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        // Someone who booked as a guest can register with the same email and keep their bookings.
        $guest = User::where('email', mb_strtolower((string) $request->input('email')))->where('status', User::STATUS_GUEST)->first();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', Rule::unique('users', 'email')->ignore($guest?->id)],
            'phone' => ['nullable', 'string', 'max:20', 'regex:/^\+?[0-9\s-]{7,20}$/', Rule::unique('users', 'phone')->ignore($guest?->id)],
            'password' => ['required', 'confirmed', Password::defaults()],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $details = [
            'name' => $validated['name'],
            'phone' => $validated['phone'] ?? $guest?->phone,
            'password' => $validated['password'],
            'status' => User::STATUS_ACTIVE,
        ];

        if ($guest) {
            $guest->update($details);
            $user = $guest;
        } else {
            $user = User::create($details + ['email' => $validated['email'], 'type' => User::TYPE_CUSTOMER]);
            $user->assignRole(Role::Customer->value);
        }

        event(new Registered($user));

        return $this->tokenResponse($user, $validated['device_name'] ?? 'web', Response::HTTP_CREATED);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $user = User::where('email', strtolower($validated['email']))->first();

        if ($user?->isGuest()) {
            throw ValidationException::withMessages([
                'email' => 'You booked with this email as a guest. Create an account with it to sign in and see your bookings.',
            ]);
        }

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            ActivityLog::record(ActivityLog::LOGIN_FAILED, 'Failed sign-in', $user, $request, [
                'properties' => ['email' => strtolower($validated['email'])],
            ]);

            throw ValidationException::withMessages([
                'email' => 'These credentials do not match our records.',
            ]);
        }

        if (! $user->isActive()) {
            throw ValidationException::withMessages([
                'email' => 'This account has been suspended. Please contact Reenite support.',
            ]);
        }

        $user->forceFill(['last_login_at' => now()])->save();
        ActivityLog::record(ActivityLog::LOGIN, 'Signed in', $user, $request);

        return $this->tokenResponse($user, $validated['device_name'] ?? 'web');
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    public function logout(Request $request): Response
    {
        $request->user()->currentAccessToken()?->delete();
        ActivityLog::record(ActivityLog::LOGOUT, 'Signed out', $request->user(), $request);

        return response()->noContent();
    }

    private function tokenResponse(User $user, string $deviceName, int $status = Response::HTTP_OK): JsonResponse
    {
        $token = $user->createToken($deviceName)->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new UserResource($user),
        ], $status);
    }
}
