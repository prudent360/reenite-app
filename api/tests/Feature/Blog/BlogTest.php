<?php

namespace Tests\Feature\Blog;

use App\Enums\Role;
use App\Models\Post;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BlogTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        Storage::fake('public');
    }

    private function staff(Role $role): User
    {
        return User::factory()->staff()->create()->assignRole($role->value);
    }

    public function test_visitors_only_see_published_posts(): void
    {
        $live = Post::factory()->create(['slug' => 'live-post', 'category' => 'News']);
        Post::factory()->draft()->create(['slug' => 'draft-post']);
        Post::factory()->scheduled()->create(['slug' => 'next-week']);

        $this->getJson('/api/v1/blog')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.slug', 'live-post')
            ->assertJsonPath('categories', ['News'])
            ->assertJsonMissingPath('data.0.body_html')
            ->assertJsonMissingPath('data.0.state');

        $this->getJson('/api/v1/blog/live-post')->assertOk()->assertJsonPath('data.title', $live->title)->assertJsonMissingPath('data.body');
        $this->getJson('/api/v1/blog/draft-post')->assertNotFound();
        $this->getJson('/api/v1/blog/next-week')->assertNotFound();

        // A scheduled post goes live by itself.
        $this->travel(8)->days();
        $this->getJson('/api/v1/blog/next-week')->assertOk();
    }

    public function test_post_bodies_cannot_run_code_in_the_browser(): void
    {
        Post::factory()->create([
            'slug' => 'tricky',
            'body' => "Hello <script>alert(1)</script> <img src=x onerror=alert(1)>\n\n[click](javascript:alert(1)) and [ok](https://reenite.com/about)",
        ]);

        $html = $this->getJson('/api/v1/blog/tricky')->assertOk()->json('data.body_html');

        $this->assertStringNotContainsString('<script', $html);
        $this->assertStringNotContainsString('onerror', $html);
        $this->assertStringNotContainsString('javascript:', $html);
        $this->assertStringContainsString('<a href="https://reenite.com/about">ok</a>', $html);
    }

    public function test_content_staff_write_schedule_and_illustrate_posts(): void
    {
        $manager = $this->staff(Role::OperationsManager);

        $id = $this->actingAs($manager)->postJson('/api/v1/admin/blog', [
            'title' => 'Five tips for remote workers',
            'body' => "## Tip one\n\nTake breaks.",
            'category' => 'Productivity',
        ])->assertCreated()->assertJsonPath('data.slug', 'five-tips-for-remote-workers')->assertJsonPath('data.state', 'draft')->json('data.id');

        // The same title gets its own address.
        $this->actingAs($manager)->postJson('/api/v1/admin/blog', ['title' => 'Five tips for remote workers', 'body' => 'Again.'])
            ->assertCreated()->assertJsonPath('data.slug', 'five-tips-for-remote-workers-2');

        $this->actingAs($manager)->putJson("/api/v1/admin/blog/{$id}", [
            'title' => 'Five tips for remote workers',
            'slug' => 'five-tips-for-remote-workers-2',
            'body' => 'x',
        ])->assertUnprocessable()->assertJsonValidationErrors(['slug' => 'Another post already uses this address.']);

        $this->actingAs($manager)->putJson("/api/v1/admin/blog/{$id}", [
            'title' => 'Five tips for remote workers',
            'body' => "## Tip one\n\nTake breaks.",
            'published_at' => now()->addDay()->toIso8601String(),
        ])->assertOk()->assertJsonPath('data.state', 'scheduled')->assertJsonPath('data.slug', 'five-tips-for-remote-workers');

        $this->actingAs($manager)->post("/api/v1/admin/blog/{$id}/cover", ['cover' => UploadedFile::fake()->image('desk.jpg', 1200, 630)], ['Accept' => 'application/json'])
            ->assertOk();
        $cover = Post::findOrFail($id)->cover_path;
        Storage::disk('public')->assertExists($cover);

        $url = $this->actingAs($manager)->post('/api/v1/admin/blog/images', ['image' => UploadedFile::fake()->image('team.png', 800, 500)], ['Accept' => 'application/json'])
            ->assertCreated()->json('url');
        $this->assertStringContainsString('/storage/blog/images/', $url);

        $this->actingAs($manager)->postJson('/api/v1/admin/blog/preview', ['body' => '**Bold** <b>raw</b>'])
            ->assertOk()->assertJsonPath('html', "<p><strong>Bold</strong> raw</p>\n");

        $this->actingAs($manager)->deleteJson("/api/v1/admin/blog/{$id}")->assertNoContent();
        Storage::disk('public')->assertMissing($cover);
    }

    public function test_staff_without_content_permission_cannot_manage_the_blog(): void
    {
        $this->actingAs($this->staff(Role::FrontDesk))->getJson('/api/v1/admin/blog')->assertForbidden();
        $this->actingAs(User::factory()->create())->postJson('/api/v1/admin/blog', ['title' => 'x', 'body' => 'y'])->assertForbidden();
    }

    public function test_wordpress_posts_are_copied_with_their_images_once(): void
    {
        $png = UploadedFile::fake()->image('cover.png', 1200, 630)->getContent();
        Http::fake([
            'old.test/wp-json/wp/v2/posts*' => Http::response([[
                'id' => 41,
                'slug' => 'coworking-spaces-in-uyo',
                'date_gmt' => '2025-05-25T10:00:00',
                'title' => ['rendered' => 'Coworking Spaces in Uyo &#8211; Why Reenite'],
                'excerpt' => ['rendered' => '<p>Why people choose us [&hellip;]</p>'],
                'content' => ['rendered' => '<p class="wp-block-paragraph">Visit <a href="https://old.test/book-a-space/">our <strong>space</strong></a> today. Price: 5*2.</p>'
                    ."\n\n<h1>Big heading</h1>\n<ul><li>Fast Wi-Fi</li><li>Power <em>all day</em></li></ul>"
                    .'<figure class="wp-block-image"><img src="https://old.test/wp-content/uploads/2025/05/desk.png" alt="A desk"/><figcaption>Our desks</figcaption></figure>'
                    .'<p><a href="https://old.test/wp-content/uploads/2025/05/desk.png">Download</a> or <a href="https://elsewhere.test/x">read more</a></p>'
                    .'<script>alert(1)</script>'],
                'yoast_head_json' => ['description' => 'The best coworking space in Uyo.'],
                '_embedded' => [
                    'author' => [['name' => 'Precious Ayodele']],
                    'wp:featuredmedia' => [['source_url' => 'https://old.test/wp-content/uploads/2025/05/homebg.png', 'alt_text' => 'The front desk']],
                    'wp:term' => [[['name' => 'Uncategorized'], ['name' => 'coworking space']], [['name' => 'reenite']]],
                ],
            ]], 200, ['X-WP-TotalPages' => '1']),
            'old.test/wp-content/*' => Http::response($png, 200, ['Content-Type' => 'image/png']),
        ]);

        $this->artisan('blog:import-wordpress', ['site' => 'https://old.test'])->assertSuccessful();

        $post = Post::sole();
        $this->assertSame('coworking-spaces-in-uyo', $post->slug);
        $this->assertSame('Coworking Spaces in Uyo – Why Reenite', $post->title);
        $this->assertSame('Why people choose us', $post->excerpt);
        $this->assertSame('Coworking Space', $post->category);
        $this->assertSame('Precious Ayodele', $post->author_name);
        $this->assertSame('The best coworking space in Uyo.', $post->meta_description);
        $this->assertSame('The front desk', $post->cover_alt);
        $this->assertSame('2025-05-25 10:00:00', $post->published_at->utc()->format('Y-m-d H:i:s'));
        Storage::disk('public')->assertExists($post->cover_path);

        $this->assertStringStartsWith('Visit [our **space**](/book-a-space) today. Price: 5\*2.', $post->body);
        $this->assertStringContainsString("## Big heading\n\n- Fast Wi-Fi\n- Power *all day*", $post->body);
        $this->assertMatchesRegularExpression('#!\[A desk\]\([^)]*/storage/blog/images/desk-[a-z0-9]{6}\.png\)\n\n\*Our desks\*#', $post->body);
        $this->assertMatchesRegularExpression('#\[Download\]\([^)]*/storage/blog/images/desk-[a-z0-9]{6}\.png\)#', $post->body);
        $this->assertStringContainsString('[read more](https://elsewhere.test/x)', $post->body);
        $this->assertStringNotContainsString('alert', $post->body);
        // The same image is downloaded once: the cover, plus the desk used twice.
        Http::assertSentCount(3);
        $this->assertCount(2, Storage::disk('public')->allFiles('blog'));

        // Running it again leaves posts alone, including edits made here.
        $post->update(['title' => 'Edited here']);
        $this->artisan('blog:import-wordpress', ['site' => 'https://old.test'])->assertSuccessful();
        $this->assertSame('Edited here', Post::sole()->title);
    }

    public function test_import_explains_when_wordpress_cannot_be_reached(): void
    {
        Http::fake(['old.test/*' => Http::response('Not found', 404)]);

        $this->artisan('blog:import-wordpress', ['site' => 'https://old.test'])
            ->expectsOutputToContain('WordPress answered 404')
            ->assertFailed();
    }
}
