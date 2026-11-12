<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Blog\Markdown;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\BlogPostRequest;
use App\Http\Resources\PostResource;
use App\Models\Post;
use App\Uploads\UploadLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;

/**
 * Writing and publishing blog posts, their cover photos and the images inside them.
 */
class BlogPostController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        // Drafts first, then newest.
        return PostResource::collection(Post::orderByRaw('published_at is null desc')->latest('published_at')->latest('id')->get());
    }

    public function show(Post $post): PostResource
    {
        return PostResource::full($post);
    }

    public function store(BlogPostRequest $request): JsonResponse
    {
        $data = $request->validated();
        $post = Post::create(['slug' => $data['slug'] ?? Post::uniqueSlug($data['title'])] + $data);

        return PostResource::full($post)->additional(['message' => $post->isPublished() ? 'Post published.' : 'Post saved.'])->response()->setStatusCode(201);
    }

    public function update(BlogPostRequest $request, Post $post): PostResource
    {
        $data = $request->validated();
        $post->update(['slug' => $data['slug'] ?? $post->slug] + $data);

        return PostResource::full($post)->additional(['message' => 'Post saved.']);
    }

    public function destroy(Post $post): Response
    {
        if ($post->cover_path) {
            Storage::disk('public')->delete($post->cover_path);
        }
        $post->delete();

        return response()->noContent();
    }

    public function cover(Request $request, Post $post): PostResource
    {
        $request->validate(
            ['cover' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', UploadLimit::rule(), 'dimensions:min_width=600,min_height=300']],
            ['cover.max' => UploadLimit::message('The photo'), 'cover.dimensions' => 'Use a photo at least 600 pixels wide.']
        );

        $old = $post->cover_path;
        $post->forceFill(['cover_path' => $request->file('cover')->store('blog', 'public')])->save();
        if ($old) {
            Storage::disk('public')->delete($old);
        }

        return PostResource::full($post)->additional(['message' => 'Cover photo updated.']);
    }

    public function removeCover(Post $post): PostResource
    {
        if ($post->cover_path) {
            Storage::disk('public')->delete($post->cover_path);
            $post->forceFill(['cover_path' => null])->save();
        }

        return PostResource::full($post)->additional(['message' => 'Cover photo removed.']);
    }

    /** An image to place inside a post. Returns its address for the Markdown. */
    public function image(Request $request): JsonResponse
    {
        $request->validate(
            ['image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp,gif', UploadLimit::rule()]],
            ['image.max' => UploadLimit::message('Images')]
        );

        $path = $request->file('image')->store('blog/images', 'public');

        return response()->json(['url' => Storage::disk('public')->url($path)], 201);
    }

    /** Markdown rendered exactly as the website will show it. */
    public function preview(Request $request): JsonResponse
    {
        $request->validate(['body' => ['present', 'nullable', 'string', 'max:200000']]);

        return response()->json(['html' => Markdown::toHtml((string) $request->input('body'))]);
    }
}
