import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PostEditor } from "@/components/admin/blog/post-editor";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { BlogPost } from "@/lib/types";

export const metadata: Metadata = { title: "New post" };

export default function NewPostPage() {
  return (
    <>
      <Link href="/admin/blog" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Blog
      </Link>
      <PageHeader title="New post" />
      <Suspense fallback={<Skeleton className="h-[640px] rounded-2xl" />}>
        <Editor />
      </Suspense>
    </>
  );
}

async function Editor() {
  await requireStaff("content.manage");
  const { data: posts } = await api<{ data: BlogPost[] }>("/admin/blog");
  return <PostEditor categories={[...new Set(posts.map((post) => post.category).filter((name): name is string => Boolean(name)))].sort()} />;
}
