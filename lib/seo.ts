import "server-only";

import type { Metadata } from "next";

export type ModuleSeoOverride = {
  title?: string;
  description?: string;
  keywords?: string;
  og_image?: string;
  allow_indexing?: boolean;
};

export type ModuleCatalogEntry = { key: string; label: string; path: string };

export type SeoSettings = {
  site_name: string;
  title_template: string;
  default_title: string;
  meta_description: string;
  keywords: string;
  allow_indexing: boolean;
  canonical_base_url: string;
  og_image: string;
  og_type: string;
  twitter_card: string;
  twitter_handle: string;
  google_site_verification: string;
  bing_site_verification: string;
  google_analytics_id: string;
  google_tag_manager_id: string;
  facebook_pixel_id: string;
  organization_name: string;
  organization_logo: string;
  social_links: string[];
  robots_extra: string;
  module_seo: Record<string, ModuleSeoOverride>;
  modules_catalog: ModuleCatalogEntry[];
};

/**
 * Fetches the central super-admin SEO configuration (server-side, cached 5 min).
 * Returns {} on any failure so the app still renders with built-in defaults.
 */
export async function fetchSeoSettings(): Promise<Partial<SeoSettings>> {
  const base = (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
  if (!base) return {};
  try {
    const res = await fetch(`${base}/settings/seo/public`, { next: { revalidate: 300 } });
    if (!res.ok) return {};
    const json = await res.json();
    return (json?.data ?? {}) as Partial<SeoSettings>;
  } catch {
    return {};
  }
}

/**
 * Builds Next.js metadata for a specific public module, layering the central
 * per-module override (set in Settings → SEO & Discovery) over the global SEO
 * config. Anything left blank for the module inherits the global value, so the
 * parent layout's title template, OG and verification still apply.
 *
 * Use inside a module's server `layout.tsx`:
 *   export const generateMetadata = () => moduleMetadata("marketplace");
 */
export async function moduleMetadata(moduleKey: string): Promise<Metadata> {
  const seo = await fetchSeoSettings();
  const override: ModuleSeoOverride = seo.module_seo?.[moduleKey] ?? {};

  const meta: Metadata = {};

  // A plain string title composes with the root layout's title template.
  if (override.title) {
    meta.title = override.title;
  }

  const description = override.description || seo.meta_description;
  if (description) meta.description = description;

  if (override.keywords) {
    meta.keywords = override.keywords.split(",").map((k) => k.trim()).filter(Boolean);
  }

  // Module can opt out of indexing even when the site as a whole is indexable.
  if (override.allow_indexing === false) {
    meta.robots = { index: false, follow: false, googleBot: { index: false, follow: false } };
  }

  const ogImage = override.og_image || seo.og_image;
  if (override.title || description || ogImage) {
    meta.openGraph = {
      ...(override.title ? { title: override.title } : {}),
      ...(description ? { description } : {}),
      ...(ogImage ? { images: [ogImage] } : {}),
    };
    meta.twitter = {
      ...(override.title ? { title: override.title } : {}),
      ...(description ? { description } : {}),
      ...(ogImage ? { images: [ogImage] } : {}),
    };
  }

  return meta;
}
