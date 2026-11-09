<?php

namespace Tests\Feature\Catalogue;

use App\Enums\Role;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ServiceBuilderTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;

    private Service $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        $this->manager = User::factory()->staff()->create()->assignRole(Role::OperationsManager->value);
        $this->service = Service::factory()->create();
    }

    public function test_fields_are_created_updated_reordered_and_removed(): void
    {
        $url = "/api/v1/admin/services/{$this->service->id}/fields";

        $fields = $this->actingAs($this->manager)->putJson($url, ['fields' => [
            ['key' => 'business_name', 'label' => 'Proposed business name', 'type' => 'text', 'is_required' => true],
            ['key' => 'nature', 'label' => 'Nature of business', 'type' => 'select', 'options' => ['Trading', 'Services']],
            ['key' => 'directors', 'label' => 'Directors', 'type' => 'people'],
        ]])->assertOk()->assertJsonCount(3, 'data.form_fields')->json('data.form_fields');

        // Swap the first two, rename one, drop the third, add a new one.
        $this->actingAs($this->manager)->putJson($url, ['fields' => [
            ['id' => $fields[1]['id'], 'key' => 'nature', 'label' => 'What do you do?', 'type' => 'radio', 'options' => ['Trading', 'Services', 'Other']],
            ['id' => $fields[0]['id'], 'key' => 'business_name', 'label' => 'Proposed business name', 'type' => 'text', 'is_required' => true],
            ['key' => 'start_date', 'label' => 'Start date', 'type' => 'date'],
        ]])->assertOk()
            ->assertJsonCount(3, 'data.form_fields')
            ->assertJsonPath('data.form_fields.0.id', $fields[1]['id'])
            ->assertJsonPath('data.form_fields.0.label', 'What do you do?')
            ->assertJsonPath('data.form_fields.0.options.2', 'Other')
            ->assertJsonPath('data.form_fields.1.id', $fields[0]['id'])
            ->assertJsonPath('data.form_fields.2.key', 'start_date');

        $this->assertDatabaseMissing('service_form_fields', ['id' => $fields[2]['id']]);
    }

    public function test_new_items_keep_their_position_ahead_of_existing_ones(): void
    {
        $existing = $this->service->formFields()->create(['key' => 'existing', 'label' => 'Existing', 'type' => 'text']);
        $stage = $this->service->stages()->create(['name' => 'Existing stage']);

        $this->actingAs($this->manager)->putJson("/api/v1/admin/services/{$this->service->id}/fields", ['fields' => [
            ['key' => 'brand_new', 'label' => 'Brand new', 'type' => 'text'],
            ['id' => $existing->id, 'key' => 'existing', 'label' => 'Existing', 'type' => 'text'],
        ]])->assertOk()
            ->assertJsonPath('data.form_fields.0.key', 'brand_new')
            ->assertJsonPath('data.form_fields.1.key', 'existing');

        $this->actingAs($this->manager)->putJson("/api/v1/admin/services/{$this->service->id}/stages", ['stages' => [
            ['name' => 'New first stage'],
            ['id' => $stage->id, 'name' => 'Existing stage'],
        ]])->assertOk()->assertJsonPath('data.stages.0.name', 'New first stage');
    }

    public function test_fields_can_swap_keys(): void
    {
        $url = "/api/v1/admin/services/{$this->service->id}/fields";
        $fields = $this->actingAs($this->manager)->putJson($url, ['fields' => [
            ['key' => 'first', 'label' => 'A', 'type' => 'text'],
            ['key' => 'second', 'label' => 'B', 'type' => 'text'],
        ]])->json('data.form_fields');

        $this->actingAs($this->manager)->putJson($url, ['fields' => [
            ['id' => $fields[0]['id'], 'key' => 'second', 'label' => 'A', 'type' => 'text'],
            ['id' => $fields[1]['id'], 'key' => 'first', 'label' => 'B', 'type' => 'text'],
        ]])->assertOk()->assertJsonPath('data.form_fields.0.key', 'second');
    }

    public function test_field_validation(): void
    {
        $this->actingAs($this->manager)->putJson("/api/v1/admin/services/{$this->service->id}/fields", ['fields' => [
            ['key' => 'Bad Key', 'label' => 'One', 'type' => 'text'],
            ['key' => 'choice', 'label' => 'Pick', 'type' => 'select', 'options' => ['Only one']],
            ['key' => 'dup', 'label' => 'Dup', 'type' => 'unknown'],
            ['key' => 'dup', 'label' => 'Dup 2', 'type' => 'text'],
        ]])->assertUnprocessable()->assertJsonValidationErrors([
            'fields.0.key', 'fields.1.options', 'fields.2.type', 'fields.2.key',
        ]);
    }

    public function test_ids_from_another_service_are_treated_as_new(): void
    {
        $other = Service::factory()->create();
        $foreign = $other->formFields()->create(['key' => 'theirs', 'label' => 'Theirs', 'type' => 'text']);

        $this->actingAs($this->manager)->putJson("/api/v1/admin/services/{$this->service->id}/fields", ['fields' => [
            ['id' => $foreign->id, 'key' => 'mine', 'label' => 'Mine', 'type' => 'text'],
        ]])->assertOk();

        $this->assertDatabaseHas('service_form_fields', ['id' => $foreign->id, 'service_id' => $other->id, 'key' => 'theirs']);
        $this->assertDatabaseHas('service_form_fields', ['service_id' => $this->service->id, 'key' => 'mine']);
    }

    public function test_requirements_and_stages_sync(): void
    {
        $this->actingAs($this->manager)->putJson("/api/v1/admin/services/{$this->service->id}/requirements", ['requirements' => [
            ['label' => 'Valid ID', 'description' => 'NIN slip, passport or driver licence'],
            ['label' => 'Passport photo', 'is_required' => false],
        ]])->assertOk()->assertJsonPath('data.document_requirements.1.is_required', false);

        $this->actingAs($this->manager)->putJson("/api/v1/admin/services/{$this->service->id}/stages", ['stages' => [
            ['name' => 'Documents received'],
            ['name' => 'Quality check', 'customer_visible' => false],
            ['name' => 'Filed with CAC'],
        ]])->assertOk()->assertJsonCount(3, 'data.stages')->assertJsonPath('data.stages.1.customer_visible', false);

        $this->actingAs($this->manager)
            ->putJson("/api/v1/admin/services/{$this->service->id}/stages", ['stages' => []])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('stages');
    }
}
