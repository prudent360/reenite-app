import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, CloudOff } from "lucide-react";
import { PostCard, PostMeta } from "@/components/blog/post-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { getPost, getPosts } from "@/lib/blog";
import { hq } from "@/content/site";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) {
    return { title: "Blog" };
  }
  const description = post.meta_description ?? post.excerpt;
  return {
    title: post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      publishedTime: post.published_at ?? undefined,
      authors: post.author_name ? [post.author_name] : undefined,
      images: post.cover_url ? [{ url: post.cover_url, alt: post.cover_alt ?? post.title }] : undefined,
    },
    twitter: { card: post.cover_url ? "summary_large_image" : "summary" },
  };
}

export default function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      {params.then(({ slug }) => (
        <Article slug={slug} />
      ))}
    </Suspense>
  );
}

async function Article({ slug }: { slug: string }) {
  const [post, latest] = await Promise.all([getPost(slug), getPosts({ perPage: 4 })]);
  if (post === undefined) {
    notFound();
  }
  if (post === null) {
    return <EmptyState icon={CloudOff} title="This post is unavailable right now" description="Please refresh in a moment." className="py-24" />;
  }

  const more = (latest?.data ?? []).filter((item) => item.slug !== post.slug).slice(0, 3);
  // Structured data so search engines show the date, author and photo.
  const structured = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.meta_description ?? post.excerpt,
    datePublished: post.published_at,
    image: post.cover_url ?? undefined,
    author: { "@type": post.author_name && post.author_name !== "Reenite" ? "Person" : "Organization", name: post.author_name ?? "Reenite" },
    publisher: { "@type": "Organization", name: "Reenite", url: site },
    mainEntityOfPage: `${site}/blog/${post.slug}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />
      <article>
        <header className="bg-navy-950 text-white">
          <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6 md:pb-32 md:pt-14">
            <Link href={post.category ? `/blog?category=${encodeURIComponent(post.category)}` : "/blog"} className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-200 hover:text-white">
              <ArrowLeft className="size-4" /> {post.category ?? "Blog"}
            </Link>
            <h1 className="mt-5 text-3xl font-bold leading-[1.15] sm:text-5xl">{post.title}</h1>
            <PostMeta post={post} withAuthor className="mt-5 text-navy-200" />
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          {post.cover_url ? (
            <div className="relative -mt-16 aspect-[16/9] overflow-hidden rounded-2xl bg-surface-muted shadow-xl md:-mt-24">
              <Image src={post.cover_url} alt={post.cover_alt ?? ""} fill priority sizes="(min-width: 768px) 768px, 100vw" className="object-cover" />
            </div>
          ) : (
            <div className="-mt-16 md:-mt-24" />
          )}

          <div className="article-body py-10 md:py-14" dangerouslySetInnerHTML={{ __html: post.body_html ?? "" }} />

          <aside className="mb-16 flex flex-col gap-4 rounded-2xl bg-navy-950 p-6 text-white sm:flex-row sm:items-center sm:justify-between md:p-8">
            <div>
              <p className="text-lg font-bold">Work from Reenite, {hq.city}</p>
              <p className="mt-1 text-sm text-navy-200">Desks, private offices and meeting rooms at {hq.street}. Book by the hour, day or month.</p>
            </div>
            <ButtonLink href="/book" className="shrink-0">
              Book a space <ArrowRight className="size-4" />
            </ButtonLink>
          </aside>
        </div>
      </article>

      {more.length > 0 && (
        <section className="border-t border-border bg-surface-muted/50">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-2xl font-bold text-foreground">More from the blog</h2>
              <Link href="/blog" className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
                All posts
              </Link>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {more.map((item) => (
                <PostCard key={item.id} post={item} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function ArticleSkeleton() {
  return (
    <>
      <div className="h-72 bg-navy-950" />
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="-mt-24 aspect-[16/9] rounded-2xl" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-11/12" />
        <Skeleton className="h-5 w-4/5" />
      </div>
    </>
  );
}
