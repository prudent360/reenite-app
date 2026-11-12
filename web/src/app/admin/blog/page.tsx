import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Newspaper, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { BlogPost } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Blog" };

export default function AdminBlogPage() {
  return (
    <>
      <PageHeader
        title="Blog"
        description="Posts on reenite.com/blog. Write in Markdown, add photos, and publish now or schedule for later."
        actions={
          <ButtonLink href="/admin/blog/new">
            <Plus className="size-4" /> New post
          </ButtonLink>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Posts />
      </Suspense>
    </>
  );
}

async function Posts() {
  await requireStaff("content.manage");
  const { data: posts } = await api<{ data: BlogPost[] }>("/admin/blog");

  if (posts.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Newspaper}
          title="No posts yet"
          description="Write your first post, or copy the old WordPress posts over with php artisan blog:import-wordpress."
          action={<ButtonLink href="/admin/blog/new">New post</ButtonLink>}
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-border">
        {posts.map((post) => (
          <li key={post.id}>
            <Link href={`/admin/blog/${post.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-muted/60 sm:px-6">
              <span className="relative hidden h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-muted sm:block">
                {post.cover_url && <Image src={post.cover_url} alt="" fill sizes="96px" className="object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-foreground">{post.title}</span>
                  {post.state === "draft" && <Badge>Draft</Badge>}
                  {post.state === "scheduled" && <Badge tone="warning">Goes live {formatDateTime(post.published_at)}</Badge>}
                </span>
                <span className="mt-0.5 block text-sm text-muted">
                  {[post.category, post.state === "published" ? formatDate(post.published_at) : `Edited ${formatDate(post.updated_at)}`, `${post.reading_minutes} min read`, post.from_wordpress ? "from WordPress" : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
