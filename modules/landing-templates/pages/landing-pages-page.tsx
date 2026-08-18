"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Armchair,
  BadgeCheck,
  CheckCircle2,
  Code2,
  Coffee,
  Droplets,
  ExternalLink,
  Eye,
  Globe,
  GraduationCap,
  Home,
  Hotel,
  LayoutDashboard,
  LayoutTemplate,
  Loader2,
  Lock,
  Music,
  Palette,
  Search,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Sprout,
  Star,
  Stethoscope,
  Store,
  Truck,
  UtensilsCrossed,
  Wine,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getBackendOrigin, isTenantSession } from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import { fetchAvailableTemplates, selectTemplate, type TemplateLibraryCard } from "../lib/api";
import { TemplatePreviewDialog } from "../components/template-preview-dialog";

const frameworkLabel: Record<string, string> = {
  "static-html": "Static HTML",
  "html-css-js": "HTML + CSS + JS",
  react: "React",
  nextjs: "Next.js",
};

const frameworkOptions = [
  { value: "all", label: "All frameworks" },
  { value: "static-html", label: "Static HTML" },
  { value: "html-css-js", label: "HTML + CSS + JS" },
  { value: "react", label: "React" },
  { value: "nextjs", label: "Next.js" },
];

const businessIcon: Record<string, typeof Globe> = {
  "layout-dashboard": LayoutDashboard,
  "code-2": Code2,
  store: Store,
  "utensils-crossed": UtensilsCrossed,
  music: Music,
  wine: Wine,
  coffee: Coffee,
  armchair: Armchair,
  hotel: Hotel,
  stethoscope: Stethoscope,
  truck: Truck,
  droplets: Droplets,
  sprout: Sprout,
  "shopping-bag": ShoppingBag,
  "graduation-cap": GraduationCap,
};

export default function LandingPagesPage() {
  const [templates, setTemplates] = React.useState<TemplateLibraryCard[]>([]);
  const [businessLabel, setBusinessLabel] = React.useState("your business");
  const [businessMeta, setBusinessMeta] = React.useState<{ label: string; description: string; icon: string } | null>(null);
  const [recommendedId, setRecommendedId] = React.useState<number | null>(null);
  const [current, setCurrent] = React.useState<{ template_id: number | null; status: string } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selecting, setSelecting] = React.useState<number | null>(null);
  const [previewing, setPreviewing] = React.useState<TemplateLibraryCard | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Marketplace filters
  const [query, setQuery] = React.useState("");
  const [premiumOnly, setPremiumOnly] = React.useState(false);
  const [framework, setFramework] = React.useState("all");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await fetchAvailableTemplates();
      setTemplates(data.templates);
      setBusinessLabel(data.business_type_meta?.label ?? "your business");
      setBusinessMeta(data.business_type_meta ?? null);
      setRecommendedId(data.recommended_template_id ?? null);
      setCurrent(data.current ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load available templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!isTenantSession()) return;
    void load();
  }, [load]);

  const choose = async (template: TemplateLibraryCard) => {
    setSelecting(template.id);
    setError(null);
    setNotice(null);
    try {
      const { message } = await selectTemplate(template.id);
      setCurrent({ template_id: template.id, status: "draft" });
      setNotice(message);
      setPreviewing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Selection failed.");
    } finally {
      setSelecting(null);
    }
  };

  const recommended = templates.find((t) => t.id === recommendedId) ?? null;

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    return templates.filter((t) => {
      if (premiumOnly && !t.is_premium) return false;
      if (framework !== "all" && t.source_framework !== framework) return false;
      if (q) {
        const haystack = [t.name, t.description ?? "", ...(t.business_types ?? []), ...(t.tags ?? [])]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [framework, premiumOnly, query, templates]);

  if (!isTenantSession()) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
          <ShieldAlert className="h-10 w-10 text-amber-500" />
        </div>
        <h2 className="font-space text-2xl font-black uppercase tracking-tight text-foreground">Tenant workspace only</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Landing Pages is available inside a tenant workspace. Central administrators use the Landing Library instead.
        </p>
        <Button asChild variant="outline" className="rounded-xl">
          <Link href="/dashboard/landing-library">Open Landing Library</Link>
        </Button>
      </div>
    );
  }

  const Icon = businessMeta?.icon ? (businessIcon[businessMeta.icon] ?? Globe) : Globe;

  return (
    <div className="space-y-6">
      <div className="mb-4 flex w-full items-center justify-end gap-3">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <Home className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <span className="text-xs text-border">/</span>
        <span className="text-xs font-semibold text-foreground">Template Marketplace</span>
      </div>

      {/* Hero — business-type recommendation */}
      <div className="overflow-hidden rounded-[2rem] border border-border/50 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_32%),linear-gradient(145deg,rgba(15,23,42,0.02),rgba(15,23,42,0.09))] p-6 shadow-sm backdrop-blur-md">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Template Marketplace</p>
                <h2 className="flex items-center gap-2 text-2xl font-space font-black tracking-tight text-foreground">
                  Templates for <span className="text-primary">{businessLabel}</span>
                </h2>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {businessMeta?.description ??
                `Browse curated templates for ${businessLabel}, preview each one live, then pick the design that fits. Customize and publish from Settings — no code required.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {current ? (
              <Badge
                variant="outline"
                className={cn(
                  "border-transparent",
                  current.status === "published"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                )}
              >
                {current.status === "published" ? "Published" : "Draft"}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-border/60 text-muted-foreground">No template selected</Badge>
            )}
            <Button asChild variant="outline" className="gap-2 rounded-xl border-border/60 bg-background/70">
              <Link href="/dashboard/settings?tab=landing">
                <Palette className="h-4 w-4" />
                Customize (Settings)
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Recommended pick */}
      {recommended && (
        <div className="overflow-hidden rounded-[2rem] border border-primary/25 bg-[radial-gradient(circle_at_85%_10%,rgba(16,185,129,0.16),transparent_40%)] shadow-sm">
          <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="relative min-h-[220px]">
              {recommended.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${getBackendOrigin()}${recommended.thumbnail}`}
                  alt={recommended.name}
                  className="absolute inset-0 h-full w-full object-cover object-top"
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(circle at 20% 20%, ${recommended.preview?.theme?.accent_soft ?? "#ccfbf1"}55, transparent 60%), linear-gradient(135deg, ${recommended.preview?.theme?.surface ?? "#0f172a"}, ${recommended.preview?.theme?.accent ?? "#0f766e"}22)`,
                  }}
                />
              )}
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/25 bg-black/40 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white backdrop-blur-sm">
                <Star className="h-3 w-3 text-amber-400" /> Recommended for {businessLabel}
              </div>
              {recommended.is_premium && (
                <div className="absolute right-3 top-3">
                  <Badge className="border-transparent bg-amber-500/90 text-white">
                    <Lock className="mr-1 h-3 w-3" /> Premium
                  </Badge>
                </div>
              )}
            </div>
            <div className="flex flex-col justify-center gap-3 p-6">
              <div>
                <h3 className="font-space text-xl font-black tracking-tight text-foreground">{recommended.name}</h3>
                <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-muted-foreground">{recommended.description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="border-border/60 bg-background/60 text-muted-foreground">
                  {frameworkLabel[recommended.source_framework] ?? recommended.source_framework}
                </Badge>
                <Badge variant="outline" className="border-border/60 bg-background/60 text-muted-foreground">
                  v{recommended.current_version}
                </Badge>
                <Badge variant="outline" className="border-border/60 bg-background/60 text-muted-foreground">
                  {recommended.compatibility_score}% compat
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                <Button className="h-10 gap-2 rounded-xl" onClick={() => setPreviewing(recommended)}>
                  <Eye className="h-4 w-4" /> Live preview
                </Button>
                <Button
                  variant="outline"
                  className="h-10 gap-2 rounded-xl border-border/60 bg-background/70"
                  disabled={selecting === recommended.id || current?.template_id === recommended.id}
                  onClick={() => void choose(recommended)}
                >
                  {selecting === recommended.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {current?.template_id === recommended.id ? "Active" : "Use this template"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Marketplace toolbar */}
      <div className="flex flex-col gap-3 rounded-[1.5rem] border border-border/50 bg-card/40 p-3 backdrop-blur-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search templates for ${businessLabel}…`}
            className="h-10 rounded-xl border-border/60 bg-background/70 pl-9"
          />
        </div>
        <Select value={framework} onValueChange={setFramework}>
          <SelectTrigger className="h-10 w-full rounded-xl border-border/60 bg-background/70 sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {frameworkOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={premiumOnly ? "default" : "outline"}
          className="h-10 gap-2 rounded-xl"
          onClick={() => setPremiumOnly((v) => !v)}
        >
          <Lock className="h-4 w-4" />
          {premiumOnly ? "Premium only" : "All templates"}
        </Button>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-[1.75rem]" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[2rem] border border-dashed border-border/60 py-20 text-center">
          <LayoutTemplate className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-semibold text-foreground">No templates are available for {businessLabel} yet</p>
          <p className="max-w-md text-xs leading-5 text-muted-foreground">
            Your subscription&apos;s business category has no published templates assigned yet. Ask your platform administrator
            to assign templates to the <span className="font-semibold">{businessLabel}</span> category.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[2rem] border border-dashed border-border/60 py-16 text-center">
          <Search className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-semibold text-foreground">No templates match your filters</p>
          <p className="max-w-md text-xs leading-5 text-muted-foreground">Try clearing the search or switching frameworks.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((template) => {
            const isActive = current?.template_id === template.id;
            const isRecommended = template.id === recommendedId;
            return (
              <Card key={template.id} className={cn("group relative overflow-hidden rounded-[1.75rem] border-border/50 shadow-sm", isActive && "border-primary/50 ring-2 ring-primary/20")}>
                <div className="relative flex h-24 items-end p-3">
                  {template.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${getBackendOrigin()}${template.thumbnail}`}
                      alt={template.name}
                      className="absolute inset-0 h-full w-full rounded-t-[1.75rem] object-cover object-top"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `radial-gradient(circle at 20% 20%, ${template.preview?.theme?.accent_soft ?? "#ccfbf1"}55, transparent 60%), linear-gradient(135deg, ${template.preview?.theme?.surface ?? "#0f172a"}, ${template.preview?.theme?.accent ?? "#0f766e"}22)`,
                      }}
                    />
                  )}
                  <p className="relative line-clamp-1 rounded-lg border border-white/20 bg-black/25 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    {template.preview?.hero?.title ? String(template.preview.hero.title).slice(0, 40) : template.name}
                  </p>
                  {isRecommended && (
                    <div className="absolute right-2 top-2">
                      <Badge className="border-transparent bg-black/50 text-amber-300 backdrop-blur-sm">
                        <Star className="mr-1 h-3 w-3" /> Recommended
                      </Badge>
                    </div>
                  )}
                </div>
                <CardHeader className="p-4 pb-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate font-space text-base font-black tracking-tight text-foreground">{template.name}</h3>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {template.is_premium && (
                        <Badge className="border-transparent bg-amber-500/90 text-white">
                          <Lock className="mr-1 h-3 w-3" /> Premium
                        </Badge>
                      )}
                      {isActive && <Badge className="border-transparent bg-emerald-500/90 text-white">Selected</Badge>}
                    </div>
                  </div>
                  <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{template.description}</p>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5 p-4 pt-2">
                  <Badge variant="outline" className="border-border/60 bg-background/60 text-muted-foreground">
                    {frameworkLabel[template.source_framework] ?? template.source_framework}
                  </Badge>
                  <Badge variant="outline" className="border-border/60 bg-background/60 text-muted-foreground">v{template.current_version}</Badge>
                  <Badge variant="outline" className="border-border/60 bg-background/60 text-muted-foreground">
                    {template.compatibility_score}% compat
                  </Badge>
                </CardContent>
                <CardFooter className="flex gap-2 p-4 pt-0">
                  <Button
                    variant="outline"
                    className="h-9 flex-1 gap-2 rounded-xl border-border/60 bg-background/70"
                    onClick={() => setPreviewing(template)}
                  >
                    <Eye className="h-4 w-4" /> Preview
                  </Button>
                  <Button
                    onClick={() => void choose(template)}
                    disabled={selecting === template.id || isActive}
                    className="h-9 flex-1 gap-2 rounded-xl"
                  >
                    {selecting === template.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {isActive ? "Active" : "Use this"}
                  </Button>
                  {isActive && (
                    <Button asChild variant="outline" size="icon" className="h-9 w-9 rounded-xl" title="View live site">
                      <Link href="/">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
          Previews render the real template in a sandboxed browser before you commit.
        </span>
        <span className="flex items-center gap-1.5">
          <ArrowUpRight className="h-3.5 w-3.5" />
          After selecting, open <span className="font-semibold text-foreground">Settings → Landing Page</span> to edit, then publish.
        </span>
      </div>

      <TemplatePreviewDialog
        template={previewing}
        businessLabel={businessLabel}
        busy={selecting !== null}
        onOpenChange={(open) => !open && setPreviewing(null)}
        onChoose={(t) => void choose(t)}
      />
    </div>
  );
}
