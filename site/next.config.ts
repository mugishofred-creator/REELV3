import type { NextConfig } from "next";

/**
 * The site is fully prerendered, so any static host can serve it: set
 * STATIC_EXPORT=1 for a `out/` folder with no server behind it (Netlify,
 * GitHub Pages, Cloudflare Pages). Without it the full server build runs,
 * image optimization included — that is what `dev`, `start` and Vercel use.
 *
 * NEXT_PUBLIC_BASE_PATH is only needed on a host that serves the site from a
 * subfolder rather than a domain root, e.g. GitHub project pages.
 */
const isStatic = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: isStatic ? { unoptimized: true } : { formats: ["image/avif", "image/webp"] },
  ...(basePath ? { basePath } : {}),
  ...(isStatic ? { output: "export", trailingSlash: true } : {}),
};

export default nextConfig;
