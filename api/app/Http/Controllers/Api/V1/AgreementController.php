<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DocumentSignature;
use App\Models\LegalDocument;
use App\Support\AgreementData;
use App\Support\Signatory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The signed-in customer's agreements: read, sign, and get the data for their signed copy.
 * Documents not meant for them return 404 (unless they already signed it).
 */
class AgreementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $signed = $user->documentSignatures()->get()->keyBy('legal_document_id');
        $documents = LegalDocument::query()
            ->where(fn ($query) => $query->for($user)->orWhereIn('id', $signed->keys()))
            ->latest('id')
            ->get();

        return response()->json(['data' => $documents->map(fn (LegalDocument $document) => $this->present($document, $signed->get($document->id)))]);
    }

    public function show(Request $request, LegalDocument $legalDocument, Signatory $signatory): JsonResponse
    {
        $signature = $this->authorizeDocument($request, $legalDocument);
        $details = $signatory->details();

        return response()->json(['data' => $this->present($legalDocument, $signature) + [
            // Shown on the signing page: Reenite has already signed.
            'signatory' => $signature
                ? ['name' => $signature->signatory_name, 'title' => $signature->signatory_title]
                : ($details ? ['name' => $details['name'], 'title' => $details['title']] : null),
        ]]);
    }

    public function file(Request $request, LegalDocument $legalDocument): StreamedResponse
    {
        $this->authorizeDocument($request, $legalDocument);

        return Storage::disk('local')->response($legalDocument->file_path, $legalDocument->file_name, ['Content-Type' => 'application/pdf']);
    }

    public function sign(Request $request, LegalDocument $legalDocument, Signatory $signatory): JsonResponse
    {
        abort_if($this->authorizeDocument($request, $legalDocument), 422, "You've already signed this document.");
        abort_unless($legalDocument->is_active, 422, 'This document is no longer open for signing.');
        $details = $signatory->details();
        abort_unless($details, 422, "We can't take signatures right now. Please try again later.");

        $validated = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'signature' => ['required', 'string', 'max:800000'],
            'agree' => ['accepted'],
        ], [
            'name.required' => 'Type your full name.',
            'signature.required' => 'Add your signature.',
            'agree.accepted' => 'Tick the box to confirm you have read and agree to the document.',
        ]);
        $png = Signatory::decodePng($validated['signature']);

        // Signed copies always point at the file exactly as it was signed.
        abort_unless(hash_file('sha256', Storage::disk('local')->path($legalDocument->file_path)) === $legalDocument->sha256, 409, 'This document has changed. Please refresh and read it again before signing.');

        $user = $request->user();
        $signature = DB::transaction(function () use ($legalDocument, $user, $validated, $png, $details, $request) {
            $path = "signatures/{$user->id}-{$legalDocument->id}-".Str::random(12).'.png';
            Storage::disk('local')->put($path, $png);

            return DocumentSignature::create([
                'legal_document_id' => $legalDocument->id,
                'user_id' => $user->id,
                'signer_name' => trim($validated['name']),
                'signature_path' => $path,
                'signed_at' => now(),
                'ip_address' => $request->ip(),
                'user_agent' => Str::limit((string) $request->userAgent(), 490, ''),
                'document_sha256' => $legalDocument->sha256,
                'signatory_name' => $details['name'],
                'signatory_title' => $details['title'],
                'signatory_signature_path' => $details['signature_path'],
            ]);
        });

        return response()->json(['data' => $this->present($legalDocument, $signature), 'message' => 'Signed. You can download your copy now.']);
    }

    /**
     * Everything needed to build the customer's signed copy.
     */
    public function signed(Request $request, LegalDocument $legalDocument): JsonResponse
    {
        $signature = $this->authorizeDocument($request, $legalDocument);
        abort_unless($signature, 404);

        return response()->json(['data' => AgreementData::signed($legalDocument, $signature->load('user'))]);
    }

    /**
     * 404 unless the document is for this customer (or they already signed it). Returns their signature, if any.
     */
    private function authorizeDocument(Request $request, LegalDocument $document): ?DocumentSignature
    {
        $signature = $document->signatures()->where('user_id', $request->user()->id)->first();
        abort_unless($signature || $document->isFor($request->user()), 404);

        return $signature;
    }

    /**
     * @return array<string, mixed>
     */
    private function present(LegalDocument $document, ?DocumentSignature $signature): array
    {
        return [
            'id' => $document->id,
            'title' => $document->title,
            'description' => $document->description,
            'file_name' => $document->file_name,
            'created_at' => $document->created_at?->toIso8601String(),
            'is_open' => $document->is_active,
            'signed_at' => $signature?->signed_at?->toIso8601String(),
            'signer_name' => $signature?->signer_name,
        ];
    }
}
