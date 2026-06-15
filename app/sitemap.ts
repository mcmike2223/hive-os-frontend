import type { MetadataRoute } from "next";

import { fetchSeoSettings } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seo = await fetchSeoSettings();

  // Without a canonical base URL we cannot emit absolute, valid sitemap entries.
  const base = (seo.canonical_base_url || "").replace(/\/+$/, "");
  if (!base || seo.allow_indexing === false) return [];

  const now = new Date();
  const staticPaths: Array<{ path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
    { path: "/", priority: 1, freq: "daily" },
    { path: "/marketplace", priority: 0.9, freq: "daily" },
    { path: "/marketplace/products", priority: 0.8, freq: "daily" },
    { path: "/marketplace/suppliers", priority: 0.7, freq: "weekly" },
    { path: "/login", priority: 0.3, freq: "monthly" },
    { path: "/register", priority: 0.4, freq: "monthly" },
  ];

  return staticPaths.map(({ path, priority, freq }) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: freq,
    priority,
  }));
}
