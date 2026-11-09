<?php

use App\Models\ActivityLog;
use App\Workspace\BookingService;
use App\Workspace\PlanService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('bookings:expire-holds', function (BookingService $bookings) {
    $this->info($bookings->expireHolds().' unpaid holds released.');
})->purpose('Release booking holds whose payment window has passed');

Artisan::command('bookings:complete', function (BookingService $bookings) {
    $this->info($bookings->completeEnded().' bookings completed.');
})->purpose('Mark bookings that have ended as completed');

Artisan::command('bookings:remind', function (BookingService $bookings) {
    $this->info($bookings->sendReminders().' reminders sent.');
})->purpose('Email customers the day before their booking');

Artisan::command('plans:expire', function (PlanService $plans) {
    $this->info($plans->expireEnded().' passes and memberships ended.');
})->purpose('End passes and memberships whose period is over');

Schedule::command('bookings:expire-holds')->everyMinute()->withoutOverlapping()->onOneServer();
Schedule::command('bookings:complete')->everyFifteenMinutes()->withoutOverlapping()->onOneServer();
Schedule::command('bookings:remind')->hourly()->withoutOverlapping()->onOneServer();
Schedule::command('plans:expire')->hourly()->withoutOverlapping()->onOneServer();

// Daily backups at 2am Lagos time: the database every night, uploaded files too on Sundays.
Schedule::command('app:backup')->dailyAt('02:00')->timezone('Africa/Lagos')->withoutOverlapping()->onOneServer();
Schedule::command('app:backup --files')->weeklyOn(0, '02:30')->timezone('Africa/Lagos')->withoutOverlapping()->onOneServer();

// Activity older than a year is removed.
Schedule::command('model:prune', ['--model' => [ActivityLog::class]])->daily();

// Shared hosting: run queued emails and jobs from cron (see config/queue.php).
if (config('queue.run_from_scheduler')) {
    Schedule::command('queue:work --stop-when-empty --max-time=50 --tries=3')->everyMinute()->withoutOverlapping(5);
}
