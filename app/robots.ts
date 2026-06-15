import type { MetadataRoute } from "next";

import { fetchSeoSettings } from "@/lib/seo";

// Render at request time so it reflects the live central SEO config — otherwise
// Next prerenders this at build time (backend unreachable) and bakes defaults.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await fetchSeoSettings();
  const indexable = seo.allow_indexing !== false;
  const base = (seo.canonical_base_url || "").replace(/\/+$/, "");

  // Extra disallow rules entered by the super-admin (one directive per line).
  const extraDisallow = (seo.robots_extra || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^disallow:/i.test(line))
    .map((line) => line.replace(/^disallow:\s*/i, "").trim())
    .filter(Boolean);

  if (!indexable) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api", ...extraDisallow],
    },
    sitemap: base ? `${base}/sitemap.xml` : undefined,
  };
}
