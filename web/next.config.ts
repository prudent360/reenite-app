import type { NextConfig } from "next";

// Space photos uploaded in the admin are served from the API's public storage (e.g. https://api.reenite.com/storage/spaces/...).
const api = new URL(process.env.API_URL ?? "http://localhost:8000");

/**
 * Addresses from the WordPress site that used to run on reenite.com (taken from its sitemap in November 2026).
 * Each one sends visitors, and Google, permanently to the closest page here, so old links and search rankings carry over.
 * Pages with the same address (/, /about, /contact, /blog) need no entry.
 */
const wordpressRedirects: Record<string, string> = {
  // Pages
  "/book-a-space": "/book",
  "/online-booking": "/book",
  "/space-viewing": "/contact",
  "/my-account": "/dashboard",
  "/privacy-policy": "/privacy",
  "/privacy-policy-2": "/privacy",
  "/terms-of-use": "/terms",
  "/refund_returns": "/terms#cancellations",
  "/scholarship-quiz": "https://scholarship.reenite.com",
  "/shop": "/services",
  "/cart": "/services",
  "/checkout": "/services",
  "/reenite-payment": "/dashboard/billing",
  "/pos": "/",
  "/pos-2": "/",
  "/hangout-donation": "/",
  "/test-page": "/",
  "/quiz-testing": "/",
  // Blog posts: the same posts, copied over by `php artisan blog:import-wordpress`.
  "/coworking-spaces-in-uyo": "/blog/coworking-spaces-in-uyo",
  "/best-workspace-in-uyo-reenite": "/blog/best-workspace-in-uyo-reenite",
  "/uyo-workspace": "/blog/uyo-workspace",
  "/meeting-space-for-rent-in-uyo": "/blog/meeting-space-for-rent-in-uyo",
  "/looking-for-a-meeting-room-in-uyo-heres-what-to-consider": "/blog/looking-for-a-meeting-room-in-uyo-heres-what-to-consider",
  "/flexibility-with-reenite-workspace-plans": "/blog/flexibility-with-reenite-workspace-plans",
  "/get-50-off-reenite-workspace": "/blog/get-50-off-reenite-workspace",
  "/sui-nigeria-holds-event-at-reenite-spaces": "/blog/sui-nigeria-holds-event-at-reenite-spaces",
  "/akwa-ibom-tech-week": "/blog/akwa-ibom-tech-week",
  "/reenite-espressor-coffee": "/blog/reenite-espressor-coffee",
  "/reenite-more-than-just-a-coworking-space-in-uyo": "/blog/reenite-more-than-just-a-coworking-space-in-uyo",
  "/reenite-officially-opens-in-uyo": "/blog/reenite-officially-opens-in-uyo",
  // Archives and feeds
  "/category/:path*": "/blog",
  "/tag/:path*": "/blog",
  "/author/:path*": "/blog",
  "/feed": "/blog",
  "/wp-login.php": "/login",
  "/wp-admin/:path*": "/login",
};

const nextConfig: NextConfig = {
  cacheComponents: true,
  async redirects() {
    return Object.entries(wordpressRedirects).map(([source, destination]) => ({ source, destination, permanent: true }));
  },
  images: {
    remotePatterns: [
      {
        protocol: api.protocol.replace(":", "") as "http" | "https",
        hostname: api.hostname,
        port: api.port,
        pathname: "/storage/**",
      },
    ],
    // Locally the API runs on localhost, which Next 16 refuses to optimise by default. Never in production.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
  partialPrefetching: true,
  experimental: {
    serverActions: {
      // Uploads are capped at 3MB (src/lib/uploads.ts), plus multipart overhead. Vercel refuses anything over 4.5MB.
      bodySizeLimit: "4mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
