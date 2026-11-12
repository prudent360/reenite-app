<?php

namespace App\Blog;

use App\Models\Post;
use Dom\Element;
use Dom\HTMLDocument;
use Dom\Node;
use Dom\Text;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Copies posts from a WordPress site (its public REST API) into the blog: title, address, date, author, category,
 * SEO description, cover photo, and the body converted to Markdown. Every image is downloaded into our own storage,
 * so nothing depends on the WordPress site once it's switched off. Posts already imported are left as they are.
 */
class WordPressImporter
{
    /** Images bigger than this are skipped rather than stored. */
    private const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

    private string $host = '';

    /** @var array<string, string|null> Folder and original image address => our copy, so a repeated image is downloaded once. */
    private array $images = [];

    /**
     * @return array{imported: list<string>, skipped: list<string>, missing_images: list<string>}
     */
    public function import(string $site, bool $refresh = false): array
    {
        $site = rtrim($site, '/');
        $this->host = (string) parse_url($site, PHP_URL_HOST);
        $result = ['imported' => [], 'skipped' => [], 'missing_images' => []];

        foreach ($this->fetchPosts($site) as $item) {
            $existing = Post::where('wordpress_id', $item['id'])->first();
            if ($existing && ! $refresh) {
                $result['skipped'][] = $existing->slug;

                continue;
            }

            $post = $this->save($item, $existing ?? new Post);
            $result['imported'][] = $post->slug;
        }

        $result['missing_images'] = array_values(array_unique(array_map(fn (string $key) => Str::after($key, '|'), array_keys(array_filter($this->images, fn (?string $copy) => $copy === null)))));

        return $result;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function fetchPosts(string $site): array
    {
        $posts = [];
        for ($page = 1; $page <= 50; $page++) {
            $response = Http::acceptJson()->timeout(30)->get("{$site}/wp-json/wp/v2/posts", [
                'per_page' => 100,
                'page' => $page,
                'status' => 'publish',
                '_embed' => 'wp:featuredmedia,wp:term,author',
            ]);

            // WordPress answers 400 when asked for a page past the last one.
            if ($page > 1 && $response->status() === 400) {
                break;
            }
            if (! $response->successful()) {
                throw new RuntimeException("WordPress answered {$response->status()} for {$site}/wp-json/wp/v2/posts. Is the site up, with its REST API on?");
            }

            $batch = $response->json();
            if (! is_array($batch) || $batch === []) {
                break;
            }
            array_push($posts, ...$batch);

            if ($page >= (int) $response->header('X-WP-TotalPages')) {
                break;
            }
        }

        return $posts;
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function save(array $item, Post $post): Post
    {
        $embedded = $item['_embedded'] ?? [];
        $media = $embedded['wp:featuredmedia'][0] ?? null;
        $categories = collect($embedded['wp:term'][0] ?? [])->pluck('name')->map(fn ($name) => $this->plain((string) $name))->reject(fn ($name) => strcasecmp($name, 'Uncategorized') === 0);
        $slug = Str::limit((string) $item['slug'], 100, '');

        $post->fill([
            'title' => Str::limit($this->plain($item['title']['rendered'] ?? ''), 200, ''),
            'slug' => Post::where('slug', $slug)->whereKeyNot($post->id)->exists() ? Post::uniqueSlug($slug, $post->id) : $slug,
            'excerpt' => Str::limit(trim((string) preg_replace('/\s*\[(&hellip;|…|\.\.\.)\]\s*$/u', '', $this->plain($item['excerpt']['rendered'] ?? ''))), 497) ?: null,
            'body' => $this->toMarkdown((string) ($item['content']['rendered'] ?? '')),
            'cover_alt' => $media ? (Str::limit($this->plain((string) ($media['alt_text'] ?? '')), 255, '') ?: null) : null,
            'category' => $categories->first() ? Str::limit(Str::title($categories->first()), 60, '') : null,
            'meta_description' => ($description = $item['yoast_head_json']['description'] ?? null) ? Str::limit($this->plain((string) $description), 300, '') : null,
            'author_name' => ($author = $embedded['author'][0]['name'] ?? null) ? Str::limit($this->plain((string) $author), 120, '') : null,
            'published_at' => $item['date_gmt'] ?? $item['date'] ?? now(),
        ]);
        $post->forceFill(['wordpress_id' => (int) $item['id']]);

        if ($media && ($source = $media['source_url'] ?? null) && ($copy = $this->download((string) $source, 'blog'))) {
            if ($post->cover_path && $post->cover_path !== $copy) {
                Storage::disk('public')->delete($post->cover_path);
            }
            $post->forceFill(['cover_path' => $copy]);
        }

        $post->save();

        return $post;
    }

    /** Text from a WordPress string: tags removed, entities like &#8217; turned back into characters. */
    private function plain(string $html): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
    }

    /**
     * Downloads an image once and returns its path on the public disk, or null when it can't be fetched.
     */
    private function download(string $url, string $folder): ?string
    {
        // Covers and body images get separate copies, so removing a cover never breaks an image inside a post.
        $key = "{$folder}|{$url}";
        if (array_key_exists($key, $this->images)) {
            return $this->images[$key];
        }

        $copy = null;
        $response = rescue(fn () => Http::timeout(60)->get($url), report: false);
        if ($response?->successful() && strlen($response->body()) <= self::MAX_IMAGE_BYTES) {
            $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($response->body());
            $extension = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'][$mime] ?? null;
            if ($extension) {
                $name = Str::limit(Str::slug(pathinfo((string) parse_url($url, PHP_URL_PATH), PATHINFO_FILENAME)), 60, '') ?: 'image';
                $copy = "{$folder}/{$name}-".Str::lower(Str::random(6)).".{$extension}";
                Storage::disk('public')->put($copy, $response->body());
            }
        }

        return $this->images[$key] = $copy;
    }

    public function toMarkdown(string $html): string
    {
        $document = HTMLDocument::createFromString('<!doctype html><html><body>'.$html.'</body></html>', LIBXML_NOERROR);
        $markdown = $this->blocks($document->body);

        return trim((string) preg_replace("/\n{3,}/", "\n\n", $markdown))."\n";
    }

    /** Block-level content: paragraphs, headings, lists, quotes and images, separated by blank lines. */
    private function blocks(Node $parent, int $depth = 0): string
    {
        $out = '';
        $inline = '';
        $flush = function () use (&$out, &$inline) {
            if (trim($inline) !== '') {
                $out .= trim($inline)."\n\n";
            }
            $inline = '';
        };

        foreach ($parent->childNodes as $node) {
            if (! $node instanceof Element) {
                $inline .= $node instanceof Text ? $this->escape($this->collapse($node->data)) : '';

                continue;
            }

            switch ($node->localName) {
                case 'p':
                    $flush();
                    $out .= ($text = trim($this->inline($node))) !== '' ? "{$text}\n\n" : '';
                    break;
                case 'h1':
                case 'h2':
                case 'h3':
                case 'h4':
                case 'h5':
                case 'h6':
                    $flush();
                    // The post title is the page's only h1, so headings in the body start at h2.
                    $level = max(2, min(4, (int) substr($node->localName, 1)));
                    $out .= ($text = trim($this->inline($node))) !== '' ? str_repeat('#', $level)." {$text}\n\n" : '';
                    break;
                case 'ul':
                case 'ol':
                    $flush();
                    $out .= $this->list($node, $depth)."\n";
                    break;
                case 'blockquote':
                    $flush();
                    $quote = trim($this->blocks($node, $depth));
                    $out .= $quote !== '' ? preg_replace('/^/m', '> ', $quote)."\n\n" : '';
                    break;
                case 'figure':
                    $flush();
                    $out .= $this->figure($node);
                    break;
                case 'img':
                    $flush();
                    $out .= ($image = $this->image($node)) !== '' ? "{$image}\n\n" : '';
                    break;
                case 'hr':
                    $flush();
                    $out .= "---\n\n";
                    break;
                case 'div':
                case 'section':
                case 'article':
                    $flush();
                    $out .= $this->blocks($node, $depth);
                    break;
                case 'script':
                case 'style':
                case 'iframe':
                case 'noscript':
                case 'form':
                    break;
                default:
                    $inline .= $this->inline($node);
            }
        }
        $flush();

        return $out;
    }

    private function list(Element $list, int $depth): string
    {
        $out = '';
        $number = 1;
        $indent = str_repeat('   ', $depth);
        foreach ($list->childNodes as $item) {
            if (! $item instanceof Element || $item->localName !== 'li') {
                continue;
            }
            $marker = $list->localName === 'ol' ? ($number++).'.' : '-';
            $text = '';
            $nested = '';
            foreach ($item->childNodes as $child) {
                if ($child instanceof Element && in_array($child->localName, ['ul', 'ol'], true)) {
                    $nested .= $this->list($child, $depth + 1);
                } elseif ($child instanceof Element && $child->localName === 'p') {
                    $text .= ' '.$this->inline($child);
                } else {
                    $text .= $child instanceof Element ? $this->inline($child) : ($child instanceof Text ? $this->escape($this->collapse($child->data)) : '');
                }
            }
            $out .= "{$indent}{$marker} ".trim((string) preg_replace('/\s+/u', ' ', $text))."\n".$nested;
        }

        return $out;
    }

    private function figure(Element $figure): string
    {
        $out = '';
        foreach ($figure->getElementsByTagName('img') as $img) {
            $out .= ($image = $this->image($img)) !== '' ? "{$image}\n\n" : '';
        }
        foreach ($figure->getElementsByTagName('figcaption') as $caption) {
            $out .= ($text = trim($this->inline($caption))) !== '' ? "*{$text}*\n\n" : '';
        }

        return $out;
    }

    private function image(Element $img): string
    {
        $source = $img->getAttribute('src') ?: '';
        if ($source === '' || str_starts_with($source, 'data:')) {
            return '';
        }
        $copy = $this->download($this->absolute($source), 'blog/images');
        if (! $copy) {
            return '';
        }
        $alt = str_replace(['[', ']'], '', $this->plain($img->getAttribute('alt') ?? ''));

        return '!['.$alt.']('.Storage::disk('public')->url($copy).')';
    }

    /** Inline content: bold, italics, links and line breaks. */
    private function inline(Node $node): string
    {
        if ($node instanceof Text) {
            return $this->escape($this->collapse($node->data));
        }
        if (! $node instanceof Element) {
            return '';
        }

        $inner = '';
        foreach ($node->childNodes as $child) {
            $inner .= $this->inline($child);
        }

        return match ($node->localName) {
            'strong', 'b' => $this->wrap($inner, '**'),
            'em', 'i' => $this->wrap($inner, '*'),
            'code' => trim($inner) !== '' ? '`'.str_replace('`', '', html_entity_decode($node->textContent ?? '')).'`' : '',
            'br' => "  \n",
            'a' => $this->link($node, $inner),
            'img' => $this->image($node),
            'script', 'style', 'iframe', 'noscript' => '',
            default => $inner,
        };
    }

    /** Keeps the spaces around bold or italic text outside the markers, which Markdown needs. */
    private function wrap(string $text, string $marker): string
    {
        if (trim($text) === '') {
            return $text;
        }
        preg_match('/^(\s*)(.*?)(\s*)$/su', $text, $parts);

        return $parts[1].$marker.$parts[2].$marker.$parts[3];
    }

    private function link(Element $anchor, string $text): string
    {
        $href = trim($anchor->getAttribute('href') ?? '');
        if ($href === '' || trim($text) === '' || preg_match('/^(javascript|data):/i', $href)) {
            return $text;
        }

        // Links to the old site become addresses on this one, where the redirects take over.
        $host = parse_url($href, PHP_URL_HOST);
        if ($host && in_array(strtolower($host), [$this->host, 'www.'.$this->host], true)) {
            $href = (parse_url($href, PHP_URL_PATH) ?: '/').(($query = parse_url($href, PHP_URL_QUERY)) ? "?{$query}" : '').(($fragment = parse_url($href, PHP_URL_FRAGMENT)) ? "#{$fragment}" : '');
            $href = $href !== '/' ? rtrim($href, '/') : $href;

            // Files in WordPress's uploads folder disappear with it, so link to our own copy.
            if (str_starts_with($href, '/wp-content/uploads/') && ($copy = $this->download($this->absolute($href), 'blog/images'))) {
                $href = Storage::disk('public')->url($copy);
            }
        }

        return '['.trim($text).']('.str_replace([' ', ')'], ['%20', '%29'], $href).')';
    }

    private function absolute(string $url): string
    {
        if (str_starts_with($url, '//')) {
            return "https:{$url}";
        }

        return str_starts_with($url, '/') ? "https://{$this->host}{$url}" : $url;
    }

    /** Whitespace in HTML text counts as a single space. */
    private function collapse(string $text): string
    {
        return (string) preg_replace('/\s+/u', ' ', $text);
    }

    /** Stops ordinary text being read as Markdown (a line starting "1. " or "# ", or stray asterisks). */
    private function escape(string $text): string
    {
        $text = str_replace(['\\', '*', '_', '`', '[', ']'], ['\\\\', '\\*', '\\_', '\\`', '\\[', '\\]'], $text);

        return (string) preg_replace(['/^(\s*)([#+-])(?=\s)/', '/^(\s*)>/', '/^(\s*\d+)\.(\s)/'], ['$1\\\\$2', '$1\\\\>', '$1\\.$2'], $text);
    }
}
