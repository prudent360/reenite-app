<?php

namespace Tests\Feature\Admin;

use App\Enums\InvoiceStatus;
use App\Enums\Role;
use App\Models\ActivityLog;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Notifications\PaymentReceiptNotification;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role as RoleModel;
use Tests\TestCase;

class SignInAsCustomerTest extends TestCase
{
    use RefreshDatabase;

    private User $frontDesk;

    private User $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        $this->frontDesk = User::factory()->staff()->create(['name' => 'Uduak Desk'])->assignRole(Role::FrontDesk->value);
        $this->customer = User::factory()->create(['name' => 'Ifiok Etim'])->assignRole(Role::Customer->value);
        Notification::fake();
    }

    /** Signs the staff member in as the customer through the API and returns the customer token. */
    private function signInAs(User $customer, ?User $staff = null): string
    {
        Sanctum::actingAs($staff ?? $this->frontDesk);
        $token = $this->postJson("/api/v1/admin/customers/{$customer->id}/sign-in")->assertOk()->json('token');
        $this->app['auth']->forgetGuards();

        return $token;
    }

    /** A request with a real bearer token, so the impersonation middleware sees the token row. */
    private function withCustomerToken(string $token): static
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    public function test_staff_sign_in_as_a_customer_for_a_limited_time(): void
    {
        $token = $this->signInAs($this->customer);

        $this->withCustomerToken($token)->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.id', $this->customer->id)
            ->assertJsonPath('data.signed_in_by', ['id' => $this->frontDesk->id, 'name' => 'Uduak Desk']);

        $row = PersonalAccessToken::findToken($token);
        $this->assertSame($this->frontDesk->id, $row->impersonator_id);
        $this->assertTrue($row->expires_at->between(now()->addMinutes(119), now()->addMinutes(121)));
        $this->assertNull($this->customer->fresh()->last_login_at);
    }

    public function test_the_customer_signing_in_themselves_has_no_staff_attached(): void
    {
        $token = $this->customer->createToken('web')->plainTextToken;

        $this->withCustomerToken($token)->getJson('/api/v1/auth/me')->assertOk()->assertJsonMissingPath('data.signed_in_by.id');
        $this->assertNull($this->withCustomerToken($token)->getJson('/api/v1/auth/me')->json('data.signed_in_by'));
    }

    public function test_only_active_customers_and_permitted_staff(): void
    {
        Sanctum::actingAs($this->frontDesk);
        $this->postJson('/api/v1/admin/customers/'.User::factory()->staff()->create()->id.'/sign-in')->assertNotFound();
        $this->postJson('/api/v1/admin/customers/'.User::factory()->create(['status' => User::STATUS_SUSPENDED])->id.'/sign-in')->assertUnprocessable();
        $this->postJson('/api/v1/admin/customers/'.User::factory()->guest()->create()->id.'/sign-in')
            ->assertUnprocessable()->assertJsonPath('message', fn (string $message) => str_contains($message, 'Add them as a customer first'));

        RoleModel::findByName(Role::FrontDesk->value, 'web')->revokePermissionTo('customers.impersonate');
        $this->app['auth']->forgetGuards();
        Sanctum::actingAs($this->frontDesk->fresh());
        $this->postJson("/api/v1/admin/customers/{$this->customer->id}/sign-in")->assertForbidden();

        Sanctum::actingAs($this->customer);
        $this->postJson("/api/v1/admin/customers/{$this->customer->id}/sign-in")->assertForbidden();

        $this->assertSame(0, PersonalAccessToken::query()->whereNotNull('impersonator_id')->count());
    }

    public function test_staff_cannot_touch_the_customers_password_profile_signatures_or_cards(): void
    {
        $token = $this->signInAs($this->customer);

        $this->withCustomerToken($token)->putJson('/api/v1/profile/password', [
            'current_password' => 'password', 'password' => 'N3w-passw0rd!', 'password_confirmation' => 'N3w-passw0rd!',
        ])->assertForbidden()->assertJsonPath('message', 'Only Ifiok Etim can do this from their own account.');
        $this->withCustomerToken($token)->putJson('/api/v1/profile', ['name' => 'Someone Else', 'email' => 'else@example.com'])->assertForbidden();
        $this->withCustomerToken($token)->postJson('/api/v1/agreements/1/sign')->assertForbidden();
        $this->withCustomerToken($token)->deleteJson('/api/v1/billing/cards/1')->assertForbidden();

        $this->assertSame('Ifiok Etim', $this->customer->fresh()->name);
    }

    public function test_the_session_ends_when_staff_are_suspended_or_lose_the_permission(): void
    {
        $token = $this->signInAs($this->customer);
        $this->frontDesk->update(['status' => User::STATUS_SUSPENDED]);

        $this->withCustomerToken($token)->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->assertNull(PersonalAccessToken::findToken($token));

        $this->frontDesk->update(['status' => User::STATUS_ACTIVE]);
        $token = $this->signInAs($this->customer);
        RoleModel::findByName(Role::FrontDesk->value, 'web')->revokePermissionTo('customers.impersonate');

        $this->withCustomerToken($token)->getJson('/api/v1/my-bookings')->assertUnauthorized();
    }

    public function test_going_back_to_admin_ends_the_customer_session(): void
    {
        $token = $this->signInAs($this->customer);

        $this->withCustomerToken($token)->deleteJson('/api/v1/auth/impersonation')->assertNoContent();
        $this->assertNull(PersonalAccessToken::findToken($token));

        // A customer's own session isn't a staff sign-in, so there's nothing to end.
        $own = $this->customer->createToken('web')->plainTextToken;
        $this->withCustomerToken($own)->deleteJson('/api/v1/auth/impersonation')->assertNotFound();
        $this->assertNotNull(PersonalAccessToken::findToken($own));
    }

    public function test_staff_record_a_payment_at_the_desk_and_it_is_logged_under_their_name(): void
    {
        $invoice = Invoice::factory()->for($this->customer)->create(['total' => 1_500_000, 'subtotal' => 1_500_000]);
        $token = $this->signInAs($this->customer);

        $this->withCustomerToken($token)->postJson("/api/v1/billing/invoices/{$invoice->id}/desk-payment", ['channel' => 'pos', 'note' => 'Terminal 2'])
            ->assertCreated()
            ->assertJsonPath('data.gateway_label', 'POS at desk')
            ->assertJsonPath('message', fn (string $message) => str_contains($message, '₦15,000'));

        $invoice->refresh();
        $this->assertSame(InvoiceStatus::Paid, $invoice->status);
        $payment = $invoice->payments()->sole();
        $this->assertSame([Payment::DESK, 'pos', $this->frontDesk->id, 'Terminal 2'], [$payment->gateway, $payment->channel, $payment->reviewed_by, $payment->review_note]);
        $this->assertNotNull($payment->receipt_number);
        Notification::assertSentTo($this->customer, PaymentReceiptNotification::class);

        $log = ActivityLog::query()->where('user_id', $this->frontDesk->id)->where('description', 'like', 'As Ifiok Etim:%')->sole();
        $this->assertSame(['v1.billing.invoices.desk-payment', 201, $this->customer->id], [$log->route, $log->status, $log->properties['as_customer']]);

        $this->withCustomerToken($token)->postJson("/api/v1/billing/invoices/{$invoice->id}/desk-payment", ['channel' => 'cash'])
            ->assertUnprocessable()->assertJsonPath('message', 'This invoice is already paid.');
    }

    public function test_customers_cannot_mark_their_own_invoice_paid_at_the_desk(): void
    {
        $invoice = Invoice::factory()->for($this->customer)->create();

        Sanctum::actingAs($this->customer);
        $this->postJson("/api/v1/billing/invoices/{$invoice->id}/desk-payment", ['channel' => 'cash'])->assertForbidden();

        $other = User::factory()->create();
        $token = $this->signInAs($other);
        $this->withCustomerToken($token)->postJson("/api/v1/billing/invoices/{$invoice->id}/desk-payment", ['channel' => 'cash'])->assertNotFound();

        $token = $this->signInAs($this->customer);
        $this->withCustomerToken($token)->postJson("/api/v1/billing/invoices/{$invoice->id}/desk-payment", ['channel' => 'cheque'])
            ->assertUnprocessable()->assertJsonValidationErrors(['channel']);

        $this->assertSame(InvoiceStatus::Unpaid, $invoice->fresh()->status);
    }
}
