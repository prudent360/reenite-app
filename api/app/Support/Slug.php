<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Slug
{
    /**
     * A URL slug for the given text that is unique in the model's table, appending -2, -3...
     * Soft-deleted rows count, because the unique index still holds their slugs.
     *
     * @param  class-string<Model>  $modelClass
     */
    public static function unique(string $modelClass, string $text, ?int $ignoreId = null): string
    {
        $base = Str::slug($text) ?: 'item';
        $slug = $base;
        $suffix = 2;

        while (self::taken($modelClass, $slug, $ignoreId)) {
            $slug = "{$base}-{$suffix}";
            $suffix++;
        }

        return $slug;
    }

    /**
     * @param  class-string<Model>  $modelClass
     */
    private static function taken(string $modelClass, string $slug, ?int $ignoreId): bool
    {
        $query = in_array(SoftDeletes::class, class_uses_recursive($modelClass), true)
            ? $modelClass::withTrashed()
            : $modelClass::query();

        return $query->where('slug', $slug)
            ->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))
            ->exists();
    }
}
