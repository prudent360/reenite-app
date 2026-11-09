<?php

namespace App\Uploads;

use App\Models\User;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

/**
 * A short-lived permission to send one upload straight from the browser to the API.
 *
 * The website signs people in with a token the browser never sees, and its host (Vercel)
 * rejects requests over 4.5MB. So instead of passing files through the website, the website
 * asks for a grant, and the browser posts the file to the API with it. The grant is encrypted
 * and authenticated with APP_KEY, names exactly one path and the person, and expires quickly.
 */
final class UploadGrant
{
    public const LIFETIME_SECONDS = 600;

    /** Upload endpoints a grant may open, and whether a signed-out guest may use them. */
    private const PATHS = [
        '#^/orders/[A-Za-z0-9-]+/files$#' => false,
        '#^/admin/orders/[A-Za-z0-9-]+/files$#' => false,
        '#^/admin/workspace/spaces/\d+/photo$#' => false,
        '#^/admin/legal-documents$#' => false,
        '#^/billing/invoices/\d+/bank-transfer$#' => false,
        '#^/bookings/[A-Za-z0-9-]+/bank-transfer$#' => true,
    ];

    public function __construct(
        public readonly string $path,
        public readonly ?int $userId,
        public readonly int $expiresAt,
    ) {}

    /** Whether `$path` can be granted to this person (null for a guest). */
    public static function allows(string $path, ?User $user): bool
    {
        foreach (self::PATHS as $pattern => $guestAllowed) {
            if (preg_match($pattern, $path) === 1) {
                return $user !== null || $guestAllowed;
            }
        }

        return false;
    }

    public static function issue(string $path, ?User $user): self
    {
        return new self($path, $user?->id, now()->addSeconds(self::LIFETIME_SECONDS)->getTimestamp());
    }

    public function encode(): string
    {
        return Crypt::encryptString(json_encode(['p' => $this->path, 'u' => $this->userId, 'e' => $this->expiresAt]));
    }

    /** Null when the grant was tampered with or is not a grant at all. */
    public static function decode(string $value): ?self
    {
        try {
            $data = json_decode(Crypt::decryptString($value), true, flags: JSON_THROW_ON_ERROR);
        } catch (DecryptException|\JsonException) {
            return null;
        }

        if (! is_array($data) || ! is_string($data['p'] ?? null) || ! is_int($data['e'] ?? null)) {
            return null;
        }

        return new self($data['p'], is_int($data['u'] ?? null) ? $data['u'] : null, $data['e']);
    }

    public function expired(): bool
    {
        return now()->getTimestamp() > $this->expiresAt;
    }
}
