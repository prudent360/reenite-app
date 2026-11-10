import type { NextConfig } from "next";

// Space photos uploaded in the admin are served from the API's public storage (e.g. https://api.reenite.com/storage/spaces/...).
const api = new URL(process.env.API_URL ?? "http://localhost:8000");

const nextConfig: NextConfig = {
  cacheComponents: true,
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
