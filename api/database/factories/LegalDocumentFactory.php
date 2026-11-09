<?php

namespace Database\Factories;

use App\Models\LegalDocument;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<LegalDocument>
 */
class LegalDocumentFactory extends Factory
{
    /**
     * An active document sent to chosen clients; the file is a placeholder path.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'title' => 'Virtual Address Agreement',
            'file_path' => 'legal-documents/agreement.pdf',
            'file_name' => 'agreement.pdf',
            'sha256' => hash('sha256', 'agreement'),
            'audience' => LegalDocument::SELECTED,
            'is_active' => true,
        ];
    }
}
