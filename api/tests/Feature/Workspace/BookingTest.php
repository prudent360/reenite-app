<?php

namespace Tests\Feature\Workspace;

use App\Enums\BookingStatus;
use App\Enums\EmailTemplateKey;
use App\Enums\InvoiceStatus;
use App\Enums\Role;
use App\Models\Addon;
use App\Models\BlackoutDate;
use App\Models\Booking;
use App\Models\CancellationPolicy;
use App\Models\Coupon;
use App\Models\CustomerMembership;
use App\Models\CustomerPass;
use App\Models\Location;
use App\Models\PassPlan;
use App\Models\PaymentGateway;
use App\Models\Space;
use App\Models\SpaceType;
use App\Models\User;
use App\Notifications\BookingNotification;
use App\Notifications\StaffAlertNotification;
use App\Support\Settings;
use App\Workspace\BookingService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class BookingTest extends TestCase
{
    use RefreshDatabase;

    private Space $room;

    private Space $desk;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        // Monday 2 November 2026, 8:00am in Uyo. Bookings below are for Tuesday.
        $this->travelTo('2026-11-02 07:00:00');

        PaymentGateway::where('code', 'paystack')->first()->update([
            'is_enabled' => true,
            'mode' => 'test',
            'credentials' => ['test' => ['public_key' => 'pk_test_abc', 'secret_key' => 'sk_test_secret123456789']],
        ]);
        app(Settings::class)->set('workspace.booking_destination', BookingService::DESTINATION_INTERNAL);

        // Open Mon to Sat, 9am to 8pm; closed Sundays.
        $location = Location::factory()->create(['name' => 'Reenite Uyo']);
        $policy = CancellationPolicy::factory()->create(['rules' => [['hours_before' => 24, 'refund_percent' => 100], ['hours_before' => 0, 'refund_percent' => 0]]]);

        $this->room = Space::factory()->for($location)->for(SpaceType::factory()->create(['booking_mode' => SpaceType::EXCLUSIVE]), 'type')->create([
            'name' => 'Meeting Room', 'slug' => 'meeting-room', 'capacity' => 10, 'min_duration_minutes' => 60,
            'buffer_minutes' => 15, 'min_notice_minutes' => 120, 'advance_booking_days' => 90, 'cancellation_policy_id' => $policy->id,
        ]);
        $this->room->rates()->createMany([['unit' => 'hour', 'price' => 750_000, 'is_active' => true], ['unit' => 'day', 'price' => 2_500_000, 'is_active' => true]]);

        $this->desk = Space::factory()->for($location)->for(SpaceType::factory()->create(['booking_mode' => SpaceType::SHARED]), 'type')->create([
            'name' => 'Hot Desk', 'slug' => 'hot-desk', 'capacity' => 2, 'min_duration_minutes' => 60, 'cancellation_policy_id' => $policy->id,
        ]);
        $this->desk->rates()->create(['unit' => 'hour', 'price' => 120_000, 'is_active' => true]);
    }

    /**
     * Booking routes also serve guests, so they read the user from the Sanctum guard directly;
     * signing in through Sanctum keeps that guard in step when a test switches people.
     */
    private function signIn(User $user): static
    {
        Sanctum::actingAs($user);

        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    private function roomBooking(array $overrides = []): array
    {
        return $overrides + ['space' => 'meeting-room', 'date' => '2026-11-03', 'start_time' => '10:00', 'rate_unit' => 'hour', 'quantity' => 2, 'seats' => 4];
    }

    /**
     * @return array<string, mixed>
     */
    private function guest(): array
    {
        return ['name' => 'Ada Obi', 'email' => 'ada@example.com', 'phone' => '08031234567'];
    }

    private function fakePaystack(int $amount): void
    {
        Http::fake([
            'api.paystack.co/transaction/initialize' => Http::response(['status' => true, 'data' => ['authorization_url' => 'https://checkout.paystack.com/abc123', 'access_code' => 'abc123']]),
            'api.paystack.co/transaction/verify/*' => Http::response(['status' => true, 'data' => [
                'id' => 4099260516, 'status' => 'success', 'amount' => $amount, 'currency' => 'NGN', 'channel' => 'card', 'gateway_response' => 'Approved',
            ]]),
            'api.paystack.co/refund' => Http::response(['status' => true, 'data' => ['id' => 777]]),
        ]);
    }

    /**
     * Pays for a held booking the way the browser does: start payment, come back, verify.
     */
    private function payOnline(Booking $booking, string $token): void
    {
        $this->fakePaystack($booking->total);
        $reference = $this->postJson("/api/v1/bookings/{$booking->reference}/pay", ['gateway' => 'paystack', 'token' => $token])
            ->assertCreated()
            ->json('reference');
        $this->postJson("/api/v1/bookings/{$booking->reference}/payments/{$reference}/verify", ['token' => $token])->assertOk();
    }

    public function test_booking_is_refused_while_the_switch_points_to_the_booking_site(): void
    {
        app(Settings::class)->set('workspace.booking_destination', BookingService::DESTINATION_EXTERNAL);

        $this->getJson('/api/v1/workspace/booking-settings')
            ->assertOk()
            ->assertJson(['destination' => 'external', 'external_url' => 'https://book.reenite.com']);
        $this->postJson('/api/v1/bookings', $this->roomBooking() + $this->guest())
            ->assertForbidden()
            ->assertJsonPath('message', 'Online booking on this site is paused. Please book at https://book.reenite.com.');
        $this->assertDatabaseCount('bookings', 0);
    }

    public function test_only_settings_managers_can_flip_the_booking_switch(): void
    {
        $frontDesk = User::factory()->staff()->create()->assignRole(Role::FrontDesk->value);
        $admin = User::factory()->staff()->create()->assignRole(Role::SuperAdmin->value);
        $payload = ['destination' => 'external', 'external_url' => 'https://book.reenite.com'];

        $this->signIn($frontDesk)->putJson('/api/v1/admin/settings/workspace', $payload)->assertForbidden();
        $this->signIn($admin)->putJson('/api/v1/admin/settings/workspace', ['destination' => 'external', 'external_url' => 'book.reenite.com'])
            ->assertJsonValidationErrors(['external_url' => 'Enter the full address of the booking site, starting with https://.']);
        $this->signIn($admin)->putJson('/api/v1/admin/settings/workspace', $payload)
            ->assertOk()
            ->assertJsonPath('data.destination', 'external');

        $this->assertFalse(app(BookingService::class)->isOpen());
    }

    public function test_quote_prices_the_space_extras_and_membership_discount(): void
    {
        $projector = Addon::factory()->create(['name' => 'Projector', 'price' => 500_000, 'charge_type' => 'per_booking']);
        $water = Addon::factory()->create(['name' => 'Water', 'price' => 20_000, 'charge_type' => 'per_person']);
        $this->room->addons()->attach([$projector->id, $water->id]);
        $member = User::factory()->create();
        CustomerMembership::factory()->for($member)->create(['name' => 'Pro', 'discount_percent' => 15]);

        $this->signIn($member)->postJson('/api/v1/bookings/quote', $this->roomBooking(['addons' => [['id' => $projector->id, 'quantity' => 1], ['id' => $water->id, 'quantity' => 1]]]))
            ->assertOk()
            // 2 hours × ₦7,500, projector ₦5,000, water ₦200 × 4 people, 15% off the room.
            ->assertJsonPath('data.subtotal', 1_500_000)
            ->assertJsonPath('data.addons_total', 580_000)
            ->assertJsonPath('data.discount', 225_000)
            ->assertJsonPath('data.discount_label', 'Pro membership (15% off)')
            ->assertJsonPath('data.total', 1_855_000)
            ->assertJsonPath('data.starts_at', '2026-11-03T09:00:00+00:00')
            ->assertJsonPath('data.ends_at', '2026-11-03T11:00:00+00:00');
    }

    public function test_shared_spaces_are_priced_per_person(): void
    {
        $this->postJson('/api/v1/bookings/quote', ['space' => 'hot-desk', 'date' => '2026-11-03', 'start_time' => '09:00', 'rate_unit' => 'hour', 'quantity' => 3, 'seats' => 2])
            ->assertOk()
            ->assertJsonPath('data.total', 720_000);
    }

    public function test_guest_books_pays_online_and_the_booking_is_confirmed(): void
    {
        Notification::fake();
        $frontDesk = User::factory()->staff()->create()->assignRole(Role::FrontDesk->value);

        $response = $this->postJson('/api/v1/bookings', $this->roomBooking() + $this->guest())
            ->assertCreated()
            ->assertJsonPath('data.status', 'held')
            ->assertJsonPath('data.total', 1_500_000)
            ->assertJsonPath('data.hold_expires_at', '2026-11-02T07:15:00+00:00')
            ->assertJsonPath('data.check_in_code', null);
        $booking = Booking::firstOrFail();
        $guest = User::firstWhere('email', 'ada@example.com');
        $this->assertTrue($guest->isGuest());
        $this->assertSame(1_500_000, $booking->invoice->total);

        $this->payOnline($booking, $response->json('token'));

        Http::assertSent(fn (Request $request) => str_contains($request->url(), '/transaction/initialize')
            && str_contains((string) $request['callback_url'], "/bookings/{$booking->reference}/return/"));
        $booking->refresh();
        $this->assertSame(BookingStatus::Confirmed, $booking->status);
        $this->assertSame('online', $booking->paid_via);
        $this->assertMatchesRegularExpression('/^[A-Z2-9]{6}$/', (string) $booking->check_in_code);
        $this->assertSame(InvoiceStatus::Paid, $booking->invoice->status);
        Notification::assertSentTo($guest, BookingNotification::class, fn (BookingNotification $notification) => $notification->key === EmailTemplateKey::BookingConfirmed);
        Notification::assertSentTo($guest, BookingNotification::class, fn (BookingNotification $notification) => $notification->key === EmailTemplateKey::GuestAccountInvite);
        Notification::assertSentTo($frontDesk, StaffAlertNotification::class, fn (StaffAlertNotification $notification) => $notification->key === EmailTemplateKey::StaffNewBooking);
    }

    public function test_a_guest_uses_a_discount_code_and_pays_the_lower_amount(): void
    {
        Notification::fake();
        Coupon::factory()->create(['code' => 'DESK20', 'discount_value' => 20, 'applies_to' => 'bookings']);
        $response = $this->postJson('/api/v1/bookings', $this->roomBooking() + $this->guest())->assertCreated();
        $booking = Booking::firstOrFail();
        $token = $response->json('token');

        $this->postJson("/api/v1/bookings/{$booking->reference}/coupon", ['code' => 'desk20'])->assertNotFound();
        $this->postJson("/api/v1/bookings/{$booking->reference}/coupon", ['code' => 'desk20', 'token' => $token])
            ->assertOk()
            ->assertJsonPath('data.total', 1_500_000)
            ->assertJsonPath('data.invoice.total', 1_200_000)
            ->assertJsonPath('data.invoice.coupon_code', 'DESK20');

        $this->fakePaystack(1_200_000);
        $reference = $this->postJson("/api/v1/bookings/{$booking->reference}/pay", ['gateway' => 'paystack', 'token' => $token])->assertCreated()->json('reference');
        $this->postJson("/api/v1/bookings/{$booking->reference}/payments/{$reference}/verify", ['token' => $token])->assertOk();

        $this->assertSame(BookingStatus::Confirmed, $booking->refresh()->status);
        $this->assertSame(1_200_000, $booking->chargedAmount());
    }

    public function test_a_full_discount_code_confirms_the_booking_without_payment(): void
    {
        Notification::fake();
        Coupon::factory()->create(['code' => 'COMP', 'discount_value' => 100]);
        $token = $this->postJson('/api/v1/bookings', $this->roomBooking() + $this->guest())->assertCreated()->json('token');
        $booking = Booking::firstOrFail();

        $this->postJson("/api/v1/bookings/{$booking->reference}/coupon", ['code' => 'COMP', 'token' => $token])
            ->assertOk()
            ->assertJsonPath('data.status', 'confirmed')
            ->assertJsonPath('data.invoice.status', 'paid');
        $this->assertNotNull($booking->refresh()->check_in_code);
    }

    public function test_a_booking_needs_its_token_unless_the_owner_is_signed_in(): void
    {
        $owner = User::factory()->create();
        $booking = Booking::factory()->for($owner)->for($this->room)->create(['manage_token' => 'secret-token']);

        $this->getJson("/api/v1/bookings/{$booking->reference}")->assertNotFound();
        $this->getJson("/api/v1/bookings/{$booking->reference}?token=wrong")->assertNotFound();
        $this->signIn(User::factory()->create())->getJson("/api/v1/bookings/{$booking->reference}")->assertNotFound();
        $this->getJson("/api/v1/bookings/{$booking->reference}?token=secret-token")->assertOk();
        $this->signIn($owner)->getJson("/api/v1/bookings/{$booking->reference}")->assertOk()->assertJsonPath('data.reference', $booking->reference);
    }

    public function test_an_exclusive_space_cannot_be_double_booked_or_booked_inside_its_buffer(): void
    {
        $this->signIn(User::factory()->create())->postJson('/api/v1/bookings', $this->roomBooking())->assertCreated();
        $other = User::factory()->create();

        // Booked 10am to 12pm; the 15 minute buffer keeps 12:00 free for the room to be reset.
        $this->signIn($other)->postJson('/api/v1/bookings', $this->roomBooking(['start_time' => '11:00', 'quantity' => 1]))
            ->assertJsonValidationErrors(['start_time' => 'Meeting Room is already booked then. Please choose another time.']);
        $this->signIn($other)->postJson('/api/v1/bookings', $this->roomBooking(['start_time' => '12:00', 'quantity' => 1]))
            ->assertJsonValidationErrors(['start_time']);
        $this->signIn($other)->postJson('/api/v1/bookings', $this->roomBooking(['start_time' => '12:15', 'quantity' => 1]))->assertCreated();
    }

    public function test_a_shared_space_takes_bookings_until_its_seats_run_out(): void
    {
        $desk = ['space' => 'hot-desk', 'date' => '2026-11-03', 'start_time' => '09:00', 'rate_unit' => 'hour', 'quantity' => 2, 'seats' => 1];

        $this->signIn(User::factory()->create())->postJson('/api/v1/bookings', $desk)->assertCreated();
        $this->signIn(User::factory()->create())->postJson('/api/v1/bookings', $desk)->assertCreated();
        $this->signIn(User::factory()->create())->postJson('/api/v1/bookings', $desk)
            ->assertJsonValidationErrors(['start_time' => "There aren't enough free seats at Hot Desk then. Try fewer people or another time."]);
    }

    /**
     * @return array<string, array{0: array<string, mixed>, 1: string, 2: string}>
     */
    public static function unbookableTimes(): array
    {
        return [
            'Sunday' => [['date' => '2026-11-08'], 'date', 'Meeting Room is closed on Sunday, 8 Nov.'],
            'before opening' => [['start_time' => '08:00'], 'start_time', 'On Tuesdays, Meeting Room is open 9:00am to 8:00pm.'],
            'running past closing' => [['start_time' => '19:00'], 'start_time', 'On Tuesdays, Meeting Room is open 9:00am to 8:00pm.'],
            'less than the notice period' => [['date' => '2026-11-02', 'start_time' => '09:00', 'quantity' => 1], 'start_time', 'Please book at least 2 hours ahead.'],
            'too far ahead' => [['date' => '2027-03-01'], 'date', 'Meeting Room can be booked up to 90 days ahead.'],
            'too many people' => [['seats' => 11], 'seats', 'Meeting Room fits up to 10 people.'],
            'unit without a rate' => [['rate_unit' => 'week', 'quantity' => 1], 'rate_unit', "Meeting Room can't be booked by the week."],
        ];
    }

    #[DataProvider('unbookableTimes')]
    public function test_times_that_break_a_rule_are_rejected_with_the_reason(array $overrides, string $field, string $message): void
    {
        $this->postJson('/api/v1/bookings/quote', $this->roomBooking($overrides))->assertJsonValidationErrors([$field => $message]);
    }

    public function test_closures_block_bookings(): void
    {
        BlackoutDate::factory()->create(['location_id' => $this->room->location_id, 'starts_at' => '2026-11-03 00:00:00', 'ends_at' => '2026-11-04 00:00:00', 'reason' => 'Staff training']);

        $this->postJson('/api/v1/bookings/quote', $this->roomBooking())
            ->assertJsonValidationErrors(['date' => 'We are closed then (Staff training). Please choose another time.']);
    }

    public function test_availability_offers_only_free_start_times(): void
    {
        Booking::factory()->for($this->room)->create(['starts_at' => '2026-11-03 09:00:00', 'ends_at' => '2026-11-03 11:00:00']);

        $starts = collect($this->getJson('/api/v1/workspace/spaces/meeting-room/availability?date=2026-11-03')->assertOk()->json('data.starts'));

        // Booked 10am to 12pm local with a 15 minute buffer either side, so an hour before
        // 10am doesn't fit and the first free start is 12:30.
        $this->assertSame(['time' => '12:30', 'max_minutes' => 450], $starts->first());
        $this->assertSame('19:00', $starts->last()['time']);
        $this->assertNull($starts->firstWhere('time', '09:00'));
    }

    public function test_unpaid_holds_expire_and_free_the_slot(): void
    {
        $this->signIn(User::factory()->create())->postJson('/api/v1/bookings', $this->roomBooking())->assertCreated();
        $booking = Booking::firstOrFail();

        $this->travel(16)->minutes();
        $this->artisan('bookings:expire-holds')->assertSuccessful();

        $this->assertSame(BookingStatus::Expired, $booking->fresh()->status);
        $this->assertSame(InvoiceStatus::Void, $booking->invoice->fresh()->status);
        $this->signIn(User::factory()->create())->postJson('/api/v1/bookings', $this->roomBooking())->assertCreated();
    }

    public function test_a_payment_arriving_after_the_hold_still_confirms_if_the_slot_is_free(): void
    {
        Notification::fake();
        $response = $this->postJson('/api/v1/bookings', $this->roomBooking() + $this->guest())->assertCreated();
        $booking = Booking::firstOrFail();
        $this->fakePaystack($booking->total);
        $reference = $this->postJson("/api/v1/bookings/{$booking->reference}/pay", ['gateway' => 'paystack', 'token' => $response->json('token')])->json('reference');

        $this->travel(20)->minutes();
        $this->artisan('bookings:expire-holds');
        $this->postJson("/api/v1/bookings/{$booking->reference}/payments/{$reference}/verify", ['token' => $response->json('token')])
            ->assertOk()
            ->assertJsonPath('booking.status', 'confirmed');
    }

    public function test_customer_cancelling_early_is_refunded_in_full_through_the_gateway(): void
    {
        Notification::fake();
        $response = $this->postJson('/api/v1/bookings', $this->roomBooking() + $this->guest())->assertCreated();
        $booking = Booking::firstOrFail();
        $this->payOnline($booking, $response->json('token'));

        $this->postJson("/api/v1/bookings/{$booking->reference}/cancel", ['token' => $response->json('token'), 'reason' => 'Plans changed'])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.refund_amount', 1_500_000);

        Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/refund') && $request['amount'] === 1_500_000);
        $this->assertSame(1_500_000, $booking->invoice->fresh()->amount_refunded);
        Notification::assertSentTo($booking->user, BookingNotification::class, fn (BookingNotification $notification) => $notification->key === EmailTemplateKey::BookingCancelled);
    }

    public function test_customer_cancelling_inside_the_policy_window_gets_no_refund(): void
    {
        Notification::fake();
        $response = $this->postJson('/api/v1/bookings', $this->roomBooking() + $this->guest())->assertCreated();
        $booking = Booking::firstOrFail();
        $this->payOnline($booking, $response->json('token'));

        $this->travelTo('2026-11-02 18:00:00'); // 15 hours before the start.
        $this->postJson("/api/v1/bookings/{$booking->reference}/cancel", ['token' => $response->json('token')])
            ->assertOk()
            ->assertJsonPath('data.refund_amount', 0);

        Http::assertNotSent(fn (Request $request) => str_ends_with($request->url(), '/refund'));
    }

    public function test_a_pass_pays_for_the_space_and_its_credits_come_back_on_early_cancellation(): void
    {
        Notification::fake();
        $member = User::factory()->create();
        $pass = CustomerPass::factory()->for($member)->create(['space_type_ids' => [$this->desk->space_type_id], 'credits' => 3]);
        $desk = ['space' => 'hot-desk', 'date' => '2026-11-03', 'start_time' => '09:00', 'rate_unit' => 'hour', 'quantity' => 4, 'seats' => 1];

        $this->signIn($member)->postJson('/api/v1/bookings/quote', $desk)
            ->assertOk()
            ->assertJsonPath('data.eligible_pass.credits_needed', 1)
            ->assertJsonPath('data.total', 480_000);
        $booking = $this->signIn($member)->postJson('/api/v1/bookings', $desk + ['use_pass' => true])
            ->assertCreated()
            ->assertJsonPath('data.status', 'confirmed')
            ->assertJsonPath('data.total', 0)
            ->assertJsonPath('data.paid_via', 'pass')
            ->json('data.reference');
        $this->assertSame(1, $pass->fresh()->credits_used);

        $this->signIn($member)->postJson("/api/v1/bookings/{$booking}/cancel")->assertOk();
        $this->assertSame(0, $pass->fresh()->credits_used);
    }

    public function test_front_desk_checks_people_in_by_their_code(): void
    {
        $frontDesk = User::factory()->staff()->create()->assignRole(Role::FrontDesk->value);
        $booking = Booking::factory()->for($this->room)->create(['starts_at' => '2026-11-02 12:00:00', 'ends_at' => '2026-11-02 14:00:00', 'check_in_code' => 'K7Q2MX']);

        $this->signIn(User::factory()->create())->postJson('/api/v1/admin/bookings/check-in', ['code' => 'K7Q2MX'])->assertForbidden();
        $this->signIn($frontDesk)->postJson('/api/v1/admin/bookings/check-in', ['code' => 'k7q2mx'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Check-in opens two hours before the booking starts (2 Nov, 1:00pm).');

        $this->travelTo('2026-11-02 11:30:00');
        $this->signIn($frontDesk)->postJson('/api/v1/admin/bookings/check-in', ['code' => 'k7q2mx'])
            ->assertOk()
            ->assertJsonPath('data.status', 'checked_in');
        $this->signIn($frontDesk)->postJson('/api/v1/admin/bookings/check-in', ['code' => 'NOPE00'])
            ->assertNotFound()
            ->assertJsonPath('message', 'No booking has that code. Check it and try again.');
        $this->assertSame($frontDesk->id, $booking->fresh()->checked_in_by);
    }

    public function test_spaces_needing_approval_wait_for_staff_before_payment(): void
    {
        Notification::fake();
        $this->room->update(['requires_approval' => true]);
        $manager = User::factory()->staff()->create()->assignRole(Role::OperationsManager->value);
        $customer = User::factory()->create();

        $reference = $this->signIn($customer)->postJson('/api/v1/bookings', $this->roomBooking())
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending_approval')
            ->assertJsonPath('data.invoice', null)
            ->json('data.reference');
        $this->signIn($customer)->postJson("/api/v1/bookings/{$reference}/pay", ['gateway' => 'paystack'])
            ->assertUnprocessable()
            ->assertJsonPath('message', "We're reviewing your request. You can pay once it's approved.");

        $this->signIn($manager)->postJson("/api/v1/admin/bookings/{$reference}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'held')
            ->assertJsonPath('data.hold_expires_at', '2026-11-03T07:00:00+00:00')
            ->assertJsonPath('data.invoice.total', 1_500_000);
        Notification::assertSentTo($customer, BookingNotification::class, fn (BookingNotification $notification) => $notification->key === EmailTemplateKey::BookingAwaitingPayment);
    }

    public function test_a_guest_who_registers_with_the_same_email_keeps_their_bookings(): void
    {
        Notification::fake();
        $this->postJson('/api/v1/bookings', $this->roomBooking() + $this->guest())->assertCreated();

        $this->postJson('/api/v1/auth/login', ['email' => 'ada@example.com', 'password' => 'anything'])
            ->assertJsonValidationErrors(['email' => 'You booked with this email as a guest. Create an account with it to sign in and see your bookings.']);

        $token = $this->postJson('/api/v1/auth/register', [
            'name' => 'Ada Obi', 'email' => 'ada@example.com', 'phone' => '08031234567', 'password' => 'password123', 'password_confirmation' => 'password123',
        ])->assertCreated()->json('token');

        $this->assertSame(1, User::where('email', 'ada@example.com')->count());
        $this->withToken($token)->getJson('/api/v1/my-bookings')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_someone_with_an_account_must_sign_in_to_book(): void
    {
        User::factory()->create(['email' => 'ada@example.com']);

        $this->postJson('/api/v1/bookings', $this->roomBooking() + $this->guest())
            ->assertJsonValidationErrors(['email' => 'You already have a Reenite account with this email. Please sign in to book.']);
    }

    public function test_guests_must_give_their_contact_details(): void
    {
        $this->postJson('/api/v1/bookings', $this->roomBooking())->assertJsonValidationErrors(['name', 'email', 'phone']);
    }

    public function test_buying_a_pass_creates_an_invoice_and_paying_it_activates_the_pass(): void
    {
        Notification::fake();
        $customer = User::factory()->create();
        $plan = PassPlan::factory()->create(['name' => '3 days a week', 'price' => 1_200_000]);

        $invoiceId = $this->signIn($customer)->postJson('/api/v1/plans/passes', ['pass_plan_id' => $plan->id])->assertCreated()->json('invoice_id');
        $this->fakePaystack(1_200_000);
        $reference = $this->signIn($customer)->postJson("/api/v1/billing/invoices/{$invoiceId}/pay", ['gateway' => 'paystack'])->json('reference');
        $this->signIn($customer)->postJson("/api/v1/billing/payments/{$reference}/verify")->assertOk();

        $this->signIn($customer)->getJson('/api/v1/plans')
            ->assertOk()
            ->assertJsonPath('passes.0.status', 'active')
            ->assertJsonPath('passes.0.credits_left', 3)
            ->assertJsonPath('passes.0.ends_at', '2026-11-09T07:00:00+00:00');
    }
}
