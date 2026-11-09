import type { MetadataRoute } from "next";
import { getCatalogue } from "@/lib/catalogue";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Public pages plus one entry per active service, so new services are found without a deploy. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalogue = await getCatalogue();
  const pages = ["", "/services", "/workspace", "/about", "/contact", "/privacy", "/terms"].map((path) => ({
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
  return [...pages, ...services];
}
