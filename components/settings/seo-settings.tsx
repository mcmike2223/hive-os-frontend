"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Boxes,
  Globe,
  Image as ImageIcon,
  Loader2,
  Save,
  Search,
  Share2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAuthHeaders, getBackendApiRoot, getWorkspaceScopeKey } from "@/lib/runtime-context";

async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${getBackendApiRoot()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const headers: HeadersInit = getAuthHeaders(
    options.body && typeof options.body === "string" ? { "Content-Type": "application/json" } : {}
  );
  const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || "API Request Failed");
  }
  return res.json();
}

type ModuleOverride = {
  title: string;
  description: string;
  keywords: string;
  og_image: string;
  allow_indexing: boolean;
};

type CatalogEntry = { key: string; label: string; path: string };

const EMPTY_MODULE: ModuleOverride = {
  title: "",
  description: "",
  keywords: "",
  og_image: "",
  allow_indexing: true,
};

type SeoForm = {
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
  social_links: string;
  robots_extra: string;
  module_seo: Record<string, ModuleOverride>;
};

const EMPTY: SeoForm = {
  site_name: "",
  title_template: "%page% | %site%",
  default_title: "",
  meta_description: "",
  keywords: "",
  allow_indexing: true,
  canonical_base_url: "",
  og_image: "",
  og_type: "website",
  twitter_card: "summary_large_image",
  twitter_handle: "",
  google_site_verification: "",
  bing_site_verification: "",
  google_analytics_id: "",
  google_tag_manager_id: "",
  facebook_pixel_id: "",
  organization_name: "",
  organization_logo: "",
  social_links: "",
  robots_extra: "",
  module_seo: {},
};

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: any;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.75rem] border border-border/50 bg-card/40 backdrop-blur-sm p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

export default function SeoSettings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SeoForm>(EMPTY);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const workspaceScope = getWorkspaceScopeKey();

  const { data, isLoading } = useQuery({
    queryKey: ["seo-settings", workspaceScope],
    queryFn: () => apiFetch("/settings/seo"),
  });

  useEffect(() => {
    const d = data?.data;
    if (!d) return;
    const cat: CatalogEntry[] = Array.isArray(d.modules_catalog) ? d.modules_catalog : [];
    setCatalog(cat);

    // Ensure every catalogued module has a full override object to edit.
    const modules: Record<string, ModuleOverride> = {};
    for (const m of cat) {
      modules[m.key] = { ...EMPTY_MODULE, ...(d.module_seo?.[m.key] ?? {}) };
      modules[m.key].allow_indexing = (d.module_seo?.[m.key]?.allow_indexing ?? true) !== false;
    }

    setForm({
      ...EMPTY,
      ...d,
      social_links: Array.isArray(d.social_links) ? d.social_links.join("\n") : d.social_links || "",
      allow_indexing: d.allow_indexing !== false,
      module_seo: modules,
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: SeoForm) =>
      apiFetch("/settings/seo", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          social_links: payload.social_links
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: () => {
      toast.success("SEO settings saved. Live across every landing page within ~5 minutes.");
      queryClient.invalidateQueries({ queryKey: ["seo-settings"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to save SEO settings"),
  });

  const set = <K extends keyof SeoForm>(key: K, value: SeoForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setModule = <K extends keyof ModuleOverride>(moduleKey: string, field: K, value: ModuleOverride[K]) =>
    setForm((prev) => ({
      ...prev,
      module_seo: {
        ...prev.module_seo,
        [moduleKey]: { ...(prev.module_seo[moduleKey] ?? EMPTY_MODULE), [field]: value },
      },
    }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 transition-all animate-in fade-in slide-in-from-bottom-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">SEO &amp; Discovery</h2>
          <p className="text-sm text-muted-foreground">
            Central search-engine, social-sharing and analytics config — applied to every module and landing page.
          </p>
        </div>
        <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="rounded-xl">
          {mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save SEO settings
        </Button>
      </div>

      <Section icon={Search} title="Core Metadata" description="The title, description and keywords search engines display.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Site name" help="Brand name used in titles and Open Graph.">
            <Input value={form.site_name} onChange={(e) => set("site_name", e.target.value)} placeholder="HIVE" />
          </Field>
          <Field label="Title template" help="Use %page% for the page title and %site% for the site name.">
            <Input value={form.title_template} onChange={(e) => set("title_template", e.target.value)} placeholder="%page% | %site%" />
          </Field>
        </div>
        <Field label="Default / home title" help="Shown when a page does not set its own title.">
          <Input value={form.default_title} onChange={(e) => set("default_title", e.target.value)} placeholder="HIVE | Enterprise Marketplace" />
        </Field>
        <Field label="Meta description" help="120–160 characters works best.">
          <Textarea value={form.meta_description} onChange={(e) => set("meta_description", e.target.value)} rows={3} />
        </Field>
        <Field label="Keywords" help="Comma-separated.">
          <Input value={form.keywords} onChange={(e) => set("keywords", e.target.value)} placeholder="marketplace, b2b, wholesale" />
        </Field>
      </Section>

      <Section icon={ShieldCheck} title="Indexing &amp; Canonical" description="Control whether search engines may index the platform.">
        <div className="flex items-center justify-between rounded-xl border border-border/50 p-4">
          <div>
            <p className="text-sm font-medium">Allow search engine indexing</p>
            <p className="text-xs text-muted-foreground">Turn off for staging or private deployments.</p>
          </div>
          <Switch checked={form.allow_indexing} onCheckedChange={(v) => set("allow_indexing", v)} />
        </div>
        <Field label="Canonical base URL" help="Primary public URL, e.g. https://global-b2b.gulfingot.com">
          <Input value={form.canonical_base_url} onChange={(e) => set("canonical_base_url", e.target.value)} placeholder="https://example.com" />
        </Field>
        <Field label="Extra robots.txt rules" help="Appended to the generated robots.txt (one directive per line).">
          <Textarea value={form.robots_extra} onChange={(e) => set("robots_extra", e.target.value)} rows={3} placeholder={"Disallow: /admin\nDisallow: /dashboard"} />
        </Field>
      </Section>

      <Section icon={Share2} title="Social Sharing" description="How links look when shared on social platforms.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Default share image (OG image)" help="Absolute URL, 1200×630px recommended.">
            <Input value={form.og_image} onChange={(e) => set("og_image", e.target.value)} placeholder="https://.../share.png" />
          </Field>
          <Field label="Open Graph type">
            <Select value={form.og_type} onValueChange={(v) => set("og_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="website">website</SelectItem>
                <SelectItem value="article">article</SelectItem>
                <SelectItem value="product">product</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Twitter card type">
            <Select value={form.twitter_card} onValueChange={(v) => set("twitter_card", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="summary_large_image">summary_large_image</SelectItem>
                <SelectItem value="summary">summary</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Twitter / X handle" help="Include the @.">
            <Input value={form.twitter_handle} onChange={(e) => set("twitter_handle", e.target.value)} placeholder="@hive" />
          </Field>
        </div>
      </Section>

      <Section icon={BarChart3} title="Analytics &amp; Verification" description="Tracking IDs and search-console verification tokens.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Google Analytics 4 ID" help="Starts with G-">
            <Input value={form.google_analytics_id} onChange={(e) => set("google_analytics_id", e.target.value)} placeholder="G-XXXXXXX" />
          </Field>
          <Field label="Google Tag Manager ID" help="Starts with GTM-">
            <Input value={form.google_tag_manager_id} onChange={(e) => set("google_tag_manager_id", e.target.value)} placeholder="GTM-XXXXXX" />
          </Field>
          <Field label="Facebook Pixel ID">
            <Input value={form.facebook_pixel_id} onChange={(e) => set("facebook_pixel_id", e.target.value)} placeholder="0000000000" />
          </Field>
          <div />
          <Field label="Google site verification" help="Token from Google Search Console.">
            <Input value={form.google_site_verification} onChange={(e) => set("google_site_verification", e.target.value)} />
          </Field>
          <Field label="Bing site verification" help="Token from Bing Webmaster Tools.">
            <Input value={form.bing_site_verification} onChange={(e) => set("bing_site_verification", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section icon={Globe} title="Organization (Rich Results)" description="Structured data so Google can show your brand knowledge panel.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Organization name">
            <Input value={form.organization_name} onChange={(e) => set("organization_name", e.target.value)} />
          </Field>
          <Field label="Organization logo URL">
            <Input value={form.organization_logo} onChange={(e) => set("organization_logo", e.target.value)} placeholder="https://.../logo.png" />
          </Field>
        </div>
        <Field label="Social profile links" help="One URL per line (used for sameAs structured data).">
          <Textarea value={form.social_links} onChange={(e) => set("social_links", e.target.value)} rows={3} placeholder={"https://twitter.com/hive\nhttps://linkedin.com/company/hive"} />
        </Field>
      </Section>

      {catalog.length > 0 && (
        <Section
          icon={Boxes}
          title="Per-Module SEO"
          description="Override the title, description and keywords for each public-facing module. Blank fields inherit the global settings above."
        >
          {catalog.map((m) => {
            const mod = form.module_seo[m.key] ?? EMPTY_MODULE;
            return (
              <div key={m.key} className="rounded-xl border border-border/50 p-4 space-y-4 bg-background/40">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{m.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">{m.path}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Indexable</span>
                    <Switch
                      checked={mod.allow_indexing}
                      onCheckedChange={(v) => setModule(m.key, "allow_indexing", v)}
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Title" help="Composed with the global title template.">
                    <Input value={mod.title} onChange={(e) => setModule(m.key, "title", e.target.value)} placeholder={`${m.label}`} />
                  </Field>
                  <Field label="Keywords" help="Comma-separated.">
                    <Input value={mod.keywords} onChange={(e) => setModule(m.key, "keywords", e.target.value)} />
                  </Field>
                </div>
                <Field label="Meta description">
                  <Textarea value={mod.description} onChange={(e) => setModule(m.key, "description", e.target.value)} rows={2} />
                </Field>
                <Field label="Share image (OG image) URL" help="Falls back to the global share image when blank.">
                  <Input value={mod.og_image} onChange={(e) => setModule(m.key, "og_image", e.target.value)} placeholder="https://.../share.png" />
                </Field>
              </div>
            );
          })}
        </Section>
      )}

      <div className="flex justify-end">
        <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="rounded-xl">
          {mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save SEO settings
        </Button>
      </div>
    </div>
  );
}
