<?php

namespace Tests\Feature\Settings;

use App\Enums\Role;
use App\Models\BankAccount;
use App\Models\PaymentGateway;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PaymentSettingsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private const SECRET = 'sk_test_abcdef1234567890abcdef1234567890wxyz';

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        $this->admin = User::factory()->staff()->create()->assignRole(Role::SuperAdmin->value);
    }

    public function test_only_super_admin_can_manage_payment_settings(): void
    {
        $ops = User::factory()->staff()->create()->assignRole(Role::OperationsManager->value);

        $this->actingAs($ops)->getJson('/api/v1/admin/settings/payments')->assertForbidden();
        $this->actingAs($this->admin)->getJson('/api/v1/admin/settings/payments')
            ->assertOk()
            ->assertJsonCount(3, 'gateways')
            ->assertJsonPath('gateways.0.code', 'paystack')
            ->assertJsonPath('gateways.0.is_enabled', false);
    }

    public function test_keys_are_encrypted_masked_and_kept_when_left_blank(): void
    {
        $this->actingAs($this->admin)->putJson('/api/v1/admin/settings/payments/gateways/paystack', [
            'is_enabled' => true,
            'mode' => 'test',
            'credentials' => ['test' => ['public_key' => 'pk_test_public123', 'secret_key' => self::SECRET]],
        ])->assertOk()
            ->assertJsonPath('data.is_enabled', true)
            ->assertJsonPath('data.fields.test.0.value', 'pk_test_public123')
            ->assertJsonPath('data.fields.test.1.value', 'sk_test_••••wxyz')
            ->assertJsonMissing(['value' => self::SECRET]);

        $raw = DB::table('payment_gateways')->where('code', 'paystack')->value('credentials');
        $this->assertStringNotContainsString(self::SECRET, $raw);

        // Saving again with blank keys keeps them.
        $this->actingAs($this->admin)->putJson('/api/v1/admin/settings/payments/gateways/paystack', [
            'is_enabled' => true,
            'mode' => 'test',
            'credentials' => ['test' => ['public_key' => '', 'secret_key' => '']],
        ])->assertOk();

        $this->assertSame(self::SECRET, PaymentGateway::firstWhere('code', 'paystack')->credentialsFor('test')['secret_key']);
    }

    public function test_cannot_enable_without_keys_or_with_wrong_kind_of_key(): void
    {
        $this->actingAs($this->admin)->putJson('/api/v1/admin/settings/payments/gateways/paystack', [
            'is_enabled' => true,
            'mode' => 'live',
        ])->assertUnprocessable()->assertJsonValidationErrors('is_enabled');

        $this->actingAs($this->admin)->putJson('/api/v1/admin/settings/payments/gateways/paystack', [
            'is_enabled' => false,
            'mode' => 'live',
            'credentials' => ['live' => ['secret_key' => self::SECRET]],
        ])->assertUnprocessable()->assertJsonValidationErrors('credentials.live.secret_key');

        $this->actingAs($this->admin)->putJson('/api/v1/admin/settings/payments/gateways/flutterwave', [
            'is_enabled' => false,
            'mode' => 'test',
            'credentials' => ['test' => ['public_key' => 'pk_test_wrong']],
        ])->assertUnprocessable()->assertJsonValidationErrors('credentials.test.public_key');
    }

    public function test_connection_test_uses_the_secret_key(): void
    {
        Http::fake([
            'api.paystack.co/*' => Http::sequence()->push(['status' => true], 200)->push(['status' => false], 401),
        ]);
        PaymentGateway::firstWhere('code', 'paystack')->update(['credentials' => ['test' => ['public_key' => 'pk_test_x', 'secret_key' => self::SECRET]]]);

        $this->actingAs($this->admin)->postJson('/api/v1/admin/settings/payments/gateways/paystack/test')
            ->assertOk()
            ->assertJsonPath('message', 'Connected to Paystack in test mode.');

        Http::assertSent(fn ($request) => $request->hasHeader('Authorization', 'Bearer '.self::SECRET));
        $this->assertNotNull(PaymentGateway::firstWhere('code', 'paystack')->verified_at);

        $this->actingAs($this->admin)->postJson('/api/v1/admin/settings/payments/gateways/paystack/test')
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Paystack rejected the test secret key. Copy it again from your Paystack dashboard.');
    }

    public function test_bank_transfer_needs_an_active_account(): void
    {
        $this->actingAs($this->admin)->putJson('/api/v1/admin/settings/payments/bank-transfer', ['enabled' => true])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('enabled');

        $this->actingAs($this->admin)->postJson('/api/v1/admin/settings/bank-accounts', [
            'bank_name' => 'Zenith Bank', 'account_name' => 'Reenite Ltd', 'account_number' => '12345',
        ])->assertUnprocessable()->assertJsonValidationErrors('account_number');

        $id = $this->actingAs($this->admin)->postJson('/api/v1/admin/settings/bank-accounts', [
            'bank_name' => 'Zenith Bank', 'account_name' => 'Reenite Ltd', 'account_number' => '1234567890',
        ])->assertCreated()->json('data.id');

        $this->actingAs($this->admin)->putJson('/api/v1/admin/settings/payments/bank-transfer', ['enabled' => true, 'instructions' => 'Use your order number as the reference.'])
            ->assertOk()
            ->assertJsonPath('bank_transfer.enabled', true)
            ->assertJsonPath('bank_transfer.accounts.0.account_number', '1234567890');

        // The only account can't be removed or deactivated while transfers are on.
        $this->actingAs($this->admin)->deleteJson("/api/v1/admin/settings/bank-accounts/{$id}")->assertUnprocessable();
        $this->actingAs($this->admin)->putJson("/api/v1/admin/settings/bank-accounts/{$id}", [
            'bank_name' => 'Zenith Bank', 'account_name' => 'Reenite Ltd', 'account_number' => '1234567890', 'is_active' => false,
        ])->assertUnprocessable();
        $this->assertTrue(BankAccount::find($id)->is_active);
    }
}
