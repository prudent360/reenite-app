<?php

namespace Tests\Feature\Catalogue;

use App\Enums\Role;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminServiceTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        $this->manager = User::factory()->staff()->create()->assignRole(Role::OperationsManager->value);
    }

    public function test_only_staff_with_services_permission_can_manage_the_catalogue(): void
    {
        $frontDesk = User::factory()->staff()->create()->assignRole(Role::FrontDesk->value);
        $customer = User::factory()->create()->assignRole(Role::Customer->value);

        $this->actingAs($frontDesk)->getJson('/api/v1/admin/services')->assertForbidden();
        $this->actingAs($customer)->getJson('/api/v1/admin/services')->assertForbidden();
        $this->actingAs($this->manager)->getJson('/api/v1/admin/services')->assertOk();
    }

    public function test_category_crud_generates_unique_slugs(): void
    {
        $this->actingAs($this->manager)
            ->postJson('/api/v1/admin/service-categories', ['name' => 'Tax & Compliance', 'icon' => 'calculator'])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'tax-compliance');

        $id = $this->actingAs($this->manager)
            ->postJson('/api/v1/admin/service-categories', ['name' => 'Tax & Compliance'])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'tax-compliance-2')
            ->json('data.id');

        $this->actingAs($this->manager)
            ->putJson("/api/v1/admin/service-categories/{$id}", ['name' => 'Payroll', 'is_active' => false])
            ->assertOk()
            ->assertJsonPath('data.slug', 'payroll')
            ->assertJsonPath('data.is_active', false);
    }

    public function test_category_with_services_cannot_be_deleted(): void
    {
        $category = ServiceCategory::factory()->create();
        Service::factory()->for($category, 'category')->create()->delete();

        $this->actingAs($this->manager)->deleteJson("/api/v1/admin/service-categories/{$category->id}")->assertUnprocessable();

        $empty = ServiceCategory::factory()->create();
        $this->actingAs($this->manager)->deleteJson("/api/v1/admin/service-categories/{$empty->id}")->assertNoContent();
    }

    public function test_creating_a_service_adds_default_stages(): void
    {
        $category = ServiceCategory::factory()->create();

        $this->actingAs($this->manager)->postJson('/api/v1/admin/services', [
            'service_category_id' => $category->id,
            'name' => 'Business Name Registration',
            'summary' => 'Register your business name with CAC.',
            'service_fee' => 2_500_000,
            'government_fee' => 1_000_000,
            'turnaround_days' => 7,
            'is_active' => true,
        ])->assertCreated()
            ->assertJsonPath('data.slug', 'business-name-registration')
            ->assertJsonPath('data.total_fee', 3_500_000)
            ->assertJsonCount(3, 'data.stages');
    }

    public function test_service_validation(): void
    {
        $this->actingAs($this->manager)->postJson('/api/v1/admin/services', [
            'service_category_id' => 999,
            'name' => '',
            'summary' => '',
            'service_fee' => -5,
            'government_fee' => 'abc',
        ])->assertUnprocessable()->assertJsonValidationErrors(['service_category_id', 'name', 'summary', 'service_fee', 'government_fee']);
    }

    public function test_service_list_filters_and_archive(): void
    {
        $tax = ServiceCategory::factory()->create();
        Service::factory()->for($tax, 'category')->create(['name' => 'VAT Registration']);
        $hidden = Service::factory()->for($tax, 'category')->inactive()->create(['name' => 'TCC']);
        Service::factory()->create(['name' => 'Logo Design']);

        $this->actingAs($this->manager)->getJson("/api/v1/admin/services?category_id={$tax->id}")->assertJsonCount(2, 'data');
        $this->actingAs($this->manager)->getJson('/api/v1/admin/services?status=hidden')->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'TCC');
        $this->actingAs($this->manager)->getJson('/api/v1/admin/services?search=logo')->assertJsonCount(1, 'data');

        $this->actingAs($this->manager)->deleteJson("/api/v1/admin/services/{$hidden->id}")->assertNoContent();
        $this->assertSoftDeleted($hidden);
        $this->actingAs($this->manager)->getJson("/api/v1/admin/services/{$hidden->id}")->assertNotFound();
    }

    public function test_admin_view_includes_internal_stages(): void
    {
        $service = Service::factory()->create();
        $service->stages()->create(['name' => 'Internal QA', 'customer_visible' => false]);

        $this->actingAs($this->manager)
            ->getJson("/api/v1/admin/services/{$service->id}")
            ->assertOk()
            ->assertJsonPath('data.stages.0.name', 'Internal QA');
    }
}
