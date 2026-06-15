import "server-only";

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
