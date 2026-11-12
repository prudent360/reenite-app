import type { MetadataRoute } from "next";
import { getPosts } from "@/lib/blog";
import { getCatalogue } from "@/lib/catalogue";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Public pages plus one entry per active service and blog post, so new ones are found without a deploy. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [catalogue, blog] = await Promise.all([getCatalogue(), getPosts({ perPage: 100 })]);
  const pages = ["", "/services", "/workspace", "/blog", "/about", "/contact", "/privacy", "/terms"].map((path) => ({
    url: `${site}${path}`,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.8,
  }));
  const services = (catalogue?.categories ?? []).flatMap((category) =>
    (category.services ?? []).map((service) => ({
      url: `${site}/services/${service.slug}`,
      lastModified: service.updated_at ?? undefined,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  );
  const posts = (blog?.data ?? []).map((post) => ({
    url: `${site}/blog/${post.slug}`,
    lastModified: post.published_at ?? undefined,
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }));
  return [...pages, ...services, ...posts];
}
