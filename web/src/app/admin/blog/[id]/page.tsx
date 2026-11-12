import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PostEditor } from "@/components/admin/blog/post-editor";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { BlogPost } from "@/lib/types";

export const metadata: Metadata = { title: "Edit post" };

export default function EditPostPage({ params }: PageProps<"/admin/blog/[id]">) {
  return (
    <>
      <Link href="/admin/blog" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Blog
      </Link>
      <PageHeader title="Edit post" />
      <Suspense fallback={<Skeleton className="h-[640px] rounded-2xl" />}>
        {params.then(({ id }) => (
          <Editor id={id} />
        ))}
      </Suspense>
    </>
  );
}

async function Editor({ id }: { id: string }) {
  await requireStaff("content.manage");
  let post: BlogPost;
  try {
    ({ data: post } = await api<{ data: BlogPost }>(`/admin/blog/${encodeURIComponent(id)}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const { data: posts } = await api<{ data: BlogPost[] }>("/admin/blog");
  const categories = [...new Set(posts.map((item) => item.category).filter((name): name is string => Boolean(name)))].sort();

  // Keyed by post so switching between posts starts the editor fresh.
  return <PostEditor key={post.id} post={post} categories={categories} />;
}
