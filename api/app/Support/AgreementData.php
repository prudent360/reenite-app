<?php

namespace App\Support;

use App\Models\DocumentSignature;
use App\Models\LegalDocument;

/**
 * The data a signed copy is built from, shared by the client and admin endpoints.
 */
class AgreementData
{
    /**
     * @return array<string, mixed>
     */
    public static function signed(LegalDocument $document, DocumentSignature $signature): array
    {
        return [
            'document' => ['id' => $document->id, 'title' => $document->title, 'file_name' => $document->file_name, 'sha256' => $signature->document_sha256],
            'signatory' => [
                'name' => $signature->signatory_name,
                'title' => $signature->signatory_title,
                'signature' => Signatory::dataUri($signature->signatory_signature_path),
            ],
            'signer' => [
                'name' => $signature->signer_name,
                'email' => $signature->user->email,
                'signature' => Signatory::dataUri($signature->signature_path),
                'signed_at' => $signature->signed_at->toIso8601String(),
                'ip_address' => $signature->ip_address,
                'reference' => sprintf('SIG-%s-%06d', $signature->signed_at->format('Y'), $signature->id),
            ],
        ];
    }
}
