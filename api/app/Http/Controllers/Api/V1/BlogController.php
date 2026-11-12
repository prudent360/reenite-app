<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * The public blog: published posts only, newest first.
 */
class BlogController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate(['category' => ['nullable', 'string', 'max:60'], 'per_page' => ['nullable', 'integer', 'between:1,100']]);

        return PostResource::collection(
            Post::published()
                ->when($request->query('category'), fn ($query, $category) => $query->where('category', $category))
                ->latest('published_at')
                ->paginate($request->integer('per_page', 12))
        )->additional(['categories' => Post::published()->whereNotNull('category')->distinct()->orderBy('category')->pluck('category')]);
    }

    public function show(string $slug): PostResource
    {
        return PostResource::full(Post::published()->where('slug', $slug)->firstOrFail());
    }
}
