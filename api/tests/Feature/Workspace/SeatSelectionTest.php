<?php

namespace Tests\Feature\Workspace;

use App\Enums\Role;
use App\Models\Booking;
use App\Models\CancellationPolicy;
use App\Models\Location;
use App\Models\Space;
use App\Models\SpaceSeat;
use App\Models\SpaceType;
use App\Models\User;
use App\Support\Settings;
use App\Workspace\BookingService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SeatSelectionTest extends TestCase
{
    use RefreshDatabase;

    private Space $desk;

    private Space $room;

    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        // Monday 2 November 2026, 8:00am in Uyo. Bookings below are for Tuesday.
        $this->travelTo('2026-11-02 07:00:00');
        app(Settings::class)->set('workspace.booking_destination', BookingService::DESTINATION_INTERNAL);

        $location = Location::factory()->create(['name' => 'Reenite Uyo']);
        $policy = CancellationPolicy::factory()->create(['rules' => [['hours_before' => 0, 'refund_percent' => 100]]]);

        $this->desk = Space::factory()->for($location)->for(SpaceType::factory()->create(['booking_mode' => SpaceType::SHARED]), 'type')->create([
            'name' => 'Hot Desk', 'slug' => 'hot-desk', 'capacity' => 10, 'min_duration_minutes' => 60, 'cancellation_policy_id' => $policy->id,
        ]);
        $this->desk->rates()->create(['unit' => 'hour', 'price' => 120_000, 'is_active' => true]);

        $this->room = Space::factory()->for($location)->for(SpaceType::factory()->create(['booking_mode' => SpaceType::EXCLUSIVE]), 'type')->create([
            'name' => 'Meeting Room', 'slug' => 'meeting-room', 'capacity' => 10, 'min_duration_minutes' => 60, 'cancellation_policy_id' => $policy->id,
        ]);
        $this->room->rates()->create(['unit' => 'hour', 'price' => 750_000, 'is_active' => true]);

        $this->manager = User::factory()->staff()->create()->assignRole(Role::OperationsManager->value);
    }

    /**
     * @return array<string, mixed>
     */
    private function deskBooking(array $overrides = []): array
    {
        return $overrides + ['space' => 'hot-desk', 'date' => '2026-11-03', 'start_time' => '10:00', 'rate_unit' => 'hour', 'quantity' => 2, 'seats' => 1];
    }

    private function signIn(User $user): static
    {
        Sanctum::actingAs($user);

        return $this;
    }

    /**
     * Three seats: Desk 1 and Desk 2 by the window, Desk 3 switched off.
     *
     * @return array{0: SpaceSeat, 1: SpaceSeat, 2: SpaceSeat}
     */
    private function seats(): array
    {
        return [
            SpaceSeat::factory()->for($this->desk)->create(['label' => 'Desk 1', 'zone' => 'Window', 'sort_order' => 1]),
            SpaceSeat::factory()->for($this->desk)->create(['label' => 'Desk 2', 'zone' => 'Window', 'sort_order' => 2]),
            SpaceSeat::factory()->for($this->desk)->inactive()->create(['label' => 'Desk 3', 'sort_order' => 3]),
        ];
    }

    public function test_staff_add_numbered_seats_that_carry_on_from_the_last_number(): void
    {
        $this->signIn($this->manager);

        $this->postJson("/api/v1/admin/workspace/spaces/{$this->desk->id}/seats", ['prefix' => 'Desk', 'count' => 3, 'zone' => 'Window'])
            ->assertCreated()
            ->assertJsonPath('data.0.label', 'Desk 1')
            ->assertJsonPath('data.2.label', 'Desk 3');
        $this->postJson("/api/v1/admin/workspace/spaces/{$this->desk->id}/seats", ['prefix' => 'Desk', 'count' => 2])
            ->assertCreated()
            ->assertJsonPath('data.0.label', 'Desk 4');

        $this->getJson("/api/v1/admin/workspace/spaces/{$this->desk->id}/seats")->assertOk()->assertJsonCount(5, 'data');
        $this->postJson("/api/v1/admin/workspace/spaces/{$this->room->id}/seats", ['prefix' => 'Desk', 'count' => 2])->assertStatus(422);
    }

    public function test_staff_cannot_add_seats_without_permission(): void
    {
        $this->signIn(User::factory()->create())
            ->postJson("/api/v1/admin/workspace/spaces/{$this->desk->id}/seats", ['prefix' => 'Desk', 'count' => 1])
            ->assertForbidden();
    }

    public function test_a_booked_seat_can_be_switched_off_but_not_deleted(): void
    {
        [$first, $second] = $this->seats();
        $this->signIn(User::factory()->create())->postJson('/api/v1/bookings', $this->deskBooking(['seat_ids' => [$first->id]]))->assertCreated();

        $this->signIn($this->manager);
        $this->deleteJson("/api/v1/admin/workspace/spaces/{$this->desk->id}/seats/{$first->id}")
            ->assertJsonValidationErrors(['seat' => "Desk 1 has bookings, so it can't be deleted. Switch it off instead."]);
        $this->patchJson("/api/v1/admin/workspace/spaces/{$this->desk->id}/seats/{$first->id}", ['is_active' => false])->assertOk()->assertJsonPath('data.is_active', false);
        $this->deleteJson("/api/v1/admin/workspace/spaces/{$this->desk->id}/seats/{$second->id}")->assertNoContent();
    }

    public function test_seats_belong_to_their_own_space_in_admin_urls(): void
    {
        [$first] = $this->seats();

        $this->signIn($this->manager)
            ->patchJson("/api/v1/admin/workspace/spaces/{$this->room->id}/seats/{$first->id}", ['label' => 'Moved'])
            ->assertNotFound();
    }

    public function test_customers_see_which_seats_are_free_for_their_time(): void
    {
        [$first, $second] = $this->seats();
        $this->signIn(User::factory()->create())->postJson('/api/v1/bookings', $this->deskBooking(['seat_ids' => [$first->id]]))->assertCreated();

        $this->getJson('/api/v1/workspace/spaces/hot-desk/seats?date=2026-11-03&start_time=11:00&rate_unit=hour&quantity=1')
            ->assertOk()
            ->assertJsonPath('data.free', 1)
            ->assertJsonCount(2, 'data.seats')
            ->assertJsonPath('data.seats.0', ['id' => $first->id, 'label' => 'Desk 1', 'zone' => 'Window', 'available' => false])
            ->assertJsonPath('data.seats.1.available', true);

        // Later the same day, both are free again.
        $this->getJson('/api/v1/workspace/spaces/hot-desk/seats?date=2026-11-03&start_time=14:00&rate_unit=hour&quantity=1')
            ->assertJsonPath('data.free', 2);

        $this->getJson('/api/v1/workspace/spaces/meeting-room/seats?date=2026-11-03&start_time=10:00&rate_unit=hour&quantity=1')
            ->assertOk()
            ->assertJsonPath('data.seats', [])
            ->assertJsonPath('data.free', null);
    }

    public function test_a_booking_keeps_the_seat_the_customer_chose(): void
    {
        [, $second] = $this->seats();

        $reference = $this->signIn(User::factory()->create())
            ->postJson('/api/v1/bookings', $this->deskBooking(['seat_ids' => [$second->id]]))
            ->assertCreated()
            ->assertJsonPath('data.assigned_seats.0.label', 'Desk 2')
            ->json('data.reference');

        $this->assertSame([$second->id], Booking::where('reference', $reference)->first()->assignedSeats->pluck('id')->all());
    }

    public function test_without_a_choice_the_booking_gets_the_first_free_seats(): void
    {
        [$first, $second] = $this->seats();

        $this->signIn(User::factory()->create())->postJson('/api/v1/bookings', $this->deskBooking())
            ->assertCreated()
            ->assertJsonPath('data.assigned_seats.0.id', $first->id);
        $this->signIn(User::factory()->create())->postJson('/api/v1/bookings', $this->deskBooking())
            ->assertCreated()
            ->assertJsonPath('data.assigned_seats.0.id', $second->id);

        // Desk 3 is switched off, so with two seats taken the desk is full even though capacity is 10.
        $this->signIn(User::factory()->create())->postJson('/api/v1/bookings', $this->deskBooking())
            ->assertJsonValidationErrors(['start_time' => "There aren't enough free seats at Hot Desk then. Try fewer people or another time."]);
    }

    public function test_a_seat_taken_for_that_time_cannot_be_chosen(): void
    {
        [$first] = $this->seats();
        $this->signIn(User::factory()->create())->postJson('/api/v1/bookings', $this->deskBooking(['seat_ids' => [$first->id]]))->assertCreated();

        $this->signIn(User::factory()->create())->postJson('/api/v1/bookings', $this->deskBooking(['start_time' => '11:00', 'seat_ids' => [$first->id]]))
            ->assertJsonValidationErrors(['seat_ids' => 'Desk 1 has just been booked for that time. Please choose another seat.']);
    }

    public function test_the_chosen_seats_must_match_the_number_of_people_and_be_open(): void
    {
        [$first, $second, $off] = $this->seats();
        $customer = User::factory()->create();

        $this->signIn($customer)->postJson('/api/v1/bookings', $this->deskBooking(['seats' => 2, 'seat_ids' => [$first->id]]))
            ->assertJsonValidationErrors(['seat_ids' => 'Choose 2 seats, one for each person.']);
        $this->signIn($customer)->postJson('/api/v1/bookings', $this->deskBooking(['seat_ids' => [$off->id]]))
            ->assertJsonValidationErrors(['seat_ids' => 'One of those seats is no longer available. Please choose again.']);
        $this->signIn($customer)->postJson('/api/v1/bookings', $this->deskBooking(['seats' => 2, 'seat_ids' => [$first->id, $second->id]]))
            ->assertCreated()
            ->assertJsonCount(2, 'data.assigned_seats');
    }

    public function test_bookings_made_before_seats_existed_still_take_up_places(): void
    {
        // Booked while the desk had no seats, so it holds a place but no seat.
        $this->signIn(User::factory()->create())->postJson('/api/v1/bookings', $this->deskBooking())->assertCreated()->assertJsonPath('data.assigned_seats', []);

        $this->seats();

        $this->getJson('/api/v1/workspace/spaces/hot-desk/seats?date=2026-11-03&start_time=10:00&rate_unit=hour&quantity=2')
            ->assertJsonPath('data.free', 1);
    }

    public function test_staff_can_move_a_booking_to_another_free_seat(): void
    {
        [$first, $second] = $this->seats();
        $reference = $this->signIn(User::factory()->create())->postJson('/api/v1/bookings', $this->deskBooking(['seat_ids' => [$first->id]]))->json('data.reference');

        $this->signIn($this->manager)->getJson("/api/v1/admin/bookings/{$reference}/seats")
            ->assertOk()
            ->assertJsonPath('data.current', [$first->id])
            ->assertJsonPath('data.seats.0.available', true);

        $this->putJson("/api/v1/admin/bookings/{$reference}/seats", ['seat_ids' => [$second->id]])
            ->assertOk()
            ->assertJsonPath('data.assigned_seats.0.label', 'Desk 2');
    }

    public function test_spaces_without_seats_book_exactly_as_before(): void
    {
        $this->signIn(User::factory()->create())->postJson('/api/v1/bookings', $this->deskBooking(['seats' => 3]))
            ->assertCreated()
            ->assertJsonPath('data.assigned_seats', []);
        $this->signIn(User::factory()->create())->postJson('/api/v1/bookings', $this->deskBooking(['seat_ids' => [999]]))
            ->assertJsonValidationErrors(['seat_ids' => "Hot Desk doesn't have seats to choose from."]);
    }
}
