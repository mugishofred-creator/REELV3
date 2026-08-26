import type { NextConfig } from "next";

/**
 * GitHub Pages serves the site from a subpath and has no image optimizer, so the
 * Pages build is a static export. Everything else — dev, `next start`, a future
 * Vercel deploy — keeps the full server build untouched.
 */
const isPages = process.env.DEPLOY_TARGET === "pages";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: isPages ? { unoptimized: true } : { formats: ["image/avif", "image/webp"] },
  ...(isPages
    ? {
        output: "export",
        basePath: process.env.PAGES_BASE_PATH ?? "",
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
