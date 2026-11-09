<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Reenite's signatory (usually the founder): their full name, title and signature image, which
 * are printed on every legal document before clients sign. Signature images live on the
 * private disk.
 */
class Signatory
{
    public function __construct(private Settings $settings) {}

    /**
     * @return array{name: string, title: string|null, signature_path: string}|null null until set up
     */
    public function details(): ?array
    {
        $name = $this->settings->get('legal.signatory_name');
        $path = $this->settings->get('legal.signatory_signature_path');

        return $name && $path && Storage::disk('local')->exists($path)
            ? ['name' => $name, 'title' => $this->settings->get('legal.signatory_title'), 'signature_path' => $path]
            : null;
    }

    public function save(string $name, ?string $title, ?string $signaturePng): void
    {
        $this->settings->set('legal.signatory_name', $name);
        $this->settings->set('legal.signatory_title', $title);
        if ($signaturePng !== null) {
            // A new file each time, so signed copies keep pointing at the signature they were signed with.
            $path = 'signatures/reenite-'.now()->format('YmdHis').'-'.Str::random(8).'.png';
            Storage::disk('local')->put($path, $signaturePng);
            $this->settings->set('legal.signatory_signature_path', $path);
        }
    }

    /**
     * Turns a signature drawn in the browser (a PNG data URL) into checked PNG bytes.
     */
    public static function decodePng(string $dataUrl, string $field = 'signature'): string
    {
        $fail = fn () => throw ValidationException::withMessages([$field => 'Please draw your signature again.']);

        if (! str_starts_with($dataUrl, 'data:image/png;base64,')) {
            $fail();
        }
        $bytes = base64_decode(substr($dataUrl, strlen('data:image/png;base64,')), true);
        if ($bytes === false || strlen($bytes) > 512 * 1024) {
            $fail();
        }
        $size = @getimagesizefromstring($bytes);
        if ($size === false || $size[2] !== IMAGETYPE_PNG || $size[0] < 50 || $size[1] < 20 || $size[0] > 3000 || $size[1] > 1500) {
            $fail();
        }

        return $bytes;
    }

    public static function dataUri(string $path): string
    {
        return 'data:image/png;base64,'.base64_encode((string) Storage::disk('local')->get($path));
    }
}
