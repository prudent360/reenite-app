"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Bold, ExternalLink, Eye, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Pencil, Quote, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { TextField, TextareaField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";
import { deletePost, previewPost, removePostCover, savePost, uploadPostCover, uploadPostImage, type PostInput } from "@/lib/actions/blog";
import type { BlogPost } from "@/lib/types";
import { uploadTooLarge } from "@/lib/uploads";
import { cn } from "@/lib/utils";

type Publish = "draft" | "now" | "later";

/** Toolbar buttons: Markdown before and after the selection, a placeholder, and whether it starts a new line. */
const tools: { icon: typeof Bold; label: string; format: [before: string, after: string, placeholder: string, block: boolean] }[] = [
  { icon: Heading2, label: "Heading", format: ["## ", "", "Heading", true] },
  { icon: Heading3, label: "Subheading", format: ["### ", "", "Subheading", true] },
  { icon: Bold, label: "Bold", format: ["**", "**", "text", false] },
  { icon: Italic, label: "Italic", format: ["*", "*", "text", false] },
  { icon: Link2, label: "Link", format: ["[", "](https://)", "link text", false] },
  { icon: List, label: "Bulleted list", format: ["- ", "", "Item", true] },
  { icon: ListOrdered, label: "Numbered list", format: ["1. ", "", "Item", true] },
  { icon: Quote, label: "Quote", format: ["> ", "", "Quote", true] },
];

/** "2026-11-12T09:30" in the browser's time zone, for a datetime-local input. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const stateBadge = {
  draft: <Badge>Draft</Badge>,
  scheduled: <Badge tone="warning">Scheduled</Badge>,
  published: <Badge tone="success">Published</Badge>,
};

/**
 * Writing a post in Markdown, with a toolbar for the common bits, a preview that matches the website,
 * images uploaded straight into the text, and publish now, schedule or keep as a draft.
 */
export function PostEditor({ post, categories }: { post?: BlogPost; categories: string[] }) {
  const router = useRouter();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const [fields, setFields] = useState({
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    excerpt: post?.own_excerpt ?? "",
    body: post?.body ?? "",
    cover_alt: post?.cover_alt ?? "",
    category: post?.category ?? "",
    meta_description: post?.meta_description ?? "",
    author_name: post?.author_name ?? "Reenite",
  });
  const [publish, setPublish] = useState<Publish>(!post?.published_at ? "draft" : post.state === "scheduled" ? "later" : "now");
  const [when, setWhen] = useState(toLocalInput(post?.published_at));
  const [cover, setCover] = useState<{ url: string | null; file: File | null }>({ url: post?.cover_url ?? null, file: null });
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, startSaving] = useTransition();
  const [uploading, startUploading] = useTransition();
  const [previewing, startPreview] = useTransition();
  const [deleting, startDeleting] = useTransition();

  const set = (key: keyof typeof fields) => (event: { target: { value: string } }) => setFields((current) => ({ ...current, [key]: event.target.value }));

  /**
   * Wraps the selection (or a placeholder) in Markdown and selects the text inside, so typing replaces it.
   * Uses the browser's own insert so Ctrl+Z undoes it. `atCursor` inserts after the selection instead of wrapping it.
   */
  function format(before: string, after = "", placeholder = "text", block = false, atCursor = false) {
    const element = textarea.current;
    if (!element) return;
    element.focus();
    const start = atCursor ? element.selectionEnd : element.selectionStart;
    const end = element.selectionEnd;
    const selected = atCursor ? placeholder : element.value.slice(start, end) || placeholder;
    const lineStart = block && start > 0 && element.value[start - 1] !== "\n" ? "\n\n" : "";
    const lineEnd = block && end < element.value.length && element.value[end] !== "\n" ? "\n\n" : "";
    const text = lineStart + before + selected + after + lineEnd;
    element.setSelectionRange(start, end);
    if (!document.execCommand("insertText", false, text)) {
      element.setRangeText(text, start, end, "end");
    }
    setFields((current) => ({ ...current, body: element.value }));
    const from = start + lineStart.length + before.length;
    element.setSelectionRange(from, from + selected.length);
  }

  function insertImage(file: File) {
    const tooLarge = uploadTooLarge(file, "Images");
    if (tooLarge) return toast.error(tooLarge);
    startUploading(async () => {
      const form = new FormData();
      form.set("image", file);
      const result = await uploadPostImage(form);
      if (!result.ok || !result.url) return void toast.error(result.message ?? "Upload failed.");
      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
      format(`![${alt}](${result.url})`, "", "", true, true);
      toast.success("Image added. Change the words in [ ] to describe it.");
    });
  }

  function showPreview() {
    setTab("preview");
    startPreview(async () => setPreview(await previewPost(fields.body)));
  }

  function chooseCover(file: File | undefined) {
    if (!file) return;
    const tooLarge = uploadTooLarge(file, "The photo");
    if (tooLarge) return toast.error(tooLarge);
    if (!post) {
      // Uploaded once the post is first saved.
      setCover({ url: URL.createObjectURL(file), file });
      return;
    }
    startUploading(async () => {
      const form = new FormData();
      form.set("cover", file);
      const result = await uploadPostCover(post.id, form);
      if (result.ok) {
        setCover({ url: result.data?.cover_url ?? null, file: null });
        toast.success(result.message);
      } else toast.error(result.message);
    });
  }

  function removeCover() {
    if (!post) return setCover({ url: null, file: null });
    startUploading(async () => {
      const result = await removePostCover(post.id);
      if (result.ok) {
        setCover({ url: null, file: null });
        toast.success(result.message);
      } else toast.error(result.message ?? "We couldn't remove it.");
    });
  }

  function save(mode: Publish = publish) {
    setErrors({});
    let publishedAt: string | null = null;
    if (mode === "now") publishedAt = post?.published_at && post.state === "published" ? post.published_at : new Date().toISOString();
    if (mode === "later") {
      if (!when) return setErrors({ published_at: ["Choose when it should go live."] });
      publishedAt = new Date(when).toISOString();
    }
    const input: PostInput = { ...fields, published_at: publishedAt };

    startSaving(async () => {
      const result = await savePost(post?.id ?? null, input);
      if (!result.ok || !result.data) {
        setErrors(result.errors ?? {});
        toast.error(result.message ?? "Check the highlighted fields.");
        return;
      }
      setPublish(mode);
      if (!post && cover.file) {
        const form = new FormData();
        form.set("cover", cover.file);
        const uploaded = await uploadPostCover(result.data.id, form);
        if (!uploaded.ok) toast.error(uploaded.message);
      }
      toast.success(mode === "draft" ? "Draft saved." : mode === "later" ? "Scheduled." : result.message);
      if (!post) router.replace(`/admin/blog/${result.data.id}`);
      else setFields((current) => ({ ...current, slug: result.data!.slug }));
    });
  }

  function remove() {
    if (!post || !window.confirm(`Delete "${post.title}"? Its address will stop working. This can't be undone.`)) return;
    startDeleting(async () => {
      const result = await deletePost(post.id);
      if (!result.ok) return void toast.error(result.message ?? "We couldn't delete it.");
      toast.success(result.message);
      router.push("/admin/blog");
    });
  }

  const busy = saving || uploading || deleting;
  const metaLength = (fields.meta_description || fields.excerpt).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <Card className="space-y-5 p-5 sm:p-6">
          <TextField label="Title" name="title" value={fields.title} onChange={set("title")} error={errors.title} placeholder="Looking for a meeting room in Uyo?" inputClassName="text-lg font-semibold" />

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">Post</span>
              <div className="flex rounded-lg bg-surface-muted p-0.5 text-sm font-semibold" role="tablist">
                <button type="button" role="tab" aria-selected={tab === "write"} onClick={() => setTab("write")} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1", tab === "write" ? "bg-surface text-foreground shadow-sm" : "text-muted")}>
                  <Pencil className="size-3.5" /> Write
                </button>
                <button type="button" role="tab" aria-selected={tab === "preview"} onClick={showPreview} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1", tab === "preview" ? "bg-surface text-foreground shadow-sm" : "text-muted")}>
                  <Eye className="size-3.5" /> Preview
                </button>
              </div>
            </div>

            {tab === "write" ? (
              <div className={cn("overflow-hidden rounded-xl border bg-surface focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15", errors.body ? "border-danger" : "border-border")}>
                <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface-muted/60 px-1.5 py-1">
                  {tools.map((tool) => (
                    <button key={tool.label} type="button" title={tool.label} aria-label={tool.label} onClick={() => format(...tool.format)} className="rounded-md p-2 text-muted hover:bg-surface hover:text-foreground">
                      <tool.icon className="size-4" />
                    </button>
                  ))}
                  <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                  <button type="button" onClick={() => imageInput.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted hover:bg-surface hover:text-foreground">
                    {uploading ? <DotLoader className="text-current" label="Uploading" /> : <ImagePlus className="size-4" />} Image
                  </button>
                  <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) insertImage(file); }} />
                </div>
                <textarea
                  ref={textarea}
                  aria-label="Post"
                  value={fields.body}
                  onChange={set("body")}
                  onPaste={(event) => { const file = event.clipboardData.files?.[0]; if (file?.type.startsWith("image/")) { event.preventDefault(); insertImage(file); } }}
                  onDrop={(event) => { const file = event.dataTransfer.files?.[0]; if (file?.type.startsWith("image/")) { event.preventDefault(); insertImage(file); } }}
                  placeholder={"Start writing…\n\n## A heading\n\nA paragraph with **bold** text and a [link](https://reenite.com)."}
                  className="block min-h-[28rem] w-full resize-y bg-transparent px-4 py-3 font-mono text-[14px] leading-relaxed text-foreground placeholder:text-navy-400 focus:outline-none"
                />
              </div>
            ) : (
              <div className="min-h-[28rem] rounded-xl border border-border bg-surface px-5 py-4">
                {previewing || preview === null ? <DotLoader label="Loading preview" /> : <div className="article-body" dangerouslySetInnerHTML={{ __html: preview || "<p>Nothing written yet.</p>" }} />}
              </div>
            )}
            <p className="text-[13px] text-danger">{errors.body?.[0]}</p>
            <p className="text-[13px] text-muted">
              Uses Markdown: <code>## Heading</code>, <code>**bold**</code>, <code>*italic*</code>, <code>- list</code>, <code>[text](link)</code>. Paste or drop an image to add it.
            </p>
          </div>
        </Card>

        <Card className="space-y-5 p-5 sm:p-6">
          <h2 className="font-semibold text-foreground">Search and sharing</h2>
          <TextareaField label="Summary (optional)" name="excerpt" value={fields.excerpt} onChange={set("excerpt")} error={errors.excerpt} maxLength={500} hint="Shown on the blog page under the title. Left blank, the opening lines are used." className="[&_textarea]:min-h-20" />
          <TextareaField
            label="Google description (optional)"
            name="meta_description"
            value={fields.meta_description}
            onChange={set("meta_description")}
            error={errors.meta_description}
            maxLength={300}
            hint={<span className={cn(metaLength > 160 && "text-warning")}>{metaLength} characters. Google shows about 155; the summary is used if this is blank.</span>}
            className="[&_textarea]:min-h-20"
          />
          <TextField
            label="Address"
            name="slug"
            value={fields.slug}
            onChange={(event) => setFields((current) => ({ ...current, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") }))}
            error={errors.slug}
            leading={<span className="pl-2 text-xs">/blog/</span>}
            inputClassName="pl-14"
            placeholder="made from the title"
            hint={post?.state === "published" ? "Changing this breaks links people have already shared." : "Leave blank to make it from the title."}
          />
        </Card>
      </div>

      <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-foreground">Publishing</h2>
            {post?.state && stateBadge[post.state]}
          </div>
          <fieldset className="space-y-2">
            <legend className="sr-only">When it goes live</legend>
            {([
              ["draft", "Draft", "Only staff can see it."],
              ["now", "Published", "Live on the blog."],
              ["later", "Schedule", "Goes live by itself at a set time."],
            ] as const).map(([value, title, body]) => (
              <label key={value} className={cn("flex cursor-pointer gap-3 rounded-xl border p-3 transition", publish === value ? "border-brand-500 bg-brand-500/5" : "border-border hover:border-navy-200")}>
                <input type="radio" name="publish" value={value} checked={publish === value} onChange={() => setPublish(value)} className="mt-1 accent-brand-500" />
                <span>
                  <span className="block text-sm font-semibold text-foreground">{title}</span>
                  <span className="block text-xs text-muted">{body}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {publish === "later" && <TextField label="Go live on" name="published_at" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} error={errors.published_at} />}
          <Button className="w-full" onClick={() => save()} disabled={busy}>
            {saving ? <DotLoader className="text-current" label="Saving" /> : publish === "draft" ? "Save draft" : publish === "later" ? "Schedule" : post?.state === "published" ? "Update" : "Publish"}
          </Button>
          {post?.state === "published" && (
            <ButtonLink href={`/blog/${post.slug}`} target="_blank" variant="outline" className="w-full">
              View on the site <ExternalLink className="size-4" />
            </ButtonLink>
          )}
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="font-semibold text-foreground">Cover photo</h2>
          {cover.url ? (
            <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-surface-muted">
              <Image src={cover.url} alt={fields.cover_alt} fill sizes="320px" className="object-cover" unoptimized={cover.url.startsWith("blob:")} />
            </div>
          ) : (
            <button type="button" onClick={() => coverInput.current?.click()} className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-sm text-muted hover:border-brand-500 hover:text-foreground">
              <Upload className="size-5" /> Add a cover photo
              <span className="text-xs">Wide, at least 1200 × 630, up to 3MB</span>
            </button>
          )}
          <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { chooseCover(event.target.files?.[0]); event.target.value = ""; }} />
          {cover.url && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => coverInput.current?.click()} disabled={uploading}>
                {uploading ? <DotLoader className="text-current" label="Uploading" /> : "Change"}
              </Button>
              <Button size="sm" variant="ghost" onClick={removeCover} disabled={uploading}>
                Remove
              </Button>
            </div>
          )}
          <TextField label="Describe the photo" name="cover_alt" value={fields.cover_alt} onChange={set("cover_alt")} error={errors.cover_alt} placeholder="Two people working at a desk" hint="For people using screen readers, and for Google." />
        </Card>

        <Card className="space-y-4 p-5">
          <TextField label="Topic" name="category" value={fields.category} onChange={set("category")} error={errors.category} list="blog-categories" placeholder="Coworking Space" hint="Visitors can filter the blog by topic." />
          <datalist id="blog-categories">
            {categories.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <TextField label="Written by" name="author_name" value={fields.author_name} onChange={set("author_name")} error={errors.author_name} />
        </Card>

        {post && (
          <Button variant="ghost" className="w-full text-danger" onClick={remove} disabled={busy}>
            {deleting ? <DotLoader className="text-current" label="Deleting" /> : <><Trash2 className="size-4" /> Delete post</>}
          </Button>
        )}
      </div>
    </div>
  );
}
