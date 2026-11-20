<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use App\Notifications\CustomerImportedNotification;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class CustomerImportTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        $this->manager = User::factory()->staff()->create()->assignRole(Role::OperationsManager->value);
        $this->withoutDefer();
    }

    private function csv(string $contents): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('customers.csv', $contents);
    }

    public function test_preview_shows_what_happens_to_each_row_without_saving(): void
    {
        User::factory()->create(['email' => 'taken@example.com', 'phone' => '08030000000']);
        $file = $this->csv("\u{FEFF}First Name,Surname,E-mail Address,Mobile\n"
            ."Ada,Bassey,ADA@example.com,08011112222\n"
            ."Taken,Person,taken@example.com,\n"
            ."No,Email,,\n"
            ."Ada,Again,ada@example.com,\n"
            .",,nameless@example.com,08030000000\n"
            ."\n");

        $response = $this->actingAs($this->manager)->post('/api/v1/admin/customers/import', ['file' => $file, 'preview' => '1'], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('summary', ['total' => 5, 'new' => 2, 'guest' => 0, 'exists' => 1, 'invalid' => 2]);

        $rows = collect($response->json('rows'))->keyBy('row');
        $this->assertSame(['Ada Bassey', 'ada@example.com', '08011112222', 'new'], [$rows[2]['name'], $rows[2]['email'], $rows[2]['phone'], $rows[2]['result']]);
        $this->assertSame('exists', $rows[3]['result']);
        $this->assertSame('No email address.', $rows[4]['note']);
        $this->assertSame('Same email as row 2.', $rows[5]['note']);
        $this->assertSame(['Nameless', ''], [$rows[6]['name'], $rows[6]['phone']]);
        $this->assertStringContainsString('belongs to another account', $rows[6]['note']);

        $this->assertDatabaseMissing('users', ['email' => 'ada@example.com']);
    }

    public function test_import_creates_customers_who_must_change_the_temporary_password(): void
    {
        Notification::fake();
        $guest = User::factory()->guest()->create(['email' => 'guest@example.com', 'phone' => '08099990000']);
        $existing = User::factory()->create(['email' => 'old@example.com', 'name' => 'Keep Me']);

        $this->actingAs($this->manager)->post('/api/v1/admin/customers/import', [
            'file' => $this->csv("Name;Email;Phone\nAda Bassey;ada@example.com;+234 801 111 2222\nGuest Person;guest@example.com;\nChanged;old@example.com;\n"),
            'temporary_password' => 'Welcome2026',
            'send_email' => '1',
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('imported', 2)
            ->assertJsonPath('message', '2 customers imported. Their sign-in details are on the way by email. 1 row was skipped.');

        $ada = User::firstWhere('email', 'ada@example.com');
        $this->assertSame(['Ada Bassey', '+234 801 111 2222', 'customer', 'active'], [$ada->name, $ada->phone, $ada->type, $ada->status]);
        $this->assertTrue($ada->must_change_password);
        $this->assertTrue($ada->hasVerifiedEmail());
        $this->assertTrue($ada->hasRole(Role::Customer->value));
        $this->assertTrue(Hash::check('Welcome2026', $ada->password));

        $guest->refresh();
        $this->assertSame([User::STATUS_ACTIVE, '08099990000', true], [$guest->status, $guest->phone, $guest->must_change_password]);
        $this->assertSame('Keep Me', $existing->refresh()->name);

        Notification::assertSentTo($ada, CustomerImportedNotification::class, function (CustomerImportedNotification $notification) use ($ada) {
            $mail = $notification->toMail($ada);

            return str_contains(implode(' ', $mail->introLines), 'temporary password: Welcome2026')
                && $mail->actionUrl === config('app.frontend_url').'/login';
        });
        Notification::assertNotSentTo($existing, CustomerImportedNotification::class);
    }

    public function test_import_without_email_sends_nothing(): void
    {
        Notification::fake();

        $this->actingAs($this->manager)->post('/api/v1/admin/customers/import', [
            'file' => $this->csv("name,email\nAda,ada@example.com\n"),
            'temporary_password' => 'Welcome2026',
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('message', '1 customer imported. Remember to tell them their temporary password.');

        Notification::assertNothingSent();
    }

    public function test_a_file_without_an_email_column_is_refused(): void
    {
        $this->actingAs($this->manager)->post('/api/v1/admin/customers/import', ['file' => $this->csv("name,phone\nAda,0801\n"), 'preview' => '1'], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['file']);
    }

    public function test_import_needs_a_temporary_password_and_permission(): void
    {
        $this->actingAs($this->manager)->post('/api/v1/admin/customers/import', ['file' => $this->csv("email\nada@example.com\n")], ['Accept' => 'application/json'])
            ->assertJsonValidationErrors(['temporary_password']);

        $finance = User::factory()->staff()->create()->assignRole(Role::Finance->value);
        $this->actingAs($finance)->post('/api/v1/admin/customers/import', ['file' => $this->csv("email\nada@example.com\n"), 'preview' => '1'], ['Accept' => 'application/json'])
            ->assertForbidden();
    }

    public function test_imported_customer_chooses_their_own_password_after_signing_in(): void
    {
        $customer = User::factory()->create(['password' => 'Welcome2026', 'must_change_password' => true]);

        $token = $this->postJson('/api/v1/auth/login', ['email' => $customer->email, 'password' => 'Welcome2026'])
            ->assertOk()
            ->assertJsonPath('user.must_change_password', true)
            ->json('token');

        $this->withToken($token)->putJson('/api/v1/profile/temporary-password', ['password' => 'Welcome2026', 'password_confirmation' => 'Welcome2026'])
            ->assertJsonValidationErrors(['password']);

        $this->withToken($token)->putJson('/api/v1/profile/temporary-password', ['password' => 'MyOwnPass99', 'password_confirmation' => 'MyOwnPass99'])
            ->assertOk()
            ->assertJsonPath('user.must_change_password', false);

        $this->assertTrue(Hash::check('MyOwnPass99', $customer->refresh()->password));
        $this->withToken($token)->putJson('/api/v1/profile/temporary-password', ['password' => 'Another123', 'password_confirmation' => 'Another123'])
            ->assertStatus(409);
    }
}
