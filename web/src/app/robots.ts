import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Search engines may index the public site, but not accounts, admin or private files. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/dashboard", "/files", "/auth", "/bookings"] },
    sitemap: `${site}/sitemap.xml`,
  };
}
