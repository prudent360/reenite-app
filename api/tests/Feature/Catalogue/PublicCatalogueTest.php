<?php

namespace Tests\Feature\Catalogue;

use App\Models\Bundle;
use App\Models\Service;
use App\Models\ServiceCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicCatalogueTest extends TestCase
{
    use RefreshDatabase;

    public function test_catalogue_lists_only_active_categories_and_services(): void
    {
        $category = ServiceCategory::factory()->create(['name' => 'Business Registration']);
        Service::factory()->for($category, 'category')->create(['name' => 'LTD Company', 'service_fee' => 5_000_000, 'government_fee' => 1_000_000]);
        Service::factory()->for($category, 'category')->inactive()->create(['name' => 'Hidden Service']);
        Service::factory()->for($category, 'category')->create(['name' => 'Archived Service'])->delete();

        $hiddenCategory = ServiceCategory::factory()->inactive()->create();
        Service::factory()->for($hiddenCategory, 'category')->create();

        $emptyCategory = ServiceCategory::factory()->create();

        $response = $this->getJson('/api/v1/catalogue')->assertOk();

        $response->assertJsonCount(1, 'categories')
            ->assertJsonPath('categories.0.name', 'Business Registration')
            ->assertJsonCount(1, 'categories.0.services')
            ->assertJsonPath('categories.0.services.0.name', 'LTD Company')
            ->assertJsonPath('categories.0.services.0.total_fee', 6_000_000);

        $this->assertNotContains($emptyCategory->id, array_column($response->json('categories'), 'id'));
    }

    public function test_bundles_with_unavailable_services_are_not_offered(): void
    {
        $services = Service::factory(2)->create();
        $offered = Bundle::factory()->create(['name' => 'Launch Pack']);
        $offered->services()->attach($services->pluck('id'));

        $broken = Bundle::factory()->create();
        $broken->services()->attach([$services[0]->id, Service::factory()->inactive()->create()->id]);

        $this->getJson('/api/v1/catalogue')
            ->assertOk()
            ->assertJsonCount(1, 'bundles')
            ->assertJsonPath('bundles.0.name', 'Launch Pack')
            ->assertJsonPath('bundles.0.value_of_services', $services->sum(fn (Service $service) => $service->totalFee()));
    }

    public function test_service_detail_shows_requirements_and_only_customer_visible_stages(): void
    {
        $service = Service::factory()->create(['slug' => 'ltd-company']);
        $service->documentRequirements()->create(['label' => 'Valid ID', 'is_required' => true]);
        $service->stages()->createMany([
            ['name' => 'Filed with CAC', 'customer_visible' => true, 'sort_order' => 0],
            ['name' => 'Internal QA', 'customer_visible' => false, 'sort_order' => 1],
        ]);

        $this->getJson('/api/v1/catalogue/services/ltd-company')
            ->assertOk()
            ->assertJsonPath('data.document_requirements.0.label', 'Valid ID')
            ->assertJsonCount(1, 'data.stages')
            ->assertJsonPath('data.stages.0.name', 'Filed with CAC');
    }

    public function test_hidden_services_have_no_public_page(): void
    {
        Service::factory()->inactive()->create(['slug' => 'secret']);
        $hiddenCategory = ServiceCategory::factory()->inactive()->create();
        Service::factory()->for($hiddenCategory, 'category')->create(['slug' => 'in-hidden-category']);

        $this->getJson('/api/v1/catalogue/services/secret')->assertNotFound();
        $this->getJson('/api/v1/catalogue/services/in-hidden-category')->assertNotFound();
    }
}
