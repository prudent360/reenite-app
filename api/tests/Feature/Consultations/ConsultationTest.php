<?php

namespace Tests\Feature\Consultations;

use App\Consultations\ConsultationService;
use App\Enums\EmailTemplateKey;
use App\Enums\InvoiceStatus;
use App\Enums\Role;
use App\Events\InvoicePaid;
use App\Models\Consultation;
use App\Models\ConsultationType;
use App\Models\Coupon;
use App\Models\Invoice;
use App\Models\User;
use App\Notifications\ConsultationNotification;
use App\Notifications\StaffAlertNotification;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class ConsultationTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;

    private ConsultationType $type;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        Notification::fake();
        // Tuesday 10 November 2026, 8am Lagos (7am UTC).
        $this->travelTo(now('UTC')->setDate(2026, 11, 10)->setTime(7, 0));
        $this->customer = User::factory()->create();
        $this->type = ConsultationType::factory()->create(['name' => 'Tax advice', 'slug' => 'tax-advice', 'price' => 1_500_000, 'duration_minutes' => 60]);
    }

    private function book(string $startsAt = '2026-11-12T10:00:00+01:00', ?User $customer = null): TestResponse
    {
        return $this->actingAs($customer ?? $this->customer)->postJson('/api/v1/consultations', [
            'consultation_type_id' => $this->type->id,
            'starts_at' => $startsAt,
            'topic' => 'Do I need to register for VAT yet?',
        ]);
    }

    public function test_slots_follow_the_weekly_hours_notice_and_existing_bookings(): void
    {
        // Tuesday: 12 hours' notice from 8am rules out everything before 8pm, so nothing today.
        $this->getJson('/api/v1/consultations/types/tax-advice/slots?date=2026-11-10')->assertOk()->assertJsonCount(0, 'data');
        // Saturday is closed.
        $this->getJson('/api/v1/consultations/types/tax-advice/slots?date=2026-11-14')->assertJsonCount(0, 'data');

        // Thursday 9am to 5pm, one-hour sessions every half hour: 9:00 to 4:00 is 15 starts.
        $this->getJson('/api/v1/consultations/types/tax-advice/slots?date=2026-11-12')
            ->assertJsonCount(15, 'data')
            ->assertJsonPath('data.0.label', '9:00am')
            ->assertJsonPath('data.14.label', '4:00pm');

        Consultation::factory()->for($this->type, 'type')->create(['starts_at' => '2026-11-12 09:00:00', 'ends_at' => '2026-11-12 10:00:00']); // 10am to 11am Lagos
        $labels = collect($this->getJson('/api/v1/consultations/types/tax-advice/slots?date=2026-11-12')->json('data'))->pluck('label');
        $this->assertNotContains('9:30am', $labels);
        $this->assertNotContains('10:30am', $labels);
        $this->assertContains('9:00am', $labels);
        $this->assertContains('11:00am', $labels);
    }

    public function test_booking_holds_the_time_and_paying_confirms_it(): void
    {
        $officer = User::factory()->staff()->create()->assignRole(Role::OperationsManager->value);

        $reference = $this->book()
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending_payment')
            ->assertJsonPath('data.invoice.total', 1_500_000)
            ->assertJsonPath('data.meeting_details', null)
            ->json('data.reference');
        $consultation = Consultation::firstWhere('reference', $reference);

        // Someone else can't take the same time while it's held.
        $this->book(customer: User::factory()->create())->assertJsonValidationErrors('starts_at');

        $consultation->invoice->update(['status' => InvoiceStatus::Paid, 'amount_paid' => 1_500_000, 'paid_at' => now()]);
        InvoicePaid::dispatch($consultation->invoice->refresh());

        $this->assertSame(Consultation::CONFIRMED, $consultation->refresh()->status);
        Notification::assertSentTo($this->customer, ConsultationNotification::class, fn (ConsultationNotification $mail) => $mail->key === EmailTemplateKey::ConsultationConfirmed);
        Notification::assertSentTo($officer, StaffAlertNotification::class, fn (StaffAlertNotification $alert) => $alert->key === EmailTemplateKey::StaffNewConsultation);
        $this->actingAs($this->customer)->getJson("/api/v1/consultations/{$reference}")
            ->assertOk()
            ->assertJsonPath('data.meeting_details', "We'll email you the video call link before the session.");
    }

    public function test_free_consultations_confirm_straight_away_and_a_full_discount_code_confirms_a_paid_one(): void
    {
        $free = ConsultationType::factory()->create(['price' => 0]);
        $this->actingAs($this->customer)->postJson('/api/v1/consultations', ['consultation_type_id' => $free->id, 'starts_at' => '2026-11-12T10:00:00+01:00', 'topic' => 'Quick question about TIN'])
            ->assertCreated()
            ->assertJsonPath('data.status', 'confirmed')
            ->assertJsonPath('data.invoice', null);

        Coupon::factory()->create(['code' => 'ADVICE', 'discount_value' => 100, 'applies_to' => 'services']);
        $invoiceId = $this->book()->json('data.invoice.id');
        $this->actingAs($this->customer)->postJson("/api/v1/billing/invoices/{$invoiceId}/coupon", ['code' => 'ADVICE'])->assertOk()->assertJsonPath('data.status', 'paid');

        $this->assertSame(Consultation::CONFIRMED, Invoice::findOrFail($invoiceId)->source->status);
    }

    public function test_an_unpaid_hold_expires_and_frees_the_time(): void
    {
        $reference = $this->book()->json('data.reference');

        $this->travel(Consultation::HOLD_MINUTES + 1)->minutes();
        $this->assertSame(1, app(ConsultationService::class)->expireHolds());

        $consultation = Consultation::firstWhere('reference', $reference);
        $this->assertSame(Consultation::EXPIRED, $consultation->status);
        $this->assertSame(InvoiceStatus::Void, $consultation->invoice->status);
        $this->book(customer: User::factory()->create())->assertCreated();
    }

    public function test_cancelling_a_day_ahead_is_free_and_later_is_not(): void
    {
        $early = Consultation::factory()->for($this->customer)->for($this->type, 'type')->create(['starts_at' => now()->addDays(3), 'ends_at' => now()->addDays(3)->addHour()]);
        $late = Consultation::factory()->for($this->customer)->for($this->type, 'type')->create(['starts_at' => now()->addHours(5), 'ends_at' => now()->addHours(6)]);

        $this->actingAs($this->customer)->postJson("/api/v1/consultations/{$early->reference}/cancel")->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->actingAs($this->customer)->postJson("/api/v1/consultations/{$late->reference}/cancel")->assertOk();
        Notification::assertSentTo($this->customer, ConsultationNotification::class, fn (ConsultationNotification $mail) => $mail->key === EmailTemplateKey::ConsultationCancelled
            && $mail->extra['refund_amount'] === 'Nothing was paid');

        $this->actingAs($this->customer)->postJson("/api/v1/consultations/{$early->reference}/cancel")->assertUnprocessable();
        $this->actingAs(User::factory()->create())->getJson("/api/v1/consultations/{$late->reference}")->assertNotFound();
    }

    public function test_paid_consultations_are_refunded_in_full_only_a_day_ahead(): void
    {
        $paid = fn (array $times) => Consultation::factory()->for($this->customer)->for($this->type, 'type')->create($times + [
            'invoice_id' => Invoice::factory()->for($this->customer)->create(['subtotal' => 1_500_000, 'total' => 1_500_000, 'amount_paid' => 1_500_000, 'status' => InvoiceStatus::Paid])->id,
        ]);
        $early = $paid(['starts_at' => now()->addDays(2), 'ends_at' => now()->addDays(2)->addHour()]);
        $late = $paid(['starts_at' => now()->addHours(5), 'ends_at' => now()->addHours(6)]);

        $this->actingAs($this->customer)->postJson("/api/v1/consultations/{$early->reference}/cancel")->assertJsonPath('data.refund_amount', 1_500_000);
        $this->actingAs($this->customer)->postJson("/api/v1/consultations/{$late->reference}/cancel")->assertJsonPath('data.refund_amount', 0);
        Notification::assertSentTo($this->customer, ConsultationNotification::class, fn (ConsultationNotification $mail) => $mail->consultation->is($late)
            && $mail->extra['refund_amount'] === 'No refund (cancelled less than 24 hours before)');
    }

    public function test_reminders_go_the_day_before_once(): void
    {
        Consultation::factory()->for($this->customer)->for($this->type, 'type')->create(['starts_at' => now()->addHours(20), 'ends_at' => now()->addHours(21)]);
        Consultation::factory()->for($this->type, 'type')->create(['starts_at' => now()->addDays(3), 'ends_at' => now()->addDays(3)->addHour()]);

        $this->assertSame(1, app(ConsultationService::class)->sendReminders());
        $this->assertSame(0, app(ConsultationService::class)->sendReminders());
    }

    public function test_officers_only_see_their_own_and_managers_assign_them(): void
    {
        $manager = User::factory()->staff()->create()->assignRole(Role::OperationsManager->value);
        $officer = User::factory()->staff()->create(['name' => 'Ekemini'])->assignRole(Role::FilingOfficer->value);
        $frontDesk = User::factory()->staff()->create()->assignRole(Role::FrontDesk->value);
        $consultation = Consultation::factory()->for($this->customer)->for($this->type, 'type')->create();

        $this->actingAs($frontDesk)->getJson('/api/v1/admin/consultations')->assertForbidden();
        $this->actingAs($officer)->getJson('/api/v1/admin/consultations')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($officer)->getJson("/api/v1/admin/consultations/{$consultation->reference}")->assertNotFound();
        $this->actingAs($officer)->patchJson("/api/v1/admin/consultations/{$consultation->reference}", ['assigned_to' => $officer->id])->assertNotFound();

        $this->actingAs($manager)->patchJson("/api/v1/admin/consultations/{$consultation->reference}", ['assigned_to' => $frontDesk->id])->assertJsonValidationErrors('assigned_to');
        $this->actingAs($manager)->patchJson("/api/v1/admin/consultations/{$consultation->reference}", ['assigned_to' => $officer->id])
            ->assertOk()
            ->assertJsonPath('data.officer.name', 'Ekemini');

        $this->actingAs($officer)->getJson('/api/v1/admin/consultations')->assertJsonCount(1, 'data')->assertJsonPath('can_manage', false);
        $this->actingAs($officer)->patchJson("/api/v1/admin/consultations/{$consultation->reference}", ['meeting_details' => 'Google Meet: meet.google.com/abc'])->assertOk();
        $this->actingAs($officer)->patchJson("/api/v1/admin/consultations/{$consultation->reference}", ['assigned_to' => $manager->id])->assertJsonValidationErrors('assigned_to');
        $this->actingAs($officer)->postJson("/api/v1/admin/consultations/{$consultation->reference}/cancel", ['reason' => 'x', 'refund_percent' => 100])->assertForbidden();
        $this->actingAs($this->customer)->getJson("/api/v1/consultations/{$consultation->reference}")->assertJsonPath('data.meeting_details', 'Google Meet: meet.google.com/abc');

        $this->actingAs($officer)->postJson("/api/v1/admin/consultations/{$consultation->reference}/outcome", ['outcome' => 'completed'])->assertUnprocessable();
        $this->travelTo($consultation->starts_at->copy()->addMinutes(70));
        $this->actingAs($officer)->postJson("/api/v1/admin/consultations/{$consultation->reference}/outcome", ['outcome' => 'completed'])->assertOk()->assertJsonPath('data.status', 'completed');
    }

    public function test_managers_set_up_consultation_types_with_weekly_hours(): void
    {
        $manager = User::factory()->staff()->create()->assignRole(Role::OperationsManager->value);
        $data = ['name' => 'Trademark advice', 'duration_minutes' => 45, 'price' => 2_000_000, 'mode' => 'phone', 'schedule' => ['2' => ['10:00', '14:00']], 'notice_hours' => 24, 'is_active' => true];

        $this->actingAs($manager)->postJson('/api/v1/admin/consultations/types', $data)->assertCreated()->assertJsonPath('data.slug', 'trademark-advice');
        $this->actingAs($manager)->postJson('/api/v1/admin/consultations/types', ['schedule' => ['2' => ['14:00', '10:00']]] + $data)->assertJsonValidationErrors('schedule.2');
        $this->actingAs($manager)->postJson('/api/v1/admin/consultations/types', ['schedule' => ['8' => ['10:00', '14:00']]] + $data)->assertJsonValidationErrors('schedule');
        $this->actingAs($manager)->postJson('/api/v1/admin/consultations/types', ['duration_minutes' => 50] + $data)->assertJsonValidationErrors('duration_minutes');

        Consultation::factory()->for($this->type, 'type')->create();
        $this->actingAs($manager)->deleteJson("/api/v1/admin/consultations/types/{$this->type->slug}")->assertUnprocessable();
        $this->getJson('/api/v1/consultations/types')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.1.schedule.2', ['10:00', '14:00']);
        $this->assertStringContainsString('"schedule":{"1":["09:00","17:00"]', $this->getJson('/api/v1/consultations/types')->getContent());
    }
}
