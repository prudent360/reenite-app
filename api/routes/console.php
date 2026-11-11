<?php

use App\Appointments\AppointmentService;
use App\Compliance\ComplianceCalendar;
use App\Consultations\ConsultationService;
use App\Models\ActivityLog;
use App\Payments\PaymentReminders;
use App\Workspace\BookingService;
use App\Workspace\PlanService;
use App\Workspace\RenewalService;
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

Artisan::command('compliance:refresh', function (ComplianceCalendar $calendar) {
    $this->info($calendar->refreshAll().' business calendars refreshed.');
})->purpose('Roll compliance deadlines forward (monthly VAT and PAYE, yearly returns)');

Artisan::command('compliance:remind', function (ComplianceCalendar $calendar) {
    $this->info($calendar->sendReminders().' deadline reminders sent.');
})->purpose('Email customers about deadlines coming up or missed');

Artisan::command('consultations:expire-holds', function (ConsultationService $consultations) {
    $this->info($consultations->expireHolds().' unpaid consultation holds released.');
})->purpose('Release consultation times whose payment window has passed');

Artisan::command('appointments:remind', function (AppointmentService $appointments) {
    $sent = $appointments->sendReminders();
    $this->info("{$sent['day']} day-before and {$sent['soon']} starting-soon appointment reminders sent.");
})->purpose('Remind clients the day before and an hour before appointments staff booked');

Artisan::command('consultations:remind', function (ConsultationService $consultations) {
    $this->info($consultations->sendReminders().' consultation reminders sent.');
})->purpose('Email customers the day before their consultation');

Artisan::command('plans:renew', function (RenewalService $renewals) {
    $result = $renewals->run();
    $this->info("{$result['notices']} renewal notices, {$result['charged']} renewed, {$result['failed']} failed, {$result['abandoned']} unpaid renewals cancelled.");
})->purpose('Renewal notices, automatic card renewals and clean-up of unpaid renewals');

Artisan::command('billing:remind', function (PaymentReminders $reminders) {
    $result = $reminders->run();
    $this->info("{$result['invoices']} invoice reminders and {$result['nudges']} checkout nudges sent.");
})->purpose('Remind customers about unpaid invoices and unfinished checkouts');

Schedule::command('bookings:expire-holds')->everyMinute()->withoutOverlapping()->onOneServer();
Schedule::command('bookings:complete')->everyFifteenMinutes()->withoutOverlapping()->onOneServer();
Schedule::command('bookings:remind')->hourly()->withoutOverlapping()->onOneServer();
Schedule::command('consultations:expire-holds')->everyMinute()->withoutOverlapping()->onOneServer();
Schedule::command('consultations:remind')->hourly()->withoutOverlapping()->onOneServer();
// Appointment reminders: the day before and about an hour before, so checked often.
Schedule::command('appointments:remind')->everyFiveMinutes()->withoutOverlapping()->onOneServer();
Schedule::command('plans:renew')->hourly()->withoutOverlapping()->onOneServer();
Schedule::command('billing:remind')->dailyAt('09:00')->timezone('Africa/Lagos')->withoutOverlapping()->onOneServer();
Schedule::command('plans:expire')->hourly()->withoutOverlapping()->onOneServer();

// Compliance: roll the calendar forward overnight, then remind at 8am Lagos time.
Schedule::command('compliance:refresh')->dailyAt('05:00')->timezone('Africa/Lagos')->withoutOverlapping()->onOneServer();
Schedule::command('compliance:remind')->dailyAt('08:00')->timezone('Africa/Lagos')->withoutOverlapping()->onOneServer();

// Daily backups at 2am Lagos time: the database every night, uploaded files too on Sundays.
Schedule::command('app:backup')->dailyAt('02:00')->timezone('Africa/Lagos')->withoutOverlapping()->onOneServer();
Schedule::command('app:backup --files')->weeklyOn(0, '02:30')->timezone('Africa/Lagos')->withoutOverlapping()->onOneServer();

// Activity older than a year is removed.
Schedule::command('model:prune', ['--model' => [ActivityLog::class]])->daily();

// Shared hosting: run queued emails and jobs from cron (see config/queue.php).
if (config('queue.run_from_scheduler')) {
    Schedule::command('queue:work --stop-when-empty --max-time=50 --tries=3')->everyMinute()->withoutOverlapping(5);
}
