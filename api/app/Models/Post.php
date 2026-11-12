<?php

namespace App\Models;

use App\Blog\Markdown;
use Database\Factories\PostFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * A blog post. The body is Markdown. With no publish date it's a draft; dated in the future it goes live at that time.
 */
#[Fillable(['title', 'slug', 'excerpt', 'body', 'cover_alt', 'category', 'meta_description', 'author_name', 'published_at'])]
class Post extends Model
{
    /** @use HasFactory<PostFactory> */
    use HasFactory;

    /** Average adult reading speed, words per minute. */
    private const WORDS_PER_MINUTE = 220;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
            'wordpress_id' => 'integer',
        ];
    }

    /**
     * Posts visitors can read: dated today or earlier.
     *
     * @param  Builder<self>  $query
     */
    public function scopePublished(Builder $query): void
    {
        $query->whereNotNull('published_at')->where('published_at', '<=', now());
    }

    public function isPublished(): bool
    {
        return $this->published_at !== null && $this->published_at->lte(now());
    }

    /** draft, scheduled or published. */
    public function state(): string
    {
        return match (true) {
            $this->published_at === null => 'draft',
            $this->published_at->isFuture() => 'scheduled',
            default => 'published',
        };
    }

    public function coverUrl(): ?string
    {
        return $this->cover_path ? Storage::disk('public')->url($this->cover_path) : null;
    }

    public function bodyHtml(): string
    {
        return Markdown::toHtml($this->body);
    }

    /** The excerpt, or the opening of the post when there isn't one. */
    public function summary(): string
    {
        return $this->excerpt ?: Str::limit(Markdown::toText($this->body), 220);
    }

    public function readingMinutes(): int
    {
        return max(1, (int) round(str_word_count(Markdown::toText($this->body)) / self::WORDS_PER_MINUTE));
    }

    /** A slug no other post uses, from the given text. */
    public static function uniqueSlug(string $text, ?int $ignoreId = null): string
    {
        $base = Str::limit(Str::slug($text), 90, '') ?: 'post';
        $slug = $base;
        for ($i = 2; self::where('slug', $slug)->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }
}
