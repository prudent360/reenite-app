<?php

namespace Tests\Feature\Workspace;

use App\Enums\EmailTemplateKey;
use App\Enums\Role;
use App\Models\CustomerMembership;
use App\Models\Location;
use App\Models\Mailbox;
use App\Models\MailItem;
use App\Models\MembershipPlan;
use App\Models\User;
use App\Notifications\MailNotification;
use App\Notifications\StaffAlertNotification;
use App\Workspace\PlanService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MailboxTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;

    private User $frontDesk;

    private Location $location;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        Notification::fake();
        Storage::fake('local');

        $this->customer = User::factory()->create(['name' => 'Ada Obi']);
        $this->frontDesk = User::factory()->staff()->create()->assignRole(Role::FrontDesk->value);
        $this->location = Location::factory()->create(['name' => 'Reenite Uyo', 'address' => '12 Oron Road', 'city' => 'Uyo', 'state' => 'Akwa Ibom']);
    }

    private function pendingMembership(MembershipPlan $plan): CustomerMembership
    {
        return CustomerMembership::factory()->for($this->customer)->for($plan, 'plan')->create(['status' => CustomerMembership::PENDING, 'starts_at' => null, 'ends_at' => null]);
    }

    public function test_paying_for_a_virtual_office_membership_opens_a_mailbox_and_renewing_extends_it(): void
    {
        $plan = MembershipPlan::factory()->create(['name' => 'Virtual Office', 'mailbox_location_id' => $this->location->id]);

        app(PlanService::class)->activate($this->pendingMembership($plan));
        $mailbox = Mailbox::sole();
        $this->assertSame('RN-0001', $mailbox->number);
        $this->assertSame('Ada Obi', $mailbox->business_name);
        $this->assertTrue($mailbox->isActive());

        $this->travel(20)->days();
        $renewal = $this->pendingMembership($plan);
        app(PlanService::class)->activate($renewal);

        $this->assertSame(1, Mailbox::count());
        $this->assertTrue($mailbox->refresh()->active_until->equalTo($renewal->refresh()->ends_at));
        $this->assertSame($renewal->id, $mailbox->customer_membership_id);

        $this->actingAs($this->customer)->getJson('/api/v1/mailbox')
            ->assertOk()
            ->assertJsonPath('data.0.number', 'RN-0001')
            ->assertJsonPath('data.0.state', 'active')
            ->assertJsonPath('data.0.address_lines', ['Ada Obi', 'Mailbox RN-0001', '12 Oron Road', 'Uyo, Akwa Ibom']);
    }

    public function test_a_membership_without_a_mailbox_location_opens_nothing(): void
    {
        app(PlanService::class)->activate($this->pendingMembership(MembershipPlan::factory()->create()));

        $this->assertSame(0, Mailbox::count());
    }

    public function test_a_lapsed_mailbox_shows_as_lapsed(): void
    {
        Mailbox::factory()->for($this->customer)->for($this->location)->create(['active_until' => now()->subDay()]);

        $this->actingAs($this->customer)->getJson('/api/v1/mailbox')->assertJsonPath('data.0.state', 'lapsed');
    }

    public function test_front_desk_opens_a_mailbox_once_per_customer_and_location(): void
    {
        $data = ['user_id' => $this->customer->id, 'location_id' => $this->location->id, 'business_name' => 'Obi Ventures Ltd'];

        $this->actingAs($this->frontDesk)->postJson('/api/v1/admin/mail/mailboxes', $data)
            ->assertCreated()
            ->assertJsonPath('data.business_name', 'Obi Ventures Ltd')
            ->assertJsonPath('data.active_until', null)
            ->assertJsonPath('data.state', 'active');
        $this->actingAs($this->frontDesk)->postJson('/api/v1/admin/mail/mailboxes', $data)->assertJsonValidationErrors('user_id');
        $this->actingAs($this->frontDesk)->postJson('/api/v1/admin/mail/mailboxes', ['user_id' => $this->frontDesk->id] + $data)->assertJsonValidationErrors('user_id');
    }

    public function test_finance_cannot_manage_mail(): void
    {
        $finance = User::factory()->staff()->create()->assignRole(Role::Finance->value);

        $this->actingAs($finance)->getJson('/api/v1/admin/mail')->assertForbidden();
        $this->actingAs($finance)->getJson('/api/v1/admin/mail/mailboxes')->assertForbidden();
    }

    public function test_logged_mail_emails_the_customer_and_only_they_can_read_the_scan(): void
    {
        $mailbox = Mailbox::factory()->for($this->customer)->for($this->location)->create();

        $id = $this->actingAs($this->frontDesk)->post("/api/v1/admin/mail/mailboxes/{$mailbox->id}/items", [
            'kind' => 'official',
            'sender' => 'Corporate Affairs Commission',
            'scan' => UploadedFile::fake()->create('cac-letter.pdf', 200, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.has_scan', true)->json('data.id');

        Notification::assertSentTo($this->customer, MailNotification::class, fn (MailNotification $mail) => $mail->key === EmailTemplateKey::MailReceived);
        $this->actingAs($this->customer)->getJson('/api/v1/mailbox')
            ->assertJsonPath('data.0.waiting_count', 1)
            ->assertJsonPath('data.0.items.0.sender', 'Corporate Affairs Commission')
            ->assertJsonPath('data.0.items.0.kind_label', 'Official letter');
        $this->actingAs($this->customer)->get("/api/v1/mailbox/items/{$id}/scan")->assertOk();
        $this->actingAs(User::factory()->create())->getJson("/api/v1/mailbox/items/{$id}/scan")->assertNotFound();
    }

    public function test_scans_over_the_upload_limit_are_refused(): void
    {
        $mailbox = Mailbox::factory()->for($this->customer)->for($this->location)->create();

        $this->actingAs($this->frontDesk)->post("/api/v1/admin/mail/mailboxes/{$mailbox->id}/items", [
            'kind' => 'letter',
            'scan' => UploadedFile::fake()->create('big.pdf', 4000, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertJsonValidationErrors(['scan' => 'The scan must be 3MB or smaller.']);
    }

    public function test_customer_asks_to_forward_mail_and_the_front_desk_finishes_it(): void
    {
        $mailbox = Mailbox::factory()->for($this->customer)->for($this->location)->create();
        $item = $mailbox->items()->create(['kind' => 'parcel', 'sender' => 'Jumia', 'received_at' => now(), 'status' => MailItem::WAITING]);

        $this->actingAs($this->customer)->postJson("/api/v1/mailbox/items/{$item->id}/request", ['action' => 'forward'])->assertJsonValidationErrors('note');
        $this->actingAs($this->customer)->postJson("/api/v1/mailbox/items/{$item->id}/request", ['action' => 'forward', 'note' => '5 Aka Road, Uyo'])
            ->assertOk()
            ->assertJsonPath('data.request_label', 'Forward it');
        Notification::assertSentTo($this->frontDesk, StaffAlertNotification::class, fn (StaffAlertNotification $alert) => $alert->key === EmailTemplateKey::StaffMailRequest
            && $alert->values['request_note'] === '5 Aka Road, Uyo');
        $this->actingAs(User::factory()->create())->postJson("/api/v1/mailbox/items/{$item->id}/request", ['action' => 'shred'])->assertNotFound();

        $this->actingAs($this->frontDesk)->getJson('/api/v1/admin/mail?filter=requests')->assertJsonPath('data.0.id', $item->id);
        $this->actingAs($this->frontDesk)->postJson("/api/v1/admin/mail/items/{$item->id}/handle", ['outcome' => 'forwarded', 'note' => 'GIG tracking 12345'])
            ->assertOk()
            ->assertJsonPath('data.status', 'forwarded')
            ->assertJsonPath('data.requested_action', null);

        $this->actingAs($this->customer)->postJson("/api/v1/mailbox/items/{$item->id}/request", ['action' => 'shred'])->assertUnprocessable();
        $this->actingAs($this->frontDesk)->postJson("/api/v1/admin/mail/items/{$item->id}/handle", ['outcome' => 'shredded'])->assertUnprocessable();
    }

    public function test_a_scan_request_is_answered_by_uploading_the_scan(): void
    {
        $mailbox = Mailbox::factory()->for($this->customer)->for($this->location)->create();
        $item = $mailbox->items()->create(['kind' => 'letter', 'received_at' => now(), 'status' => MailItem::WAITING]);
        $this->actingAs($this->customer)->postJson("/api/v1/mailbox/items/{$item->id}/request", ['action' => 'scan'])->assertOk();

        $this->actingAs($this->frontDesk)->post("/api/v1/admin/mail/items/{$item->id}/scan", [
            'scan' => UploadedFile::fake()->image('letter.jpg'),
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.has_scan', true)
            ->assertJsonPath('data.requested_action', null)
            ->assertJsonPath('data.status', 'waiting');

        Notification::assertSentTo($this->customer, MailNotification::class, fn (MailNotification $mail) => $mail->key === EmailTemplateKey::MailScanned);
        $this->actingAs($this->customer)->postJson("/api/v1/mailbox/items/{$item->id}/request", ['action' => 'scan'])->assertUnprocessable();
    }

    public function test_closed_mailboxes_take_no_new_mail(): void
    {
        $mailbox = Mailbox::factory()->for($this->customer)->for($this->location)->create(['status' => Mailbox::CLOSED]);

        $this->actingAs($this->frontDesk)->postJson("/api/v1/admin/mail/mailboxes/{$mailbox->id}/items", ['kind' => 'letter'])->assertUnprocessable();
    }
}
