<?php

namespace Tests\Feature\Compliance;

use App\Compliance\ComplianceCalendar;
use App\Enums\EmailTemplateKey;
use App\Enums\Role;
use App\Models\Business;
use App\Models\ComplianceItem;
use App\Models\User;
use App\Notifications\ComplianceNotification;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class ComplianceCalendarTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        Notification::fake();
        // 10 November 2026, mid-morning in Lagos.
        $this->travelTo(now()->setDate(2026, 11, 10)->setTime(10, 0));
        $this->customer = User::factory()->create(['name' => 'Ada Obi']);
    }

    /**
     * @return array<string, mixed>
     */
    private function companyDetails(array $overrides = []): array
    {
        return $overrides + [
            'name' => 'Obi Foods Ltd',
            'entity_type' => 'company',
            'registration_number' => 'RC 1234567',
            'registered_on' => '2024-03-15',
            'tin' => '12345678-0001',
            'vat_registered' => true,
            'has_employees' => true,
            'financial_year_end_month' => 12,
        ];
    }

    /**
     * @return array<string, string>
     */
    private function deadlines(Business $business): array
    {
        return $business->complianceItems()->orderBy('due_on')->get()
            ->mapWithKeys(fn (ComplianceItem $item) => [$item->kind.' '.($item->period_label ?? '') => $item->due_on->toDateString()])
            ->sortKeys()
            ->all();
    }

    public function test_adding_a_company_works_out_its_deadlines(): void
    {
        $id = $this->actingAs($this->customer)->postJson('/api/v1/businesses', $this->companyDetails())
            ->assertCreated()
            ->assertJsonPath('data.entity_type_label', 'Limited company (LTD)')
            ->json('data.id');

        $this->assertSame(collect([
            'paye October 2026' => '2026-11-10',
            'vat October 2026' => '2026-11-21',
            'paye November 2026' => '2026-12-10',
            'vat November 2026' => '2026-12-21',
            'tcc 2027' => '2026-12-31',
            'paye December 2026' => '2027-01-10',
            'vat December 2026' => '2027-01-21',
            // Incorporated 15 March 2024: first returns 18 months later (Sept 2025), then every year.
            'annual_returns 2027' => '2027-09-15',
            'cit Year ended 31 Dec 2026' => '2027-06-30',
        ])->sortKeys()->all(), $this->deadlines(Business::findOrFail($id)));
    }

    public function test_a_business_name_owner_files_personal_tax_and_a_new_company_waits_18_months(): void
    {
        $businessName = Business::factory()->for($this->customer)->create(['registered_on' => '2026-02-01', 'tin' => null]);
        app(ComplianceCalendar::class)->refresh($businessName);
        $this->assertSame(['annual_returns 2027' => '2027-02-01', 'personal_tax 2026' => '2027-03-31'], $this->deadlines($businessName));

        $company = Business::factory()->company()->for($this->customer)->create(['registered_on' => '2026-10-01', 'tin' => null]);
        app(ComplianceCalendar::class)->refresh($company);
        // First returns would be April 2028: more than 13 months away, so not on the calendar yet.
        $this->assertArrayNotHasKey('annual_returns 2028', $this->deadlines($company));
    }

    public function test_changing_the_details_removes_deadlines_that_no_longer_apply_but_keeps_finished_ones(): void
    {
        $id = $this->actingAs($this->customer)->postJson('/api/v1/businesses', $this->companyDetails())->json('data.id');
        $business = Business::findOrFail($id);
        $november = $business->complianceItems()->where('kind', 'vat')->whereDate('due_on', '2026-11-21')->sole();
        $this->actingAs($this->customer)->patchJson("/api/v1/compliance/items/{$november->id}", ['status' => 'done'])->assertOk();

        $this->actingAs($this->customer)->putJson("/api/v1/businesses/{$id}", $this->companyDetails(['vat_registered' => false]))->assertOk();

        $vat = $business->complianceItems()->where('kind', 'vat')->get();
        $this->assertCount(1, $vat);
        $this->assertSame(ComplianceItem::DONE, $vat->first()->status);
        $this->assertNotNull($vat->first()->completed_at);
    }

    public function test_the_calendar_rolls_forward_and_missed_deadlines_stay(): void
    {
        $business = Business::factory()->for($this->customer)->create(['vat_registered' => true]);
        app(ComplianceCalendar::class)->refresh($business);

        $this->travelTo(now()->setDate(2026, 11, 25));
        app(ComplianceCalendar::class)->refreshAll();

        $october = $business->complianceItems()->where('kind', 'vat')->where('period_label', 'October 2026')->sole();
        $this->assertSame('overdue', $october->state());
        $this->assertSame(1, $business->complianceItems()->where('kind', 'vat')->where('period_label', 'January 2027')->count());
    }

    public function test_reminders_go_14_days_and_3_days_before_and_once_when_missed(): void
    {
        $business = Business::factory()->for($this->customer)->create();
        $item = ComplianceItem::factory()->for($business)->create(['title' => 'Renew fire certificate', 'due_on' => '2026-11-30']);
        $calendar = app(ComplianceCalendar::class);

        $this->assertSame(0, $calendar->sendReminders()); // 20 days away
        $this->travelTo(now()->setDate(2026, 11, 17));
        $this->assertSame(1, $calendar->sendReminders());
        $this->assertSame(0, $calendar->sendReminders()); // already sent today
        $this->travelTo(now()->setDate(2026, 11, 28));
        $this->assertSame(1, $calendar->sendReminders());
        $this->travelTo(now()->setDate(2026, 12, 1));
        $this->assertSame(1, $calendar->sendReminders());
        $this->travelTo(now()->setDate(2026, 12, 9));
        $this->assertSame(0, $calendar->sendReminders());

        Notification::assertSentToTimes($this->customer, ComplianceNotification::class, 3);
        Notification::assertSentTo($this->customer, ComplianceNotification::class, fn (ComplianceNotification $mail) => $mail->key === EmailTemplateKey::ComplianceOverdue && $mail->item->is($item));
    }

    public function test_a_deadline_added_late_gets_one_reminder_and_done_ones_get_none(): void
    {
        $business = Business::factory()->for($this->customer)->create();
        ComplianceItem::factory()->for($business)->create(['due_on' => '2026-11-12']);
        ComplianceItem::factory()->for($business)->create(['due_on' => '2026-11-11', 'status' => ComplianceItem::DONE]);

        $this->assertSame(1, app(ComplianceCalendar::class)->sendReminders());
        $this->travelTo(now()->setDate(2026, 11, 11));
        $this->assertSame(0, app(ComplianceCalendar::class)->sendReminders());
    }

    public function test_the_health_score_counts_missed_deadlines_and_missing_details(): void
    {
        $business = Business::factory()->for($this->customer)->create(['tin' => null]);
        ComplianceItem::factory()->for($business)->create(['title' => 'File VAT return', 'period_label' => 'September 2026', 'due_on' => '2026-10-21']);
        ComplianceItem::factory()->for($business)->create(['title' => 'Renew permit', 'period_label' => null, 'due_on' => '2026-11-13']);

        $this->actingAs($this->customer)->getJson('/api/v1/businesses')
            ->assertOk()
            ->assertJsonPath('data.0.health.score', 60)
            ->assertJsonPath('data.0.health.band', 'attention')
            ->assertJsonPath('data.0.health.issues.0.text', 'File VAT return (September 2026) is overdue')
            ->assertJsonPath('data.0.health.issues.1.text', 'Add your tax identification number (TIN)')
            ->assertJsonPath('data.0.health.issues.2.text', 'Renew permit is due in 3 days')
            ->assertJsonPath('data.0.next_deadlines.0.state', 'overdue');
    }

    public function test_customers_only_see_and_change_their_own_businesses(): void
    {
        $theirs = Business::factory()->create();
        $item = ComplianceItem::factory()->for($theirs)->create();

        $this->actingAs($this->customer)->getJson("/api/v1/businesses/{$theirs->id}")->assertNotFound();
        $this->actingAs($this->customer)->putJson("/api/v1/businesses/{$theirs->id}", $this->companyDetails())->assertNotFound();
        $this->actingAs($this->customer)->patchJson("/api/v1/compliance/items/{$item->id}", ['status' => 'done'])->assertNotFound();
        $this->actingAs($this->customer)->postJson("/api/v1/compliance/businesses/{$theirs->id}/items", ['title' => 'x', 'due_on' => '2026-12-01'])->assertNotFound();
        $this->actingAs($this->customer)->getJson('/api/v1/compliance')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_custom_reminders_can_be_moved_and_deleted_but_worked_out_ones_only_dismissed(): void
    {
        $business = Business::factory()->for($this->customer)->create(['vat_registered' => true]);
        app(ComplianceCalendar::class)->refresh($business);
        $vat = $business->complianceItems()->where('kind', 'vat')->firstOrFail();

        $id = $this->actingAs($this->customer)->postJson("/api/v1/compliance/businesses/{$business->id}/items", ['title' => 'Renew shop permit', 'due_on' => '2026-12-15'])
            ->assertCreated()
            ->json('data.id');
        $this->actingAs($this->customer)->patchJson("/api/v1/compliance/items/{$id}", ['due_on' => '2026-12-20'])->assertOk()->assertJsonPath('data.due_on', '2026-12-20');
        $this->actingAs($this->customer)->deleteJson("/api/v1/compliance/items/{$id}")->assertNoContent();

        $this->actingAs($this->customer)->patchJson("/api/v1/compliance/items/{$vat->id}", ['due_on' => '2027-01-01'])->assertJsonValidationErrors('due_on');
        $this->actingAs($this->customer)->deleteJson("/api/v1/compliance/items/{$vat->id}")->assertUnprocessable();
        $this->actingAs($this->customer)->patchJson("/api/v1/compliance/items/{$vat->id}", ['status' => 'dismissed'])->assertOk()->assertJsonPath('data.state', 'dismissed');
    }

    public function test_filing_officers_see_deadlines_needing_attention_and_mark_them_done(): void
    {
        $officer = User::factory()->staff()->create()->assignRole(Role::FilingOfficer->value);
        $frontDesk = User::factory()->staff()->create()->assignRole(Role::FrontDesk->value);
        $business = Business::factory()->for($this->customer)->create(['name' => 'Obi Foods']);
        $late = ComplianceItem::factory()->for($business)->create(['due_on' => '2026-11-01']);
        ComplianceItem::factory()->for($business)->create(['due_on' => '2027-02-01']);

        $this->actingAs($frontDesk)->getJson('/api/v1/admin/compliance')->assertForbidden();
        $this->actingAs($officer)->getJson('/api/v1/admin/compliance?search=obi')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.business.owner.name', 'Ada Obi')
            ->assertJsonPath('counts.overdue', 1);

        $this->actingAs($officer)->patchJson("/api/v1/admin/compliance/items/{$late->id}", ['status' => 'done', 'note' => 'Filed on their behalf'])
            ->assertOk()
            ->assertJsonPath('data.status', 'done');
        $this->assertSame($officer->id, $late->refresh()->completed_by);
    }
}
