<?php

namespace App\Http\Middleware;

use App\Models\ActivityLog;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Records every change a staff member makes through the admin API: what they changed,
 * which fields they sent (names only, never values) and whether it worked.
 */
class LogAdminActivity
{
    /** Field names that hint at a secret are left out even as names. */
    private const SECRET_HINTS = ['password', 'secret', 'token', 'key', 'signature'];

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true) && $request->user()) {
            $route = $request->route();
            $name = (string) $route?->getName();

            ActivityLog::record(ActivityLog::ADMIN_CHANGE, $this->describe($request->method(), $name), $request->user(), $request, [
                'route' => $name ?: null,
                'method' => $request->method(),
                'path' => Str::limit('/'.$request->path(), 250, ''),
                'status' => $response->getStatusCode(),
                'properties' => array_filter([
                    'subject' => collect($route?->parameters() ?? [])
                        ->map(fn ($value) => is_object($value) && method_exists($value, 'getRouteKey') ? $value->getRouteKey() : $value)
                        ->filter(fn ($value) => is_scalar($value))
                        ->all(),
                    'fields' => $this->fieldNames($request),
                ]),
            ]);
        }

        return $response;
    }

    /** "admin.services.update" becomes "Updated services". */
    private function describe(string $method, string $routeName): string
    {
        $parts = array_values(array_filter(explode('.', Str::after($routeName, 'admin.'))));
        $action = count($parts) > 1 ? array_pop($parts) : null;
        $subject = str_replace(['-', '_'], ' ', implode(' ', $parts) ?: 'admin');

        $verb = match ($action) {
            'store' => 'Created',
            'update' => 'Updated',
            'destroy' => 'Deleted',
            null => match ($method) {
                'DELETE' => 'Deleted',
                'POST' => 'Created',
                default => 'Updated',
            },
            default => 'Changed',
        };

        // Custom actions read as "Changed orders assign", "Changed customers status".
        $extra = in_array($action, [null, 'store', 'update', 'destroy'], true) ? '' : ' '.str_replace(['-', '_'], ' ', $action);

        return trim("{$verb} {$subject}{$extra}");
    }

    /** @return list<string> */
    private function fieldNames(Request $request): array
    {
        return collect(array_keys($request->except(['_method'])))
            ->merge(array_keys($request->allFiles()))
            ->unique()
            ->reject(fn (string $field) => Str::contains(strtolower($field), self::SECRET_HINTS))
            ->take(30)
            ->values()
            ->all();
    }
}
