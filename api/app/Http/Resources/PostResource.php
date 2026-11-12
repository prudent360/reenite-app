<?php

namespace App\Http\Resources;

use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Post
 */
class PostResource extends JsonResource
{
    /** Include the post's body (a single post rather than a list). */
    private bool $withBody = false;

    public static function full(Post $post): self
    {
        $resource = new self($post);
        $resource->withBody = true;

        return $resource;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $admin = $request->routeIs('v1.admin.*');

        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'title' => $this->title,
            'excerpt' => $this->summary(),
            'cover_url' => $this->coverUrl(),
            'cover_alt' => $this->cover_alt,
            'category' => $this->category,
            'author_name' => $this->author_name,
            'published_at' => $this->published_at?->toIso8601String(),
            'reading_minutes' => $this->readingMinutes(),
            'meta_description' => $this->meta_description,
            'body_html' => $this->when($this->withBody, fn () => $this->bodyHtml()),
            $this->mergeWhen($admin, fn () => [
                'state' => $this->state(),
                'own_excerpt' => $this->excerpt,
                'from_wordpress' => $this->wordpress_id !== null,
                'updated_at' => $this->updated_at?->toIso8601String(),
            ]),
            'body' => $this->when($admin && $this->withBody, fn () => $this->body),
        ];
    }
}
