"use client";

import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Store,
  Loader2,
  Save,
  Plus,
  Trash2,
  Image as ImageIcon,
  X,
  Sparkles,
  RefreshCcw,
  ExternalLink,
  LayoutGrid,
  BarChart3,
  Package,
  Users,
  Quote as QuoteIcon,
  HelpCircle,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { SecureAssetImage } from "@/components/ui/secure-asset-image";
import { FileManagerClient } from "@/components/dashboard/file-manager-client";
import { usePermissions } from "@/hooks/use-permissions";
import { getAuthHeaders, getBackendApiRoot, getWorkspaceScopeKey } from "@/lib/runtime-context";
import {
  resolveLandingTemplate,
  type TenantLandingTemplate,
  type TenantB2BLanding,
  type TenantB2BStat,
  type TenantB2BCategory,
  type TenantB2BProduct,
  type TenantB2BSupplier,
  type TenantB2BTestimonial,
  type TenantB2BFaq,
} from "@/modules/tenancy/landing-template";

async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${getBackendApiRoot()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const headers: HeadersInit = getAuthHeaders(
    options.body && typeof options.body === "string" ? { "Content-Type": "application/json" } : {},
  );
  const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const p = await res.json();
      if (p?.message) message = p.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json();
}

// ── premium defaults (mirror the landing fallbacks; "Load Presets" populates these) ──
const DEFAULT_HERO = {
  badge: "Trusted by 24,000+ businesses in 184 countries",
  title: "Source globally.",
  title_highlight: "Scale confidently.",
  subtitle:
    "Connect with verified wholesale manufacturers, run competitive RFQs, and ship safely with built-in Escrow and end-to-end logistics tracking.",
  search_placeholder: "Search 10,400+ products, suppliers, MOQs…",
  trending: ["Smartphones", "Coffee Beans", "Excavators", "Workwear", "Solar Panels"],
};
const DEFAULT_STATS: TenantB2BStat[] = [
  { value: "10,400+", label: "Verified Suppliers", icon: "store" },
  { value: "$2.8B", label: "Annual GMV", icon: "dollar" },
  { value: "184", label: "Countries Served", icon: "globe" },
  { value: "99.2%", label: "On-Time Delivery", icon: "truck" },
];
const DEFAULT_CATEGORIES: TenantB2BCategory[] = [
  { name: "Electronics & Gadgets", image: "", count: "1.2k+ Products", growth: "+24%", description: "Phones, laptops, IoT and consumer electronics from audited factories.", suppliers: 482 },
  { name: "Industrial Machinery", image: "", count: "850+ Products", growth: "+11%", description: "Heavy equipment, CNC tools, and assembly line solutions.", suppliers: 217 },
  { name: "Apparel & Textiles", image: "", count: "2.5k+ Products", growth: "+38%", description: "Cut-and-sew factories, fabrics, and full-package apparel sourcing.", suppliers: 631 },
  { name: "Agriculture & Food", image: "", count: "920+ Products", growth: "+19%", description: "Single-origin coffee, spices, oilseeds, and packaged commodities.", suppliers: 308 },
];
const DEFAULT_PRODUCTS: TenantB2BProduct[] = [
  { name: "NextGen Pro Smartphone 1TB — Bulk Wholesale", price: "$450.00", moq: "50 units", image: "", supplier: "TechTronics Ltd.", rating: 4.9, reviews: 1248, location: "Shenzhen, China", badges: ["Trending", "Fast Ship"], lead_time: "7-15 days", category: "Electronics & Gadgets" },
  { name: "Premium Ethiopian Coffee — Grade 1, Single Origin", price: "$4.50 / kg", moq: "1,000 kg", image: "", supplier: "Abyssinia Roasters", rating: 5.0, reviews: 586, location: "Addis Ababa, Ethiopia", badges: ["Organic", "Fair Trade"], lead_time: "5-10 days", category: "Agriculture & Food" },
  { name: "HX-900 Industrial Excavator — 22 ton class", price: "$85,000.00", moq: "1 unit", image: "", supplier: "HeavyBuild Machineries", rating: 4.8, reviews: 312, location: "Lagos, Nigeria", badges: ["Top Rated"], lead_time: "30-45 days", category: "Industrial Machinery" },
];
const DEFAULT_SUPPLIERS: TenantB2BSupplier[] = [
  { name: "TechTronics Ltd.", country: "China", flag: "🇨🇳", rating: 4.9, years: 12, products: 1240, premium: true },
  { name: "Abyssinia Roasters", country: "Ethiopia", flag: "🇪🇹", rating: 5.0, years: 9, products: 86, premium: true },
  { name: "HeavyBuild Machineries", country: "Nigeria", flag: "🇳🇬", rating: 4.8, years: 18, products: 312, premium: false },
];
const DEFAULT_TESTIMONIALS: TenantB2BTestimonial[] = [
  { quote: "We sourced $1.2M worth of excavators in a single RFQ. The escrow protected every shipment and on-time delivery was 100%.", author: "Daniel Tesfaye", role: "Procurement Director", company: "Horn Construction Group", flag: "🇪🇹", amount: "$1.2M deal" },
  { quote: "The verified supplier badges let us skip weeks of due diligence. We've now transacted in 14 new countries without a single dispute.", author: "Fatima Al-Rashid", role: "Head of Sourcing", company: "Gulf Trade Holdings", flag: "🇦🇪", amount: "$3.4M in 90 days" },
  { quote: "Comparing quotes from 8 suppliers used to take a week. Here it takes an afternoon — and the data rooms are airtight.", author: "Marcus Williams", role: "VP Supply Chain", company: "Bluefield Imports", flag: "🇺🇸", amount: "14 countries" },
];
const DEFAULT_FAQS: TenantB2BFaq[] = [
  { question: "How does the Escrow service protect my payment?", answer: "Funds are held in a regulated escrow account until you confirm the goods match your quality, quantity, and lead-time requirements. Only then are they released to the supplier." },
  { question: "What does \"Verified Supplier\" mean?", answer: "Every supplier passes a multi-stage KYC, document, and on-site audit before they can transact on the platform." },
  { question: "Can I post a custom RFQ and get competing quotes?", answer: "Yes. Use Post Inquiry to publish a Request for Quote. Verified suppliers respond with sealed offers you can compare side-by-side." },
];
const DEFAULT_CTA = {
  badge: "Start in 60 seconds",
  title: "Ready to scale your global sourcing?",
  description: "Join 24,000+ businesses already trading with confidence. No fees to source.",
};

const VALID_TABS = ["hero", "stats", "categories", "products", "suppliers", "testimonials", "faqs", "cta"];

export default function B2BLandingEditor() {
  const queryClient = useQueryClient();
  const { hasAnyPermission, hasPermission } = usePermissions();
  const canBrowseAssets = hasAnyPermission(["view_storage", "manage_storage"]);
  const canManageStorage = hasPermission("manage_storage");
  const workspaceScope = getWorkspaceScopeKey();

  const [currentTemplate, setCurrentTemplate] = useState<TenantLandingTemplate | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState("hero");

  // section state
  const [hero, setHero] = useState({ ...DEFAULT_HERO });
  const [stats, setStats] = useState<TenantB2BStat[]>([]);
  const [categories, setCategories] = useState<TenantB2BCategory[]>([]);
  const [productList, setProductList] = useState<TenantB2BProduct[]>([]);
  const [suppliers, setSuppliers] = useState<TenantB2BSupplier[]>([]);
  const [testimonials, setTestimonials] = useState<TenantB2BTestimonial[]>([]);
  const [faqs, setFaqs] = useState<TenantB2BFaq[]>([]);
  const [cta, setCta] = useState({ ...DEFAULT_CTA });

  // media picker — targets: "category_<i>", "product_<i>"
  const [mediaTarget, setMediaTarget] = useState<string | null>(null);

  // tab persistence
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    const stored = window.localStorage.getItem("b2b-landing-active-tab");
    const initial = fromUrl && VALID_TABS.includes(fromUrl) ? fromUrl : stored && VALID_TABS.includes(stored) ? stored : "hero";
    setActiveTab(initial);
  }, []);
  const onTab = (tab: string) => {
    setActiveTab(tab);
    try {
      window.localStorage.setItem("b2b-landing-active-tab", tab);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* ignore */
    }
  };

  const { data: queryData, isLoading, isError, refetch } = useQuery({
    queryKey: ["b2b", "landing-settings", workspaceScope],
    queryFn: () => apiFetch("/settings/landing"),
    throwOnError: false,
    retry: 1,
  });

  const applyB2b = (b2b: TenantB2BLanding | undefined) => {
    setHero({ ...DEFAULT_HERO, ...(b2b?.hero ?? {}), trending: b2b?.hero?.trending?.length ? b2b.hero.trending : DEFAULT_HERO.trending });
    setStats(b2b?.stats?.length ? b2b.stats : DEFAULT_STATS);
    setCategories(b2b?.categories?.length ? b2b.categories : DEFAULT_CATEGORIES);
    setProductList(b2b?.products?.length ? b2b.products : DEFAULT_PRODUCTS);
    setSuppliers(b2b?.suppliers?.length ? b2b.suppliers : DEFAULT_SUPPLIERS);
    setTestimonials(b2b?.testimonials?.length ? b2b.testimonials : DEFAULT_TESTIMONIALS);
    setFaqs(b2b?.faqs?.length ? b2b.faqs : DEFAULT_FAQS);
    setCta({ ...DEFAULT_CTA, ...(b2b?.cta ?? {}) });
  };

  useEffect(() => {
    if (!queryData?.data) return;
    const tpl = resolveLandingTemplate(queryData.data.landing_page_template ?? {});
    setCurrentTemplate(tpl);
    applyB2b(tpl.b2b);
    setIsDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const nextB2b: TenantB2BLanding = {
        ...(currentTemplate?.b2b ?? {}),
        hero: { ...hero, trending: hero.trending.map((s) => s.trim()).filter(Boolean) },
        stats: stats.filter((s) => s.value.trim() && s.label.trim()),
        categories: categories.filter((c) => c.name.trim()),
        products: productList.filter((p) => p.name.trim()),
        suppliers: suppliers.filter((s) => s.name.trim()),
        testimonials: testimonials.filter((tm) => tm.quote.trim() && tm.author.trim()),
        faqs: faqs.filter((f) => f.question.trim() && f.answer.trim()),
        cta,
      };
      const nextTemplate = { ...currentTemplate, b2b: nextB2b };
      return apiFetch("/settings/landing", {
        method: "POST",
        body: JSON.stringify({
          business_type: queryData?.data?.business_type,
          landing_page_template: nextTemplate,
        }),
      });
    },
    onSuccess: (resp: { data?: { landing_page_template?: unknown } }) => {
      const tpl = resolveLandingTemplate(resp?.data?.landing_page_template ?? currentTemplate);
      setCurrentTemplate(tpl);
      applyB2b(tpl.b2b);
      queryClient.invalidateQueries({ queryKey: ["b2b", "landing-settings"] });
      queryClient.invalidateQueries({ queryKey: ["tenantPublicLanding"] });
      toast.success("Marketplace landing saved!");
      setIsDirty(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to save."),
  });

  const loadPresets = () => {
    if (confirm("Load the premium marketplace presets? This replaces the current content in every tab.")) {
      applyB2b(undefined);
      setIsDirty(true);
      toast.success("Presets loaded — tweak and Save Changes to publish.");
    }
  };

  const handleFileSelect = (file: { media_details?: { public_url?: string; url?: string }; url?: string; path?: string }) => {
    const url = file.media_details?.public_url || file.media_details?.url || file.url || file.path || "";
    if (mediaTarget?.startsWith("category_")) {
      const i = Number(mediaTarget.replace("category_", ""));
      setCategories((prev) => prev.map((c, idx) => (idx === i ? { ...c, image: url } : c)));
      setIsDirty(true);
    } else if (mediaTarget?.startsWith("product_")) {
      const i = Number(mediaTarget.replace("product_", ""));
      setProductList((prev) => prev.map((p, idx) => (idx === i ? { ...p, image: url } : p)));
      setIsDirty(true);
    }
    setMediaTarget(null);
    toast.success("Image selected");
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 flex-col">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Loading marketplace landing…</p>
      </div>
    );
  }

  const fieldLabel = "text-xs font-black uppercase tracking-wide text-muted-foreground";

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-rose-500 shadow-lg shadow-primary/30">
            <Store className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Marketplace Landing</h1>
            <p className="text-muted-foreground text-sm">Edit every section of your B2B landing page.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isError && (
            <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-full gap-1.5">
              <RefreshCcw className="h-3.5 w-3.5" /> Retry
            </Button>
          )}
          <Button onClick={loadPresets} variant="outline" size="sm" className="rounded-full gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Load Presets
          </Button>
          <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground border rounded-full px-3 py-1.5 transition-colors">
            <ExternalLink className="h-3 w-3" /> View Live
          </a>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending}
            className="rounded-full px-6 gap-2 bg-gradient-to-r from-primary to-rose-500 text-white shadow-lg shadow-primary/25 disabled:opacity-50"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isDirty ? "Save Changes" : "Saved"}
          </Button>
        </div>
      </div>

      {isDirty && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 text-amber-700 dark:text-amber-400">
          <Sparkles className="h-4 w-4 shrink-0" />
          <p className="text-sm font-medium">Unsaved changes — click <strong>Save Changes</strong> to publish.</p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={onTab} className="w-full">
        <TabsList className="flex w-full flex-wrap h-auto gap-1 mb-6 justify-start">
          <TabsTrigger value="hero" className="gap-1.5"><Megaphone className="h-3.5 w-3.5" /> 1. Hero</TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> 2. Stats</TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> 3. Categories</TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5"><Package className="h-3.5 w-3.5" /> 4. Products</TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-1.5"><Users className="h-3.5 w-3.5" /> 5. Suppliers</TabsTrigger>
          <TabsTrigger value="testimonials" className="gap-1.5"><QuoteIcon className="h-3.5 w-3.5" /> 6. Testimonials</TabsTrigger>
          <TabsTrigger value="faqs" className="gap-1.5"><HelpCircle className="h-3.5 w-3.5" /> 7. FAQs</TabsTrigger>
          <TabsTrigger value="cta" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> 8. CTA</TabsTrigger>
        </TabsList>

        {/* HERO */}
        <TabsContent value="hero" className="outline-none">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
            <h2 className="text-lg font-bold">Hero Section</h2>
            <div className="space-y-2">
              <Label className={fieldLabel}>Top Badge</Label>
              <Input value={hero.badge} onChange={(e) => { setHero({ ...hero, badge: e.target.value }); setIsDirty(true); }} maxLength={90} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className={fieldLabel}>Title (line 1)</Label>
                <Input value={hero.title} onChange={(e) => { setHero({ ...hero, title: e.target.value }); setIsDirty(true); }} maxLength={50} />
              </div>
              <div className="space-y-2">
                <Label className={fieldLabel}>Title Highlight (gradient line 2)</Label>
                <Input value={hero.title_highlight} onChange={(e) => { setHero({ ...hero, title_highlight: e.target.value }); setIsDirty(true); }} maxLength={50} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className={fieldLabel}>Subtitle</Label>
              <Textarea rows={2} value={hero.subtitle} onChange={(e) => { setHero({ ...hero, subtitle: e.target.value }); setIsDirty(true); }} maxLength={240} />
            </div>
            <div className="space-y-2">
              <Label className={fieldLabel}>Search Placeholder</Label>
              <Input value={hero.search_placeholder} onChange={(e) => { setHero({ ...hero, search_placeholder: e.target.value }); setIsDirty(true); }} maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label className={fieldLabel}>Trending Tags <span className="normal-case font-normal opacity-60">(comma separated)</span></Label>
              <Input
                value={hero.trending.join(", ")}
                onChange={(e) => { setHero({ ...hero, trending: e.target.value.split(",").map((s) => s.trimStart()) }); setIsDirty(true); }}
                placeholder="Smartphones, Coffee Beans, Excavators"
              />
            </div>
          </div>
        </TabsContent>

        {/* STATS */}
        <TabsContent value="stats" className="outline-none">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-lg font-bold">Stats Band</h2>
              <p className="text-muted-foreground text-xs">Four trust metrics under the hero. Icon options: store, dollar, globe, truck, users, shield, trending, chart.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="p-5 border rounded-xl bg-background/50 space-y-3">
                  <Badge variant="outline" className="font-bold text-xs uppercase tracking-widest text-primary bg-primary/5 border-primary/20">Stat 0{i + 1}</Badge>
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Value</Label>
                    <Input placeholder="10,400+" value={stats[i]?.value || ""} onChange={(e) => { const n = [...stats]; if (!n[i]) n[i] = { value: "", label: "" }; n[i] = { ...n[i], value: e.target.value }; setStats(n); setIsDirty(true); }} maxLength={12} /></div>
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Label</Label>
                    <Input placeholder="Verified Suppliers" value={stats[i]?.label || ""} onChange={(e) => { const n = [...stats]; if (!n[i]) n[i] = { value: "", label: "" }; n[i] = { ...n[i], label: e.target.value }; setStats(n); setIsDirty(true); }} maxLength={30} /></div>
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Icon</Label>
                    <Input placeholder="store" value={stats[i]?.icon || ""} onChange={(e) => { const n = [...stats]; if (!n[i]) n[i] = { value: "", label: "" }; n[i] = { ...n[i], icon: e.target.value }; setStats(n); setIsDirty(true); }} maxLength={16} /></div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* CATEGORIES */}
        <TabsContent value="categories" className="outline-none">
          <ArrayCardSection
            title="Sourcing Categories"
            subtitle="The industry cards. Each links the search filter to that category."
            items={categories}
            blank={{ name: "", image: "", count: "", growth: "", description: "", suppliers: 0 }}
            onChange={(next) => { setCategories(next); setIsDirty(true); }}
            max={8}
            render={(c, i, update) => (
              <>
                <ImagePick label="Image" url={c.image} onPick={() => setMediaTarget(`category_${i}`)} onClear={() => update({ ...c, image: "" })} />
                <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Name</Label>
                  <Input value={c.name} onChange={(e) => update({ ...c, name: e.target.value })} maxLength={40} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Count</Label>
                    <Input placeholder="1.2k+ Products" value={c.count || ""} onChange={(e) => update({ ...c, count: e.target.value })} maxLength={20} /></div>
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Growth</Label>
                    <Input placeholder="+24%" value={c.growth || ""} onChange={(e) => update({ ...c, growth: e.target.value })} maxLength={10} /></div>
                </div>
                <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Suppliers count</Label>
                  <Input type="number" value={c.suppliers ?? 0} onChange={(e) => update({ ...c, suppliers: Number(e.target.value) })} /></div>
                <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Description</Label>
                  <Textarea rows={2} value={c.description || ""} onChange={(e) => update({ ...c, description: e.target.value })} maxLength={140} /></div>
              </>
            )}
          />
        </TabsContent>

        {/* PRODUCTS */}
        <TabsContent value="products" className="outline-none">
          <ArrayCardSection
            title="Featured Products"
            subtitle="Showcase wholesale deals. Buyers can Contact / request a Quote on each."
            items={productList}
            blank={{ name: "", price: "", moq: "", image: "", supplier: "", rating: 5, reviews: 0, location: "", badges: [], lead_time: "", category: "" }}
            onChange={(next) => { setProductList(next); setIsDirty(true); }}
            max={12}
            render={(p, i, update) => (
              <>
                <ImagePick label="Image" url={p.image} onPick={() => setMediaTarget(`product_${i}`)} onClear={() => update({ ...p, image: "" })} />
                <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Product Name</Label>
                  <Input value={p.name} onChange={(e) => update({ ...p, name: e.target.value })} maxLength={90} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">FOB Price</Label>
                    <Input placeholder="$450.00" value={p.price || ""} onChange={(e) => update({ ...p, price: e.target.value })} maxLength={20} /></div>
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">MOQ</Label>
                    <Input placeholder="50 units" value={p.moq || ""} onChange={(e) => update({ ...p, moq: e.target.value })} maxLength={20} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Supplier</Label>
                    <Input value={p.supplier || ""} onChange={(e) => update({ ...p, supplier: e.target.value })} maxLength={40} /></div>
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Category</Label>
                    <Input placeholder="Electronics & Gadgets" value={p.category || ""} onChange={(e) => update({ ...p, category: e.target.value })} maxLength={40} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Location</Label>
                    <Input placeholder="Shenzhen, China" value={p.location || ""} onChange={(e) => update({ ...p, location: e.target.value })} maxLength={40} /></div>
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Lead Time</Label>
                    <Input placeholder="7-15 days" value={p.lead_time || ""} onChange={(e) => update({ ...p, lead_time: e.target.value })} maxLength={20} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Rating</Label>
                    <Input type="number" step="0.1" min="0" max="5" value={p.rating ?? 5} onChange={(e) => update({ ...p, rating: Number(e.target.value) })} /></div>
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Reviews</Label>
                    <Input type="number" value={p.reviews ?? 0} onChange={(e) => update({ ...p, reviews: Number(e.target.value) })} /></div>
                </div>
                <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Badges <span className="normal-case font-normal opacity-60">(comma sep: Trending, Organic, Hot, OEM…)</span></Label>
                  <Input value={(p.badges || []).join(", ")} onChange={(e) => update({ ...p, badges: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
              </>
            )}
          />
        </TabsContent>

        {/* SUPPLIERS */}
        <TabsContent value="suppliers" className="outline-none">
          <ArrayCardSection
            title="Top Suppliers"
            subtitle="Verified partner directory cards."
            items={suppliers}
            blank={{ name: "", country: "", flag: "", rating: 5, years: 0, products: 0, premium: false }}
            onChange={(next) => { setSuppliers(next); setIsDirty(true); }}
            max={9}
            render={(s, i, update) => (
              <>
                <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Supplier Name</Label>
                  <Input value={s.name} onChange={(e) => update({ ...s, name: e.target.value })} maxLength={40} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Country</Label>
                    <Input value={s.country || ""} onChange={(e) => update({ ...s, country: e.target.value })} maxLength={30} /></div>
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Flag emoji</Label>
                    <Input placeholder="🇪🇹" value={s.flag || ""} onChange={(e) => update({ ...s, flag: e.target.value })} maxLength={6} /></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Rating</Label>
                    <Input type="number" step="0.1" min="0" max="5" value={s.rating ?? 5} onChange={(e) => update({ ...s, rating: Number(e.target.value) })} /></div>
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Years</Label>
                    <Input type="number" value={s.years ?? 0} onChange={(e) => update({ ...s, years: Number(e.target.value) })} /></div>
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Products</Label>
                    <Input type="number" value={s.products ?? 0} onChange={(e) => update({ ...s, products: Number(e.target.value) })} /></div>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium pt-1">
                  <input type="checkbox" checked={!!s.premium} onChange={(e) => update({ ...s, premium: e.target.checked })} className="h-4 w-4 accent-primary" />
                  Premium supplier (gold badge)
                </label>
              </>
            )}
          />
        </TabsContent>

        {/* TESTIMONIALS */}
        <TabsContent value="testimonials" className="outline-none">
          <ArrayCardSection
            title="Buyer Testimonials"
            subtitle="Social proof quotes."
            items={testimonials}
            blank={{ quote: "", author: "", role: "", company: "", flag: "", amount: "" }}
            onChange={(next) => { setTestimonials(next); setIsDirty(true); }}
            max={6}
            render={(tm, i, update) => (
              <>
                <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Quote</Label>
                  <Textarea rows={3} value={tm.quote} onChange={(e) => update({ ...tm, quote: e.target.value })} maxLength={280} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Author</Label>
                    <Input value={tm.author} onChange={(e) => update({ ...tm, author: e.target.value })} maxLength={40} /></div>
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Flag emoji</Label>
                    <Input value={tm.flag || ""} onChange={(e) => update({ ...tm, flag: e.target.value })} maxLength={6} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Role</Label>
                    <Input value={tm.role || ""} onChange={(e) => update({ ...tm, role: e.target.value })} maxLength={40} /></div>
                  <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Company</Label>
                    <Input value={tm.company || ""} onChange={(e) => update({ ...tm, company: e.target.value })} maxLength={40} /></div>
                </div>
                <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Deal amount tag</Label>
                  <Input placeholder="$1.2M deal" value={tm.amount || ""} onChange={(e) => update({ ...tm, amount: e.target.value })} maxLength={30} /></div>
              </>
            )}
          />
        </TabsContent>

        {/* FAQS */}
        <TabsContent value="faqs" className="outline-none">
          <ArrayCardSection
            title="FAQ"
            subtitle="Buyer questions in the FAQ accordion."
            items={faqs}
            blank={{ question: "", answer: "" }}
            onChange={(next) => { setFaqs(next); setIsDirty(true); }}
            max={10}
            render={(f, i, update) => (
              <>
                <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Question</Label>
                  <Input value={f.question} onChange={(e) => update({ ...f, question: e.target.value })} maxLength={140} /></div>
                <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Answer</Label>
                  <Textarea rows={3} value={f.answer} onChange={(e) => update({ ...f, answer: e.target.value })} maxLength={500} /></div>
              </>
            )}
          />
        </TabsContent>

        {/* CTA */}
        <TabsContent value="cta" className="outline-none">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
            <h2 className="text-lg font-bold">Final Call-To-Action</h2>
            <div className="space-y-2"><Label className={fieldLabel}>Badge</Label>
              <Input value={cta.badge} onChange={(e) => { setCta({ ...cta, badge: e.target.value }); setIsDirty(true); }} maxLength={40} /></div>
            <div className="space-y-2"><Label className={fieldLabel}>Title</Label>
              <Input value={cta.title} onChange={(e) => { setCta({ ...cta, title: e.target.value }); setIsDirty(true); }} maxLength={70} /></div>
            <div className="space-y-2"><Label className={fieldLabel}>Description</Label>
              <Textarea rows={2} value={cta.description} onChange={(e) => { setCta({ ...cta, description: e.target.value }); setIsDirty(true); }} maxLength={180} /></div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Media picker */}
      <Dialog open={mediaTarget !== null} onOpenChange={(o) => { if (!o) setMediaTarget(null); }}>
        <DialogContent className="flex h-[80vh] max-w-[1000px] flex-col p-0 overflow-hidden rounded-[2rem]">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <DialogTitle>Media Library</DialogTitle>
              <DialogDescription>Select an image for this card.</DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setMediaTarget(null)} className="rounded-full"><X className="h-4 w-4" /></Button>
          </div>
          <div className="relative flex-1 overflow-hidden">
            <FileManagerClient isPickerMode onFileSelect={handleFileSelect} access={{ canRead: canBrowseAssets, canManage: canManageStorage }} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── reusable array editor with add/remove + per-item render ── */
function ArrayCardSection<T>({
  title,
  subtitle,
  items,
  blank,
  onChange,
  render,
  max = 10,
}: {
  title: string;
  subtitle: string;
  items: T[];
  blank: T;
  onChange: (next: T[]) => void;
  render: (item: T, index: number, update: (next: T) => void) => React.ReactNode;
  max?: number;
}) {
  const update = (i: number, next: T) => onChange(items.map((it, idx) => (idx === i ? next : it)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, JSON.parse(JSON.stringify(blank))]);
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        </div>
        <Button type="button" size="sm" disabled={items.length >= max} onClick={add} className="rounded-full gap-1.5 bg-gradient-to-r from-primary to-rose-500 text-white border-none shadow-md shadow-primary/20">
          <Plus className="h-3.5 w-3.5" /> Add {items.length >= max ? `(max ${max})` : ""}
        </Button>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item, i) => (
          <div key={i} className="relative p-5 border rounded-xl bg-background/50 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="font-bold text-xs uppercase tracking-widest text-primary bg-primary/5 border-primary/20">#{i + 1}</Badge>
              <Button type="button" variant="outline" size="sm" onClick={() => remove(i)} className="h-7 w-7 p-0 text-rose-500 border-rose-200 bg-rose-50 hover:bg-rose-100 dark:text-rose-400 dark:border-rose-800 dark:bg-rose-950/40 rounded-lg" title="Remove">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {render(item, i, (next) => update(i, next))}
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 h-32 gap-2 text-muted-foreground/50">
            <Plus className="h-7 w-7" />
            <p className="text-sm font-medium">Nothing yet — click Add.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── image picker field ── */
function ImagePick({ label, url, onPick, onClear }: { label: string; url?: string; onPick: () => void; onClear: () => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold text-muted-foreground">{label}</Label>
      <div className="relative h-28 rounded-xl overflow-hidden border bg-gradient-to-br from-muted/40 to-muted/10 group">
        {url ? (
          <>
            <SecureAssetImage src={url} alt={label} className="w-full h-full object-cover object-center" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button type="button" variant="secondary" size="sm" onClick={onPick} className="rounded-full text-xs shadow-lg">Change</Button>
              <Button type="button" variant="destructive" size="sm" onClick={onClear} className="rounded-full text-xs shadow-lg">Remove</Button>
            </div>
          </>
        ) : (
          <button type="button" onClick={onPick} className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-muted-foreground/50 hover:text-primary transition-colors">
            <ImageIcon className="h-6 w-6" />
            <span className="text-[10px] font-medium">Choose image</span>
          </button>
        )}
      </div>
    </div>
  );
}
