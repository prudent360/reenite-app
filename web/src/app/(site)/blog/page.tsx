import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, CloudOff, Newspaper } from "lucide-react";
import { PostCard } from "@/components/blog/post-card";
import { PageHero } from "@/components/site/page-hero";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { getPosts } from "@/lib/blog";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Blog",
  description: "News, events and practical guides from Reenite: coworking, meeting rooms and running a business in Uyo, Akwa Ibom.",
  alternates: { canonical: "/blog" },
};

export default function BlogPage({ searchParams }: PageProps<"/blog">) {
  return (
    <>
      <PageHero eyebrow="Blog" title="Ideas, news and guides from Reenite" body="What's happening at the space, plus practical advice on working well and running a business in Uyo." />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <Suspense fallback={<ListSkeleton />}>
          {searchParams.then(({ category, page }) => (
            <PostList category={typeof category === "string" ? category : undefined} page={Math.max(1, Number(page) || 1)} />
          ))}
        </Suspense>
      </section>
    </>
  );
}

async function PostList({ category, page }: { category?: string; page: number }) {
  const result = await getPosts({ category, page });
  if (!result) {
    return <EmptyState icon={CloudOff} title="The blog is unavailable right now" description="Please refresh in a moment." className="py-20" />;
  }

  const [first, ...rest] = result.data;
  const featured = page === 1 && first ? first : null;
  const posts = featured ? rest : result.data;
  const href = (next: { category?: string; page?: number }) => {
    const query = new URLSearchParams();
    if (next.category) query.set("category", next.category);
    if (next.page && next.page > 1) query.set("page", String(next.page));
    return query.size ? `/blog?${query}` : "/blog";
  };

  return (
    <>
      {result.categories.length > 1 && (
        <nav aria-label="Topics" className="-mx-1 mb-8 flex gap-2 overflow-x-auto px-1 pb-1">
          {[undefined, ...result.categories].map((name) => (
            <Link
              key={name ?? "all"}
              href={href({ category: name })}
              aria-current={name === category ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition",
                name === category ? "border-navy-900 bg-navy-900 text-white dark:border-white dark:bg-white dark:text-navy-950" : "border-border text-muted hover:border-navy-300 hover:text-foreground",
              )}
            >
              {name ?? "All posts"}
            </Link>
          ))}
        </nav>
      )}

      {result.data.length === 0 ? (
        <EmptyState icon={Newspaper} title="No posts here yet" description="Check back soon, or see all posts." className="py-20" />
      ) : (
        <div className="space-y-8">
          {featured && <PostCard post={featured} featured />}
          {posts.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      )}

      {result.meta.last_page > 1 && (
        <nav aria-label="Pages" className="mt-12 flex items-center justify-between gap-4">
          {page > 1 ? (
            <Link href={href({ category, page: page - 1 })} className={buttonClasses({ variant: "outline" })}>
              <ChevronLeft className="size-4" /> Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted">
            Page {result.meta.current_page} of {result.meta.last_page}
          </span>
          {page < result.meta.last_page ? (
            <Link href={href({ category, page: page + 1 })} className={buttonClasses({ variant: "outline" })}>
              Older <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-80 rounded-2xl" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-80 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
