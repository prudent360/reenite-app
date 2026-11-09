<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ActivityLogResource;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class ActivityLogController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'event' => ['nullable', Rule::in(ActivityLog::EVENTS)],
            'user_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:10', 'max:100'],
        ]);

        $timezone = config('app.display_timezone');

        $logs = ActivityLog::query()
            ->with('user:id,name,email,type')
            ->when($request->filled('event'), fn ($query) => $query->where('event', $request->string('event')))
            ->when($request->filled('user_id'), fn ($query) => $query->where('user_id', $request->integer('user_id')))
            ->when($request->filled('from'), fn ($query) => $query->where('created_at', '>=', Carbon::parse($request->string('from'), $timezone)->startOfDay()->utc()))
            ->when($request->filled('to'), fn ($query) => $query->where('created_at', '<=', Carbon::parse($request->string('to'), $timezone)->endOfDay()->utc()))
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search').'%';
                $query->where(fn ($q) => $q->where('description', 'like', $term)
                    ->orWhere('path', 'like', $term)
                    ->orWhere('ip', 'like', $term)
                    ->orWhere('properties', 'like', $term)
                    ->orWhereHas('user', fn ($user) => $user->where('name', 'like', $term)->orWhere('email', 'like', $term)));
            })
            ->latest('id')
            ->paginate($request->integer('per_page', 30));

        return ActivityLogResource::collection($logs);
    }
}
