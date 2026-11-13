<?php

namespace Tests\Feature\Workspace;

use App\Enums\BookingStatus;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\Location;
use App\Models\Space;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SelfCheckInTest extends TestCase
{
    use RefreshDatabase;

    private Location $location;

    private Space $space;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        // Monday 2 November 2026, 11:00am in Uyo.
        $this->travelTo('2026-11-02 10:00:00');

        $this->location = Location::factory()->create(['name' => 'Reenite Uyo', 'self_check_in' => true]);
        $this->space = Space::factory()->for($this->location)->create();
    }

    /**
     * Starts at 11:20am Uyo time, so self check-in is open (it opens 30 minutes before).
     */
    private function booking(array $overrides = []): Booking
    {
        return Booking::factory()->for($this->space)->create([
            'starts_at' => '2026-11-02 10:20:00',
            'ends_at' => '2026-11-02 12:20:00',
            'check_in_code' => 'K7Q2MX',
            ...$overrides,
        ]);
    }

    public function test_every_location_gets_a_private_link_that_is_never_shown_publicly(): void
    {
        $this->assertSame(32, strlen((string) $this->location->check_in_token));

        $this->getJson('/api/v1/workspace')->assertOk()->assertDontSee($this->location->check_in_token);
    }

    public function test_anyone_can_check_in_with_the_code_from_their_confirmation(): void
    {
        $booking = $this->booking();

        $this->getJson("/api/v1/check-in/{$this->location->check_in_token}")
            ->assertOk()
            ->assertJsonPath('data.location.name', 'Reenite Uyo')
            ->assertJsonPath('data.signed_in', false)
            ->assertJsonPath('data.bookings', []);

        $this->postJson("/api/v1/check-in/{$this->location->check_in_token}", ['code' => ' k7q2mx '])
            ->assertOk()
            ->assertJsonPath('data.reference', $booking->reference)
            ->assertJsonPath('data.status', 'checked_in')
            ->assertJsonPath('message', "You're checked in. Welcome to Reenite Uyo.");

        $booking->refresh();
        $this->assertSame(BookingStatus::CheckedIn, $booking->status);
        $this->assertSame('self', $booking->checked_in_via);
        $this->assertNull($booking->checked_in_by);

        $this->postJson("/api/v1/check-in/{$this->location->check_in_token}", ['code' => 'K7Q2MX'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Already checked in at 11:00am.');
    }

    public function test_signed_in_customers_see_todays_bookings_here_and_tap_to_check_in(): void
    {
        $customer = User::factory()->create(['name' => 'Ada Obi']);
        $now = $this->booking(['user_id' => $customer->id]);
        $later = $this->booking(['user_id' => $customer->id, 'starts_at' => '2026-11-02 15:00:00', 'ends_at' => '2026-11-02 17:00:00', 'check_in_code' => 'P3RT9W']);
        $this->booking(['user_id' => $customer->id, 'starts_at' => '2026-11-05 10:00:00', 'ends_at' => '2026-11-05 12:00:00', 'check_in_code' => 'ZZ22AA']);
        $elsewhere = Space::factory()->for(Location::factory()->create(['self_check_in' => true]))->create();
        Booking::factory()->for($elsewhere)->for($customer)->create(['starts_at' => '2026-11-02 10:20:00', 'ends_at' => '2026-11-02 12:20:00']);
        $this->booking(['check_in_code' => 'OTHER1']);

        Sanctum::actingAs($customer);
        $this->getJson("/api/v1/check-in/{$this->location->check_in_token}")
            ->assertOk()
            ->assertJsonPath('data.signed_in', true)
            ->assertJsonPath('data.customer_name', 'Ada Obi')
            ->assertJsonCount(2, 'data.bookings')
            ->assertJsonPath('data.bookings.0.reference', $now->reference)
            ->assertJsonPath('data.bookings.0.can_check_in', true)
            ->assertJsonPath('data.bookings.1.reference', $later->reference)
            ->assertJsonPath('data.bookings.1.can_check_in', false);

        $this->postJson("/api/v1/check-in/{$this->location->check_in_token}", ['reference' => $now->reference])->assertOk();
        $this->postJson("/api/v1/check-in/{$this->location->check_in_token}", ['reference' => $later->reference])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Check-in opens 30 minutes before the booking starts (2 Nov, 4:00pm).');
    }

    public function test_codes_only_work_at_their_own_location_and_while_check_in_is_open(): void
    {
        $other = Location::factory()->create(['self_check_in' => true]);
        $this->booking();

        $this->postJson("/api/v1/check-in/{$other->check_in_token}", ['code' => 'K7Q2MX'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('code');

        $this->booking(['starts_at' => '2026-11-02 11:00:00', 'ends_at' => '2026-11-02 12:00:00', 'check_in_code' => 'P3RT9W']);
        $this->postJson("/api/v1/check-in/{$this->location->check_in_token}", ['code' => 'P3RT9W'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Check-in opens 30 minutes before the booking starts (2 Nov, 12:00pm).');

        $this->booking(['status' => BookingStatus::Cancelled, 'check_in_code' => 'CANC22']);
        $this->postJson("/api/v1/check-in/{$this->location->check_in_token}", ['code' => 'CANC22'])->assertUnprocessable();
    }

    public function test_the_link_only_works_while_self_check_in_is_switched_on(): void
    {
        $this->booking();
        $this->location->update(['self_check_in' => false]);

        $this->getJson("/api/v1/check-in/{$this->location->check_in_token}")->assertNotFound();
        $this->postJson("/api/v1/check-in/{$this->location->check_in_token}", ['code' => 'K7Q2MX'])->assertNotFound();
        $this->getJson('/api/v1/check-in/not-a-real-token')->assertNotFound();
    }

    public function test_staff_switch_it_on_and_a_new_link_retires_old_posters(): void
    {
        $manager = User::factory()->staff()->create()->assignRole(Role::OperationsManager->value);
        $this->location->update(['self_check_in' => false]);
        $oldToken = $this->location->check_in_token;

        Sanctum::actingAs(User::factory()->create());
        $this->getJson("/api/v1/admin/workspace/locations/{$this->location->id}/self-check-in")->assertForbidden();

        Sanctum::actingAs($manager);
        $this->putJson("/api/v1/admin/workspace/locations/{$this->location->id}/self-check-in", ['enabled' => true])
            ->assertOk()
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.url', rtrim((string) config('app.frontend_url'), '/')."/check-in/{$oldToken}");

        $newUrl = $this->postJson("/api/v1/admin/workspace/locations/{$this->location->id}/self-check-in/regenerate")->assertOk()->json('data.url');
        $this->assertStringNotContainsString($oldToken, $newUrl);

        $this->getJson("/api/v1/check-in/{$oldToken}")->assertNotFound();
        $this->getJson('/api/v1/check-in/'.$this->location->fresh()->check_in_token)->assertOk();
    }

    public function test_desk_check_ins_are_marked_as_done_by_staff(): void
    {
        $frontDesk = User::factory()->staff()->create()->assignRole(Role::FrontDesk->value);
        $booking = $this->booking();

        Sanctum::actingAs($frontDesk);
        $this->postJson('/api/v1/admin/bookings/check-in', ['code' => 'K7Q2MX'])->assertOk()->assertJsonPath('data.checked_in_via', 'desk');
    }
}
