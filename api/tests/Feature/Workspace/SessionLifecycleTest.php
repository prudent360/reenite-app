<?php

namespace Tests\Feature\Workspace;

use App\Enums\BookingStatus;
use App\Enums\EmailTemplateKey;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\Location;
use App\Models\Space;
use App\Models\User;
use App\Notifications\BookingNotification;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SessionLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private Space $space;

    private User $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        // Monday 2 November 2026, 11:00am in Uyo.
        $this->travelTo('2026-11-02 10:00:00');
        Notification::fake();

        $this->space = Space::factory()->for(Location::factory()->create(['name' => 'Reenite Uyo']))->create(['name' => 'Hot Desk Area']);
        $this->customer = User::factory()->create(['name' => 'Ada Obi']);
    }

    private function booking(string $startsAt, string $endsAt, array $overrides = []): Booking
    {
        return Booking::factory()->for($this->space)->for($this->customer)->create([
            'starts_at' => $startsAt, 'ends_at' => $endsAt, 'space_name' => 'Hot Desk Area', ...$overrides,
        ]);
    }

    private function assertSentKey(EmailTemplateKey $key, Booking $booking, ?callable $extra = null): void
    {
        Notification::assertSentTo($this->customer, BookingNotification::class, fn (BookingNotification $notification) => $notification->key === $key
            && $notification->booking->is($booking)
            && ($extra === null || $extra($notification->extra)));
    }

    public function test_customers_hear_shortly_before_their_session_ends_once(): void
    {
        $endingNow = $this->booking('2026-11-02 07:10:00', '2026-11-02 10:10:00', ['status' => BookingStatus::CheckedIn]);
        $notYet = $this->booking('2026-11-02 08:00:00', '2026-11-02 10:30:00');
        $month = $this->booking('2026-10-05 08:00:00', '2026-11-04 08:00:00', ['rate_unit' => 'month', 'quantity' => 1]);
        $upcoming = $this->booking('2026-11-02 10:05:00', '2026-11-02 10:12:00');

        $this->artisan('bookings:remind-ending')->expectsOutputToContain('2 "ending soon" messages sent.')->assertSuccessful();

        $this->assertSentKey(EmailTemplateKey::BookingEndingSoon, $endingNow, fn (array $extra) => $extra === ['time_left' => '10 minutes', 'end_time' => '11:10am today']);
        $this->assertSentKey(EmailTemplateKey::BookingEndingSoon, $month, fn (array $extra) => $extra['time_left'] === '2 days' && $extra['end_time'] === '9:00am, Wed 4 Nov');
        Notification::assertNotSentTo($this->customer, BookingNotification::class, fn (BookingNotification $notification) => $notification->booking->is($notYet) || $notification->booking->is($upcoming));

        $this->artisan('bookings:remind-ending')->expectsOutputToContain('0 "ending soon" messages sent.');
        Notification::assertSentToTimes($this->customer, BookingNotification::class, 2);
    }

    public function test_sessions_complete_on_time_and_customers_are_told(): void
    {
        $justEnded = $this->booking('2026-11-02 07:00:00', '2026-11-02 09:55:00', ['status' => BookingStatus::CheckedIn]);
        $longAgo = $this->booking('2026-10-30 08:00:00', '2026-10-30 10:00:00');
        $running = $this->booking('2026-11-02 09:00:00', '2026-11-02 12:00:00');

        $this->artisan('bookings:complete')->expectsOutputToContain('2 bookings completed.')->assertSuccessful();

        $this->assertSame(BookingStatus::Completed, $justEnded->fresh()->status);
        $this->assertSame(BookingStatus::Completed, $longAgo->fresh()->status);
        $this->assertSame(BookingStatus::Confirmed, $running->fresh()->status);
        $this->assertSentKey(EmailTemplateKey::BookingEnded, $justEnded, fn (array $extra) => $extra === ['end_time' => '10:55am today']);
        Notification::assertSentToTimes($this->customer, BookingNotification::class, 1);
        $this->assertNotNull($justEnded->fresh()->ended_notice_sent_at);
    }

    public function test_booking_staff_end_a_session_early_from_the_monitor(): void
    {
        $manager = User::factory()->staff()->create()->assignRole(Role::FrontDesk->value);
        $finance = User::factory()->staff()->create()->assignRole(Role::Finance->value);
        $session = $this->booking('2026-11-02 08:00:00', '2026-11-02 12:00:00', ['status' => BookingStatus::CheckedIn]);
        $later = $this->booking('2026-11-02 14:00:00', '2026-11-02 16:00:00');

        Sanctum::actingAs($finance);
        $this->postJson("/api/v1/admin/bookings/{$session->reference}/end")->assertForbidden();

        Sanctum::actingAs($manager);
        $this->postJson("/api/v1/admin/bookings/{$later->reference}/end")
            ->assertUnprocessable()
            ->assertJsonPath('message', "This session hasn't started yet. Cancel the booking instead.");
        $this->postJson("/api/v1/admin/bookings/{$session->reference}/end")->assertOk()->assertJsonPath('data.status', 'completed');

        $session->refresh();
        $this->assertSame($manager->id, $session->ended_by);
        $this->assertNotNull($session->ended_early_at);
        $this->assertFalse($session->isOccupying());
        $this->assertSentKey(EmailTemplateKey::BookingEnded, $session, fn (array $extra) => $extra === ['end_time' => '11:00am today']);

        $this->artisan('bookings:complete');
        Notification::assertSentToTimes($this->customer, BookingNotification::class, 1);
    }

    public function test_the_monitor_shows_who_is_in_who_is_late_and_who_is_still_due_today(): void
    {
        $frontDesk = User::factory()->staff()->create()->assignRole(Role::FrontDesk->value);
        $this->booking('2026-11-02 08:00:00', '2026-11-02 12:00:00', ['status' => BookingStatus::CheckedIn, 'checked_in_at' => '2026-11-02 08:05:00']);
        $late = $this->booking('2026-11-02 09:00:00', '2026-11-02 13:00:00');
        $endingSoon = $this->booking('2026-11-02 07:00:00', '2026-11-02 10:10:00', ['status' => BookingStatus::CheckedIn]);
        $month = $this->booking('2026-10-20 08:00:00', '2026-11-20 08:00:00', ['rate_unit' => 'month', 'quantity' => 1]);
        $upcoming = $this->booking('2026-11-02 15:00:00', '2026-11-02 17:00:00');
        $this->booking('2026-11-03 09:00:00', '2026-11-03 11:00:00');
        $this->booking('2026-11-02 07:00:00', '2026-11-02 09:00:00', ['status' => BookingStatus::Completed]);
        $this->booking('2026-11-02 09:00:00', '2026-11-02 11:00:00', ['status' => BookingStatus::Cancelled]);

        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/v1/admin/bookings/monitor')->assertForbidden();

        Sanctum::actingAs($frontDesk);
        $response = $this->getJson('/api/v1/admin/bookings/monitor')
            ->assertOk()
            ->assertJsonPath('data.counts', ['active' => 4, 'ending_soon' => 1, 'not_arrived' => 1, 'upcoming' => 1, 'checked_in' => 2])
            ->assertJsonCount(5, 'data.sessions');

        $sessions = collect($response->json('data.sessions'))->keyBy('reference');
        $this->assertTrue($sessions[$late->reference]['not_arrived']);
        $this->assertTrue($sessions[$endingSoon->reference]['ending_soon']);
        $this->assertFalse($sessions[$month->reference]['not_arrived']);
        $this->assertSame('1 month', $sessions[$month->reference]['length_label']);
        $this->assertSame('upcoming', $sessions[$upcoming->reference]['phase']);
        $this->assertSame('Ada Obi', $sessions[$upcoming->reference]['customer']['name']);
    }
}
