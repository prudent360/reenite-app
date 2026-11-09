<?php

use App\Http\Middleware\AcceptUploadGrant;
use App\Http\Middleware\EnsureUserIsStaff;
use App\Http\Middleware\LogAdminActivity;
use App\Http\Middleware\TrustWebApp;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // The web app calls the API for its visitors and passes their IP on (kept on e-signatures).
        $middleware->trustProxies(at: array_filter(explode(',', (string) env('TRUSTED_PROXIES', '127.0.0.1,::1'))));
        // In production the website sends a shared key; only then is its X-Forwarded-For believed.
        $middleware->append(TrustWebApp::class);
        // Browsers upload files straight to the API with a short-lived grant (see App\Uploads\UploadGrant).
        $middleware->append(AcceptUploadGrant::class);
        $middleware->alias([
            'staff' => EnsureUserIsStaff::class,
            'audit' => LogAdminActivity::class,
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
