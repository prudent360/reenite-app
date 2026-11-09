<?php

namespace Tests\Feature\Legal;

use App\Enums\EmailTemplateKey;
use App\Enums\Role;
use App\Models\CustomerMembership;
use App\Models\DocumentSignature;
use App\Models\LegalDocument;
use App\Models\User;
use App\Notifications\DocumentNotification;
use App\Support\Signatory;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class LegalDocumentTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([RolesAndPermissionsSeeder::class, SettingsSeeder::class]);
        Storage::fake('local');
        $this->manager = User::factory()->staff()->create()->assignRole(Role::OperationsManager->value);
    }

    /**
     * A signature as the browser sends it: a PNG data URL.
     */
    private function drawnSignature(): string
    {
        $image = imagecreatetruecolor(300, 100);
        imagefill($image, 0, 0, imagecolorallocate($image, 255, 255, 255));
        imageline($image, 20, 70, 280, 30, imagecolorallocate($image, 26, 33, 66));
        ob_start();
        imagepng($image);

        return 'data:image/png;base64,'.base64_encode((string) ob_get_clean());
    }

    private function setUpSignatory(string $name = 'Ifiok Founder'): void
    {
        app(Signatory::class)->save($name, 'Founder', Signatory::decodePng($this->drawnSignature()));
    }

    /**
     * @param  list<int>  $userIds
     */
    private function upload(string $audience = LegalDocument::SELECTED, array $userIds = []): LegalDocument
    {
        $this->actingAs($this->manager)->post('/api/v1/admin/legal-documents', [
            'title' => 'Virtual Address Agreement',
            'file' => UploadedFile::fake()->createWithContent('agreement.pdf', "%PDF-1.4\nagreement"),
            'audience' => $audience,
            'user_ids' => $userIds,
        ], ['Accept' => 'application/json'])->assertCreated();

        return LegalDocument::latest('id')->firstOrFail();
    }

    private function sign(User $customer, LegalDocument $document, array $overrides = []): TestResponse
    {
        return $this->actingAs($customer)->postJson("/api/v1/agreements/{$document->id}/sign", $overrides + ['name' => $customer->name, 'signature' => $this->drawnSignature(), 'agree' => true]);
    }

    public function test_documents_cannot_go_out_until_reenites_signatory_is_set_up(): void
    {
        $this->actingAs($this->manager)->post('/api/v1/admin/legal-documents', [
            'title' => 'Agreement', 'file' => UploadedFile::fake()->create('a.pdf', 10, 'application/pdf'), 'audience' => 'all',
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonPath('message', "Set up Reenite's signatory (name and signature) in Settings first, so documents go out already signed by you.");
    }

    public function test_only_staff_who_manage_documents_can_upload(): void
    {
        $frontDesk = User::factory()->staff()->create()->assignRole(Role::FrontDesk->value);

        $this->actingAs($frontDesk)->getJson('/api/v1/admin/legal-documents')->assertForbidden();
        $this->actingAs(User::factory()->create())->getJson('/api/v1/admin/legal-documents')->assertForbidden();
        $this->actingAs($this->manager)->getJson('/api/v1/admin/legal-documents')->assertOk();
        $this->actingAs($this->manager)->putJson('/api/v1/admin/settings/signatory', ['name' => 'X'])->assertForbidden();
    }

    public function test_a_document_for_chosen_clients_is_emailed_to_and_visible_to_only_them(): void
    {
        Notification::fake();
        $this->setUpSignatory();
        [$chosen, $other] = User::factory()->count(2)->create();

        $document = $this->upload(LegalDocument::SELECTED, [$chosen->id]);

        Notification::assertSentTo($chosen, DocumentNotification::class, fn (DocumentNotification $notification) => $notification->template() === EmailTemplateKey::DocumentToSign);
        Notification::assertNotSentTo($other, DocumentNotification::class);
        $this->actingAs($chosen)->getJson('/api/v1/agreements')->assertOk()->assertJsonPath('data.0.title', 'Virtual Address Agreement')->assertJsonPath('data.0.signed_at', null);
        $this->actingAs($other)->getJson('/api/v1/agreements')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($other)->getJson("/api/v1/agreements/{$document->id}")->assertNotFound();
        $this->actingAs($other)->get("/api/v1/agreements/{$document->id}/file")->assertNotFound();
    }

    public function test_a_members_document_reaches_only_clients_with_an_active_membership(): void
    {
        Notification::fake();
        $this->setUpSignatory();
        $member = User::factory()->create();
        CustomerMembership::factory()->for($member)->create();
        $nonMember = User::factory()->create();

        $document = $this->upload(LegalDocument::MEMBERS);

        $this->actingAs($member)->getJson("/api/v1/agreements/{$document->id}")->assertOk()->assertJsonPath('data.signatory.name', 'Ifiok Founder');
        $this->actingAs($nonMember)->getJson("/api/v1/agreements/{$document->id}")->assertNotFound();
    }

    public function test_a_client_signs_once_and_the_signed_copy_keeps_the_signatory_from_that_moment(): void
    {
        Notification::fake();
        $this->setUpSignatory();
        $client = User::factory()->create(['name' => 'Ada Obi']);
        $document = $this->upload(LegalDocument::SELECTED, [$client->id]);

        $this->sign($client, $document)->assertOk()->assertJsonPath('data.signer_name', 'Ada Obi');
        $this->sign($client, $document)->assertUnprocessable()->assertJsonPath('message', "You've already signed this document.");

        // Reenite changes its signatory later: the signed copy still shows who signed then.
        $this->setUpSignatory('New Signatory');
        $signed = $this->actingAs($client)->getJson("/api/v1/agreements/{$document->id}/signed")->assertOk();
        $signed->assertJsonPath('data.signatory.name', 'Ifiok Founder')
            ->assertJsonPath('data.signer.name', 'Ada Obi')
            ->assertJsonPath('data.document.sha256', $document->sha256);
        $this->assertStringStartsWith('data:image/png;base64,', $signed->json('data.signer.signature'));
        $this->assertStringStartsWith('data:image/png;base64,', $signed->json('data.signatory.signature'));
        $this->assertMatchesRegularExpression('/^SIG-\d{4}-\d{6}$/', $signed->json('data.signer.reference'));

        $this->actingAs($this->manager)->getJson("/api/v1/admin/legal-documents/{$document->id}")
            ->assertOk()
            ->assertJsonPath('data.signatures_count', 1)
            ->assertJsonPath('data.recipients.0.signer_name', 'Ada Obi');
        $this->actingAs($this->manager)->getJson("/api/v1/admin/legal-documents/{$document->id}/signed/{$client->id}")->assertOk()->assertJsonPath('data.signer.email', $client->email);
    }

    public function test_signing_needs_a_name_a_real_signature_and_agreement(): void
    {
        Notification::fake();
        $this->setUpSignatory();
        $client = User::factory()->create();
        $document = $this->upload(LegalDocument::SELECTED, [$client->id]);

        $this->sign($client, $document, ['name' => '', 'agree' => false])->assertJsonValidationErrors([
            'name' => 'Type your full name.',
            'agree' => 'Tick the box to confirm you have read and agree to the document.',
        ]);
        $this->sign($client, $document, ['signature' => 'data:image/png;base64,bm90IGFuIGltYWdl'])->assertJsonValidationErrors(['signature' => 'Please draw your signature again.']);
        $this->assertSame(0, DocumentSignature::count());
    }

    public function test_a_document_whose_file_changed_cannot_be_signed(): void
    {
        Notification::fake();
        $this->setUpSignatory();
        $client = User::factory()->create();
        $document = $this->upload(LegalDocument::SELECTED, [$client->id]);
        Storage::disk('local')->put($document->file_path, '%PDF-1.4 tampered');

        $this->sign($client, $document)->assertStatus(409);
    }

    public function test_signed_documents_are_kept_and_can_only_be_switched_off(): void
    {
        Notification::fake();
        $this->setUpSignatory();
        $client = User::factory()->create();
        $document = $this->upload(LegalDocument::SELECTED, [$client->id]);
        $this->sign($client, $document)->assertOk();

        $this->actingAs($this->manager)->deleteJson("/api/v1/admin/legal-documents/{$document->id}")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Clients have signed this document, so it is kept for the record. Switch it off instead.');
        $this->actingAs($this->manager)->putJson("/api/v1/admin/legal-documents/{$document->id}", ['title' => 'Old agreement', 'audience' => 'selected', 'user_ids' => [$client->id], 'is_active' => false])->assertOk();

        // Switched off: no longer asked to sign, but the signed copy stays available.
        $this->actingAs($client)->getJson('/api/v1/agreements')->assertJsonPath('data.0.is_open', false)->assertJsonPath('data.0.signed_at', fn ($value) => $value !== null);
        $this->actingAs($client)->getJson("/api/v1/agreements/{$document->id}/signed")->assertOk();
    }

    public function test_managers_can_search_clients_to_send_a_document_to(): void
    {
        $ada = User::factory()->create(['name' => 'Ada Qxzoro', 'email' => 'ada@example.com']);
        User::factory()->guest()->create(['name' => 'Guest Qxzoro']);
        User::factory()->create(['name' => 'Bola Ade']);

        $this->actingAs($this->manager)->getJson('/api/v1/admin/legal-documents/customers?search=qxzoro')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $ada->id);
        $this->actingAs($this->manager)->getJson('/api/v1/admin/legal-documents/customers?search='.urlencode($this->manager->email))->assertJsonCount(0, 'data');
    }
}
