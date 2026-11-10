<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\DocumentSignature;
use App\Models\LegalDocument;
use App\Models\User;
use App\Notifications\DocumentNotification;
use App\Support\AgreementData;
use App\Support\Signatory;
use App\Uploads\UploadLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Legal documents for clients to sign: upload, choose who signs, follow who has signed.
 */
class LegalDocumentController extends Controller
{
    public function index(): JsonResponse
    {
        $documents = LegalDocument::query()->withCount('signatures')->latest('id')->get();

        return response()->json(['data' => $documents->map(fn (LegalDocument $document) => $this->summary($document) + [
            'audience_count' => $document->audienceMembers()->count(),
        ])]);
    }

    /**
     * Upload a PDF and send it to its clients, who are emailed to sign.
     */
    public function store(Request $request, Signatory $signatory): JsonResponse
    {
        abort_unless($signatory->details(), 422, "Set up Reenite's signatory (name and signature) in Settings first, so documents go out already signed by you.");
        $validated = $request->validate($this->rules(true), $this->messages());

        $file = $request->file('file');
        $document = DB::transaction(function () use ($validated, $file, $request) {
            $document = LegalDocument::create([
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'file_path' => $file->storeAs('legal-documents', Str::random(32).'.pdf', 'local'),
                'file_name' => $file->getClientOriginalName(),
                'sha256' => hash_file('sha256', $file->getRealPath()),
                'audience' => $validated['audience'],
                'is_active' => true,
                'created_by' => $request->user()->id,
            ]);
            $document->recipients()->sync($validated['audience'] === LegalDocument::SELECTED ? $this->customerIds($validated['user_ids'] ?? []) : []);

            return $document;
        });

        Notification::send($document->audienceMembers(), new DocumentNotification($document));

        return response()->json(['data' => $this->summary($document->loadCount('signatures')), 'message' => 'Document sent for signing.'], Response::HTTP_CREATED);
    }

    public function show(LegalDocument $legalDocument): JsonResponse
    {
        $signatures = $legalDocument->signatures()->with('user:id,name,email')->get()->keyBy('user_id');
        $members = $legalDocument->audienceMembers();
        // People who signed but are no longer in the audience still appear, so no signed copy goes missing.
        $signedOutsideAudience = $signatures->reject(fn (DocumentSignature $signature) => $members->contains('id', $signature->user_id))->map(fn (DocumentSignature $signature) => $signature->user);

        return response()->json(['data' => $this->summary($legalDocument->loadCount('signatures')) + [
            'recipients' => $members->concat($signedOutsideAudience)->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'signed_at' => $signatures->get($user->id)?->signed_at?->toIso8601String(),
                'signer_name' => $signatures->get($user->id)?->signer_name,
            ])->values(),
            'selected_user_ids' => $legalDocument->recipients()->pluck('users.id'),
        ]]);
    }

    public function update(Request $request, LegalDocument $legalDocument): JsonResponse
    {
        $validated = $request->validate($this->rules(false), $this->messages());
        $before = $legalDocument->audienceMembers()->pluck('id');

        $legalDocument->update([
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'audience' => $validated['audience'],
            'is_active' => $validated['is_active'],
        ]);
        $legalDocument->recipients()->sync($validated['audience'] === LegalDocument::SELECTED ? $this->customerIds($validated['user_ids'] ?? []) : []);

        // Only people newly asked to sign are emailed.
        if ($legalDocument->is_active) {
            Notification::send($legalDocument->audienceMembers()->whereNotIn('id', $before), new DocumentNotification($legalDocument));
        }

        return response()->json(['data' => $this->summary($legalDocument->loadCount('signatures')), 'message' => 'Document updated.']);
    }

    /**
     * Unsigned documents can be deleted; signed ones are kept for the record and can only be switched off.
     */
    public function destroy(LegalDocument $legalDocument): Response
    {
        abort_if($legalDocument->signatures()->exists(), 422, 'Clients have signed this document, so it is kept for the record. Switch it off instead.');
        Storage::disk('local')->delete($legalDocument->file_path);
        $legalDocument->delete();

        return response()->noContent();
    }

    /**
     * Clients to choose from when sending a document to selected people.
     */
    public function customers(Request $request): JsonResponse
    {
        $search = trim((string) $request->string('search'));
        $customers = User::query()
            ->where('type', User::TYPE_CUSTOMER)
            ->where('status', '!=', User::STATUS_GUEST)
            ->when($search !== '', fn ($query) => $query->where(fn ($query) => $query->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%")))
            ->orderBy('name')
            ->limit(20)
            ->get(['id', 'name', 'email']);

        return response()->json(['data' => $customers]);
    }

    public function file(LegalDocument $legalDocument): StreamedResponse
    {
        return Storage::disk('local')->response($legalDocument->file_path, $legalDocument->file_name, ['Content-Type' => 'application/pdf']);
    }

    /**
     * Everything needed to build a client's signed copy.
     */
    public function signed(LegalDocument $legalDocument, User $user): JsonResponse
    {
        $signature = $legalDocument->signatures()->where('user_id', $user->id)->firstOrFail();

        return response()->json(['data' => AgreementData::signed($legalDocument, $signature->load('user'))]);
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(bool $creating): array
    {
        return [
            'title' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'file' => [$creating ? 'required' : 'prohibited', 'file', 'mimes:pdf', UploadLimit::rule()],
            'audience' => ['required', Rule::in(LegalDocument::AUDIENCES)],
            'user_ids' => ['required_if:audience,selected', 'array'],
            'user_ids.*' => ['integer'],
            'is_active' => [$creating ? 'nullable' : 'required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    private function messages(): array
    {
        return [
            'file.mimes' => 'Upload the document as a PDF.',
            'file.max' => UploadLimit::message('The PDF'),
            'user_ids.required_if' => 'Choose at least one client to sign it.',
        ];
    }

    /**
     * @param  list<int>  $ids
     * @return list<int>
     */
    private function customerIds(array $ids): array
    {
        return User::whereIn('id', $ids)->where('type', User::TYPE_CUSTOMER)->pluck('id')->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(LegalDocument $document): array
    {
        return [
            'id' => $document->id,
            'title' => $document->title,
            'description' => $document->description,
            'file_name' => $document->file_name,
            'audience' => $document->audience,
            'is_active' => $document->is_active,
            'signatures_count' => $document->signatures_count ?? 0,
            'created_at' => $document->created_at?->toIso8601String(),
        ];
    }
}
