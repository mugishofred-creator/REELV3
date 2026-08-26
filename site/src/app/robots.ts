import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** Both are fully static; saying so lets the Pages export emit them as files. */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/cart" },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
