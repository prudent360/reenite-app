<?php

namespace App\Http\Controllers\Api\V1\Admin\Settings;

use App\Http\Controllers\Controller;
use App\Support\Signatory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Reenite's signatory: the name, title and signature printed on every legal document.
 */
class SignatoryController extends Controller
{
    public function __construct(private Signatory $signatory) {}

    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->current()]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'title' => ['nullable', 'string', 'max:120'],
            'signature' => [$this->signatory->details() ? 'nullable' : 'required', 'string', 'max:800000'],
        ], ['signature.required' => 'Add the signature to print on documents.']);

        $this->signatory->save($validated['name'], $validated['title'] ?? null, isset($validated['signature']) ? Signatory::decodePng($validated['signature']) : null);

        return response()->json(['data' => $this->current(), 'message' => 'Signatory saved. New signatures will use these details.']);
    }

    /**
     * @return array{name: string|null, title: string|null, signature: string|null}
     */
    private function current(): array
    {
        $details = $this->signatory->details();

        return [
            'name' => $details['name'] ?? null,
            'title' => $details['title'] ?? null,
            'signature' => $details ? Signatory::dataUri($details['signature_path']) : null,
        ];
    }
}
