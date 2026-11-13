<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Booking;
use App\Models\User;
use App\Notifications\Channels\WhatsAppChannel;
use App\Notifications\CustomerMessageNotification;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerBulkActionsTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        $this->manager = User::factory()->staff()->create()->assignRole(Role::OperationsManager->value);
    }

    public function test_only_customer_managers_can_act_on_several_customers(): void
    {
        $customer = User::factory()->create();
        $viewer = User::factory()->staff()->create()->assignRole(Role::Finance->value);

        Sanctum::actingAs($viewer);
        $this->postJson('/api/v1/admin/customers/bulk/status', ['ids' => [$customer->id], 'status' => 'suspended'])->assertForbidden();
        $this->postJson('/api/v1/admin/customers/bulk/delete', ['ids' => [$customer->id]])->assertForbidden();
        $this->postJson('/api/v1/admin/customers/bulk/message', ['ids' => [$customer->id], 'subject' => 'Hi', 'message' => 'Hello', 'channels' => ['email']])->assertForbidden();
    }

    public function test_suspending_signs_customers_out_and_never_touches_staff(): void
    {
        [$ada, $bayo] = User::factory()->count(2)->create();
        $ada->createToken('web');
        $staff = User::factory()->staff()->create();

        Sanctum::actingAs($this->manager);
        $this->postJson('/api/v1/admin/customers/bulk/status', ['ids' => [$ada->id, $bayo->id, $staff->id], 'status' => 'suspended'])
            ->assertOk()
            ->assertJsonPath('message', '2 customers suspended and signed out.');

        $this->assertSame('suspended', $ada->fresh()->status);
        $this->assertSame(0, $ada->tokens()->count());
        $this->assertSame('active', $staff->fresh()->status);

        $this->postJson('/api/v1/admin/customers/bulk/status', ['ids' => [$ada->id], 'status' => 'active'])
            ->assertOk()
            ->assertJsonPath('message', '1 customer reactivated.');
    }

    public function test_customers_with_history_are_kept_when_deleting(): void
    {
        $empty = User::factory()->create();
        $booker = User::factory()->create(['name' => 'Bayo Ade']);
        Booking::factory()->for($booker)->create();

        Sanctum::actingAs($this->manager);
        $this->postJson('/api/v1/admin/customers/bulk/delete', ['ids' => [$empty->id, $booker->id, $this->manager->id]])
            ->assertOk()
            ->assertJsonPath('deleted', 1)
            ->assertJsonPath('kept', 1)
            ->assertJsonPath('message', '1 customer deleted. 1 was kept because they have bookings, orders or payments on record (Bayo Ade). Suspend them instead.');

        $this->assertModelMissing($empty);
        $this->assertModelExists($booker);
        $this->assertModelExists($this->manager);
    }

    public function test_messages_go_to_active_customers_by_the_chosen_channels(): void
    {
        Notification::fake();
        $ada = User::factory()->create(['phone' => '08031234567', 'whatsapp_opt_in_at' => now()]);
        $suspended = User::factory()->suspended()->create();

        Sanctum::actingAs($this->manager);
        $this->postJson('/api/v1/admin/customers/bulk/message', ['ids' => [$ada->id, $suspended->id], 'subject' => 'Closed on Friday', 'message' => 'We are closed for the holiday.', 'channels' => ['whatsapp']])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'WhatsApp isn\'t ready for messages yet. In Settings, WhatsApp, add your approved template for "Message from the team".');

        $this->postJson('/api/v1/admin/customers/bulk/message', ['ids' => [$ada->id, $suspended->id], 'subject' => 'Closed on Friday', 'message' => 'We are closed for the holiday.', 'channels' => ['email', 'whatsapp']])
            ->assertOk()
            ->assertJsonPath('recipients', 1)
            ->assertJsonPath('message', 'Sending email to 1 and WhatsApp to 0 who opted in. It can take a minute or two to arrive.');

        Notification::assertSentTo($ada, CustomerMessageNotification::class, function (CustomerMessageNotification $notification, array $channels) {
            return $notification->subject === 'Closed on Friday' && in_array('mail', $channels, true) && ! in_array(WhatsAppChannel::class, $channels, true);
        });
        Notification::assertNotSentTo($suspended, CustomerMessageNotification::class);
    }

    public function test_the_message_reads_as_typed(): void
    {
        $ada = User::factory()->create(['name' => 'Ada Obi']);
        $mail = (new CustomerMessageNotification('Closed on Friday', 'We are closed for the holiday.', ['email']))->toMail($ada);

        $this->assertSame('Closed on Friday', $mail->subject);
        $this->assertSame('Hi Ada,', $mail->greeting);
        $this->assertContains('We are closed for the holiday.', $mail->introLines);
        $this->assertSame(['database', 'mail'], (new CustomerMessageNotification('S', 'M', ['email']))->via($ada));
        $this->assertSame(['database'], (new CustomerMessageNotification('S', 'M', ['whatsapp']))->via($ada));
    }
}
