import type { MetadataRoute } from "next";
import { getAllProducts } from "@/lib/products";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = ["", "/sins", "/cloud", "/shop", "/world"].map((path) => ({
    url: `${site.url}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  const products = getAllProducts().map((product) => ({
    url: `${site.url}/shop/${product.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...routes, ...products];
}
