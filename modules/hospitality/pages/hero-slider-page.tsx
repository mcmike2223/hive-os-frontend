"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GalleryHorizontalEnd,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Image as ImageIcon,
  X,
  Save,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  RefreshCcw,
  ExternalLink,
  Box,
  BarChart3,
  Quote,
  HelpCircle,
  ConciergeBell,
  Images,
  Wine,
  Sofa,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SecureAssetImage } from "@/components/ui/secure-asset-image";
import { FileManagerClient } from "@/components/dashboard/file-manager-client";
import { usePermissions } from "@/hooks/use-permissions";
import { getAuthHeaders, getBackendApiRoot } from "@/lib/runtime-context";
import {
  resolveLandingTemplate,
  resolveBusinessTypeCatalog,
  FALLBACK_TENANT_BUSINESS_TYPES,
  type TenantLandingHeroSlide,
  type TenantBusinessTypeDefinition,
  type TenantLandingTemplate,
  type TenantLandingCard,
  type TenantLandingMenus,
  type TenantLandingStat,
  type TenantLandingTestimonial,
  type TenantLandingServiceCard,
  type TenantLandingServicesSection,
  type TenantLandingFaq,
  type TenantLandingGallery,
  type TenantLandingCellar,
  type TenantLandingExperience,
  type TenantLandingLocationInfo,
  type TenantLandingGuestlist,
} from "@/modules/tenancy/landing-template";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  fetchHospitalityMenuItems,
  updateHospitalityMenuItem,
  deleteHospitalityMenuItem,
} from "@/modules/hospitality/api";
import type { HospitalityMenuItem } from "@/modules/hospitality/types";

// ─── helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${getBackendApiRoot()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const headers: HeadersInit = getAuthHeaders(
    options.body && typeof options.body === "string" ? { "Content-Type": "application/json" } : {},
  );

  const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;
    try {
      const payload = await response.json();
      if (payload?.message) message = payload.message;
    } catch {
      /* keep fallback */
    }
    throw new Error(message);
  }

  return response.json();
}

// ─── blank slide factory ───────────────────────────────────────────────────────

const blankSlide = (): TenantLandingHeroSlide => ({
  image: "",
  title: "",
  subtitle: "",
  badge: "",
});

const PRESET_SLIDES: TenantLandingHeroSlide[] = [
  {
    image: "",
    title: "Feel the Night Energy.",
    subtitle: "Step into Addis Ababa's premier luxury lounge. Unwind with artisanal mixology, live beats, and a vibrant crowd.",
    badge: "The Ultimate Nightlife Destination",
  },
  {
    image: "",
    title: "Exquisite VIP Lounges.",
    subtitle: "Indulge in premium bottle service, private tables, and a bespoke sensory experience tailored for the elite.",
    badge: "Exclusive VIP Experience",
  },
  {
    image: "",
    title: "Palate of the Night.",
    subtitle: "Savor gourmet late-night bites and hand-mixed signature cocktails crafted by master mixologists.",
    badge: "Artisanal Cocktails & Grills",
  },
];

// ─── slide card ───────────────────────────────────────────────────────────────

function SlideCard({
  slide,
  index,
  total,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  slide: TenantLandingHeroSlide;
  index: number;
  total: number;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const hasImage = Boolean(slide.image);

  return (
    <div className="group relative rounded-2xl border bg-card overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
      {/* Image strip */}
      <div className="relative h-44 bg-gradient-to-br from-[#120820] to-[#1a0a30] overflow-hidden">
        {hasImage ? (
          <SecureAssetImage
            src={slide.image}
            alt={slide.title || `Slide ${index + 1}`}
            className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-white/30">
            <ImageIcon className="h-10 w-10" />
            <span className="text-xs font-medium">No image set</span>
          </div>
        )}

        {/* Dark overlay with slide number */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {/* Order badge */}
        <div className="absolute top-3 left-3 h-7 w-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white font-black text-xs border border-white/20">
          {index + 1}
        </div>

        {/* Move controls */}
        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="h-7 w-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed border border-white/20 transition-colors"
            title="Move up"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="h-7 w-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed border border-white/20 transition-colors"
            title="Move down"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Badge + title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          {slide.badge && (
            <span className="inline-block text-[9px] font-black uppercase tracking-widest text-[#FF1A43] bg-[#FF1A43]/15 border border-[#FF1A43]/30 px-2 py-0.5 rounded-full mb-1">
              {slide.badge}
            </span>
          )}
          {slide.title && (
            <p className="text-white font-black text-sm leading-tight line-clamp-1">{slide.title}</p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {slide.subtitle ? (
          <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">{slide.subtitle}</p>
        ) : (
          <p className="text-muted-foreground/40 text-xs italic">No subtitle</p>
        )}

        <div className="flex items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="flex-1 h-8 text-[10px] font-black uppercase tracking-widest text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:border-indigo-800 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/70 rounded-lg"
          >
            <Pencil className="mr-1 h-3 w-3" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="h-8 w-8 p-0 text-[10px] font-black text-rose-500 border-rose-200 bg-rose-50 hover:bg-rose-100 dark:text-rose-400 dark:border-rose-800 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 rounded-lg"
            title="Remove slide"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── live preview ──────────────────────────────────────────────────────────────

function SliderPreview({ slides, active }: { slides: TenantLandingHeroSlide[]; active: number }) {
  const slide = slides[active];
  if (!slide) return null;
  const hasImage = Boolean(slide.image);

  return (
    <div className="relative h-56 rounded-2xl overflow-hidden bg-[#080510] border border-white/10 shadow-2xl">
      {hasImage ? (
        <SecureAssetImage
          src={slide.image}
          alt={slide.title || "Slide preview"}
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a30] to-[#0a0015]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />

      {/* Ambient glows */}
      <div className="absolute top-0 left-1/4 w-40 h-40 bg-[#FF1A43]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-[#7B16D9]/20 rounded-full blur-3xl pointer-events-none" />

      <div className="absolute bottom-0 left-0 right-0 p-5">
        {slide.badge && (
          <span className="inline-block text-[9px] font-black uppercase tracking-widest text-[#FF1A43] bg-[#FF1A43]/15 border border-[#FF1A43]/30 px-2.5 py-1 rounded-full mb-2">
            {slide.badge}
          </span>
        )}
        <h3 className="text-white font-black text-xl leading-tight">{slide.title || "Slide Title"}</h3>
        {slide.subtitle && (
          <p className="text-white/60 text-xs mt-1 line-clamp-2">{slide.subtitle}</p>
        )}
      </div>

      {/* Slide counter dots */}
      <div className="absolute top-3 right-3 flex gap-1">
        {slides.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active ? "w-5 bg-[#FF1A43]" : "w-1.5 bg-white/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── main page ─────────────────────────────────────────────────────────────────

export default function HeroSliderPage() {
  const queryClient = useQueryClient();
  const { hasAnyPermission, hasPermission } = usePermissions();
  const canBrowseAssetLibrary = hasAnyPermission(["view_storage", "manage_storage"]);
  const canManageStorage = hasPermission("manage_storage");

  // ── slides state ──
  const [slides, setSlides] = useState<TenantLandingHeroSlide[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(true);

  // ── highlights/specialties state ──
  const [highlights, setHighlights] = useState<TenantLandingCard[]>([]);

  // ── active tab, persisted across reloads (URL ?tab= wins, then localStorage) ──
  const VALID_TABS = ["slider", "stats", "specialties", "menus", "services", "gallery", "cellar", "experience", "testimonials", "faqs", "location"];
  const [activeTab, setActiveTab] = useState("slider");

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    const stored = window.localStorage.getItem("hero-slider-active-tab");
    const initial =
      fromUrl && VALID_TABS.includes(fromUrl)
        ? fromUrl
        : stored && VALID_TABS.includes(stored)
          ? stored
          : "slider";
    setActiveTab(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    try {
      window.localStorage.setItem("hero-slider-active-tab", tab);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* non-blocking */
    }
  };

  // ── menus section state ──
  const [menus, setMenus] = useState<TenantLandingMenus>({
    eyebrow: "",
    title: "",
    description_eyebrow: "",
    description: "",
  });

  // ── new dynamic sections state ──
  const [marquee, setMarquee] = useState<string[]>([]);
  const DEFAULT_MARQUEE = ["Live DJ Sets", "Craft Cocktails", "Late Nights", "VIP Lounge", "Signature Flavors", "Private Events", "Bottle Service"];
  const [servicesSection, setServicesSection] = useState<TenantLandingServicesSection>({ eyebrow: "", title: "" });
  const [gallery, setGallery] = useState<TenantLandingGallery>({ eyebrow: "", title: "", images: [] });
  const [cellar, setCellar] = useState<TenantLandingCellar>({ eyebrow: "", title: "", description: "", image: "", items: [] });
  const [experience, setExperience] = useState<TenantLandingExperience>({});
  const [locationInfo, setLocationInfo] = useState<TenantLandingLocationInfo>({ hours: [], address: [], phone: "" });
  const [guestlist, setGuestlist] = useState<TenantLandingGuestlist>({});
  const [finalCta, setFinalCta] = useState<{ title: string; description: string }>({ title: "", description: "" });

  const DEFAULT_CELLAR_ITEMS = [
    { title: "Rare Vintages", description: "Exquisite wines from the world's most prestigious vineyards." },
    { title: "Bespoke Spirits", description: "Hard-to-find single malts, small-batch bourbons, and fine cognacs." },
    { title: "Private Tastings", description: "Curated wine and spirit tasting sessions led by our sommelier." },
    { title: "Exclusive Sourcing", description: "Request rare bottles directly through our concierge service." },
  ];

  const [stats, setStats] = useState<TenantLandingStat[]>([]);
  const [testimonials, setTestimonials] = useState<TenantLandingTestimonial[]>([]);
  const [services, setServices] = useState<TenantLandingServiceCard[]>([]);
  const [faqs, setFaqs] = useState<TenantLandingFaq[]>([]);

  const DEFAULT_STATS: TenantLandingStat[] = [
    { value: "12+", label: "Signature Cocktails" },
    { value: "4.9", label: "Guest Rating" },
    { value: "2,000+", label: "Happy Guests Monthly" },
    { value: "120+", label: "Nights Hosted a Year" },
  ];

  const DEFAULT_TESTIMONIALS: TenantLandingTestimonial[] = [
    { quote: "The atmosphere is unmatched — neon glow, deep house, and the best espresso martini in the city.", author: "Hanna T.", role: "Regular Guest" },
    { quote: "Booked the VIP lounge for a birthday. Bottle service, dedicated host, zero hassle. We're coming back.", author: "Dawit M.", role: "VIP Member" },
    { quote: "Dinner flows into the club night seamlessly. One venue, a whole evening — that's rare.", author: "Sara K.", role: "Food Critic" },
  ];

  const DEFAULT_SERVICES: TenantLandingServiceCard[] = [
    { title: "Private Events & Buyouts", description: "Celebrate anniversaries, VIP corporate receptions, or private parties. We offer full and partial venue buyout options.", image: "" },
    { title: "VIP Lounge Experience", description: "Indulge in premium bottle service, bespoke seating in our high-end lounge, and dedicated butler treatment.", image: "" },
    { title: "Catering & Masterclasses", description: "Elevate your private gatherings with custom menus, chef-led dining, and mixology sessions hosted by our top artisans.", image: "" },
  ];

  const DEFAULT_FAQS: TenantLandingFaq[] = [
    { question: "What is the dress code?", answer: "Smart casual after 8 PM — no sportswear or flip-flops. For VIP lounge bookings we recommend upscale evening wear." },
    { question: "How do VIP tables and bottle service work?", answer: "Reserve a VIP table through the booking form and pick 'VIP Lounge Table'. Your host confirms the minimum spend and a dedicated server takes care of the night." },
    { question: "Do you take walk-ins?", answer: "Yes — dining walk-ins are welcome until 9 PM. After that, guests on the list and reservations get priority entry." },
    { question: "Is parking available?", answer: "Complimentary valet parking is available every night from 6 PM, plus secured self-parking next to the venue." },
    { question: "Can we book the whole venue?", answer: "Absolutely. Choose 'Private Event / Buyout' in the booking form and our events team will design the night around you." },
  ];

  // The platform fallback ships placeholder stats — treat those as "not configured"
  const GENERIC_STAT_HINTS = ["always-on", "discovery", "next step", "inside admin"];
  const sanitizeStats = (incoming: TenantLandingStat[] | undefined): TenantLandingStat[] => {
    const list = (Array.isArray(incoming) ? incoming : []).filter(
      (s) => s?.value && s?.label && !GENERIC_STAT_HINTS.some((h) => s.label.toLowerCase().includes(h)),
    );
    return list.length >= 3 ? list.slice(0, 4) : DEFAULT_STATS;
  };

  const DEFAULT_HIGHLIGHTS: TenantLandingCard[] = [
    { kicker: "Our Specialties", title: "Crafted with passion, served with perfection.", description: "Every dish tells a story of local sourcing, seasonal inspiration, and meticulous preparation. Discover flavors that linger long after the last bite." },
    { kicker: "", title: "Artisan Steaks", description: "Dry-aged to perfection for minimum 28 days." },
    { kicker: "", title: "Fresh Catch", description: "Sourced daily from local sustainable fisheries." },
    { kicker: "", title: "Handcrafted Pasta", description: "Made fresh every morning using traditional methods." }
  ];

  const loadPresets = () => {
    if (
      confirm(
        "This will load the default Savory Lounge slide templates. Existing slides will be overwritten. Proceed?"
      )
    ) {
      setSlides(PRESET_SLIDES);
      setIsDirty(true);
      setPreviewIndex(0);
      toast.success(
        "Loaded Savory Lounge presets! Don't forget to upload/attach images and click Save Changes."
      );
    }
  };

  // ── raw catalog state (needed for backward compatibility or placeholder) ──
  const [rawCatalog, setRawCatalog] = useState<TenantBusinessTypeDefinition[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<TenantLandingTemplate | null>(null);

  // ── edit dialog ──
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<TenantLandingHeroSlide>(blankSlide());

  // ── media picker ──
  // For per-menu-item targets we use the pattern "menu_item_image_<id>" or "menu_item_model_<id>"
  const [mediaPickerTarget, setMediaPickerTarget] = useState<"slide" | "specialties" | "menus_image" | "menus_model" | string | null>(null);

  // ── menu items (for the Menus Section tab) ──
  const { data: menuItemsData, isLoading: isLoadingMenuItems } = useQuery({
    queryKey: ["hospitality", "menu-items", "all"],
    queryFn: () => fetchHospitalityMenuItems({ per_page: 50, sortCol: "sort_order", sortDir: "asc" }),
  });
  const allMenuItems: HospitalityMenuItem[] = Array.isArray(menuItemsData) ? menuItemsData : (menuItemsData as any)?.rows ?? [];

  const updateMenuItemMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      updateHospitalityMenuItem(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitality", "menu-items"] });
      queryClient.invalidateQueries({ queryKey: ["tenantPublicMenuItems"] });
      toast.success("Menu item updated");
    },
    onError: () => toast.error("Failed to update menu item"),
  });

  const deleteMenuItemMutation = useMutation({
    mutationFn: deleteHospitalityMenuItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitality", "menu-items"] });
      queryClient.invalidateQueries({ queryKey: ["tenantPublicMenuItems"] });
      toast.success("Menu item deleted");
    },
    onError: () => toast.error("Failed to delete menu item"),
  });

  // ── menu items pagination & selection ──
  const [selectedMenuItemIds, setSelectedMenuItemIds] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const totalItems = allMenuItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  const paginatedItems = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return allMenuItems.slice(startIndex, startIndex + itemsPerPage);
  }, [allMenuItems, currentPage, itemsPerPage]);

  // Adjust page if current page becomes empty after deletion
  useEffect(() => {
    if (currentPage > 1 && paginatedItems.length === 0) {
      setCurrentPage(currentPage - 1);
    }
  }, [paginatedItems.length, currentPage]);

  const isAllPageSelected = paginatedItems.length > 0 && paginatedItems.every(item => selectedMenuItemIds.includes(item.id));

  const toggleSelectAllPage = () => {
    if (isAllPageSelected) {
      setSelectedMenuItemIds(prev => prev.filter(id => !paginatedItems.some(item => item.id === id)));
    } else {
      setSelectedMenuItemIds(prev => {
        const newIds = [...prev];
        paginatedItems.forEach(item => {
          if (!newIds.includes(item.id)) {
            newIds.push(item.id);
          }
        });
        return newIds;
      });
    }
  };

  const toggleSelectItem = (id: number) => {
    setSelectedMenuItemIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedMenuItemIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete the ${selectedMenuItemIds.length} selected item(s)?`)) return;

    try {
      await Promise.all(selectedMenuItemIds.map(id => deleteMenuItemMutation.mutateAsync(id)));
      setSelectedMenuItemIds([]);
      toast.success("Selected menu items deleted successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete some menu items");
    }
  };

  // ── fetch current template ──
  const { data: queryData, isLoading, isError, refetch } = useQuery({
    queryKey: ["hospitality", "hero-slider-settings"],
    queryFn: () => apiFetch("/settings/landing"),
    throwOnError: false,
    retry: 1,
  });

  // Sync loaded data into slides and highlights state
  useEffect(() => {
    if (!queryData?.data) return;
    const template = resolveLandingTemplate(queryData.data.landing_page_template ?? {});
    setCurrentTemplate(template);
    setSlides(template.hero?.slides ?? []);
    
    // Ensure highlights array has at least 4 items, pre-populate if needed
    let loadedHighlights = template.highlights ?? [];
    if (!Array.isArray(loadedHighlights) || loadedHighlights.length < 4) {
      const merged = [...(Array.isArray(loadedHighlights) ? loadedHighlights : [])];
      for (let i = merged.length; i < 4; i++) {
        merged.push(DEFAULT_HIGHLIGHTS[i]);
      }
      loadedHighlights = merged;
    }
    setHighlights(loadedHighlights);

    setMenus(template.menus ?? {
      eyebrow: "Menus",
      title: "Explore Our Menus in 3D",
      description_eyebrow: "Interactive Experience",
      description: "Interact directly with our signature dishes in high-fidelity 3D, or select from our exquisite main courses.",
    });

    setStats(sanitizeStats(template.stats));
    setTestimonials(
      Array.isArray(template.testimonials) && template.testimonials.length > 0
        ? template.testimonials.slice(0, 3)
        : DEFAULT_TESTIMONIALS,
    );
    setServices(
      Array.isArray(template.services) && template.services.length > 0
        ? template.services.slice(0, 3)
        : DEFAULT_SERVICES,
    );
    setMarquee(
      Array.isArray(template.marquee) && template.marquee.length > 0 ? template.marquee : DEFAULT_MARQUEE,
    );
    setServicesSection({
      eyebrow: template.services_section?.eyebrow || "",
      title: template.services_section?.title || "",
    });
    setGallery({
      eyebrow: template.gallery?.eyebrow || "",
      title: template.gallery?.title || "",
      images: Array.isArray(template.gallery?.images) ? template.gallery.images : [],
    });
    setCellar({
      eyebrow: template.cellar?.eyebrow || "",
      title: template.cellar?.title || "",
      description: template.cellar?.description || "",
      image: template.cellar?.image || "",
      items:
        Array.isArray(template.cellar?.items) && template.cellar.items.length > 0
          ? template.cellar.items.slice(0, 4)
          : DEFAULT_CELLAR_ITEMS,
    });
    setExperience(template.experience ?? {});
    setLocationInfo({
      hours: template.location_info?.hours ?? [],
      address: template.location_info?.address ?? [],
      phone: template.location_info?.phone || "",
    });
    setGuestlist(template.guestlist ?? {});
    setFinalCta({
      title: template.final_cta?.title || "",
      description: template.final_cta?.description || "",
    });
    setFaqs(
      Array.isArray(template.faqs) && template.faqs.length > 0
        ? template.faqs
        : DEFAULT_FAQS,
    );
    setIsDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryData]);

  // ── save mutation ──
  const saveMutation = useMutation({
    // Reads the latest tab states directly — call with saveMutation.mutate()
    mutationFn: async () => {
      const nextTemplate = {
        ...currentTemplate,
        hero: {
          ...currentTemplate?.hero,
          slides,
        },
        highlights,
        menus,
        marquee: marquee.map((m) => m.trim()).filter(Boolean),
        stats: stats.filter((s) => s.value.trim() && s.label.trim()),
        testimonials: testimonials.filter((tst) => tst.quote.trim() && tst.author.trim()),
        services: services.filter((s) => s.title.trim()),
        services_section: {
          eyebrow: servicesSection.eyebrow?.trim() || "",
          title: servicesSection.title?.trim() || "",
        },
        faqs: faqs.filter((f) => f.question.trim() && f.answer.trim()),
        gallery: {
          eyebrow: gallery.eyebrow?.trim() || "",
          title: gallery.title?.trim() || "",
          images: (gallery.images ?? []).filter((img) => img && img.trim()),
        },
        cellar: {
          eyebrow: cellar.eyebrow?.trim() || "",
          title: cellar.title?.trim() || "",
          description: cellar.description?.trim() || "",
          image: cellar.image || "",
          items: (cellar.items ?? []).filter((i) => i.title.trim()),
        },
        experience: {
          eyebrow: experience.eyebrow?.trim() || "",
          title: experience.title?.trim() || "",
          description: experience.description?.trim() || "",
          image: experience.image || "",
          featured_badge: experience.featured_badge?.trim() || "",
          featured_title: experience.featured_title?.trim() || "",
          featured_description: experience.featured_description?.trim() || "",
        },
        location_info: {
          hours: (locationInfo.hours ?? []).map((l) => l.trim()).filter(Boolean),
          address: (locationInfo.address ?? []).map((l) => l.trim()).filter(Boolean),
          phone: locationInfo.phone?.trim() || "",
        },
        guestlist: {
          eyebrow: guestlist.eyebrow?.trim() || "",
          title: guestlist.title?.trim() || "",
          description: guestlist.description?.trim() || "",
          cta: guestlist.cta?.trim() || "",
        },
        final_cta: {
          ...currentTemplate?.final_cta,
          title: finalCta.title.trim(),
          description: finalCta.description.trim(),
        },
      };

      return apiFetch("/settings/landing", {
        method: "POST",
        body: JSON.stringify({
          business_type: queryData?.data?.business_type,
          landing_page_template: nextTemplate,
        }),
      });
    },
    onSuccess: (response: any) => {
      const updatedTemplate = resolveLandingTemplate(
        response?.data?.landing_page_template ?? currentTemplate,
      );
      setCurrentTemplate(updatedTemplate);
      setSlides(updatedTemplate.hero?.slides ?? []);
      setHighlights(updatedTemplate.highlights ?? []);
      setMenus(updatedTemplate.menus ?? {
        eyebrow: "Menus",
        title: "Explore Our Menus in 3D",
        description_eyebrow: "Interactive Experience",
        description: "Interact directly with our signature dishes in high-fidelity 3D, or select from our exquisite main courses.",
      });
      setStats(sanitizeStats(updatedTemplate.stats));
      if (Array.isArray(updatedTemplate.testimonials) && updatedTemplate.testimonials.length > 0) {
        setTestimonials(updatedTemplate.testimonials.slice(0, 3));
      }
      if (Array.isArray(updatedTemplate.services) && updatedTemplate.services.length > 0) {
        setServices(updatedTemplate.services.slice(0, 3));
      }
      if (Array.isArray(updatedTemplate.marquee) && updatedTemplate.marquee.length > 0) {
        setMarquee(updatedTemplate.marquee);
      }
      setServicesSection({
        eyebrow: updatedTemplate.services_section?.eyebrow || "",
        title: updatedTemplate.services_section?.title || "",
      });
      setGallery({
        eyebrow: updatedTemplate.gallery?.eyebrow || "",
        title: updatedTemplate.gallery?.title || "",
        images: Array.isArray(updatedTemplate.gallery?.images) ? updatedTemplate.gallery.images : [],
      });
      setCellar({
        eyebrow: updatedTemplate.cellar?.eyebrow || "",
        title: updatedTemplate.cellar?.title || "",
        description: updatedTemplate.cellar?.description || "",
        image: updatedTemplate.cellar?.image || "",
        items:
          Array.isArray(updatedTemplate.cellar?.items) && updatedTemplate.cellar.items.length > 0
            ? updatedTemplate.cellar.items.slice(0, 4)
            : DEFAULT_CELLAR_ITEMS,
      });
      setExperience(updatedTemplate.experience ?? {});
      setLocationInfo({
        hours: updatedTemplate.location_info?.hours ?? [],
        address: updatedTemplate.location_info?.address ?? [],
        phone: updatedTemplate.location_info?.phone || "",
      });
      setGuestlist(updatedTemplate.guestlist ?? {});
      setFinalCta({
        title: updatedTemplate.final_cta?.title || "",
        description: updatedTemplate.final_cta?.description || "",
      });
      if (Array.isArray(updatedTemplate.faqs) && updatedTemplate.faqs.length > 0) {
        setFaqs(updatedTemplate.faqs);
      }
      queryClient.invalidateQueries({ queryKey: ["hospitality", "hero-slider-settings"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-landing-page-settings"] });
      queryClient.invalidateQueries({ queryKey: ["tenantPublicLanding"] });
      toast.success("Landing page settings saved successfully!");
      setIsDirty(false);
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, "Failed to save settings."));
    },
  });

  // ── cycle preview index when slides change ──
  useEffect(() => {
    if (previewIndex >= slides.length && slides.length > 0) {
      setPreviewIndex(slides.length - 1);
    }
  }, [slides.length, previewIndex]);

  // ── auto-cycle preview ──
  useEffect(() => {
    if (!showPreview || slides.length < 2) return;
    const id = setInterval(() => {
      setPreviewIndex((i) => (i + 1) % slides.length);
    }, 3500);
    return () => clearInterval(id);
  }, [showPreview, slides.length]);

  // ── helpers ──
  const openAddDialog = () => {
    setEditingIndex(null);
    setFormData(blankSlide());
    setIsDialogOpen(true);
  };

  const openEditDialog = (index: number) => {
    setEditingIndex(index);
    setFormData({ ...slides[index] });
    setIsDialogOpen(true);
  };

  const handleDialogSave = () => {
    if (!formData.title.trim()) {
      toast.error("Please enter a slide title.");
      return;
    }

    setSlides((prev) => {
      const next = [...prev];
      if (editingIndex === null) {
        next.push({ ...formData });
      } else {
        next[editingIndex] = { ...formData };
      }
      return next;
    });
    setIsDirty(true);
    setIsDialogOpen(false);
  };

  const handleDelete = (index: number) => {
    if (!confirm("Remove this slide from the hero slider?")) return;
    setSlides((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  const handleMove = (index: number, dir: "up" | "down") => {
    setSlides((prev) => {
      const next = [...prev];
      const target = dir === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setIsDirty(true);
  };

  const handleFileSelect = (file: any) => {
    const url = file.media_details?.public_url || file.media_details?.url || file.url || file.path;
    if (mediaPickerTarget === "slide") {
      setFormData((prev) => ({ ...prev, image: url }));
      toast.success("Image selected for slide");
    } else if (mediaPickerTarget === "specialties") {
      const next = [...highlights];
      if (!next[0]) next[0] = { kicker: "", title: "", description: "" };
      next[0].image = url;
      setHighlights(next);
      setIsDirty(true);
      toast.success("Image selected for specialties section");
    } else if (mediaPickerTarget === "menus_image") {
      setMenus((prev) => ({ ...prev, image_url: url }));
      setIsDirty(true);
      toast.success("Image selected for menus section");
    } else if (mediaPickerTarget === "menus_model") {
      setMenus((prev) => ({ ...prev, model_3d_url: url }));
      setIsDirty(true);
      toast.success("3D model selected for menus section");
    } else if (mediaPickerTarget === "gallery_add") {
      setGallery((prev) => ({ ...prev, images: [...(prev.images ?? []), url] }));
      setIsDirty(true);
      toast.success("Image added to gallery");
    } else if (typeof mediaPickerTarget === "string" && mediaPickerTarget.startsWith("gallery_image_")) {
      const idx = Number(mediaPickerTarget.replace("gallery_image_", ""));
      setGallery((prev) => {
        const images = [...(prev.images ?? [])];
        if (idx >= 0 && idx < images.length) images[idx] = url;
        return { ...prev, images };
      });
      setIsDirty(true);
      toast.success("Gallery image replaced");
    } else if (mediaPickerTarget === "cellar_image") {
      setCellar((prev) => ({ ...prev, image: url }));
      setIsDirty(true);
      toast.success("Image selected for cellar section");
    } else if (mediaPickerTarget === "experience_image") {
      setExperience((prev) => ({ ...prev, image: url }));
      setIsDirty(true);
      toast.success("Image selected for experience section");
    } else if (typeof mediaPickerTarget === "string" && mediaPickerTarget.startsWith("service_image_")) {
      const idx = Number(mediaPickerTarget.replace("service_image_", ""));
      setServices((prev) => {
        const next = [...prev];
        if (next[idx]) next[idx] = { ...next[idx], image: url };
        return next;
      });
      setIsDirty(true);
      toast.success("Image selected for service card");
    } else if (typeof mediaPickerTarget === "string" && mediaPickerTarget.startsWith("menu_item_image_")) {
      const itemId = Number(mediaPickerTarget.replace("menu_item_image_", ""));
      updateMenuItemMutation.mutate({ id: itemId, payload: { image_url: url } });
      toast.success("Image saved to menu item");
    } else if (typeof mediaPickerTarget === "string" && mediaPickerTarget.startsWith("menu_item_model_")) {
      const itemId = Number(mediaPickerTarget.replace("menu_item_model_", ""));
      updateMenuItemMutation.mutate({ id: itemId, payload: { model_3d_url: url } });
      toast.success("3D model saved to menu item");
    }
    setMediaPickerTarget(null);
  };

  // ─────────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 flex-col">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF1A43]" />
        <p className="text-muted-foreground text-sm">Loading slider settings…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF1A43] to-[#7B16D9] shadow-lg shadow-[#FF1A43]/30">
              <GalleryHorizontalEnd className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Hero Slider</h1>
              <p className="text-muted-foreground text-sm">
                Manage the full-screen slides shown on your landing page.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isError && (
            <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-full gap-1.5">
              <RefreshCcw className="h-3.5 w-3.5" />
              Retry
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview((v) => !v)}
            className="rounded-full gap-1.5"
          >
            {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPreview ? "Hide" : "Show"} Preview
          </Button>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground border rounded-full px-3 py-1.5 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            View Live
          </a>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending}
            className="rounded-full px-6 gap-2 bg-gradient-to-r from-[#FF1A43] to-[#7B16D9] hover:from-[#e0173a] hover:to-[#6912be] text-white shadow-lg shadow-[#FF1A43]/25 disabled:opacity-50 transition-all"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isDirty ? "Save Changes" : "Saved"}
          </Button>
        </div>
      </div>

      {/* ── Unsaved changes banner ── */}
      {isDirty && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 text-amber-700 dark:text-amber-400">
          <Sparkles className="h-4 w-4 shrink-0" />
          <p className="text-sm font-medium">
            You have unsaved changes. Click <strong>Save Changes</strong> to publish them to your landing page.
          </p>
        </div>
      )}

      {/* ── Error banner ── */}
      {isError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30 px-4 py-3 text-rose-700 dark:text-rose-400 text-sm">
          Could not load slider settings. Working in offline mode — changes will overwrite existing data when saved.
        </div>
      )}

      {/* ── Tabs Container ── */}
      <Tabs defaultValue="slider" value={activeTab} onValueChange={handleTabChange} className="w-full">
        {/* Tabs are ordered top-to-bottom to match the order sections appear on the landing page */}
        <TabsList className="flex w-full flex-wrap h-auto gap-1 mb-6 justify-start">
          <TabsTrigger value="slider" className="gap-1.5"><GalleryHorizontalEnd className="h-3.5 w-3.5" /> 1. Hero Slides</TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> 2. Stats</TabsTrigger>
          <TabsTrigger value="specialties" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> 3. Specialties</TabsTrigger>
          <TabsTrigger value="menus" className="gap-1.5"><Box className="h-3.5 w-3.5" /> 4. Menus</TabsTrigger>
          <TabsTrigger value="services" className="gap-1.5"><ConciergeBell className="h-3.5 w-3.5" /> 5. Services</TabsTrigger>
          <TabsTrigger value="gallery" className="gap-1.5"><Images className="h-3.5 w-3.5" /> 6. Gallery</TabsTrigger>
          <TabsTrigger value="cellar" className="gap-1.5"><Wine className="h-3.5 w-3.5" /> 7. Cellar</TabsTrigger>
          <TabsTrigger value="experience" className="gap-1.5"><Sofa className="h-3.5 w-3.5" /> 8. Experience</TabsTrigger>
          <TabsTrigger value="testimonials" className="gap-1.5"><Quote className="h-3.5 w-3.5" /> 9. Testimonials</TabsTrigger>
          <TabsTrigger value="faqs" className="gap-1.5"><HelpCircle className="h-3.5 w-3.5" /> 10. FAQs</TabsTrigger>
          <TabsTrigger value="location" className="gap-1.5"><MapPin className="h-3.5 w-3.5" /> 11. Location &amp; CTA</TabsTrigger>
        </TabsList>

        <TabsContent value="slider" className="outline-none">
          {/* ── Layout: preview + grid ── */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-8 items-start">

            {/* Left: slides grid */}
            <div className="space-y-6">
              {/* Stats bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="rounded-full px-3 font-bold text-xs">
                    {slides.length} slide{slides.length !== 1 ? "s" : ""}
                  </Badge>
                  {slides.length === 0 && (
                    <span className="text-xs text-muted-foreground">Add at least one slide to activate the hero.</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={loadPresets}
                    variant="outline"
                    size="sm"
                    className="rounded-full gap-1.5 border-[#7B16D9] text-[#7B16D9] hover:bg-[#7B16D9]/10"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Load Savory Lounge Presets
                  </Button>
                  <Button
                    onClick={openAddDialog}
                    size="sm"
                    className="rounded-full gap-1.5 bg-gradient-to-r from-[#FF1A43] to-[#7B16D9] hover:from-[#e0173a] hover:to-[#6912be] text-white shadow-md shadow-[#FF1A43]/20"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Slide
                  </Button>
                </div>
              </div>

              {/* Slides grid */}
              {slides.length === 0 ? (
                <div
                  onClick={openAddDialog}
                  className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/20 h-56 gap-3 cursor-pointer hover:border-[#FF1A43]/40 hover:bg-[#FF1A43]/5 transition-all group"
                >
                  <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center group-hover:bg-[#FF1A43]/10 transition-colors">
                    <GalleryHorizontalEnd className="h-6 w-6 text-muted-foreground group-hover:text-[#FF1A43] transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-sm text-muted-foreground group-hover:text-foreground transition-colors">No slides yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">Click to add your first hero slide</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {slides.map((slide, i) => (
                    <SlideCard
                      key={i}
                      slide={slide}
                      index={i}
                      total={slides.length}
                      onEdit={() => openEditDialog(i)}
                      onDelete={() => handleDelete(i)}
                      onMoveUp={() => handleMove(i, "up")}
                      onMoveDown={() => handleMove(i, "down")}
                    />
                  ))}

                  {/* Add new placeholder */}
                  <button
                    onClick={openAddDialog}
                    className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 h-full min-h-[220px] gap-2 cursor-pointer hover:border-[#FF1A43]/40 hover:bg-[#FF1A43]/5 transition-all group text-muted-foreground/40 hover:text-[#FF1A43]"
                  >
                    <Plus className="h-7 w-7 transition-transform group-hover:scale-110" />
                    <span className="text-xs font-bold">Add Slide</span>
                  </button>
                </div>
              )}

              {/* Tips */}
              <div className="rounded-xl bg-muted/40 border px-5 py-4 space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Tips</p>
                <ul className="space-y-1.5 text-xs text-muted-foreground list-none">
                  <li className="flex items-start gap-2">
                    <span className="text-[#FF1A43] font-black mt-0.5">→</span>
                    Use landscape images at <strong>1920×1080px</strong> or wider for the best result.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#FF1A43] font-black mt-0.5">→</span>
                    Keep titles under <strong>5 words</strong> and subtitles under <strong>20 words</strong> for mobile readability.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#FF1A43] font-black mt-0.5">→</span>
                    The <strong>Badge</strong> appears as a small label above the title (e.g. "VIP Experience").
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#FF1A43] font-black mt-0.5">→</span>
                    Use the <strong>arrows</strong> on each card to reorder slides. Order matters — first slide plays first.
                  </li>
                </ul>
              </div>
            </div>

            {/* Right: live preview */}
            {showPreview && slides.length > 0 && (
              <div className="sticky top-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Live Preview</p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewIndex((i) => (i - 1 + slides.length) % slides.length)}
                      className="h-6 w-6 rounded-full border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                    >
                      <ArrowLeft className="h-3 w-3" />
                    </button>
                    <span className="text-xs text-muted-foreground px-1 tabular-nums">
                      {previewIndex + 1} / {slides.length}
                    </span>
                    <button
                      onClick={() => setPreviewIndex((i) => (i + 1) % slides.length)}
                      className="h-6 w-6 rounded-full border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                    >
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <SliderPreview slides={slides} active={previewIndex} />
                <p className="text-[10px] text-muted-foreground/60 text-center">
                  Auto-cycles every 3.5 s · {slides.length} slide{slides.length !== 1 ? "s" : ""} total
                </p>
              </div>
            )}
          </div>

          {/* Scrolling tagline marquee (the neon band right under the hero) */}
          <div className="mt-8 rounded-2xl border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">Scrolling Tagline Strip</h2>
                <p className="text-muted-foreground text-xs">
                  The animated neon band that loops right under the hero. Add short punchy phrases (e.g. &ldquo;Live DJ Sets&rdquo;, &ldquo;Bottle Service&rdquo;).
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={marquee.length >= 10}
                onClick={() => { setMarquee((prev) => [...prev, ""]); setIsDirty(true); }}
                className="rounded-full gap-1.5 bg-gradient-to-r from-[#FF1A43] to-[#7B16D9] text-white border-none shadow-md shadow-[#FF1A43]/20"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Phrase {marquee.length >= 10 ? "(max 10)" : ""}
              </Button>
            </div>

            {/* live preview of the strip */}
            {marquee.filter((m) => m.trim()).length > 0 && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-[#0a0612] border border-white/10 px-4 py-3">
                {marquee.filter((m) => m.trim()).map((m, i) => (
                  <span key={i} className="flex items-center gap-5">
                    <span className="bg-gradient-to-r from-[#FF1A43] via-[#D31A9B] to-[#7B16D9] bg-clip-text text-sm font-black uppercase tracking-[0.15em] text-transparent">
                      {m}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-[#FF1A43]" />
                  </span>
                ))}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {marquee.map((phrase, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder={`Phrase ${idx + 1}`}
                    value={phrase}
                    onChange={(e) => {
                      const next = [...marquee];
                      next[idx] = e.target.value;
                      setMarquee(next);
                      setIsDirty(true);
                    }}
                    maxLength={40}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { setMarquee((prev) => prev.filter((_, i) => i !== idx)); setIsDirty(true); }}
                    className="h-9 w-9 shrink-0 p-0 text-rose-500 border-rose-200 bg-rose-50 hover:bg-rose-100 dark:text-rose-400 dark:border-rose-800 dark:bg-rose-950/40 rounded-lg"
                    title="Remove phrase"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="specialties" className="space-y-6 outline-none">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">Section Header</h2>
              <p className="text-muted-foreground text-xs">Customize the Specialties section introduction header.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="specialties-eyebrow" className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                  Section Eyebrow
                </Label>
                <Input
                  id="specialties-eyebrow"
                  placeholder="e.g. Our Specialties"
                  value={highlights[0]?.kicker || ""}
                  onChange={(e) => {
                    const next = [...highlights];
                    if (!next[0]) next[0] = { kicker: "", title: "", description: "" };
                    next[0].kicker = e.target.value;
                    setHighlights(next);
                    setIsDirty(true);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialties-title" className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                  Section Title
                </Label>
                <Input
                  id="specialties-title"
                  placeholder="e.g. Crafted with passion, served with perfection."
                  value={highlights[0]?.title || ""}
                  onChange={(e) => {
                    const next = [...highlights];
                    if (!next[0]) next[0] = { kicker: "", title: "", description: "" };
                    next[0].title = e.target.value;
                    setHighlights(next);
                    setIsDirty(true);
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                Section Description (Rich Text)
              </Label>
              <RichTextEditor
                value={highlights[0]?.description || ""}
                onChange={(html) => {
                  const next = [...highlights];
                  if (!next[0]) next[0] = { kicker: "", title: "", description: "" };
                  next[0].description = html;
                  setHighlights(next);
                  setIsDirty(true);
                }}
                placeholder="Write a descriptive introduction about your venue and delicacies..."
              />
            </div>

            <div className="space-y-2 pt-2">
              <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                Section Main Image
              </Label>
              <div className="relative h-60 max-w-lg rounded-xl overflow-hidden border bg-gradient-to-br from-[#120820] to-[#1a0a30] group">
                {highlights[0]?.image ? (
                  <>
                    <SecureAssetImage
                      src={highlights[0].image}
                      alt="Specialties preview"
                      className="w-full h-full object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setMediaPickerTarget("specialties")}
                        className="rounded-full text-xs shadow-lg"
                      >
                        Change Image
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          const next = [...highlights];
                          if (next[0]) {
                            next[0].image = "";
                            setHighlights(next);
                            setIsDirty(true);
                          }
                        }}
                        className="rounded-full text-xs shadow-lg"
                      >
                        Remove
                      </Button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMediaPickerTarget("specialties")}
                    className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-xs font-medium">Click to choose from Media Library</span>
                  </button>
                )}
              </div>
              {highlights[0]?.image && (
                <p className="text-[10px] text-muted-foreground truncate">{highlights[0].image}</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">Specialty List Items</h2>
              <p className="text-muted-foreground text-xs">Configure the three key specialties/highlights listed under the description.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {[1, 2, 3].map((num) => (
                <div key={num} className="p-5 border rounded-xl bg-background/50 space-y-4">
                  <Badge variant="outline" className="font-bold text-xs uppercase tracking-widest text-[#FF1A43] bg-[#FF1A43]/5 border-[#FF1A43]/20">
                    Specialty 0{num}
                  </Badge>

                  <div className="space-y-2">
                    <Label htmlFor={`item-${num}-title`} className="text-xs font-bold text-muted-foreground">
                      Title
                    </Label>
                    <Input
                      id={`item-${num}-title`}
                      placeholder={`Specialty 0${num} Title`}
                      value={highlights[num]?.title || ""}
                      onChange={(e) => {
                        const next = [...highlights];
                        if (!next[num]) next[num] = { kicker: "", title: "", description: "" };
                        next[num].title = e.target.value;
                        setHighlights(next);
                        setIsDirty(true);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`item-${num}-desc`} className="text-xs font-bold text-muted-foreground">
                      Description
                    </Label>
                    <Textarea
                      id={`item-${num}-desc`}
                      placeholder={`Describe this specialty item...`}
                      rows={3}
                      value={highlights[num]?.description || ""}
                      onChange={(e) => {
                        const next = [...highlights];
                        if (!next[num]) next[num] = { kicker: "", title: "", description: "" };
                        next[num].description = e.target.value;
                        setHighlights(next);
                        setIsDirty(true);
                      }}
                      maxLength={150}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="menus" className="space-y-6 outline-none">
          {/* ── Text Content ── */}
          <div className="rounded-3xl border border-white/[0.08] bg-card p-6 md:p-8 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-foreground">Interactive 3D Menus Section</h3>
              <p className="text-muted-foreground text-xs">
                Configure the headings and descriptions for your interactive 3D dishes showcase section.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                  Section Subtitle / Eyebrow
                </Label>
                <Input
                  value={menus?.eyebrow || ""}
                  onChange={(e) => {
                    setMenus({ ...menus, eyebrow: e.target.value });
                    setIsDirty(true);
                  }}
                  placeholder="e.g. Menus"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                  Section Main Title
                </Label>
                <Input
                  value={menus?.title || ""}
                  onChange={(e) => {
                    setMenus({ ...menus, title: e.target.value });
                    setIsDirty(true);
                  }}
                  placeholder="e.g. Explore Our Menus in 3D"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                Description Column Content
              </Label>
              <Textarea
                value={menus?.description || ""}
                onChange={(e) => {
                  setMenus({ ...menus, description: e.target.value });
                  setIsDirty(true);
                }}
                placeholder="e.g. Interact directly with our signature dishes..."
                rows={3}
              />
            </div>
          </div>

          {/* ── Per-Item Media Cards ── */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/40 p-4 rounded-2xl border border-border/60">
              <div>
                <h3 className="text-base font-black tracking-tight">Menu Item Media</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Each item shown in the 3D showcase gets its own image and 3D model.
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {allMenuItems.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={toggleSelectAllPage}
                      className="h-8 text-xs font-bold px-3 rounded-lg"
                    >
                      {isAllPageSelected ? "Deselect Page" : "Select Page"}
                    </Button>
                    {selectedMenuItemIds.length > 0 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkDelete}
                        className="h-8 text-xs font-black uppercase tracking-wider px-3 rounded-lg flex items-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.25)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Selected ({selectedMenuItemIds.length})
                      </Button>
                    )}
                  </div>
                )}
                <Badge variant="outline" className="rounded-full px-3 py-1 font-bold text-xs bg-background">
                  {allMenuItems.length} item{allMenuItems.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            </div>

            {isLoadingMenuItems ? (
              <div className="flex items-center justify-center h-40 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-[#FF1A43]" />
                <span className="text-sm text-muted-foreground">Loading menu items…</span>
              </div>
            ) : allMenuItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 h-40 gap-2 text-muted-foreground/50">
                <ImageIcon className="h-8 w-8" />
                <p className="text-sm font-medium">No menu items found</p>
                <p className="text-xs">Add items on the Menu Management page first.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {paginatedItems.map((item) => (
                    <div
                      key={item.id}
                      className={`group rounded-2xl border overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 relative ${
                        selectedMenuItemIds.includes(item.id)
                          ? "border-[#7B16D9] ring-2 ring-[#7B16D9]/20 bg-[#7B16D9]/5"
                          : "bg-card border-border"
                      }`}
                    >
                      {/* Checkbox selector */}
                      <div className="absolute top-2 left-2 z-20 bg-black/40 backdrop-blur-md p-1.5 rounded-lg border border-white/10 flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selectedMenuItemIds.includes(item.id)}
                          onChange={() => toggleSelectItem(item.id)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-[#7B16D9]"
                        />
                      </div>

                      {/* Delete button (single delete) */}
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
                            deleteMenuItemMutation.mutate(item.id);
                          }
                        }}
                        className="absolute top-2 right-2 z-20 p-1.5 bg-rose-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-rose-600 shadow-md border border-rose-600/20"
                        title="Delete menu item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>

                      {/* Image strip */}
                      <div className="relative h-40 bg-gradient-to-br from-[#120820] to-[#1a0a30] overflow-hidden">
                        {item.image_url ? (
                          <SecureAssetImage
                            src={item.image_url}
                            alt={item.name}
                            className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full gap-2 text-white/30">
                            <ImageIcon className="h-8 w-8" />
                            <span className="text-[10px] font-medium">No image</span>
                          </div>
                        )}

                        {/* Dark overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                        {/* 3D badge */}
                        {item.model_3d_url && (
                          <div className="absolute top-2 right-2 group-hover:right-10 transition-all duration-200 flex items-center gap-1 bg-[#7B16D9]/80 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border border-[#7B16D9] z-10">
                            <Box className="h-2.5 w-2.5" />
                            3D
                          </div>
                        )}

                        {/* Item info overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          {item.category?.name && (
                            <span className="inline-block text-[9px] font-black uppercase tracking-widest text-[#FF1A43] bg-[#FF1A43]/15 border border-[#FF1A43]/30 px-2 py-0.5 rounded-full mb-1">
                              {item.category.name}
                            </span>
                          )}
                          <p className="text-white font-black text-sm leading-tight line-clamp-1">{item.name}</p>
                        </div>
                      </div>

                      {/* Body: uploaders */}
                      <div className="p-4 space-y-3">
                        {/* Image uploader row */}
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" /> Image
                          </Label>
                          <div className="flex gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setMediaPickerTarget(`menu_item_image_${item.id}`)}
                              className="flex-1 h-8 text-[10px] font-black uppercase tracking-widest text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:border-indigo-800 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/70 rounded-lg"
                            >
                              <ImageIcon className="mr-1 h-3 w-3" />
                              {item.image_url ? "Replace" : "Upload"}
                            </Button>
                            {item.image_url && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => updateMenuItemMutation.mutate({ id: item.id, payload: { image_url: null } })}
                                className="h-8 w-8 p-0 text-rose-500 border-rose-200 bg-rose-50 hover:bg-rose-100 dark:text-rose-400 dark:border-rose-800 dark:bg-rose-950/40 rounded-lg"
                                title="Remove image"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* 3D model uploader row */}
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                            <Box className="h-3 w-3" /> 3D Model
                          </Label>
                          <div className="flex gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setMediaPickerTarget(`menu_item_model_${item.id}`)}
                              className="flex-1 h-8 text-[10px] font-black uppercase tracking-widest border-[#7B16D9]/30 text-[#7B16D9] bg-[#7B16D9]/5 hover:bg-[#7B16D9]/15 rounded-lg"
                            >
                              <Box className="mr-1 h-3 w-3" />
                              {item.model_3d_url ? "Replace" : "Upload"}
                            </Button>
                            {item.model_3d_url && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => updateMenuItemMutation.mutate({ id: item.id, payload: { model_3d_url: null } })}
                                className="h-8 w-8 p-0 text-rose-500 border-rose-200 bg-rose-50 hover:bg-rose-100 dark:text-rose-400 dark:border-rose-800 dark:bg-rose-950/40 rounded-lg"
                                title="Remove 3D model"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-border/50 pt-5 mt-4">
                    <p className="text-xs text-muted-foreground font-medium">
                      Showing <span className="font-bold text-foreground">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
                      <span className="font-bold text-foreground">
                        {Math.min(currentPage * itemsPerPage, totalItems)}
                      </span>{" "}
                      of <span className="font-bold text-foreground">{totalItems}</span> items
                    </p>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                        className="h-9 px-3 font-bold rounded-xl"
                      >
                        <ArrowLeft className="h-4 w-4 mr-1.5" />
                        Previous
                      </Button>
                      
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: totalPages }).map((_, idx) => {
                          const pageNum = idx + 1;
                          return (
                            <Button
                              key={pageNum}
                              type="button"
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className={`h-9 w-9 p-0 font-bold rounded-xl ${
                                currentPage === pageNum
                                  ? "bg-gradient-to-r from-[#FF1A43] to-[#7B16D9] hover:from-[#FF1A43] hover:to-[#7B16D9] text-white border-none"
                                  : ""
                              }`}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        className="h-9 px-3 font-bold rounded-xl"
                      >
                        Next
                        <ArrowRight className="h-4 w-4 ml-1.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── STATS TAB ── */}
        <TabsContent value="stats" className="space-y-6 outline-none">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">Animated Stats Band</h2>
              <p className="text-muted-foreground text-xs">
                Four numbers shown right under the hero with a count-up animation. Use a number + suffix in the value (e.g. <strong>2,000+</strong>, <strong>4.9</strong>, <strong>12+</strong>).
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="p-5 border rounded-xl bg-background/50 space-y-4">
                  <Badge variant="outline" className="font-bold text-xs uppercase tracking-widest text-[#FF1A43] bg-[#FF1A43]/5 border-[#FF1A43]/20">
                    Stat 0{idx + 1}
                  </Badge>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground">Value</Label>
                    <Input
                      placeholder="e.g. 2,000+"
                      value={stats[idx]?.value || ""}
                      onChange={(e) => {
                        const next = [...stats];
                        if (!next[idx]) next[idx] = { value: "", label: "" };
                        next[idx] = { ...next[idx], value: e.target.value };
                        setStats(next);
                        setIsDirty(true);
                      }}
                      maxLength={12}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground">Label</Label>
                    <Input
                      placeholder="e.g. Happy Guests Monthly"
                      value={stats[idx]?.label || ""}
                      onChange={(e) => {
                        const next = [...stats];
                        if (!next[idx]) next[idx] = { value: "", label: "" };
                        next[idx] = { ...next[idx], label: e.target.value };
                        setStats(next);
                        setIsDirty(true);
                      }}
                      maxLength={40}
                    />
                  </div>
                  {/* mini preview */}
                  <div className="rounded-lg bg-[#0a0612] border border-white/10 px-3 py-4 text-center">
                    <div className="text-2xl font-black bg-gradient-to-r from-[#FF1A43] via-[#D31A9B] to-[#7B16D9] bg-clip-text text-transparent">
                      {stats[idx]?.value || "—"}
                    </div>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/50">
                      {stats[idx]?.label || "Label"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── SERVICES TAB ── */}
        <TabsContent value="services" className="space-y-6 outline-none">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">Exclusive Services Cards</h2>
              <p className="text-muted-foreground text-xs">
                The three big image cards in the &ldquo;What We Offer&rdquo; section. Each card&apos;s &ldquo;Inquire Now&rdquo; button opens the booking form.
              </p>
            </div>

            {/* Section heading (the big title + outlined background word) */}
            <div className="grid gap-4 md:grid-cols-2 p-5 border rounded-xl bg-background/50">
              <div className="space-y-2">
                <Label htmlFor="services-section-title" className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                  Section Title
                </Label>
                <Input
                  id="services-section-title"
                  placeholder="e.g. Exclusive Services"
                  value={servicesSection.title || ""}
                  onChange={(e) => {
                    setServicesSection((prev) => ({ ...prev, title: e.target.value }));
                    setIsDirty(true);
                  }}
                  maxLength={60}
                />
                <p className="text-[10px] text-muted-foreground">The gradient heading of the section.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="services-section-eyebrow" className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                  Background Word
                </Label>
                <Input
                  id="services-section-eyebrow"
                  placeholder="e.g. Services"
                  value={servicesSection.eyebrow || ""}
                  onChange={(e) => {
                    setServicesSection((prev) => ({ ...prev, eyebrow: e.target.value }));
                    setIsDirty(true);
                  }}
                  maxLength={20}
                />
                <p className="text-[10px] text-muted-foreground">The huge outlined word behind the title — keep it to one short word.</p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="border rounded-xl bg-background/50 overflow-hidden">
                  {/* image picker */}
                  <div className="relative h-36 bg-gradient-to-br from-[#120820] to-[#1a0a30] group">
                    {services[idx]?.image ? (
                      <>
                        <SecureAssetImage
                          src={services[idx].image as string}
                          alt={services[idx]?.title || `Service ${idx + 1}`}
                          className="w-full h-full object-cover object-center"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button type="button" variant="secondary" size="sm" onClick={() => setMediaPickerTarget(`service_image_${idx}`)} className="rounded-full text-xs shadow-lg">
                            Change
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              const next = [...services];
                              if (next[idx]) next[idx] = { ...next[idx], image: "" };
                              setServices(next);
                              setIsDirty(true);
                            }}
                            className="rounded-full text-xs shadow-lg"
                          >
                            Remove
                          </Button>
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMediaPickerTarget(`service_image_${idx}`)}
                        className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/30 hover:text-white/60 transition-colors"
                      >
                        <ImageIcon className="h-7 w-7" />
                        <span className="text-[10px] font-medium">Choose image</span>
                      </button>
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                    <Badge variant="outline" className="font-bold text-xs uppercase tracking-widest text-[#FF1A43] bg-[#FF1A43]/5 border-[#FF1A43]/20">
                      Service 0{idx + 1}
                    </Badge>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground">Title</Label>
                      <Input
                        placeholder="e.g. VIP Lounge Experience"
                        value={services[idx]?.title || ""}
                        onChange={(e) => {
                          const next = [...services];
                          if (!next[idx]) next[idx] = { title: "", description: "", image: "" };
                          next[idx] = { ...next[idx], title: e.target.value };
                          setServices(next);
                          setIsDirty(true);
                        }}
                        maxLength={60}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground">Description</Label>
                      <Textarea
                        rows={3}
                        placeholder="Describe this service…"
                        value={services[idx]?.description || ""}
                        onChange={(e) => {
                          const next = [...services];
                          if (!next[idx]) next[idx] = { title: "", description: "", image: "" };
                          next[idx] = { ...next[idx], description: e.target.value };
                          setServices(next);
                          setIsDirty(true);
                        }}
                        maxLength={220}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Tip: titles containing <strong>&ldquo;Private&rdquo;</strong> or <strong>&ldquo;VIP&rdquo;</strong> automatically preselect the matching booking type when guests click Inquire Now.
            </p>
          </div>
        </TabsContent>

        {/* ── TESTIMONIALS TAB ── */}
        <TabsContent value="testimonials" className="space-y-6 outline-none">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">Guest Testimonials</h2>
              <p className="text-muted-foreground text-xs">
                Three quotes shown in the &ldquo;Night Tales&rdquo; section with star ratings and the author&apos;s initial as the avatar.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="p-5 border rounded-xl bg-background/50 space-y-4">
                  <Badge variant="outline" className="font-bold text-xs uppercase tracking-widest text-[#7B16D9] bg-[#7B16D9]/5 border-[#7B16D9]/20">
                    Review 0{idx + 1}
                  </Badge>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground">Quote</Label>
                    <Textarea
                      rows={4}
                      placeholder="What did the guest say?"
                      value={testimonials[idx]?.quote || ""}
                      onChange={(e) => {
                        const next = [...testimonials];
                        if (!next[idx]) next[idx] = { quote: "", author: "", role: "" };
                        next[idx] = { ...next[idx], quote: e.target.value };
                        setTestimonials(next);
                        setIsDirty(true);
                      }}
                      maxLength={280}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground">Author</Label>
                      <Input
                        placeholder="e.g. Hanna T."
                        value={testimonials[idx]?.author || ""}
                        onChange={(e) => {
                          const next = [...testimonials];
                          if (!next[idx]) next[idx] = { quote: "", author: "", role: "" };
                          next[idx] = { ...next[idx], author: e.target.value };
                          setTestimonials(next);
                          setIsDirty(true);
                        }}
                        maxLength={40}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground">Role / Tag</Label>
                      <Input
                        placeholder="e.g. VIP Member"
                        value={testimonials[idx]?.role || ""}
                        onChange={(e) => {
                          const next = [...testimonials];
                          if (!next[idx]) next[idx] = { quote: "", author: "", role: "" };
                          next[idx] = { ...next[idx], role: e.target.value };
                          setTestimonials(next);
                          setIsDirty(true);
                        }}
                        maxLength={40}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── FAQS TAB ── */}
        <TabsContent value="faqs" className="space-y-6 outline-none">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">FAQ Accordion</h2>
                <p className="text-muted-foreground text-xs">
                  Questions shown in the &ldquo;Good To Know&rdquo; section. Drag-free: use the order they appear here.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={faqs.length >= 8}
                onClick={() => {
                  setFaqs((prev) => [...prev, { question: "", answer: "" }]);
                  setIsDirty(true);
                }}
                className="rounded-full gap-1.5 bg-gradient-to-r from-[#FF1A43] to-[#7B16D9] text-white border-none shadow-md shadow-[#FF1A43]/20"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Question {faqs.length >= 8 ? "(max 8)" : ""}
              </Button>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <div key={idx} className="p-5 border rounded-xl bg-background/50 space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">
                      Q{idx + 1}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFaqs((prev) => prev.filter((_, i) => i !== idx));
                        setIsDirty(true);
                      }}
                      className="h-7 w-7 p-0 text-rose-500 border-rose-200 bg-rose-50 hover:bg-rose-100 dark:text-rose-400 dark:border-rose-800 dark:bg-rose-950/40 rounded-lg"
                      title="Remove question"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground">Question</Label>
                    <Input
                      placeholder="e.g. What is the dress code?"
                      value={faq.question}
                      onChange={(e) => {
                        const next = [...faqs];
                        next[idx] = { ...next[idx], question: e.target.value };
                        setFaqs(next);
                        setIsDirty(true);
                      }}
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground">Answer</Label>
                    <Textarea
                      rows={2}
                      placeholder="Write the answer guests will see…"
                      value={faq.answer}
                      onChange={(e) => {
                        const next = [...faqs];
                        next[idx] = { ...next[idx], answer: e.target.value };
                        setFaqs(next);
                        setIsDirty(true);
                      }}
                      maxLength={400}
                    />
                  </div>
                </div>
              ))}
              {faqs.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 h-32 gap-2 text-muted-foreground/50">
                  <HelpCircle className="h-7 w-7" />
                  <p className="text-sm font-medium">No questions yet — add your first FAQ.</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── GALLERY TAB ── */}
        <TabsContent value="gallery" className="space-y-6 outline-none">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">The Vibe — Photo Gallery</h2>
                <p className="text-muted-foreground text-xs">
                  Photos shown in the gallery mosaic with the fullscreen lightbox. If you add none, the landing page falls back to your hero slide images.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={(gallery.images ?? []).length >= 8}
                onClick={() => setMediaPickerTarget("gallery_add")}
                className="rounded-full gap-1.5 bg-gradient-to-r from-[#FF1A43] to-[#7B16D9] text-white border-none shadow-md shadow-[#FF1A43]/20"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Photo {(gallery.images ?? []).length >= 8 ? "(max 8)" : ""}
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">Section Title</Label>
                <Input
                  placeholder="e.g. The Vibe"
                  value={gallery.title || ""}
                  onChange={(e) => {
                    setGallery((prev) => ({ ...prev, title: e.target.value }));
                    setIsDirty(true);
                  }}
                  maxLength={40}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">Background Word</Label>
                <Input
                  placeholder="e.g. Gallery"
                  value={gallery.eyebrow || ""}
                  onChange={(e) => {
                    setGallery((prev) => ({ ...prev, eyebrow: e.target.value }));
                    setIsDirty(true);
                  }}
                  maxLength={20}
                />
              </div>
            </div>

            {(gallery.images ?? []).length === 0 ? (
              <button
                type="button"
                onClick={() => setMediaPickerTarget("gallery_add")}
                className="w-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 h-40 gap-2 text-muted-foreground/50 hover:border-[#FF1A43]/40 hover:text-[#FF1A43] transition-all cursor-pointer"
              >
                <Images className="h-8 w-8" />
                <p className="text-sm font-medium">No photos yet — using hero slide images as fallback. Click to add.</p>
              </button>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {(gallery.images ?? []).map((img, idx) => (
                  <div key={`${img}-${idx}`} className="group relative h-40 rounded-xl overflow-hidden border bg-gradient-to-br from-[#120820] to-[#1a0a30]">
                    <SecureAssetImage src={img} alt={`Gallery photo ${idx + 1}`} className="w-full h-full object-cover object-center" />
                    <div className="absolute top-2 left-2 h-6 w-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white font-black text-[10px] border border-white/20">
                      {idx + 1}
                    </div>
                    <div className="absolute inset-0 bg-black/45 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        type="button" variant="secondary" size="sm"
                        onClick={() => setMediaPickerTarget(`gallery_image_${idx}`)}
                        className="rounded-full text-[10px] h-7 px-3 shadow-lg"
                      >
                        Replace
                      </Button>
                      <Button
                        type="button" variant="destructive" size="sm"
                        onClick={() => {
                          setGallery((prev) => ({ ...prev, images: (prev.images ?? []).filter((_, i) => i !== idx) }));
                          setIsDirty(true);
                        }}
                        className="rounded-full text-[10px] h-7 px-3 shadow-lg"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── CELLAR TAB ── */}
        <TabsContent value="cellar" className="space-y-6 outline-none">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">The Cellar Section</h2>
              <p className="text-muted-foreground text-xs">The gold-accented spirits &amp; wine showcase.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">Eyebrow</Label>
                <Input
                  placeholder="e.g. The Liquor Boutique"
                  value={cellar.eyebrow || ""}
                  onChange={(e) => { setCellar((p) => ({ ...p, eyebrow: e.target.value })); setIsDirty(true); }}
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">Title</Label>
                <Input
                  placeholder="e.g. Savory Spirits & Wine Cellar"
                  value={cellar.title || ""}
                  onChange={(e) => { setCellar((p) => ({ ...p, title: e.target.value })); setIsDirty(true); }}
                  maxLength={70}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">Description</Label>
              <Textarea
                rows={3}
                placeholder="Describe your cellar collection…"
                value={cellar.description || ""}
                onChange={(e) => { setCellar((p) => ({ ...p, description: e.target.value })); setIsDirty(true); }}
                maxLength={400}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">Section Image</Label>
              <div className="relative h-52 max-w-sm rounded-xl overflow-hidden border bg-gradient-to-br from-[#120820] to-[#1a0a30] group">
                {cellar.image ? (
                  <>
                    <SecureAssetImage src={cellar.image} alt="Cellar preview" className="w-full h-full object-cover object-center" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button type="button" variant="secondary" size="sm" onClick={() => setMediaPickerTarget("cellar_image")} className="rounded-full text-xs shadow-lg">Change</Button>
                      <Button type="button" variant="destructive" size="sm" onClick={() => { setCellar((p) => ({ ...p, image: "" })); setIsDirty(true); }} className="rounded-full text-xs shadow-lg">Remove</Button>
                    </div>
                  </>
                ) : (
                  <button type="button" onClick={() => setMediaPickerTarget("cellar_image")} className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/30 hover:text-white/60 transition-colors">
                    <ImageIcon className="h-7 w-7" />
                    <span className="text-xs font-medium">Choose image (default: liquor shelf)</span>
                  </button>
                )}
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="p-4 border rounded-xl bg-background/50 space-y-3">
                  <Badge variant="outline" className="font-bold text-xs uppercase tracking-widest text-yellow-600 bg-yellow-500/5 border-yellow-500/20">
                    Highlight 0{idx + 1}
                  </Badge>
                  <Input
                    placeholder="Title (e.g. Rare Vintages)"
                    value={cellar.items?.[idx]?.title || ""}
                    onChange={(e) => {
                      setCellar((p) => {
                        const items = [...(p.items ?? [])];
                        if (!items[idx]) items[idx] = { title: "", description: "" };
                        items[idx] = { ...items[idx], title: e.target.value };
                        return { ...p, items };
                      });
                      setIsDirty(true);
                    }}
                    maxLength={40}
                  />
                  <Textarea
                    rows={2}
                    placeholder="Short description…"
                    value={cellar.items?.[idx]?.description || ""}
                    onChange={(e) => {
                      setCellar((p) => {
                        const items = [...(p.items ?? [])];
                        if (!items[idx]) items[idx] = { title: "", description: "" };
                        items[idx] = { ...items[idx], description: e.target.value };
                        return { ...p, items };
                      });
                      setIsDirty(true);
                    }}
                    maxLength={150}
                  />
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── EXPERIENCE TAB ── */}
        <TabsContent value="experience" className="space-y-6 outline-none">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">Experience / Ambiance Section</h2>
              <p className="text-muted-foreground text-xs">The full-width atmosphere banner with the featured space card.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">Eyebrow</Label>
                <Input placeholder="e.g. The Ambiance" value={experience.eyebrow || ""} onChange={(e) => { setExperience((p) => ({ ...p, eyebrow: e.target.value })); setIsDirty(true); }} maxLength={40} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">Title</Label>
                <Input placeholder="e.g. An atmosphere that elevates every moment." value={experience.title || ""} onChange={(e) => { setExperience((p) => ({ ...p, title: e.target.value })); setIsDirty(true); }} maxLength={80} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">Description</Label>
              <Textarea rows={2} placeholder="Set the scene…" value={experience.description || ""} onChange={(e) => { setExperience((p) => ({ ...p, description: e.target.value })); setIsDirty(true); }} maxLength={300} />
            </div>
            <div className="grid gap-6 lg:grid-cols-[320px_1fr] items-start">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">Banner Image</Label>
                <div className="relative h-48 rounded-xl overflow-hidden border bg-gradient-to-br from-[#120820] to-[#1a0a30] group">
                  {experience.image ? (
                    <>
                      <SecureAssetImage src={experience.image} alt="Experience preview" className="w-full h-full object-cover object-center" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button type="button" variant="secondary" size="sm" onClick={() => setMediaPickerTarget("experience_image")} className="rounded-full text-xs shadow-lg">Change</Button>
                        <Button type="button" variant="destructive" size="sm" onClick={() => { setExperience((p) => ({ ...p, image: "" })); setIsDirty(true); }} className="rounded-full text-xs shadow-lg">Remove</Button>
                      </div>
                    </>
                  ) : (
                    <button type="button" onClick={() => setMediaPickerTarget("experience_image")} className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/30 hover:text-white/60 transition-colors">
                      <ImageIcon className="h-7 w-7" />
                      <span className="text-xs font-medium">Choose banner image</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="p-5 border rounded-xl bg-background/50 space-y-4">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Featured Space Card (overlay)</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground">Badge</Label>
                    <Input placeholder="e.g. Featured Space" value={experience.featured_badge || ""} onChange={(e) => { setExperience((p) => ({ ...p, featured_badge: e.target.value })); setIsDirty(true); }} maxLength={30} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground">Space Name</Label>
                    <Input placeholder="e.g. The Garden Terrace" value={experience.featured_title || ""} onChange={(e) => { setExperience((p) => ({ ...p, featured_title: e.target.value })); setIsDirty(true); }} maxLength={50} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground">Space Description</Label>
                  <Textarea rows={2} placeholder="Describe the featured space…" value={experience.featured_description || ""} onChange={(e) => { setExperience((p) => ({ ...p, featured_description: e.target.value })); setIsDirty(true); }} maxLength={220} />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── LOCATION & CTA TAB ── */}
        <TabsContent value="location" className="space-y-6 outline-none">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">Final Call-To-Action</h2>
              <p className="text-muted-foreground text-xs">The big closing section with hours and location.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">CTA Title</Label>
                <Input placeholder="e.g. Ready to join us?" value={finalCta.title} onChange={(e) => { setFinalCta((p) => ({ ...p, title: e.target.value })); setIsDirty(true); }} maxLength={60} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">CTA Description</Label>
                <Input placeholder="e.g. Reserve your table today…" value={finalCta.description} onChange={(e) => { setFinalCta((p) => ({ ...p, description: e.target.value })); setIsDirty(true); }} maxLength={160} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">Opening Hours <span className="normal-case font-normal opacity-60">(one per line)</span></Label>
                <Textarea
                  rows={4}
                  placeholder={"Mon-Thu: 11am - 10pm\nFri-Sat: 11am - 11pm\nSunday: 10am - 9pm"}
                  value={(locationInfo.hours ?? []).join("\n")}
                  onChange={(e) => { setLocationInfo((p) => ({ ...p, hours: e.target.value.split("\n") })); setIsDirty(true); }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">Address <span className="normal-case font-normal opacity-60">(one per line)</span></Label>
                <Textarea
                  rows={4}
                  placeholder={"Bole Road, Friendship Tower\nAddis Ababa"}
                  value={(locationInfo.address ?? []).join("\n")}
                  onChange={(e) => { setLocationInfo((p) => ({ ...p, address: e.target.value.split("\n") })); setIsDirty(true); }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">Phone</Label>
                <Input placeholder="e.g. +251 911 123 456" value={locationInfo.phone || ""} onChange={(e) => { setLocationInfo((p) => ({ ...p, phone: e.target.value })); setIsDirty(true); }} maxLength={30} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">Guest List Strip</h2>
              <p className="text-muted-foreground text-xs">The neon &ldquo;skip the line&rdquo; band above the final CTA. Its button opens the booking form pre-set to Guest List Entry.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">Eyebrow</Label>
                <Input placeholder="e.g. Skip the line" value={guestlist.eyebrow || ""} onChange={(e) => { setGuestlist((p) => ({ ...p, eyebrow: e.target.value })); setIsDirty(true); }} maxLength={40} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">Title</Label>
                <Input placeholder="e.g. Get on the Guest List" value={guestlist.title || ""} onChange={(e) => { setGuestlist((p) => ({ ...p, title: e.target.value })); setIsDirty(true); }} maxLength={60} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">Description</Label>
                <Input placeholder="e.g. Priority entry, a welcome drink…" value={guestlist.description || ""} onChange={(e) => { setGuestlist((p) => ({ ...p, description: e.target.value })); setIsDirty(true); }} maxLength={160} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">Button Label</Label>
                <Input placeholder="e.g. Join Tonight" value={guestlist.cta || ""} onChange={(e) => { setGuestlist((p) => ({ ...p, cta: e.target.value })); setIsDirty(true); }} maxLength={30} />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Edit / Add Dialog ── */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) setIsDialogOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GalleryHorizontalEnd className="h-4 w-4 text-[#FF1A43]" />
              {editingIndex === null ? "Add New Slide" : `Edit Slide ${editingIndex + 1}`}
            </DialogTitle>
            <DialogDescription>
              {editingIndex === null
                ? "Configure the content and image for your new hero slide."
                : "Update the slide content and image."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Image picker */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                Background Image
              </Label>
              <div className="relative h-40 rounded-xl overflow-hidden border bg-gradient-to-br from-[#120820] to-[#1a0a30] group">
                {formData.image ? (
                  <>
                    <SecureAssetImage
                      src={formData.image}
                      alt="Preview"
                      className="w-full h-full object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setMediaPickerTarget("slide")}
                        className="rounded-full text-xs shadow-lg"
                      >
                        Change Image
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setFormData((p) => ({ ...p, image: "" }))}
                        className="rounded-full text-xs shadow-lg"
                      >
                        Remove
                      </Button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMediaPickerTarget("slide")}
                    className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-xs font-medium">Click to choose from Media Library</span>
                  </button>
                )}
              </div>
              {formData.image && (
                <p className="text-[10px] text-muted-foreground truncate">{formData.image}</p>
              )}
            </div>

            {/* Badge */}
            <div className="space-y-2">
              <Label htmlFor="slide-badge" className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                Badge Label <span className="normal-case font-normal opacity-60">(optional)</span>
              </Label>
              <Input
                id="slide-badge"
                placeholder="e.g. VIP Experience, Exclusive Night Out"
                value={formData.badge}
                onChange={(e) => setFormData((p) => ({ ...p, badge: e.target.value }))}
                maxLength={60}
              />
              <p className="text-[10px] text-muted-foreground">
                Appears as a small highlight label above the title. Keep it short.
              </p>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="slide-title" className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                Title <span className="text-[#FF1A43]">*</span>
              </Label>
              <Input
                id="slide-title"
                placeholder="e.g. Feel the Night Energy."
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                maxLength={80}
                required
              />
            </div>

            {/* Subtitle */}
            <div className="space-y-2">
              <Label htmlFor="slide-subtitle" className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                Subtitle <span className="normal-case font-normal opacity-60">(optional)</span>
              </Label>
              <Textarea
                id="slide-subtitle"
                placeholder="e.g. Step into Addis Ababa's premier luxury lounge…"
                value={formData.subtitle}
                onChange={(e) => setFormData((p) => ({ ...p, subtitle: e.target.value }))}
                rows={3}
                maxLength={200}
              />
              <p className="text-[10px] text-muted-foreground">
                Short description shown below the title. 20 words max recommended.
              </p>
            </div>

            {/* Inline preview — show whenever there's any content to preview */}
            {(formData.image || formData.title || formData.badge) && (
              <div className="rounded-xl overflow-hidden border">
                <SliderPreview slides={[formData]} active={0} />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDialogSave}
              className="rounded-full px-6 bg-gradient-to-r from-[#FF1A43] to-[#7B16D9] hover:from-[#e0173a] hover:to-[#6912be] text-white"
            >
              {editingIndex === null ? "Add Slide" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Media Picker Dialog ── */}
      <Dialog
        open={mediaPickerTarget !== null}
        onOpenChange={(next) => {
          if (!next) setMediaPickerTarget(null);
        }}
      >
        <DialogContent className="flex h-[80vh] max-w-[1000px] flex-col p-0 overflow-hidden rounded-[2rem]">
          <div className="flex items-center justify-between border-b px-6 py-4 bg-background/50 backdrop-blur-md">
            <div>
              <DialogTitle>Media Library</DialogTitle>
              <DialogDescription>
                {mediaPickerTarget === "specialties"
                  ? "Select a main image for the specialties section"
                  : typeof mediaPickerTarget === "string" && mediaPickerTarget.startsWith("service_image_")
                  ? "Select a showcase image for this service card"
                  : mediaPickerTarget === "gallery_add" || (typeof mediaPickerTarget === "string" && mediaPickerTarget.startsWith("gallery_image_"))
                  ? "Select a photo for the gallery"
                  : mediaPickerTarget === "cellar_image"
                  ? "Select an image for the cellar section"
                  : mediaPickerTarget === "experience_image"
                  ? "Select a banner image for the experience section"
                  : mediaPickerTarget === "menus_image"
                  ? "Select a showcase image for the menus section"
                  : mediaPickerTarget === "menus_model"
                  ? "Select a 3D model (.glb / .gltf) for the menus section"
                  : "Select an image for this slide"}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMediaPickerTarget(null)}
              className="rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="file-picker-wrapper relative flex-1 overflow-hidden">
            <style
              dangerouslySetInnerHTML={{
                __html: `
                .file-picker-wrapper > div > div:nth-child(1),
                .file-picker-wrapper > div > div:nth-child(2) > div:nth-child(2) { display: none !important; }
                .file-picker-wrapper > div { height: 100% !important; min-height: 100% !important; margin: 0 !important; }
              `,
              }}
            />
            <FileManagerClient
              isPickerMode={true}
              onFileSelect={handleFileSelect}
              access={{ canRead: canBrowseAssetLibrary, canManage: canManageStorage }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
