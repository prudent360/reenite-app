<?php

namespace Tests\Feature\Notifications;

use App\Enums\EmailTemplateKey;
use App\Models\Booking;
use App\Models\EmailTemplate;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Notifications\BookingNotification;
use App\Notifications\OrderNotification;
use App\Notifications\PaymentReceiptNotification;
use App\Notifications\StaffAlertNotification;
use App\Notifications\VerifyEmailNotification;
use App\Support\FrontendLinks;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InAppNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_payments_bookings_and_orders_appear_under_the_bell_with_links_into_the_site(): void
    {
        $payment = Payment::factory()->create(['receipt_number' => 'RCT-0001']);
        $customer = $payment->user;
        $booking = Booking::factory()->create(['user_id' => $customer->id]);
        $order = Order::factory()->create(['user_id' => $customer->id]);

        $customer->notify(new PaymentReceiptNotification($payment));
        $this->travel(1)->minute();
        $customer->notify(new BookingNotification(EmailTemplateKey::BookingConfirmed, $booking));
        $this->travel(1)->minute();
        $customer->notify(new OrderNotification(EmailTemplateKey::OrderReceived, $order));

        $response = $this->actingAs($customer)->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('unread_count', 3)
            // Newest first.
            ->assertJsonPath('data.0.title', 'Order received')
            ->assertJsonPath('data.0.group', 'Orders')
            ->assertJsonPath('data.0.url', '/dashboard/orders/'.$order->reference)
            ->assertJsonPath('data.0.read', false)
            ->assertJsonPath('data.1.title', 'Booking confirmed')
            ->assertJsonPath('data.2.title', 'Payment receipt')
            ->assertJsonPath('data.2.body', 'Receipt RCT-0001: payment received')
            ->assertJsonPath('data.2.url', '/dashboard/billing/receipts/'.$payment->reference);

        $this->assertStringStartsWith('/bookings/'.$booking->reference, $response->json('data.1.url'));
    }

    public function test_the_bell_still_fills_when_the_email_is_switched_off(): void
    {
        EmailTemplate::create(['key' => EmailTemplateKey::PaymentReceipt, 'is_enabled' => false, ...EmailTemplateKey::PaymentReceipt->defaults()]);
        $payment = Payment::factory()->create();

        $this->assertSame(['database'], (new PaymentReceiptNotification($payment))->via($payment->user));
    }

    public function test_staff_alerts_appear_for_the_team_member(): void
    {
        $staff = User::factory()->staff()->create();
        $staff->notify(new StaffAlertNotification(EmailTemplateKey::StaffTransferToReview, ['amount' => '₦5,000', 'invoice_number' => 'INV-7'], FrontendLinks::adminTransfers()));

        $this->actingAs($staff)->getJson('/api/v1/notifications')
            ->assertJsonPath('data.0.title', 'Bank transfer to check')
            ->assertJsonPath('data.0.body', 'Transfer to check: ₦5,000 for INV-7')
            ->assertJsonPath('data.0.url', '/admin/finance/transfers');
    }

    public function test_sign_in_links_stay_in_the_inbox(): void
    {
        $user = User::factory()->unverified()->create();
        $user->notify(new VerifyEmailNotification);

        $this->assertSame(0, $user->notifications()->count());
    }

    public function test_people_mark_their_own_notifications_read(): void
    {
        $customer = User::factory()->create();
        $other = User::factory()->create();
        foreach ([$customer, $customer, $other] as $user) {
            $user->notify(new StaffAlertNotification(EmailTemplateKey::StaffNewBooking, [], FrontendLinks::base().'/admin/bookings'));
        }
        [$first] = $customer->notifications()->pluck('id');
        $theirs = $other->notifications()->value('id');

        $this->actingAs($customer)->postJson("/api/v1/notifications/{$theirs}/read")->assertNotFound();
        $this->actingAs($customer)->postJson("/api/v1/notifications/{$first}/read")->assertNoContent();
        $this->actingAs($customer)->getJson('/api/v1/notifications')->assertJsonPath('unread_count', 1);

        $this->actingAs($customer)->postJson('/api/v1/notifications/read')->assertNoContent();
        $this->actingAs($customer)->getJson('/api/v1/notifications')->assertJsonPath('unread_count', 0);
        $this->assertSame(1, $other->unreadNotifications()->count());
    }

    public function test_signed_out_visitors_cannot_read_notifications(): void
    {
        $this->getJson('/api/v1/notifications')->assertUnauthorized();
    }
}
