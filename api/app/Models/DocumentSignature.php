<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A client's signature on a legal document, with the audit trail and a snapshot of
 * Reenite's signatory at the time.
 */
#[Fillable([
    'legal_document_id', 'user_id', 'signer_name', 'signature_path', 'signed_at', 'ip_address', 'user_agent',
    'document_sha256', 'signatory_name', 'signatory_title', 'signatory_signature_path',
])]
#[Hidden(['signature_path', 'signatory_signature_path'])]
class DocumentSignature extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['signed_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<LegalDocument, $this>
     */
    public function document(): BelongsTo
    {
        return $this->belongsTo(LegalDocument::class, 'legal_document_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
