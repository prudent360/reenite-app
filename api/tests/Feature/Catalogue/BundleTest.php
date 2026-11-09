<?php

namespace Tests\Feature\Catalogue;

use App\Enums\Role;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BundleTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        $this->manager = User::factory()->staff()->create()->assignRole(Role::OperationsManager->value);
    }

    public function test_bundle_keeps_service_order_and_reports_value(): void
    {
        [$first, $second, $third] = Service::factory(3)->create();

        $id = $this->actingAs($this->manager)->postJson('/api/v1/admin/bundles', [
            'name' => 'Startup Launch Pack',
            'summary' => 'Everything to get started.',
            'price' => 10_000_000,
            'service_ids' => [$third->id, $first->id],
        ])->assertCreated()
            ->assertJsonPath('data.slug', 'startup-launch-pack')
            ->assertJsonPath('data.services.0.id', $third->id)
            ->assertJsonPath('data.value_of_services', $third->totalFee() + $first->totalFee())
            ->json('data.id');

        $this->actingAs($this->manager)->putJson("/api/v1/admin/bundles/{$id}", [
            'name' => 'Startup Launch Pack',
            'summary' => 'Everything to get started.',
            'price' => 12_000_000,
            'service_ids' => [$first->id, $second->id, $third->id],
        ])->assertOk()->assertJsonCount(3, 'data.services')->assertJsonPath('data.services.0.id', $first->id);
    }

    public function test_bundle_needs_two_existing_services(): void
    {
        $service = Service::factory()->create();
        $archived = Service::factory()->create();
        $archived->delete();

        $this->actingAs($this->manager)->postJson('/api/v1/admin/bundles', [
            'name' => 'Pack',
            'summary' => 'x',
            'price' => 100,
            'service_ids' => [$service->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('service_ids');

        $this->actingAs($this->manager)->postJson('/api/v1/admin/bundles', [
            'name' => 'Pack',
            'summary' => 'x',
            'price' => 100,
            'service_ids' => [$service->id, $archived->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('service_ids.1');
    }
}
