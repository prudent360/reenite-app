<?php

namespace App\Blog;

use Illuminate\Support\Str;

/**
 * Turns blog Markdown into HTML that is safe to show on the website: raw HTML in the source is removed and
 * javascript: style links are dropped, so a post can never run code in a visitor's browser.
 */
final class Markdown
{
    public static function toHtml(string $markdown): string
    {
        return Str::markdown($markdown, [
            'html_input' => 'strip',
            'allow_unsafe_links' => false,
            'max_nesting_level' => 20,
        ]);
    }

    /** Plain text, for excerpts, reading time and search snippets. */
    public static function toText(string $markdown): string
    {
        $text = html_entity_decode(strip_tags(self::toHtml($markdown)), ENT_QUOTES | ENT_HTML5);

        return trim((string) preg_replace('/\s+/u', ' ', $text));
    }
}
