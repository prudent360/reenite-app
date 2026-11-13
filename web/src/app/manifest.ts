import type { MetadataRoute } from "next";

/**
 * Lets phones install the site, and is what the Android app (a Trusted Web Activity wrapping this site) is built from.
 * Opening the app lands on the dashboard, which sends signed-out visitors to sign in.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Reenite",
    short_name: "Reenite",
    description: "Book a desk, office, meeting room or podcast studio in Uyo, and run your business filings, all in one place.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#1a2142",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
