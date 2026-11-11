<?php

namespace Tests\Feature;

use App\Enums\EmailTemplateKey;
use App\Enums\Role;
use App\Models\Appointment;
use App\Models\User;
use App\Notifications\AppointmentNotification;
use App\Notifications\StaffAlertNotification;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AppointmentTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        // Monday 2 November 2026, 9:00am in Lagos.
        $this->travelTo('2026-11-02 08:00:00');
        Notification::fake();
        $this->manager = User::factory()->staff()->create(['name' => 'Ekemini Udo'])->assignRole(Role::OperationsManager->value);
    }

    /**
     * @return array<string, mixed>
     */
    private function newClientAppointment(array $overrides = []): array
    {
        return $overrides + [
            'client' => ['name' => 'Aniekan Bassey', 'email' => 'aniekan@example.com', 'phone' => '08031234567', 'whatsapp_consent' => true],
            'title' => 'CAC document review',
            'mode' => 'in_person',
            'starts_at' => '2026-11-05 10:00',
            'duration_minutes' => 45,
            'assigned_to' => $this->manager->id,
        ];
    }

    private function book(array $overrides = []): Appointment
    {
        Sanctum::actingAs($this->manager);
        $reference = $this->postJson('/api/v1/admin/appointments', $this->newClientAppointment($overrides))->assertCreated()->json('data.reference');

        return Appointment::where('reference', $reference)->firstOrFail();
    }

    public function test_staff_book_a_new_client_without_an_account_and_the_client_is_told(): void
    {
        Sanctum::actingAs($this->manager);

        $this->postJson('/api/v1/admin/appointments', $this->newClientAppointment())
            ->assertCreated()
            ->assertJsonPath('data.reference', 'AP-2026-000001')
            ->assertJsonPath('data.status', 'scheduled')
            ->assertJsonPath('data.client.name', 'Aniekan Bassey')
            ->assertJsonPath('data.client.is_guest', true)
            ->assertJsonPath('data.client.whatsapp', true)
            ->assertJsonPath('data.duration_minutes', 45)
            // 10:00 Lagos time is 09:00 UTC.
            ->assertJsonPath('data.starts_at', '2026-11-05T09:00:00+00:00');

        $client = User::where('email', 'aniekan@example.com')->firstOrFail();
        $this->assertTrue($client->isGuest());
        Notification::assertSentTo($client, AppointmentNotification::class, fn (AppointmentNotification $notification) => $notification->key === EmailTemplateKey::AppointmentScheduled);
    }

    public function test_staff_can_book_an_existing_client_from_the_list(): void
    {
        $customer = User::factory()->create(['name' => 'Mfon Akpan', 'phone' => '08099990000']);
        Sanctum::actingAs($this->manager);

        $this->getJson('/api/v1/admin/appointments/clients?search=mfon')
            ->assertOk()
            ->assertJsonPath('data.0.id', $customer->id)
            ->assertJsonPath('data.0.history.total', 0);

        $this->postJson('/api/v1/admin/appointments', ['client_id' => $customer->id] + collect($this->newClientAppointment())->except('client')->all())
            ->assertCreated()
            ->assertJsonPath('data.client.id', $customer->id);
    }

    public function test_a_phone_number_saved_for_someone_else_is_refused(): void
    {
        User::factory()->create(['name' => 'Mfon Akpan', 'phone' => '08031234567']);
        Sanctum::actingAs($this->manager);

        $this->postJson('/api/v1/admin/appointments', $this->newClientAppointment())
            ->assertJsonValidationErrors(['client.phone' => 'That phone number is already saved for Mfon Akpan. Choose them from the client list instead.']);
    }

    public function test_staff_cannot_be_double_booked_and_times_must_be_in_the_future(): void
    {
        $this->book();

        $this->postJson('/api/v1/admin/appointments', $this->newClientAppointment([
            'client' => ['name' => 'Ada Obi', 'email' => 'ada@example.com', 'phone' => '08020000000'],
            'starts_at' => '2026-11-05 10:30',
        ]))->assertJsonValidationErrors(['starts_at' => 'Ekemini Udo already has an appointment at 10:00am (CAC document review, AP-2026-000001). Choose another time or person.']);

        $this->postJson('/api/v1/admin/appointments', $this->newClientAppointment(['starts_at' => '2026-11-01 10:00']))
            ->assertJsonValidationErrors(['starts_at' => 'Choose a time in the future.']);
    }

    public function test_reminders_go_out_the_day_before_and_an_hour_before_only_once(): void
    {
        $appointment = $this->book();

        // Wednesday 11:00 Lagos: within a day of Thursday 10:00.
        $this->travelTo('2026-11-04 10:00:00');
        $this->artisan('appointments:remind')->expectsOutputToContain('1 day-before and 0 starting-soon');
        Notification::assertSentTo($appointment->client, AppointmentNotification::class, fn (AppointmentNotification $notification) => $notification->key === EmailTemplateKey::AppointmentReminder);

        // Thursday 9:15 Lagos: 45 minutes to go.
        $this->travelTo('2026-11-05 08:15:00');
        $this->artisan('appointments:remind')->expectsOutputToContain('0 day-before and 1 starting-soon');
        Notification::assertSentTo($appointment->client, AppointmentNotification::class, fn (AppointmentNotification $notification) => $notification->key === EmailTemplateKey::AppointmentStartingSoon);

        $this->artisan('appointments:remind')->expectsOutputToContain('0 day-before and 0 starting-soon');
    }

    public function test_an_appointment_booked_for_later_today_skips_the_day_before_reminder(): void
    {
        $appointment = $this->book(['starts_at' => '2026-11-02 15:00']);

        $this->artisan('appointments:remind')->expectsOutputToContain('0 day-before and 0 starting-soon');
        $this->assertNotNull($appointment->fresh()->reminded_day_at);
        Notification::assertNotSentTo($appointment->client, AppointmentNotification::class, fn (AppointmentNotification $notification) => $notification->key === EmailTemplateKey::AppointmentReminder);
    }

    public function test_the_client_confirms_from_their_link(): void
    {
        $appointment = $this->book();

        $this->getJson("/api/v1/appointments/{$appointment->reference}?token=wrong")->assertNotFound();
        $this->getJson("/api/v1/appointments/{$appointment->reference}?token={$appointment->response_token}")
            ->assertOk()
            ->assertJsonPath('data.title', 'CAC document review')
            ->assertJsonPath('data.client_first_name', 'Aniekan')
            ->assertJsonMissingPath('data.staff_notes');

        $this->postJson("/api/v1/appointments/{$appointment->reference}/respond", ['token' => $appointment->response_token, 'response' => 'confirmed'])
            ->assertOk()
            ->assertJsonPath('data.response', 'confirmed');
    }

    public function test_asking_to_reschedule_alerts_staff_and_pauses_reminders(): void
    {
        $appointment = $this->book();

        $this->postJson("/api/v1/appointments/{$appointment->reference}/respond", [
            'token' => $appointment->response_token, 'response' => 'reschedule_requested', 'note' => 'Travelling that day',
        ])->assertOk();

        Notification::assertSentTo($this->manager, StaffAlertNotification::class, fn (StaffAlertNotification $notification) => $notification->key === EmailTemplateKey::StaffAppointmentReschedule
            && $notification->values['note'] === 'Travelling that day');

        $this->travelTo('2026-11-04 10:00:00');
        $this->artisan('appointments:remind')->expectsOutputToContain('0 day-before and 0 starting-soon');
        Sanctum::actingAs($this->manager);
        $this->getJson('/api/v1/admin/appointments?filter=attention')->assertJsonPath('data.0.reference', $appointment->reference);
    }

    public function test_moving_an_appointment_tells_the_client_and_resets_their_answer(): void
    {
        $appointment = $this->book();
        $appointment->update(['response' => 'confirmed', 'responded_at' => now(), 'reminded_day_at' => now()]);

        $this->patchJson("/api/v1/admin/appointments/{$appointment->reference}", ['starts_at' => '2026-11-06 14:00'])
            ->assertOk()
            ->assertJsonPath('data.starts_at', '2026-11-06T13:00:00+00:00')
            ->assertJsonPath('data.duration_minutes', 45)
            ->assertJsonPath('data.response', null)
            ->assertJsonPath('data.reminded_day_at', null);

        Notification::assertSentTo($appointment->client, AppointmentNotification::class, fn (AppointmentNotification $notification) => $notification->key === EmailTemplateKey::AppointmentChanged);
    }

    public function test_staff_record_lateness_and_no_shows_and_see_the_clients_history(): void
    {
        $first = $this->book();
        $second = $this->book(['starts_at' => '2026-11-06 10:00']);

        $this->postJson("/api/v1/admin/appointments/{$first->reference}/outcome", ['outcome' => 'attended', 'minutes_late' => 0])
            ->assertJson(['message' => 'You can record how it went once the appointment has started.']);

        $this->travelTo('2026-11-07 08:00:00');
        $this->postJson("/api/v1/admin/appointments/{$first->reference}/outcome", ['outcome' => 'attended', 'minutes_late' => 20])
            ->assertOk()
            ->assertJsonPath('data.status_label', 'Attended, 20 min late');
        $this->postJson("/api/v1/admin/appointments/{$second->reference}/outcome", ['outcome' => 'no_show'])
            ->assertOk()
            ->assertJsonPath('data.history', ['total' => 2, 'on_time' => 0, 'late' => 1, 'no_show' => 1, 'cancelled' => 0, 'average_minutes_late' => 20]);
    }

    public function test_cancelling_tells_the_client_why(): void
    {
        $appointment = $this->book();

        $this->postJson("/api/v1/admin/appointments/{$appointment->reference}/cancel", ['reason' => 'Our officer is unwell'])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        Notification::assertSentTo($appointment->client, AppointmentNotification::class, fn (AppointmentNotification $notification) => $notification->key === EmailTemplateKey::AppointmentCancelled
            && $notification->extra['reason'] === 'Our officer is unwell');
        $this->postJson("/api/v1/appointments/{$appointment->reference}/respond", ['token' => $appointment->response_token, 'response' => 'confirmed'])->assertStatus(422);
    }

    public function test_the_timekeeping_rule_is_editable_and_appears_in_messages(): void
    {
        Sanctum::actingAs($this->manager);

        $this->getJson('/api/v1/admin/appointments/settings')
            ->assertJsonPath('data.message', "Please arrive 10 minutes early. If you're more than 15 minutes late, we may need to reschedule.");
        $this->putJson('/api/v1/admin/appointments/settings', ['arrive_early_minutes' => 5, 'grace_minutes' => 10])
            ->assertOk()
            ->assertJsonPath('data.message', "Please arrive 5 minutes early. If you're more than 10 minutes late, we may need to reschedule.");

        $appointment = $this->book();
        $this->assertSame(
            "Please arrive 5 minutes early. If you're more than 10 minutes late, we may need to reschedule.",
            AppointmentNotification::appointmentVariables($appointment)['punctuality'],
        );
    }

    public function test_only_staff_with_the_permission_can_manage_appointments(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/v1/admin/appointments')->assertForbidden();

        Sanctum::actingAs(User::factory()->staff()->create()->assignRole(Role::FrontDesk->value));
        $this->getJson('/api/v1/admin/appointments')->assertOk();
        $this->getJson('/api/v1/admin/appointments/staff')->assertOk()->assertJsonFragment(['name' => 'Ekemini Udo']);
    }
}
