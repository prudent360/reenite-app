<?php

namespace App\Support;

class Money
{
    /**
     * "₦25,000" or "₦25,000.50" from kobo.
     */
    public static function format(int $kobo): string
    {
        return '₦'.number_format($kobo / 100, $kobo % 100 === 0 ? 0 : 2);
    }
}
