<?php

namespace Tests\Feature\Workspace;

use App\Enums\Role;
use App\Models\Addon;
use App\Models\CancellationPolicy;
use App\Models\Location;
use App\Models\Space;
use App\Models\SpaceType;
use App\Models\User;
use App\Workspace\OpeningHours;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\WorkspaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class WorkspaceAdminTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        $this->manager = User::factory()->staff()->create()->assignRole(Role::OperationsManager->value);
    }

    /**
     * @return array<string, mixed>
     */
    private function spacePayload(Location $location, SpaceType $type, array $overrides = []): array
    {
        return $overrides + [
            'location_id' => $location->id,
            'space_type_id' => $type->id,
            'name' => 'Podcast Studio',
            'capacity' => 2,
            'min_duration_minutes' => 60,
            'buffer_minutes' => 15,
            'min_notice_minutes' => 60,
            'advance_booking_days' => 90,
            'rates' => [['unit' => 'hour', 'price' => 700_000], ['unit' => 'day', 'price' => 4_000_000]],
        ];
    }

    public function test_only_workspace_managers_can_manage_spaces(): void
    {
        $officer = User::factory()->staff()->create()->assignRole(Role::FilingOfficer->value);

        $this->actingAs($officer)->getJson('/api/v1/admin/workspace/locations')->assertForbidden();
        $this->actingAs(User::factory()->create())->getJson('/api/v1/admin/workspace/locations')->assertForbidden();
        $this->actingAs($this->manager)->getJson('/api/v1/admin/workspace/locations')->assertOk();
    }

    public function test_locations_validate_and_normalise_opening_hours(): void
    {
        $hours = OpeningHours::defaults();
        $hours[0]['closes'] = '08:00'; // closes before it opens
        $hours[6]['opens'] = 'whenever'; // Sunday is closed, so ignored

        $this->actingAs($this->manager)->postJson('/api/v1/admin/workspace/locations', [
            'name' => 'Reenite Uyo', 'address' => '162 Oron Road', 'city' => 'Uyo', 'state' => 'Akwa Ibom State', 'hours' => $hours,
        ])->assertUnprocessable()->assertJsonValidationErrors(['hours.0.closes'])->assertJsonMissingValidationErrors(['hours.6.opens']);

        $hours[0]['closes'] = '20:00';
        $this->actingAs($this->manager)->postJson('/api/v1/admin/workspace/locations', [
            'name' => 'Reenite Uyo', 'address' => '162 Oron Road', 'city' => 'Uyo', 'state' => 'Akwa Ibom State',
            'hours' => array_reverse($hours), 'amenities' => ['WiFi', ''],
        ])->assertCreated()
            ->assertJsonPath('data.slug', 'reenite-uyo')
            ->assertJsonPath('data.hours.0.day', 1)
            ->assertJsonPath('data.hours.6.opens', null)
            ->assertJsonPath('data.amenities', ['WiFi']);
    }

    public function test_a_location_with_spaces_cannot_be_deleted(): void
    {
        $space = Space::factory()->create();

        $this->actingAs($this->manager)->deleteJson("/api/v1/admin/workspace/locations/{$space->location_id}")->assertUnprocessable();
        $this->actingAs($this->manager)->deleteJson('/api/v1/admin/workspace/locations/'.Location::factory()->create()->id)->assertNoContent();
    }

    public function test_spaces_save_rates_add_ons_and_hours_override(): void
    {
        $location = Location::factory()->create();
        $type = SpaceType::factory()->create();
        $mic = Addon::factory()->create(['name' => 'Extra mic']);

        $id = $this->actingAs($this->manager)->postJson('/api/v1/admin/workspace/spaces', $this->spacePayload($location, $type, ['addon_ids' => [$mic->id]]))
            ->assertCreated()
            ->assertJsonPath('data.uses_location_hours', true)
            ->assertJsonPath('data.rates.1.unit', 'day')
            ->assertJsonPath('data.addons.0.name', 'Extra mic')
            ->json('data.id');

        // Replacing the rate set removes the daily rate; own hours override the location's.
        $this->actingAs($this->manager)->putJson("/api/v1/admin/workspace/spaces/{$id}", $this->spacePayload($location, $type, [
            'rates' => [['unit' => 'hour', 'price' => 800_000]],
            'hours' => OpeningHours::defaults(),
        ]))->assertOk()
            ->assertJsonCount(1, 'data.rates')
            ->assertJsonPath('data.rates.0.price', 800_000)
            ->assertJsonPath('data.uses_location_hours', false)
            ->assertJsonCount(0, 'data.addons');

        $this->actingAs($this->manager)->postJson('/api/v1/admin/workspace/spaces', $this->spacePayload($location, $type, [
            'rates' => [['unit' => 'hour', 'price' => 1], ['unit' => 'hour', 'price' => 2]],
            'max_duration_minutes' => 30,
        ]))->assertUnprocessable()->assertJsonValidationErrors(['rates.0.unit', 'max_duration_minutes']);
    }

    public function test_space_photo_upload(): void
    {
        Storage::fake('public');
        $space = Space::factory()->create();

        $this->actingAs($this->manager)->post("/api/v1/admin/workspace/spaces/{$space->id}/photo", ['photo' => UploadedFile::fake()->image('small.jpg', 200, 200)], ['Accept' => 'application/json'])
            ->assertUnprocessable();

        $this->actingAs($this->manager)->post("/api/v1/admin/workspace/spaces/{$space->id}/photo", ['photo' => UploadedFile::fake()->image('studio.jpg', 1200, 800)], ['Accept' => 'application/json'])
            ->assertOk();
        Storage::disk('public')->assertExists($space->refresh()->photo_path);

        $this->actingAs($this->manager)->deleteJson("/api/v1/admin/workspace/spaces/{$space->id}/photo")->assertOk()->assertJsonPath('data.photo_url', null);
    }

    public function test_cancellation_policies_need_a_last_minute_rule_and_one_default(): void
    {
        $this->actingAs($this->manager)->postJson('/api/v1/admin/workspace/cancellation-policies', [
            'name' => 'Strict', 'rules' => [['hours_before' => 48, 'refund_percent' => 100]],
        ])->assertUnprocessable()->assertJsonValidationErrors('rules');

        $old = CancellationPolicy::factory()->create(['is_default' => true]);
        $this->actingAs($this->manager)->postJson('/api/v1/admin/workspace/cancellation-policies', [
            'name' => 'Strict', 'is_default' => true,
            'rules' => [['hours_before' => 0, 'refund_percent' => 0], ['hours_before' => 48, 'refund_percent' => 50]],
        ])->assertCreated()->assertJsonPath('data.rules.0.hours_before', 48)->assertJsonPath('data.summary.0', '50% refund if cancelled 48+ hours before');

        $this->assertFalse($old->refresh()->is_default);
        $this->assertSame(50, CancellationPolicy::firstWhere('name', 'Strict')->refundPercentFor(60));
        $this->assertSame(0, CancellationPolicy::firstWhere('name', 'Strict')->refundPercentFor(3));
    }

    public function test_closures_are_entered_in_lagos_time(): void
    {
        $space = Space::factory()->create();
        $other = Space::factory()->create();

        $this->actingAs($this->manager)->postJson('/api/v1/admin/workspace/closures', [
            'location_id' => $space->location_id, 'space_id' => $other->id, 'starts_at' => '2026-12-25 00:00', 'ends_at' => '2026-12-26 00:00', 'reason' => 'Christmas',
        ])->assertUnprocessable()->assertJsonValidationErrors('space_id');

        $this->actingAs($this->manager)->postJson('/api/v1/admin/workspace/closures', [
            'location_id' => $space->location_id, 'starts_at' => '2026-12-25 00:00', 'ends_at' => '2026-12-26 00:00', 'reason' => 'Christmas',
        ])->assertCreated()->assertJsonPath('data.starts_at', '2026-12-24T23:00:00+00:00');
    }

    public function test_pass_plans_need_eligible_space_types(): void
    {
        $desk = SpaceType::factory()->create(['booking_mode' => SpaceType::SHARED]);

        $this->actingAs($this->manager)->postJson('/api/v1/admin/workspace/pass-plans', [
            'name' => '3 days a week', 'price' => 1_200_000, 'credit_type' => 'visits', 'credits' => 3, 'period' => 'week', 'space_type_ids' => [],
        ])->assertUnprocessable()->assertJsonValidationErrors('space_type_ids');

        $this->actingAs($this->manager)->postJson('/api/v1/admin/workspace/pass-plans', [
            'name' => '3 days a week', 'price' => 1_200_000, 'credit_type' => 'visits', 'credits' => 3, 'period' => 'week', 'space_type_ids' => [$desk->id],
        ])->assertCreated()->assertJsonPath('data.allowance', '3 visits a week')->assertJsonPath('data.space_type_ids', [$desk->id]);
    }

    public function test_public_listing_hides_inactive_locations_spaces_and_rates(): void
    {
        $this->seed(WorkspaceSeeder::class);
        Space::firstWhere('slug', 'uyo-podcast-studio')->update(['is_active' => false]);
        Space::firstWhere('slug', 'uyo-hot-desk')->rates()->where('unit', 'day')->update(['is_active' => false]);

        $response = $this->getJson('/api/v1/workspace')->assertOk()
            ->assertJsonCount(1, 'locations')
            ->assertJsonPath('locations.0.slug', 'reenite-uyo')
            ->assertJsonCount(5, 'locations.0.spaces')
            ->assertJsonCount(2, 'pass_plans')
            ->assertJsonCount(3, 'memberships');

        $desk = collect($response->json('locations.0.spaces'))->firstWhere('slug', 'uyo-hot-desk');
        $this->assertSame(['hour'], array_column($desk['rates'], 'unit'));

        $this->getJson('/api/v1/workspace/spaces/uyo-podcast-studio')->assertNotFound();
        $this->getJson('/api/v1/workspace/spaces/uyo-meeting-room')->assertOk()->assertJsonCount(2, 'data.addons')->assertJsonPath('data.cancellation_policy.name', 'Flexible');
    }

    public function test_seeder_is_idempotent_and_keeps_admin_edits(): void
    {
        $this->seed(WorkspaceSeeder::class);
        Space::firstWhere('slug', 'uyo-hot-desk')->update(['capacity' => 55]);

        $this->seed(WorkspaceSeeder::class);

        $this->assertSame(6, Space::count());
        $this->assertSame(55, Space::firstWhere('slug', 'uyo-hot-desk')->capacity);
    }
}
