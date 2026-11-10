<?php

namespace App\Uploads;

/**
 * The largest file anyone can upload, in one place.
 *
 * Uploads pass through the website, whose host (Vercel) refuses requests over 4.5MB, so the
 * limit stays well under that. The website has the same number in web/src/lib/uploads.ts.
 */
final class UploadLimit
{
    public const KILOBYTES = 3072;

    public const LABEL = '3MB';

    /** The validation rule, for example `'max:3072'`. */
    public static function rule(): string
    {
        return 'max:'.self::KILOBYTES;
    }

    public static function message(string $what = 'Files'): string
    {
        return "{$what} must be ".self::LABEL.' or smaller.';
    }
}
