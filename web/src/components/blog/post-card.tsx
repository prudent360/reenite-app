import Image from "next/image";
import Link from "next/link";
import type { BlogPost } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

/** Date, reading time and (optionally) author, e.g. "14 Sept 2026 · 4 min read". */
export function PostMeta({ post, withAuthor = false, className }: { post: BlogPost; withAuthor?: boolean; className?: string }) {
  return (
    <p className={cn("text-sm text-muted", className)}>
      {withAuthor && post.author_name && <span>By {post.author_name} · </span>}
      <time dateTime={post.published_at ?? undefined}>{formatDate(post.published_at)}</time> · {post.reading_minutes} min read
    </p>
  );
}

/** A post in a list. `featured` lays it out wide, photo beside the text. */
export function PostCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  return (
    <article className={cn("group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-0.5 hover:shadow-lg", featured && "md:grid md:grid-cols-[1.2fr_1fr]")}>
      <div className={cn("relative aspect-[16/9] overflow-hidden bg-surface-muted", featured && "md:aspect-auto md:min-h-80")}>
        {post.cover_url ? (
          <Image
            src={post.cover_url}
            alt={post.cover_alt ?? ""}
            fill
            sizes={featured ? "(min-width: 768px) 640px, 100vw" : "(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"}
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--navy-900),var(--navy-700))]" aria-hidden />
        )}
      </div>
      <div className={cn("flex flex-1 flex-col p-5", featured && "md:justify-center md:p-8")}>
        {post.category && <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">{post.category}</p>}
        <h3 className={cn("mt-2 font-bold leading-snug text-foreground", featured ? "text-2xl md:text-3xl" : "text-lg")}>
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {post.title}
          </Link>
        </h3>
        <p className={cn("mt-2 text-sm leading-relaxed text-muted", featured ? "line-clamp-4" : "line-clamp-3")}>{post.excerpt}</p>
        <PostMeta post={post} className="mt-auto pt-4 text-xs" />
      </div>
    </article>
  );
}
