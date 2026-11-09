<?php

namespace Tests\Feature\Reports;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\Invoice;
use App\Models\Location;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Space;
use App\Models\SpaceType;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportTest extends TestCase
{
    use RefreshDatabase;

    private User $finance;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        // Wednesday 4 November 2026, midday in Uyo.
        $this->travelTo('2026-11-04 11:00:00');
        $this->finance = User::factory()->staff()->create()->assignRole(Role::Finance->value);
    }

    private function paid(int $amount, string $paidAt, ?object $source = null, string $gateway = 'paystack'): Payment
    {
        $invoice = Invoice::factory()->create(['total' => $amount, 'subtotal' => $amount]);
        if ($source) {
            $invoice->source()->associate($source)->save();
        }

        return Payment::factory()->for($invoice)->create(['status' => PaymentStatus::Success, 'gateway' => $gateway, 'amount' => $amount, 'paid_at' => $paidAt]);
    }

    public function test_only_staff_who_can_view_reports_see_them(): void
    {
        $frontDesk = User::factory()->staff()->create()->assignRole(Role::FrontDesk->value);

        $this->actingAs(User::factory()->create())->getJson('/api/v1/admin/reports/summary')->assertForbidden();
        $this->actingAs($frontDesk)->getJson('/api/v1/admin/reports/summary')->assertForbidden();
        $this->actingAs($this->finance)->getJson('/api/v1/admin/reports/summary')->assertOk();
    }

    public function test_money_is_totalled_by_source_method_and_day_within_the_range(): void
    {
        $order = Order::factory()->create(['service_name' => 'Business Name Registration', 'paid_at' => '2026-11-02 10:00:00']);
        $order->update(['invoice_id' => $this->paid(3_500_000, '2026-11-02 10:00:00', $order)->invoice_id]);
        $booking = Booking::factory()->create();
        $this->paid(120_000, '2026-11-03 09:00:00', $booking, 'bank_transfer');
        // Outside the range: last month.
        $this->paid(999_999, '2026-10-01 09:00:00');

        $this->actingAs($this->finance)->getJson('/api/v1/admin/reports/summary?from=2026-11-01&to=2026-11-04')
            ->assertOk()
            ->assertJsonPath('totals.collected', 3_620_000)
            ->assertJsonPath('totals.net', 3_620_000)
            ->assertJsonPath('totals.payments', 2)
            ->assertJsonPath('totals.orders', 1)
            ->assertJsonPath('revenue_by_source.0', ['source' => 'Business services', 'amount' => 3_500_000, 'count' => 1])
            ->assertJsonPath('revenue_by_source.1', ['source' => 'Space bookings', 'amount' => 120_000, 'count' => 1])
            ->assertJsonPath('payment_methods.1.method', 'Bank transfer')
            ->assertJsonPath('services.0', ['service' => 'Business Name Registration', 'orders' => 1, 'amount' => 3_500_000])
            ->assertJsonCount(4, 'revenue_series')
            ->assertJsonPath('revenue_series.1', ['key' => '2026-11-02', 'label' => '2 Nov', 'amount' => 3_500_000]);
    }

    public function test_space_use_counts_booked_hours_against_opening_hours(): void
    {
        // Open 9am to 8pm Monday to Saturday (11 hours a day).
        $room = Space::factory()->for(Location::factory())->for(SpaceType::factory()->create(['booking_mode' => SpaceType::EXCLUSIVE]), 'type')->create(['name' => 'Meeting Room']);
        Booking::factory()->for($room)->create(['starts_at' => '2026-11-03 09:00:00', 'ends_at' => '2026-11-03 14:30:00', 'total' => 2_500_000]);
        Booking::factory()->for($room)->create(['status' => BookingStatus::Cancelled, 'starts_at' => '2026-11-03 15:00:00', 'ends_at' => '2026-11-03 16:00:00']);

        $this->actingAs($this->finance)->getJson('/api/v1/admin/reports/summary?from=2026-11-03&to=2026-11-03')
            ->assertOk()
            ->assertJsonPath('totals.bookings', 1)
            ->assertJsonPath('totals.booked_hours', 5.5)
            ->assertJsonPath('spaces.0.space', 'Meeting Room')
            ->assertJsonPath('spaces.0.hours', 5.5)
            ->assertJsonPath('spaces.0.amount', 2_500_000)
            ->assertJsonPath('spaces.0.occupancy', 50);
    }

    public function test_payments_download_as_a_spreadsheet(): void
    {
        $this->paid(120_000, '2026-11-03 09:00:00');

        $response = $this->actingAs($this->finance)->get('/api/v1/admin/reports/payments.csv?from=2026-11-01&to=2026-11-04')->assertOk();

        $this->assertStringContainsString('attachment; filename=reenite-payments-2026-11-01-to-2026-11-04.csv', (string) $response->headers->get('Content-Disposition'));
        $csv = $response->streamedContent();
        $this->assertStringStartsWith('Date,Receipt,Reference,Customer,Email,For,Method,"Amount (NGN)","Refunded (NGN)",Invoice', $csv);
        $this->assertStringContainsString('2026-11-03 10:00', $csv);
        $this->assertStringContainsString(',1200.00,0.00,', $csv);
    }

    public function test_presets_count_back_from_today(): void
    {
        $this->actingAs($this->finance)->getJson('/api/v1/admin/reports/summary?preset=7d')
            ->assertOk()
            ->assertJsonPath('from', '2026-10-29')
            ->assertJsonPath('to', '2026-11-04');
        $this->actingAs($this->finance)->getJson('/api/v1/admin/reports/summary?preset=ytd')
            ->assertJsonPath('from', '2026-01-01');
    }

    public function test_a_range_longer_than_a_year_is_refused(): void
    {
        $this->actingAs($this->finance)->getJson('/api/v1/admin/reports/summary?from=2025-01-01&to=2026-11-01')
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Choose a range of a year or less.');
    }
}
