<?php

namespace Tests\Feature\Payments;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Models\CustomerPass;
use App\Models\Invoice;
use App\Models\Location;
use App\Models\Space;
use App\Models\SpaceType;
use App\Models\User;
use App\Notifications\CheckoutNudgeNotification;
use App\Notifications\InvoiceReminderNotification;
use App\Payments\PaymentReminders;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class PaymentReminderTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        Notification::fake();
        $this->travelTo('2026-11-02 08:00:00'); // 9am Lagos
        $this->customer = User::factory()->create();
    }

    public function test_invoices_are_chased_before_on_and_after_the_due_date_once_each(): void
    {
        $invoice = Invoice::factory()->for($this->customer)->create(['due_at' => '2026-11-05', 'created_at' => '2026-10-28 10:00:00']);
        $reminders = app(PaymentReminders::class);

        $sent = [];
        foreach (['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06', '2026-11-08', '2026-11-12', '2026-11-20'] as $day) {
            $this->travelTo($day.' 08:00:00');
            $sent[$day] = $reminders->remindInvoices();
        }

        $this->assertSame(['2026-11-02' => 1, '2026-11-03' => 0, '2026-11-05' => 1, '2026-11-06' => 0, '2026-11-08' => 1, '2026-11-12' => 1, '2026-11-20' => 0], $sent);
        Notification::assertSentTo($this->customer, InvoiceReminderNotification::class, fn (InvoiceReminderNotification $mail) => $mail->when === 'is due in 3 days');
        Notification::assertSentTo($this->customer, InvoiceReminderNotification::class, fn (InvoiceReminderNotification $mail) => $mail->when === 'was due 7 days ago');
        $this->assertSame(['before', 'due', 'late_3', 'late_7'], $invoice->refresh()->reminders_sent);
    }

    public function test_paid_invoices_and_new_plan_purchases_are_not_chased_as_invoices(): void
    {
        Invoice::factory()->for($this->customer)->create(['due_at' => '2026-11-02', 'status' => 'paid', 'amount_paid' => 2_000_000, 'total' => 2_000_000, 'subtotal' => 2_000_000]);
        $pass = CustomerPass::factory()->for($this->customer)->create(['status' => CustomerPass::PENDING, 'starts_at' => null, 'ends_at' => null]);
        $planInvoice = Invoice::factory()->for($this->customer)->create(['due_at' => '2026-10-30']);
        $planInvoice->source()->associate($pass)->save();

        $this->assertSame(0, app(PaymentReminders::class)->remindInvoices());
    }

    public function test_an_invoice_issued_on_its_due_date_is_first_chased_three_days_later(): void
    {
        Invoice::factory()->for($this->customer)->create(['due_at' => '2026-11-02']);

        $this->assertSame(0, app(PaymentReminders::class)->remindInvoices());
        $this->travelTo('2026-11-05 08:00:00');
        $this->assertSame(1, app(PaymentReminders::class)->remindInvoices());
        Notification::assertSentTo($this->customer, InvoiceReminderNotification::class, fn (InvoiceReminderNotification $mail) => $mail->when === 'was due 3 days ago');
    }

    public function test_an_expired_booking_hold_gets_one_nudge_that_says_whether_the_time_is_still_free(): void
    {
        $location = Location::factory()->create();
        $room = Space::factory()->for($location)->for(SpaceType::factory()->create(['booking_mode' => SpaceType::EXCLUSIVE]), 'type')->create(['name' => 'Meeting Room', 'slug' => 'meeting-room']);
        Booking::factory()->for($this->customer)->for($room)->create([
            'status' => BookingStatus::Expired, 'hold_expires_at' => now()->subHour(), 'space_name' => 'Meeting Room',
            'starts_at' => '2026-11-04 09:00:00', 'ends_at' => '2026-11-04 11:00:00',
        ]);

        $this->assertSame(1, app(PaymentReminders::class)->nudgeAbandonedCheckouts());
        $this->assertSame(0, app(PaymentReminders::class)->nudgeAbandonedCheckouts());
        Notification::assertSentTo($this->customer, CheckoutNudgeNotification::class, fn (CheckoutNudgeNotification $mail) => $mail->item === 'Meeting Room on Wed 4 Nov, 10:00am'
            && str_contains($mail->detail, 'still free')
            && str_ends_with($mail->url, '/book/meeting-room?date=2026-11-04'));
    }

    public function test_a_pass_started_but_not_paid_is_nudged_after_a_few_hours(): void
    {
        $pass = CustomerPass::factory()->for($this->customer)->create(['name' => 'Flex 3', 'status' => CustomerPass::PENDING, 'starts_at' => null, 'ends_at' => null]);
        $invoice = Invoice::factory()->for($this->customer)->create();
        $pass->update(['invoice_id' => $invoice->id]);

        $this->assertSame(0, app(PaymentReminders::class)->nudgeAbandonedCheckouts(), 'Too soon');
        $this->travel(4)->hours();
        $this->assertSame(1, app(PaymentReminders::class)->nudgeAbandonedCheckouts());
        Notification::assertSentTo($this->customer, CheckoutNudgeNotification::class, fn (CheckoutNudgeNotification $mail) => $mail->item === 'the Flex 3 pass');
    }
}
