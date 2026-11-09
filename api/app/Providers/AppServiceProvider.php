<?php

namespace App\Providers;

use App\Models\User;
use App\Support\MailSettings;
use App\Support\Settings;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->scoped(Settings::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Model::shouldBeStrict(! $this->app->isProduction());

        Password::defaults(fn () => $this->app->isProduction()
            ? Password::min(8)->letters()->numbers()->uncompromised()
            : Password::min(8));

        // Super Admin can do everything; other roles go through their permissions.
        Gate::before(fn (User $user) => $user->isSuperAdmin() ? true : null);

        // Sign-in, sign-up and password resets: 10 tries a minute from one place, and at most
        // 30 an hour against one email address, however many places they come from.
        RateLimiter::for('auth', function (Request $request) {
            $email = strtolower((string) $request->input('email'));

            return [
                Limit::perMinute(10)->by('minute|'.$email.'|'.$request->ip()),
                Limit::perHour(30)->by('hour|'.$email),
            ];
        });

        // Email delivery settings from Admin > Settings > Email, applied before any mailer is built.
        $this->app->afterResolving('mail.manager', fn () => MailSettings::apply());
    }
}
