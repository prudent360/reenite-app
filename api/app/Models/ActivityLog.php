<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Who did what, and from where: admin changes, sign-ins and failed sign-ins.
 * Rows are written once and never edited; anything older than a year is pruned.
 */
class ActivityLog extends Model
{
    use MassPrunable;

    public const LOGIN = 'auth.login';

    public const LOGIN_FAILED = 'auth.login_failed';

    public const LOGOUT = 'auth.logout';

    public const ADMIN_CHANGE = 'admin.change';

    public const EVENTS = [self::LOGIN, self::LOGIN_FAILED, self::LOGOUT, self::ADMIN_CHANGE];

    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'event', 'description', 'route', 'method', 'path', 'status', 'properties', 'ip', 'user_agent'];

    protected function casts(): array
    {
        return [
            'properties' => 'array',
            'status' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @param  array<string, mixed>  $attributes */
    public static function record(string $event, string $description, ?User $user, Request $request, array $attributes = []): self
    {
        return self::create([
            'event' => $event,
            'description' => Str::limit($description, 250),
            'user_id' => $user?->id,
            'ip' => $request->ip(),
            'user_agent' => Str::limit((string) $request->userAgent(), 250, ''),
            ...$attributes,
        ]);
    }

    public function prunable(): Builder
    {
        return static::where('created_at', '<', now()->subYear());
    }
}
