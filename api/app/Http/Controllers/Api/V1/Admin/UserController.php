<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in([User::STATUS_ACTIVE, User::STATUS_SUSPENDED])],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $customers = User::query()
            ->where('type', User::TYPE_CUSTOMER)
            ->with('roles')
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search').'%';
                $query->where(fn ($q) => $q->where('name', 'like', $term)
                    ->orWhere('email', 'like', $term)
                    ->orWhere('phone', 'like', $term));
            })
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return UserResource::collection($customers);
    }

    public function show(User $user): UserResource
    {
        abort_if($user->isStaff(), 404);

        return new UserResource($user->load('roles'));
    }

    public function updateStatus(Request $request, User $user): UserResource
    {
        abort_if($user->isStaff(), 404);

        $validated = $request->validate([
            'status' => ['required', Rule::in([User::STATUS_ACTIVE, User::STATUS_SUSPENDED])],
        ]);

        $user->update($validated);

        if ($user->status === User::STATUS_SUSPENDED) {
            $user->tokens()->delete();
        }

        return new UserResource($user->load('roles'));
    }
}
