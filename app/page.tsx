"use client";

import {
  ArrowRight,
  ArrowUp,
  BatteryCharging,
  Boxes,
  Building2,
  Calculator,
  Car,
  Check,
  CheckCircle2,
  ChevronRight,
  CloudLightning,
  Code2,
  Database,
  FileText,
  Globe,
  Network,
  PieChart,
  ShieldCheck,
  SmartphoneNfc,
  Wallet,
  Zap,
} from "lucide-react";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/store/use-translation";
import { LandingNavbar } from "@/modules/landing/components/landing-navbar";
import { LandingHero } from "@/modules/landing/components/landing-hero";
import { LandingProof } from "@/modules/landing/components/landing-proof";
import { LandingMetrics } from "@/modules/landing/components/landing-metrics";
import { LandingSecurity } from "@/modules/landing/components/landing-security";
import { LandingCompare } from "@/modules/landing/components/landing-compare";
import { Reveal, RevealGroup, RevealItem, SpotlightCard } from "@/modules/landing/components/reveal";
import {
  Eyebrow,
  IconPlate,
  SectionHeading,
  SectionShell,
  WindowChrome,
} from "@/modules/landing/components/section";
import { EASE, springSoft } from "@/modules/landing/motion";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  getBackendApiRoot,
  getPublicServeUrl,
  getTenantHeaders,
  getTenantId,
  getWorkspaceScopeKey,
  isTenantHost,
} from "@/lib/runtime-context";
import { resolveLandingTemplate } from "@/modules/tenancy/landing-template";
import { TenantBusinessLanding } from "@/modules/tenancy/components/tenant-business-landing";
import { RestaurantLandingTemplate } from "@/modules/tenancy/components/restaurant-landing-template";
import LmsLandingTemplate from "@/modules/tenancy/components/lms-landing-template";
import B2BLandingTemplate from "@/modules/tenancy/components/b2b-landing-template";
import { MarketplacePreloader } from "@/modules/b2b-marketplace/components/MarketplacePreloader";
import { formatDocumentTitle } from "@/lib/document-title";

interface LandingUIProps {
  initialPortalName: string;
  initialTenantSlug: string;
  initialIsTenant: boolean;
}

type PartnerLogo = {
  name: string;
  logo: string;
};

type HexParticle = {
  update: () => void;
};

// 🚀 SAFE LOGO COMPONENT
// This uses a native <img> tag to completely bypass CORS preflight issues for public assets.
// It instantly switches to your beautiful text fallbacks if the URL is broken.
function SafeLogo({
  src,
  alt,
  className,
  fallback,
}: {
  src: string | null;
  alt: string;
  className: string;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  // Reset the failed state if the source URL changes (e.g. switching Dark/Light mode)
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

type FooterLink = { label: string; href?: string; section?: string };

/** Footer link list. Renders a real anchor or a scroll button — never dead text. */
function FooterColumn({
  title,
  links,
  onSection,
}: {
  title: string;
  links: FooterLink[];
  onSection: (id: string) => void;
}) {
  const itemClass =
    "group flex items-center gap-2 text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:text-primary";
  const dot = (
    <span className="h-1 w-1 shrink-0 rounded-full bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
  );

  return (
    <div>
      <h4 className="mb-6 font-space font-bold uppercase tracking-wider text-foreground">
        {title}
      </h4>
      <ul className="space-y-3 text-sm font-medium text-muted-foreground">
        {links.map((link) => (
          <li key={link.label}>
            {link.href ? (
              <Link href={link.href} className={itemClass}>
                {dot}
                {link.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => link.section && onSection(link.section)}
                className={itemClass}
              >
                {dot}
                {link.label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Payslip line item — keeps the label/amount rhythm identical down the card. */
function Row({
  label,
  value,
  currency,
  tone = "default",
  muted,
}: {
  label: string;
  value: string;
  currency: string;
  tone?: "default" | "negative";
  muted?: boolean;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", muted && "text-[11px]")}>
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          tone === "negative" && "text-destructive",
          muted && "text-muted-foreground",
        )}
      >
        {value} <span className="text-muted-foreground">{currency}</span>
      </span>
    </div>
  );
}

// --- JS DRIVEN INFINITE SCROLL PARTNER COMPONENT ---
const PartnerSlider = ({ partners }: { partners: PartnerLogo[] }) => {
  const { t } = useTranslation();
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let animationFrameId: number;
    let isHovered = false;

    const handleMouseEnter = () => (isHovered = true);
    const handleMouseLeave = () => (isHovered = false);

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        scroller.scrollLeft += e.deltaY;
      }
    };

    scroller.addEventListener("mouseenter", handleMouseEnter);
    scroller.addEventListener("mouseleave", handleMouseLeave);
    scroller.addEventListener("wheel", handleWheel, { passive: false });

    const scrollStep = () => {
      if (!isHovered) {
        scroller.scrollLeft += 0.5;
      }

      if (scroller.scrollLeft >= scroller.scrollWidth / 2) {
        scroller.scrollLeft -= scroller.scrollWidth / 2;
      } else if (scroller.scrollLeft <= 0) {
        scroller.scrollLeft += scroller.scrollWidth / 2;
      }

      animationFrameId = requestAnimationFrame(scrollStep);
    };

    animationFrameId = requestAnimationFrame(scrollStep);

    return () => {
      cancelAnimationFrame(animationFrameId);
      scroller.removeEventListener("mouseenter", handleMouseEnter);
      scroller.removeEventListener("mouseleave", handleMouseLeave);
      scroller.removeEventListener("wheel", handleWheel);
    };
  }, []);

  return (
    <div className="w-full bg-background/50 backdrop-blur-sm border-y border-border py-12 overflow-hidden relative z-10 shadow-inner">
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent z-20 pointer-events-none"></div>
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent z-20 pointer-events-none"></div>

      <div className="text-center font-mono text-xs text-muted-foreground mb-10 tracking-widest uppercase">
        {t('landing.partners.title', 'Ecosystem Integrations & Partners')}
      </div>

      <div
        ref={scrollerRef}
        className="flex overflow-x-auto no-scrollbar w-full cursor-grab active:cursor-grabbing"
      >
        {[1, 2, 3, 4].map((arrayIndex) => (
          <div
            key={arrayIndex}
            className="flex shrink-0 gap-6 items-center pr-6"
          >
            {partners.map((partner, i) => {
              return (
                <div
                  key={`${arrayIndex}-${i}`}
                  className="flex items-center gap-4 px-8 py-4 bg-card/40 backdrop-blur-md border border-border/50 rounded-2xl hover:border-primary/50 hover:bg-card/80 transition-all duration-300 group shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_rgba(255,255,255,0.02)]"
                >
                  <div className="w-12 h-12 p-2 rounded-xl bg-background/80 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm overflow-hidden relative">
                    <img
                      src={partner.logo}
                      alt={`${partner.name} logo`}
                      className="max-w-full max-h-full object-contain"
                      suppressHydrationWarning
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                  <span className="text-lg font-bold font-space tracking-wider text-muted-foreground group-hover:text-foreground transition-colors duration-300 whitespace-nowrap">
                    {partner.name}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

function LandingUI({
  initialPortalName = "HIVE.OS",
  initialTenantSlug = "hive",
  initialIsTenant = false,
}: Partial<LandingUIProps>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const { t, locale } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // SCROLL TO TOP STATE
  const [showScrollTop, setShowScrollTop] = useState(false);
  const detectedTenantSlug =
    mounted && typeof window !== "undefined"
      ? getTenantId() || initialTenantSlug
      : initialTenantSlug;
  const workspaceScope = getWorkspaceScopeKey();
  const isTenantExperience =
    mounted && typeof window !== "undefined"
      ? isTenantHost(window.location.hostname)
      : initialIsTenant;

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 🚀 FETCH PUBLIC BRAND SETTINGS
  const { data: brandData } = useQuery({
    queryKey: ["publicBrandSettings", detectedTenantSlug, isTenantExperience, workspaceScope],
    queryFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/settings/brand/public`, {
        headers: {
          Accept: "application/json",
          ...getTenantHeaders(),
        },
      });
      if (!res.ok) throw new Error("Failed to fetch brand settings");
      return res.json();
    },
    staleTime: 600000,
    retry: 1,
  });

  const { data: tenantLandingData, isLoading: isLoadingTenantLanding } = useQuery({
    queryKey: ["tenantPublicLanding", detectedTenantSlug],
    queryFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/tenant/public/landing`, {
        headers: {
          Accept: "application/json",
          ...getTenantHeaders(),
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch tenant landing settings");
      }

      return res.json();
    },
    enabled: isTenantExperience,
    staleTime: 300000,
    retry: 1,
  });

  const brandSettings = brandData?.data;
  const tenantLandingPayload = tenantLandingData?.data;

  // Default to Dark Mode during hydration
  const isDark = mounted ? resolvedTheme === "dark" : true;

  // 🎨 DYNAMIC ASSET RESOLUTION
  const rawLogoUrl = useMemo(() => {
    const darkLogo = brandSettings?.logo_dark;
    const lightLogo = brandSettings?.logo_light;
    const activeLogo = isDark ? darkLogo || lightLogo : lightLogo || darkLogo;
    // Landing page is unauthenticated — the logo must resolve publicly.
    return getPublicServeUrl(activeLogo);
  }, [brandSettings, isDark]);

  const appTitle = brandSettings?.app_title || initialPortalName;

  // 🌍 BROWSER METADATA SYNC
  useEffect(() => {
    if (brandSettings?.favicon) {
      const favUrl = getPublicServeUrl(brandSettings.favicon);
      let link: HTMLLinkElement | null =
        document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.getElementsByTagName("head")[0].appendChild(link);
      }
      if (favUrl) link.href = favUrl;
    }
    if (brandSettings?.app_title) {
      if (isTenantExperience && tenantLandingPayload?.business_type === "lms") {
        return;
      }

      document.title = isTenantExperience
        ? formatDocumentTitle(brandSettings.app_title)
        : formatDocumentTitle("Enterprise Operations", brandSettings.app_title);
    }
  }, [brandSettings, isTenantExperience, tenantLandingPayload?.business_type]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  // Hexagon Background Logic
  useEffect(() => {
    if (isTenantExperience) {
      return;
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        let hexagons: HexParticle[] = [];

        const isDarkNow = document.documentElement.classList.contains("dark");
        const r = isDarkNow ? 255 : 180;
        const g = isDarkNow ? 183 : 83;
        const b = isDarkNow ? 0 : 9;

        class Hex {
          x: number;
          y: number;
          size: number;
          speed: number;
          opacity: number;
          constructor() {
            this.x = Math.random() * (canvas?.width || 0);
            this.y = Math.random() * (canvas?.height || 0);
            this.size = Math.random() * 20 + 5;
            this.speed = Math.random() * 0.3 + 0.1;
            this.opacity = Math.random() * 0.4;
          }
          draw() {
            if (!ctx) return;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              ctx.lineTo(
                this.x + this.size * Math.cos((i * 2 * Math.PI) / 6),
                this.y + this.size * Math.sin((i * 2 * Math.PI) / 6),
              );
            }
            ctx.closePath();
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${this.opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
          update() {
            if (!canvas) return;
            this.y -= this.speed;
            if (this.y < -50) this.y = canvas.height + 50;
            this.draw();
          }
        }

        const initHex = () => {
          for (let i = 0; i < 60; i++) hexagons.push(new Hex());
        };
        const animateHex = () => {
          if (!canvas || !ctx) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          hexagons.forEach((hex) => hex.update());
          requestAnimationFrame(animateHex);
        };

        initHex();
        animateHex();

        const handleResize = () => {
          if (!canvas) return;
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          hexagons = [];
          initHex();
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
      }
    }
  }, [isTenantExperience, resolvedTheme]);

  const partners = [
    { name: t('landing.partners.cbe', 'COMMERCIAL BANK'), logo: "/logos/cbe.png" },
    { name: t('landing.partners.telebirr', 'TELEBIRR'), logo: "/logos/telebirr.png" },
    { name: t('landing.partners.chapa', 'CHAPA'), logo: "/logos/chapa.png" },
    { name: t('landing.partners.safaricom', 'SAFARICOM'), logo: "/logos/safaricom.png" },
    { name: t('landing.partners.arifpay', 'ARIFPAY'), logo: "/logos/arifpay.png" },
    { name: t('landing.partners.insa', 'INSA SECURED'), logo: "/logos/insa.png" },
    { name: t('landing.partners.ethiotelecom', 'ETHIO TELECOM'), logo: "/logos/ethiotelecom.png" },
  ];

  // `landing.platform_faq.*`, not `landing.faq.*`: the restaurant tenant
  // template uses landing.faq.q1..q4 for its own questions ("What is the dress
  // code?"), and whichever dictionary seeded last won — the platform FAQ was
  // rendering restaurant copy. The two namespaces can no longer collide.
  const faqs = [
    {
      q: t('landing.platform_faq.q1', 'Does Hive ERP work during internet outages?'),
      a: t('landing.platform_faq.a1', 'Yes. Our mobile apps and POS systems feature offline-sync. They store data locally and automatically push to the central cloud once connection is restored.'),
    },
    {
      q: t('landing.platform_faq.q2', 'Is our corporate data stored locally in Ethiopia?'),
      a: t('landing.platform_faq.a2', 'We offer hybrid deployments. You can choose to host your Node on our secure AWS infrastructure, or deploy an On-Premise instance directly within your local data center for strict INSA compliance.'),
    },
    {
      q: t('landing.platform_faq.q3', 'Can we integrate existing legacy software?'),
      a: t('landing.platform_faq.a3', 'Absolutely. Hive comes with a comprehensive REST API and webhooks, allowing Techive Technology Solutions to build custom bridges to your existing software.'),
    },
    {
      q: t('landing.platform_faq.q4', 'How does the multi-tenant architecture work?'),
      a: t('landing.platform_faq.a4', 'Each company gets its own isolated database schema. This guarantees zero data-bleed between clients while allowing us to push instantaneous system updates to everyone simultaneously.'),
    },
  ];

  if (isTenantExperience) {
    if (isLoadingTenantLanding) {
      // Savory keeps its lounge spinner; every other tenant gets the marketplace preloader.
      if (detectedTenantSlug === "savory-lounge") {
        return (
          <div className="flex h-screen w-screen items-center justify-center bg-[#080510]">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#FF1A43] border-t-transparent" />
              <p className="text-white/60 font-black tracking-widest text-xs uppercase">
                Loading {brandSettings?.app_title || "Savory Lounge"}...
              </p>
            </div>
          </div>
        );
      }
      return <MarketplacePreloader brandName={brandSettings?.app_title || detectedTenantSlug} />;
    }

    const businessType = tenantLandingPayload?.business_type;
    const isRestaurant = businessType === "restaurant" || detectedTenantSlug === "savory-lounge";

    if (isRestaurant) {
      return (
        <RestaurantLandingTemplate 
          brandSettings={brandSettings}
          template={resolveLandingTemplate(tenantLandingPayload?.landing_page_template)}
          tenantName={
            tenantLandingPayload?.tenant?.name ||
            brandSettings?.app_title ||
            detectedTenantSlug ||
            t('landing.common.tenant_workspace', "Tenant Workspace")
          }
        />
      );
    }

    if (businessType === "b2b") {
      return (
        <B2BLandingTemplate
          brandSettings={brandSettings}
          template={resolveLandingTemplate(tenantLandingPayload?.landing_page_template)}
          tenantName={
            tenantLandingPayload?.tenant?.name ||
            brandSettings?.app_title ||
            detectedTenantSlug ||
            t('landing.common.tenant_workspace', "Tenant Workspace")
          }
        />
      );
    }

    if (businessType === "lms") {
      return (
        <LmsLandingTemplate
          brandSettings={brandSettings}
          template={resolveLandingTemplate(tenantLandingPayload?.landing_page_template)}
          tenantName={
            tenantLandingPayload?.tenant?.name ||
            brandSettings?.app_title ||
            detectedTenantSlug ||
            t('landing.common.tenant_workspace', "Tenant Workspace")
          }
        />
      );
    }

    return (
      <TenantBusinessLanding
        brandSettings={brandSettings}
        businessLabel={
          tenantLandingPayload?.business_type_meta?.label ||
          tenantLandingPayload?.business_type ||
          t('landing.common.general_business', "General Business")
        }
        template={resolveLandingTemplate(
          tenantLandingPayload?.landing_page_template,
        )}
        tenantName={
          tenantLandingPayload?.tenant?.name ||
          brandSettings?.app_title ||
          detectedTenantSlug ||
          t('landing.common.tenant_workspace', "Tenant Workspace")
        }
      />
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-background text-foreground font-sans selection:bg-primary/20 overflow-x-hidden">
      {/* 🚀 SCROLL TO TOP BUTTON */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 12 }}
            transition={springSoft}
            className="fixed bottom-8 right-8 z-[100]"
          >
            <Button
              onClick={scrollToTop}
              size="icon"
              aria-label={t("landing.nav.back_to_top", "Back to top")}
              className="h-12 w-12 rounded-full border border-primary/20 bg-primary/90 text-primary-foreground shadow-2xl shadow-primary/30 transition-all duration-300 hover:-translate-y-1 hover:bg-primary"
            >
              <ArrowUp className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- BACKGROUND --- */}
      <div className="tech-grid fixed inset-0 z-0 pointer-events-none opacity-40" />
      <div className="vignette fixed inset-0 z-0 pointer-events-none" />

      {/* --- NAVBAR --- */}
      <LandingNavbar
        isTenant={initialIsTenant}
        onNavigateSection={scrollToSection}
        brand={
          <SafeLogo
            src={rawLogoUrl}
            alt={appTitle}
            className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
            fallback={
              <div className="flex items-center gap-2">
                <Globe className="text-primary h-5 w-5 transition-transform duration-700 group-hover:rotate-180" />
                <span>{appTitle}</span>
              </div>
            }
          />
        }
      />

      {/* --- HERO SECTION --- */}
      <LandingHero
        isTenant={initialIsTenant}
        appTitle={appTitle}
        canvasSlot={
          <canvas
            id="hive-canvas"
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
          />
        }
      />

      {/* --- PLATFORM FACTS --- */}
      <LandingMetrics />

      {/* --- BENTO GRID MODULES --- */}
      <SectionShell id="modules" tone="base" glow="primary">
        <SectionHeading
          eyebrow={t("landing.modules.badge", "All-in-one solution")}
          title={t("landing.modules.title_part1", "Unified")}
          accent={t("landing.modules.title_part2", "Ecosystem")}
          description={t(
            "landing.modules.desc",
            "Stop switching between ten different spreadsheets. Hive centralizes every aspect of your Ethiopian business operations into one seamless dashboard.",
          )}
        />

        {/* No fixed row height: the finance tile's inner ledger panel is taller
            than half the grid, and a hard `h-[34rem]` made it overflow its own
            card. Rows size to the tallest content and the spanning tile
            stretches to match. */}
        <RevealGroup
          step={0.1}
          className="grid grid-cols-1 gap-4 md:grid-cols-4 md:grid-rows-2"
        >
          <RevealItem variant="scale" className="min-h-0 md:col-span-2 md:row-span-2">
            <SpotlightCard className="group flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-border/70 bg-card/40 p-8 backdrop-blur-sm transition-colors duration-300 hover:border-primary/40">
              <div
                aria-hidden
                className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl transition-colors duration-700 group-hover:bg-primary/20"
              />
              <div className="relative">
                <IconPlate size="lg" className="mb-6">
                  <Wallet className="h-7 w-7" />
                </IconPlate>
                <h3 className="mb-3 font-space text-2xl font-bold tracking-tight md:text-3xl">
                  {t("landing.modules.finance_title", "Intelligent Finance")}
                </h3>
                <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                  {t(
                    "landing.modules.finance_desc",
                    "Automated ERCA tax compliance, local bank API integrations for immediate reconciliation, and multi-currency ledger management (ETB/USD).",
                  )}
                </p>
              </div>

              <div className="relative mt-8 overflow-hidden rounded-2xl border border-border/70 bg-background/70">
                <WindowChrome
                  label={t("landing.modules.ledger_label", "Ledger sync")}
                  status={t("landing.modules.ledger_status", "Auto")}
                />
                <div className="divide-y divide-border/60">
                  {[
                    {
                      k: t("landing.modules.telebirr_sync", "Telebirr Sync"),
                      v: t("landing.preview.success", "SUCCESS"),
                    },
                    {
                      k: t("landing.modules.vat_calc", "VAT Calculation"),
                      v: t("landing.modules.automated", "AUTOMATED"),
                    },
                    {
                      k: t("landing.modules.cbe_recon", "CBE Reconciliation"),
                      v: t("landing.modules.matched", "MATCHED"),
                    },
                  ].map((row) => (
                    <div
                      key={row.k}
                      className="flex items-center justify-between px-4 py-2.5 font-mono text-[12px]"
                    >
                      <span className="text-muted-foreground">{row.k}</span>
                      <span className="flex items-center gap-1.5 text-primary">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {row.v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </SpotlightCard>
          </RevealItem>

          <RevealItem variant="scale" className="min-h-0 md:col-span-2 md:row-span-1">
            <SpotlightCard className="flex h-full items-start gap-5 overflow-hidden rounded-3xl border border-border/70 bg-card/40 p-8 backdrop-blur-sm transition-colors duration-300 hover:border-primary/40">
              <IconPlate size="lg">
                <Boxes className="h-6 w-6" />
              </IconPlate>
              <div>
                <h3 className="mb-2 font-space text-xl font-bold">
                  {t("landing.modules.inventory_title", "Inventory Management")}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(
                    "landing.modules.inventory_desc",
                    "Multi-branch stock syncing, automated reorder triggers, and warehouse routing.",
                  )}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    t("landing.modules.tag_reorder", "Reorder points"),
                    t("landing.modules.tag_transfers", "Branch transfers"),
                    t("landing.modules.tag_batch", "Batch & expiry"),
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </SpotlightCard>
          </RevealItem>

          <RevealItem variant="scale" className="min-h-0 md:col-span-1 md:row-span-1">
            <SpotlightCard className="flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-border/70 bg-card/40 p-7 backdrop-blur-sm transition-colors duration-300 hover:border-primary/40">
              <IconPlate size="lg" className="mb-5">
                <ShieldCheck className="h-6 w-6" />
              </IconPlate>
              <div>
                <h3 className="mb-2 font-space text-xl font-bold">
                  {t("landing.modules.compliance_title", "Compliance")}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("landing.modules.compliance_desc", "INSA & NBE aligned reporting.")}
                </p>
              </div>
            </SpotlightCard>
          </RevealItem>

          <RevealItem variant="scale" className="min-h-0 md:col-span-1 md:row-span-1">
            <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-3xl bg-primary p-7 text-primary-foreground shadow-xl shadow-primary/20 transition-transform duration-300 hover:-translate-y-0.5">
              <div
                aria-hidden
                className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary-foreground/10 blur-2xl"
              />
              <PieChart className="relative mb-5 h-9 w-9 opacity-90" />
              <div className="relative">
                <h3 className="mb-2 font-space text-xl font-bold">
                  {t("landing.modules.bi_title", "Real-Time BI")}
                </h3>
                <p className="text-sm text-primary-foreground/80">
                  {t("landing.modules.bi_desc", "Predictive operational analytics.")}
                </p>
              </div>
            </div>
          </RevealItem>
        </RevealGroup>
      </SectionShell>

      {/* --- FINTECH & PAYMENT GATEWAY INTEGRATION --- */}
      <SectionShell id="fintech" tone="raised" glow="primary">
        {/* `title_lead` is a new key on purpose. `title_part1` is seeded in the
            backend dictionary as the bare word "Native", and a stored value
            always beats the default written here — the heading rendered as
            "Native Sync". Same reason the FAQ heading below uses `title_lead`. */}
        <SectionHeading
          eyebrow={t("landing.fintech.pill", "Financial ecosystem")}
          title={t("landing.fintech.title_lead", "Native payment gateway")}
          accent={t("landing.fintech.title_part3", "Sync")}
          description={t(
            "landing.fintech.desc",
            "We understand the Ethiopian financial landscape. Hive bridges the gap between your operational ERP and localized payment processors.",
          )}
        />

        <RevealGroup step={0.1} className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            {
              icon: Zap,
              title: t("landing.fintech.chapa_title", "Chapa & ArifPay Ready"),
              desc: t(
                "landing.fintech.chapa_desc",
                "Connect directly to Ethiopia's leading modern payment gateways. Auto-reconcile invoices, track digital disbursements, and accept mobile payments natively.",
              ),
            },
            {
              icon: Building2,
              title: t("landing.fintech.nbe_title", "NBE Criteria Compliant"),
              desc: t(
                "landing.fintech.nbe_desc",
                "Our financial modules strictly adhere to the regulatory criteria set by the National Bank of Ethiopia, ensuring your reporting and ledger management remain fully compliant.",
              ),
            },
            {
              icon: Network,
              title: t("landing.fintech.routing_title", "Multi-Channel Routing"),
              desc: t(
                "landing.fintech.routing_desc",
                "Process payroll directly to CBE, distribute funds via Telebirr, or handle card payments seamlessly across branches with centralized, real-time oversight.",
              ),
            },
          ].map(({ icon: Icon, title, desc }) => (
            <RevealItem key={title} variant="scale">
              <SpotlightCard className="group h-full rounded-3xl border border-border/70 bg-background/60 p-8 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5">
                <IconPlate size="lg" className="mb-6 transition-transform group-hover:scale-105">
                  <Icon className="h-6 w-6" />
                </IconPlate>
                <h3 className="mb-3 font-space text-xl font-bold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </SpotlightCard>
            </RevealItem>
          ))}
        </RevealGroup>

        {/* Settlement strip: makes the reconciliation claim concrete. */}
        <Reveal variant="scale" className="mt-6">
          <div className="overflow-hidden rounded-3xl border border-border/70 bg-background/60 backdrop-blur-sm">
            <WindowChrome
              label={t("landing.fintech.settlement_label", "Settlement queue")}
              status={t("landing.fintech.settlement_status", "Reconciled")}
            />
            <div className="grid divide-y divide-border/60 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
              {[
                { rail: "Telebirr", amount: "412,900", count: "184" },
                { rail: "CBE Birr", amount: "1,204,500", count: "96" },
                { rail: "Chapa", amount: "88,240", count: "51" },
                { rail: "ArifPay", amount: "247,110", count: "77" },
              ].map((row) => (
                <div
                  key={row.rail}
                  className="border-border/60 px-6 py-5 sm:border-r sm:last:border-r-0"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {row.rail}
                  </p>
                  <p className="mt-2 font-space text-xl font-bold tabular-nums">
                    {row.amount}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      {t("landing.hr.currency", "ETB")}
                    </span>
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-primary">
                    {row.count} {t("landing.fintech.txns", "txns matched")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </SectionShell>

      {/* --- SMART MOBILITY & INFRASTRUCTURE --- */}
      <SectionShell id="mobility" tone="base" glow="cool">
        <div className="flex flex-col items-center gap-14 lg:flex-row lg:gap-16">
          <Reveal className="flex-1">
            <Eyebrow align="left">
              {t("landing.mobility.badge", "Infrastructure modules")}
            </Eyebrow>
            <h2 className="mb-6 text-balance font-space text-[2.1rem] font-bold leading-[1.08] tracking-[-0.02em] md:text-5xl">
              {t("landing.mobility.title_part1", "Smart mobility &")}{" "}
              <span className="font-serif font-normal italic tracking-[-0.03em] text-primary">
                {t("landing.mobility.title_part2", "Fleet Operations")}
              </span>
            </h2>
            <p className="mb-9 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              {t(
                "landing.mobility.desc",
                "Expand beyond basic tracking. Hive features advanced integration capabilities for municipalities, transit authorities, and logistics giants.",
              )}
            </p>
            <ul className="space-y-6">
              {[
                {
                  icon: Car,
                  title: t(
                    "landing.mobility.traffic_title",
                    "Smart Traffic & Toll Management",
                  ),
                  desc: t(
                    "landing.mobility.traffic_desc",
                    "Automate toll collection and traffic violation processing via direct API integration with Telebirr and local transit databases.",
                  ),
                },
                {
                  icon: BatteryCharging,
                  title: t("landing.mobility.ev_title", "EV Dashboard Integration"),
                  desc: t(
                    "landing.mobility.ev_desc",
                    "Manage an Electric Vehicle fleet with specialized dashboard modules tracking battery health, charging node status, and route optimization.",
                  ),
                },
              ].map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex gap-4">
                  <IconPlate accent="cool">
                    <Icon className="h-5 w-5" />
                  </IconPlate>
                  <div>
                    <h4 className="mb-1 font-space font-bold">{title}</h4>
                    <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal variant="scale" className="w-full flex-1">
            <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/60 shadow-2xl shadow-background backdrop-blur-sm">
              <WindowChrome
                label={t("landing.mobility.node_id", "Node // Mobility")}
                status={t("landing.mobility.telebirr_sync", "Telebirr sync active")}
                accent="cool"
              />
              <div className="p-6">
                <div className="mb-6 flex items-end justify-between gap-4">
                  <div>
                    <h3 className="font-space text-lg font-bold leading-tight">
                      {t("landing.mobility.active_tolls", "Active Tolls (A.A. Expressway)")}
                    </h3>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      {t("landing.mobility.gantry", "Gantry 04 · Northbound")}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-space text-3xl font-bold tabular-nums text-sky-500">
                      842
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t("landing.mobility.vehicles_processed_hr", "Vehicles / hr")}
                    </div>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {[
                    {
                      plate: "A 42315 AA",
                      status: t("landing.mobility.cleared", "CLEARED"),
                      tone: "text-primary bg-primary/10",
                      amount: "45.00",
                    },
                    {
                      plate: "B 19482 OR",
                      status: t("landing.mobility.pending", "PENDING"),
                      tone: "text-amber-500 bg-amber-500/10",
                      amount: "120.00",
                    },
                    {
                      plate: "EV 00412 AA",
                      status: t("landing.mobility.exempt", "EXEMPT"),
                      tone: "text-sky-500 bg-sky-500/10",
                      amount: "0.00",
                    },
                  ].map((row) => (
                    <div
                      key={row.plate}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 p-3"
                    >
                      <span className="rounded-md bg-muted px-2 py-1 font-mono text-[13px] font-bold tracking-tight">
                        {row.plate}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider",
                          row.tone,
                        )}
                      >
                        {row.status}
                      </span>
                      <span className="font-mono text-[13px] tabular-nums">
                        {row.amount}{" "}
                        <span className="text-muted-foreground">
                          {t("landing.hr.currency", "ETB")}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </SectionShell>

      {/* --- LOCALIZED HR & PAYROLL --- */}
      <SectionShell id="hr" tone="raised" glow="primary">
        <div className="flex flex-col items-center gap-14 lg:flex-row lg:gap-16">
          <Reveal variant="scale" className="order-2 w-full flex-1 lg:order-1">
            <div className="relative mx-auto max-w-sm">
              <div
                aria-hidden
                className="absolute left-1/2 top-1/2 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[90px]"
              />
              <div className="overflow-hidden rounded-3xl border border-border/70 bg-background/80 shadow-2xl shadow-background backdrop-blur-sm transition-transform duration-500 hover:-translate-y-1">
                <WindowChrome
                  label={t("landing.hr.payslip_title", "Payslip generation")}
                  status={t("landing.hr.payslip_status", "Approved")}
                />
                <div className="space-y-3.5 p-6 font-mono text-[13px]">
                  <Row
                    label={t("landing.hr.gross_salary", "Gross Salary")}
                    value="25,000.00"
                    currency={t("landing.hr.currency", "ETB")}
                  />
                  <Row
                    label={t("landing.hr.income_tax", "Income Tax (ERCA)")}
                    value="-4,550.00"
                    currency={t("landing.hr.currency", "ETB")}
                    tone="negative"
                  />
                  <Row
                    label={t("landing.hr.pension_emp", "Pension (7% Emp)")}
                    value="-1,750.00"
                    currency={t("landing.hr.currency", "ETB")}
                    tone="negative"
                  />
                  <div className="h-px bg-border/70" />
                  <Row
                    label={t("landing.hr.pension_boss", "Employer Pension (11%)")}
                    value="2,750.00"
                    currency={t("landing.hr.currency", "ETB")}
                    muted
                  />
                  <div className="h-px bg-border/70" />
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="font-space text-sm font-bold">
                      {t("landing.hr.net_pay", "Net Pay")}
                    </span>
                    <span className="font-space text-2xl font-bold tabular-nums text-primary">
                      18,700.00{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        {t("landing.hr.currency", "ETB")}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t border-border/60 bg-primary/5 px-6 py-3">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {t("landing.hr.payslip_note", "Bands applied automatically")}
                  </span>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal className="order-1 flex-1 lg:order-2">
            <Eyebrow align="left">{t("landing.hr.badge", "Human resources")}</Eyebrow>
            <h2 className="mb-6 text-balance font-space text-[2.1rem] font-bold leading-[1.08] tracking-[-0.02em] md:text-5xl">
              {t("landing.hr.title_part1", "Ethiopian")}{" "}
              <span className="font-serif font-normal italic tracking-[-0.03em] text-primary">
                {t("landing.hr.title_part2", "Payroll & Pension")}
              </span>
            </h2>
            <p className="mb-9 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              {t(
                "landing.hr.desc",
                "Managing payroll shouldn't require a master's degree in tax law. Hive automatically handles ERCA tax brackets and POESSA pension splits for your entire workforce.",
              )}
            </p>
            <ul className="space-y-6">
              {[
                {
                  icon: Calculator,
                  title: t("landing.hr.deductions_title", "Automated Deductions"),
                  desc: t(
                    "landing.hr.deductions_desc",
                    "System auto-calculates the progressive income tax tiers and exact 7% (Employee) / 11% (Employer) pension splits instantly.",
                  ),
                },
                {
                  icon: FileText,
                  title: t("landing.hr.compliance_title", "Compliance Reporting"),
                  desc: t(
                    "landing.hr.compliance_desc",
                    "Generate month-end Ministry of Revenue and Pension Agency declaration formats with one click.",
                  ),
                },
              ].map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex gap-4">
                  <IconPlate>
                    <Icon className="h-5 w-5" />
                  </IconPlate>
                  <div>
                    <h4 className="mb-1 font-space font-bold">{title}</h4>
                    <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </SectionShell>

      {/* --- MULTI-TENANCY & DOCKER ARCHITECTURE --- */}
      <SectionShell id="architecture" tone="base" glow="primary">
        <div className="flex flex-col items-center gap-14 lg:flex-row lg:gap-16">
          <Reveal variant="scale" className="order-2 w-full flex-1 lg:order-1">
            <div className="relative mx-auto max-w-md">
              <div
                aria-hidden
                className="absolute -inset-3 -z-10 rotate-3 rounded-3xl bg-gradient-to-tr from-primary/20 to-transparent"
              />
              <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/80 shadow-2xl shadow-background backdrop-blur-sm">
                <WindowChrome
                  label={t("landing.architecture.terminal_label", "hive-mesh · deploy")}
                  status={t("landing.architecture.running", "Running 4/4")}
                />
                <div className="space-y-1.5 p-6 font-mono text-[13px] leading-relaxed text-muted-foreground">
                  <p className="text-primary">
                    {t("landing.architecture.docker_init", "# Docker Swarm Cluster Init")}
                  </p>
                  <p>
                    {t(
                      "landing.architecture.deploying",
                      "Deploying isolated tenant environments...",
                    )}
                  </p>
                  <p className="pt-2 text-foreground">
                    <span className="text-primary">$</span> docker compose -f hive.yml up -d
                  </p>
                  <p className="pt-2 text-primary">
                    [+] {t("landing.architecture.running", "Running 4/4")}
                  </p>
                  {["hive_mesh", "tenant_a_db", "tenant_b_db", "gateway"].map((name) => (
                    <p key={name} className="pl-4">
                      <span className="text-primary">✔</span> {name}
                      <span className="text-muted-foreground/60"> started</span>
                    </p>
                  ))}
                  <p className="pt-3 text-primary blink-caret">_</p>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal className="order-1 flex-1 lg:order-2">
            <Eyebrow align="left">
              {t("landing.architecture.badge", "Techive engineering")}
            </Eyebrow>
            <h2 className="mb-6 text-balance font-space text-[2.1rem] font-bold leading-[1.08] tracking-[-0.02em] md:text-5xl">
              {t("landing.architecture.title_part1", "Containerized")}{" "}
              <span className="font-serif font-normal italic tracking-[-0.03em] text-primary">
                {t("landing.architecture.title_part2", "Multi-Tenancy")}
              </span>
            </h2>
            <p className="mb-9 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              {t(
                "landing.architecture.desc",
                "Scale without boundaries. Hive operates on a heavily optimized, Dockerized environment that strictly isolates databases at the container level.",
              )}
            </p>
            <ul className="space-y-6">
              {[
                {
                  icon: Code2,
                  title: t("landing.architecture.security_title", "Isolated Data Schemas"),
                  desc: t(
                    "landing.architecture.security_desc",
                    "Every corporate tenant operates within its own dedicated database schema, preventing catastrophic data bleed.",
                  ),
                },
                {
                  icon: Database,
                  title: t("landing.architecture.deployment_title", "Hybrid Cloud & On-Prem"),
                  desc: t(
                    "landing.architecture.deployment_desc",
                    "Deploy seamlessly on AWS infrastructure or containerize the entire platform for strictly isolated On-Premise deployments.",
                  ),
                },
              ].map(({ icon: Icon, title, desc }) => (
                <li key={title} className="group flex gap-4">
                  <IconPlate className="transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </IconPlate>
                  <div>
                    <h4 className="mb-1 font-space font-bold">{title}</h4>
                    <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </SectionShell>

      {/* --- FIELD OPERATIONS & MOBILE --- */}
      <SectionShell id="field" tone="raised" glow="none">
        <div className="flex flex-col items-center gap-14 lg:flex-row lg:gap-20">
          <Reveal className="flex-1">
            <Eyebrow align="left">{t("landing.field.badge", "Field ready")}</Eyebrow>
            <h2 className="mb-6 text-balance font-space text-[2.1rem] font-bold leading-[1.08] tracking-[-0.02em] md:text-5xl">
              {t("landing.field.title_part1", "Built for the")}{" "}
              <span className="font-serif font-normal italic tracking-[-0.03em] text-primary">
                {t("landing.field.title_part2", "Road")}
              </span>
            </h2>
            <p className="mb-9 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              {t(
                "landing.field.desc",
                "Operations in Ethiopia don't always have reliable internet. Our native applications are designed with aggressive offline-caching, allowing your team to work anywhere.",
              )}
            </p>
            <RevealGroup step={0.08} className="space-y-3">
              {[
                {
                  icon: CloudLightning,
                  title: t("landing.field.offline_title", "Offline-First Sync"),
                  desc: t(
                    "landing.field.offline_desc",
                    "Scan waybills and register deliveries offline. System syncs when connection returns.",
                  ),
                },
                {
                  icon: SmartphoneNfc,
                  title: t("landing.field.mobile_title", "Mobile POS Integration"),
                  desc: t(
                    "landing.field.mobile_desc",
                    "Equip sales agents with mobile point-of-sale systems linked directly to your central inventory.",
                  ),
                },
              ].map(({ icon: Icon, title, desc }) => (
                <RevealItem key={title}>
                  <div className="flex items-start gap-4 rounded-2xl border border-border/70 bg-card/40 p-5 transition-colors hover:border-primary/40">
                    <IconPlate>
                      <Icon className="h-5 w-5" />
                    </IconPlate>
                    <div>
                      <h4 className="mb-1 font-space font-bold">{title}</h4>
                      <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                </RevealItem>
              ))}
            </RevealGroup>
          </Reveal>

          {/* Handset shows the actual offline-queue UI rather than grey skeleton
              blocks, which read as an unfinished mockup. */}
          <Reveal variant="scale" className="flex flex-1 justify-center">
            <div className="relative">
              <div
                aria-hidden
                className="absolute left-1/2 top-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[90px]"
              />
              <div className="relative h-[560px] w-[280px] overflow-hidden rounded-[2.75rem] border-[10px] border-muted bg-background shadow-2xl shadow-background">
                <div className="absolute left-1/2 top-0 z-20 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-muted" />

                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b border-border/60 bg-card/60 px-4 pb-2.5 pt-9">
                    <span className="font-space text-sm font-bold">
                      {t("landing.field.app_title", "Waybills")}
                    </span>
                    <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      {t("landing.field.offline_badge", "Offline")}
                    </span>
                  </div>

                  <div className="flex-1 space-y-2.5 overflow-hidden p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                      {t("landing.field.queued", "Queued locally · 6")}
                    </p>
                    {[
                      { id: "WB-8841", place: "Bole → Adama", state: "queued" },
                      { id: "WB-8840", place: "Merkato → Hawassa", state: "queued" },
                      { id: "WB-8839", place: "Kality → Dire Dawa", state: "queued" },
                      { id: "WB-8838", place: "Bole → Bahir Dar", state: "sent" },
                      { id: "WB-8837", place: "Piassa → Adama", state: "sent" },
                    ].map((row) => (
                      <div
                        key={row.id}
                        className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 px-3 py-2.5"
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            row.state === "sent" ? "bg-primary" : "bg-amber-500",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[11px] font-bold">{row.id}</p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {row.place}
                          </p>
                        </div>
                        <Check
                          className={cn(
                            "h-3.5 w-3.5 shrink-0",
                            row.state === "sent" ? "text-primary" : "text-muted-foreground/30",
                          )}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="p-4 pt-0">
                    <div className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary font-space text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02]">
                      <CloudLightning className="h-4 w-4" />
                      {t("landing.field.sync_data", "Sync data")}
                    </div>
                    <p className="mt-2.5 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                      {t("landing.field.auto_note", "Auto-syncs when signal returns")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </SectionShell>

      {/* --- SECURITY & DATA RESIDENCY --- */}
      <LandingSecurity />

      {/* --- CUSTOMER PROOF --- */}
      <LandingProof />

      {/* --- POSITIONING TABLE --- */}
      {!initialIsTenant && <LandingCompare />}

      {/* ─── HOW IT WORKS ──────────────────────────────────────────────── */}
      {!initialIsTenant && (
        <SectionShell id="how-it-works" tone="base" glow="primary">
          <SectionHeading
            eyebrow={t("landing.how.badge", "Two ways to get started")}
            title={t("landing.how.title_part1", "How onboarding")}
            accent={t("landing.how.title_part3", "Works")}
            description={t(
              "landing.how.desc",
              "Every organization on Hive chooses their own deployment path. Self-service is instant, or let our admin team provision your node manually.",
            )}
          />

          <div>
            <RevealGroup step={0.14} className="grid gap-6 md:grid-cols-2">
              {/* Self-Service Path */}
              <RevealItem variant="scale"><div className="relative h-full rounded-[2rem] border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-violet-500/5 p-8 hover:shadow-lg hover:shadow-indigo-500/10 transition-all group">
                <div className="absolute top-6 right-6 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                  {t('landing.how.self_service', 'Self-Service')}
                </div>
                <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6">
                  <Zap className="h-7 w-7 text-indigo-500" />
                </div>
                <h3 className="text-2xl font-black font-space mb-3">
                  {t('landing.how.self_title', 'Tenants Register Themselves')}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                  {t('landing.how.self_desc', 'Any organization can visit this page, pick a plan, complete payment via ArifPay, and get their workspace provisioned automatically — no admin required.')}
                </p>
                <ol className="space-y-4 mb-8">
                  {[
                    {
                      n: "01",
                      title: t('landing.how.step1_title', 'Choose a Plan'),
                      desc: t('landing.how.step1_desc', 'Compare plans below and pick the one that fits your team.'),
                    },
                    {
                      n: "02",
                      title: t('landing.how.step2_title', 'Complete ArifPay Checkout'),
                      desc: t('landing.how.step2_desc', 'Pay securely via Telebirr, CBE or Card through ArifPay.'),
                    },
                    {
                      n: "03",
                      title: t('landing.how.step3_title', 'Workspace Auto-Provisions'),
                      desc: t('landing.how.step3_desc', 'Your isolated tenant database and admin account are created instantly.'),
                    },
                    {
                      n: "04",
                      title: t('landing.how.step4_title', 'Add Modules Anytime'),
                      desc: t('landing.how.step4_desc', 'Upgrade or add more modules from your subscription dashboard.'),
                    },
                  ].map((step) => (
                    <li key={step.n} className="flex gap-4">
                      <span className="h-8 w-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-black text-xs shrink-0 mt-0.5 border border-indigo-500/20">
                        {step.n}
                      </span>
                      <div>
                        <p className="font-bold text-foreground text-sm">
                          {step.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {step.desc}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <Link href="/auth/signup">
                  <Button className="w-full font-space font-bold uppercase tracking-wider bg-indigo-500 hover:bg-indigo-600 text-white border-none shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all gap-2">
                    {t('landing.hero.cta_free', 'Get Started Free')} <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              {/* Admin-Provisioned Path */}
              </RevealItem>

              <RevealItem variant="scale"><div className="relative h-full rounded-[2rem] border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-8 hover:shadow-lg hover:shadow-amber-500/10 transition-all group">
                <div className="absolute top-6 right-6 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  {t('landing.how.admin_managed', 'Admin-Managed')}
                </div>
                <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6">
                  <ShieldCheck className="h-7 w-7 text-amber-500" />
                </div>
                <h3 className="text-2xl font-black font-space mb-3">
                  {t('landing.how.admin_title', 'Central Admin Provisions Tenants')}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                  {t('landing.how.admin_desc', 'Central Super Admins can manually create and configure any tenant — assigning their plan, storage quota, and enabled modules directly from the admin panel.')}
                </p>
                <ol className="space-y-4 mb-8">
                  {[
                    {
                      n: "01",
                      title: t('landing.how.admin_step1_title', 'Open Tenants Panel'),
                      desc: t('landing.how.admin_step1_desc', 'Go to Dashboard → Tenants and click "Create New Tenant".'),
                    },
                    {
                      n: "02",
                      title: t('landing.how.admin_step2_title', 'Select Plan & Modules'),
                      desc: t('landing.how.admin_step2_desc', 'Assign a subscription plan and pick which modules to enable.'),
                    },
                    {
                      n: "03",
                      title: t('landing.how.admin_step3_title', 'Set Storage Quota'),
                      desc: t('landing.how.admin_step3_desc', 'Override the plan default or use per-plan quotas set in Email Settings.'),
                    },
                    {
                      n: "04",
                      title: t('landing.how.admin_step4_title', 'Provision Instantly'),
                      desc: t('landing.how.admin_step4_desc', 'The tenant workspace is created immediately with full isolation.'),
                    },
                  ].map((step) => (
                    <li key={step.n} className="flex gap-4">
                      <span className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 font-black text-xs shrink-0 mt-0.5 border border-amber-500/20">
                        {step.n}
                      </span>
                      <div>
                        <p className="font-bold text-foreground text-sm">
                          {step.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {step.desc}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <Link href="/sign-in">
                  <Button
                    variant="outline"
                    className="w-full font-space font-bold uppercase tracking-wider border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-500 transition-all gap-2"
                  >
                    {t('landing.how.admin_signin', 'Admin Sign In')} <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              </RevealItem>
            </RevealGroup>
          </div>
        </SectionShell>
      )}

      {/* ─── PRICING & PLAN COMPARISON ────────────────────────────────── */}
      {!initialIsTenant && (
        <SectionShell id="pricing" tone="raised" glow="primary" innerClassName="max-w-7xl">
          <SectionHeading
            eyebrow={t("landing.pricing.badge", "Subscription plans")}
            title={t("landing.pricing.title_part1", "Transparent")}
            accent={t("landing.pricing.title_part2", "Pricing")}
            description={t(
              "landing.pricing.desc",
              "Every plan includes an isolated tenant workspace, secure mailbox, and a bundled module stack. Add more modules anytime via ArifPay checkout.",
            )}
          />

          <div>
            {/* Plan grid */}
            <RevealGroup step={0.07} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
              {(
                [
                  {
                    key: "larva",
                    label: t('landing.pricing.larva_label', 'Larva'),
                    tagline: t('landing.pricing.larva_tagline', 'Free trial'),
                    price: t('landing.pricing.free', 'Free'),
                    priceNote: t('landing.pricing.forever', 'forever'),
                    storage: "512 MB",
                    color: "text-slate-500",
                    ring: "ring-slate-500/30",
                    bg: "from-slate-500/10 to-slate-400/5",
                    highlight: false,
                    features: [
                      t('landing.pricing.feat_mailbox', 'Internal Mailbox'),
                      t('landing.pricing.feat_storage_512', '512 MB mailbox quota'),
                      t('landing.pricing.feat_users_5', 'Up to 5 users'),
                      t('landing.pricing.feat_shared', 'Shared instance'),
                      t('landing.pricing.feat_overview', 'Dashboard overview'),
                    ],
                  },
                  {
                    key: "startup",
                    label: t('landing.pricing.startup_label', 'Startup'),
                    tagline: t('landing.pricing.startup_tagline', 'Launch-ready'),
                    price: t('landing.pricing.free', 'Free'),
                    priceNote: t('landing.pricing.per_month', '/month'),
                    storage: "2 GB",
                    color: "text-sky-500",
                    ring: "ring-sky-500/30",
                    bg: "from-sky-500/10 to-cyan-400/5",
                    highlight: false,
                    features: [
                      t('landing.pricing.feat_mailbox_file', 'Mailbox + File Manager'),
                      t('landing.pricing.feat_img_editor', 'Image Editor'),
                      t('landing.pricing.feat_doc_conv', 'Document Converter'),
                      t('landing.pricing.feat_storage_2gb', '2 GB storage quota'),
                      t('landing.pricing.feat_isolated_db', 'Isolated DB schema'),
                    ],
                  },
                  {
                    key: "business",
                    label: t('landing.pricing.business_label', 'Business'),
                    tagline: t('landing.pricing.business_tagline', 'Most popular'),
                    price: "ETB 3,499",
                    priceNote: t('landing.pricing.per_month', '/month'),
                    storage: "10 GB",
                    color: "text-indigo-500",
                    ring: "ring-indigo-500/30",
                    bg: "from-indigo-500/10 to-violet-400/5",
                    highlight: true,
                    features: [
                      t('landing.pricing.feat_all_startup', 'All Startup modules'),
                      t('landing.pricing.feat_media_video', 'Media Library + Video Player'),
                      t('landing.pricing.feat_analytics', 'Advanced Analytics'),
                      t('landing.pricing.feat_audit', 'Audit Logs + Alerts Center'),
                      t('landing.pricing.feat_billing', 'Invoice & Billing'),
                      t('landing.pricing.feat_inventory', 'Inventory Control'),
                      t('landing.pricing.feat_security', 'Security Management'),
                      t('landing.pricing.feat_storage_10gb', '10 GB storage quota'),
                    ],
                  },
                  {
                    key: "enterprise",
                    label: t('landing.pricing.enterprise_label', 'Enterprise'),
                    tagline: t('landing.pricing.enterprise_tagline', 'Large-scale ops'),
                    price: "ETB 7,999",
                    priceNote: t('landing.pricing.per_month', '/month'),
                    storage: "50 GB",
                    color: "text-violet-500",
                    ring: "ring-violet-500/30",
                    bg: "from-violet-500/10 to-purple-400/5",
                    highlight: false,
                    features: [
                      t('landing.pricing.feat_all_business', 'All Business modules'),
                      t('landing.pricing.feat_automation', 'Workflow Automation'),
                      t('landing.pricing.feat_api', 'API Access + API Docs'),
                      t('landing.pricing.feat_fleet', 'Fleet Management'),
                      t('landing.pricing.feat_dev_tools', 'Developer tools'),
                      t('landing.pricing.feat_storage_50gb', '50 GB storage quota'),
                      t('landing.pricing.feat_priority_support', 'Priority support'),
                    ],
                  },
                  {
                    key: "overlord",
                    label: t('landing.pricing.overlord_label', 'Overlord'),
                    tagline: t('landing.pricing.overlord_tagline', 'All-inclusive'),
                    price: "ETB 12,999",
                    priceNote: t('landing.pricing.per_month', '/month'),
                    storage: "200 GB",
                    color: "text-amber-500",
                    ring: "ring-amber-500/30",
                    bg: "from-amber-500/10 to-orange-400/5",
                    highlight: false,
                    features: [
                      t('landing.pricing.feat_all_unlocked', 'Every module unlocked (17 total)'),
                      t('landing.pricing.feat_storage_200gb', '200 GB storage quota'),
                      t('landing.pricing.feat_custom_integration', 'Custom module integrations'),
                      t('landing.pricing.feat_sla', 'Dedicated SLA'),
                      t('landing.pricing.feat_eng_support', 'Techive engineering support'),
                    ],
                  },
                ] as const
              ).map((plan) => (
                <RevealItem key={plan.key} variant="scale" className="min-h-0">
                <SpotlightCard
                  className={cn(
                    "flex h-full flex-col overflow-hidden rounded-3xl border p-6 transition-all duration-300",
                    plan.highlight
                      ? "border-primary/40 bg-primary/[0.07] shadow-xl shadow-primary/10 lg:-my-2 lg:py-8"
                      : "border-border/60 bg-card/40 backdrop-blur-sm hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/70",
                  )}
                >
                  {plan.highlight && (
                    <>
                      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
                      <div className="absolute right-5 top-5 rounded-full bg-primary px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-primary-foreground">
                        {t("landing.pricing.popular", "Popular")}
                      </div>
                    </>
                  )}

                  <div
                    className={cn(
                      "mb-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em]",
                      plan.highlight ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {plan.label}
                  </div>
                  <p className="mb-5 text-xs text-muted-foreground">{plan.tagline}</p>

                  {/* text-2xl, not larger: at five columns "ETB 12,999" wraps
                      onto a second line above ~1.6rem and knocks the quota chip
                      out of alignment with the other four cards. */}
                  <div className="mb-5 flex items-baseline gap-1">
                    <span className="whitespace-nowrap font-space text-2xl font-bold leading-none tracking-tight">
                      {plan.price}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{plan.priceNote}</span>
                  </div>

                  <div className="mb-5 flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2 font-mono text-[11px] font-bold text-muted-foreground">
                    <Globe className="h-3.5 w-3.5 shrink-0 text-primary" />
                    {plan.storage} {t("landing.pricing.mailbox_quota", "quota")}
                  </div>

                  <ul className="mb-6 flex-1 space-y-2.5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="leading-snug">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link href="/auth/signup" className="mt-auto block">
                    <Button
                      size="sm"
                      className={cn(
                        "w-full gap-1.5 rounded-xl font-space text-xs font-bold uppercase tracking-wider transition-all",
                        plan.highlight
                          ? "border-none bg-primary text-primary-foreground shadow-md shadow-primary/30 hover:bg-primary/90"
                          : "border-border/70 bg-transparent hover:border-primary/50 hover:bg-primary/10 hover:text-primary",
                      )}
                      variant={plan.highlight ? "default" : "outline"}
                    >
                      {t("landing.pricing.get_started", "Get Started")}
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </SpotlightCard>
                </RevealItem>
              ))}
            </RevealGroup>

            {/* Admin-provision callout */}
            <Reveal variant="scale" className="mt-8">
              <div className="flex flex-col items-center justify-between gap-6 rounded-3xl border border-border/60 bg-card/30 p-6 backdrop-blur-sm sm:flex-row">
                <div className="flex items-center gap-4">
                  <IconPlate size="lg" accent="warm">
                    <ShieldCheck className="h-6 w-6" />
                  </IconPlate>
                  <div>
                    <p className="font-space font-bold text-foreground">
                      {t("landing.pricing.managed_title", "Need a managed deployment?")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t(
                        "landing.pricing.managed_desc",
                        "Central admins can provision tenant workspaces with custom quotas and module overrides from the admin panel.",
                      )}
                    </p>
                  </div>
                </div>
                <Link href="/sign-in" className="shrink-0">
                  <Button
                    variant="outline"
                    className="gap-2 whitespace-nowrap rounded-xl border-amber-500/30 font-space font-bold uppercase tracking-wider transition-all hover:bg-amber-500/10 hover:text-amber-500"
                  >
                    {t("landing.pricing.admin_portal", "Admin Portal")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </Reveal>
          </div>
        </SectionShell>
      )}

      {/* 🚀 Partner Slider */}
      <PartnerSlider partners={partners} />

      {/* --- FAQ --- */}
      <SectionShell id="faq" tone="base" glow="none" innerClassName="max-w-4xl">
        <SectionHeading
          eyebrow={t("landing.faq.badge", "Knowledge base")}
          title={t("landing.faq.title_lead", "Frequently asked")}
          accent={t("landing.faq.title_accent", "Questions")}
        />

        <RevealGroup className="space-y-3" step={0.06}>
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <RevealItem key={idx}>
                <div
                  className={cn(
                    "overflow-hidden rounded-2xl border transition-colors duration-300",
                    isOpen
                      ? "border-primary/40 bg-card/60"
                      : "border-border/70 bg-card/30 hover:border-border",
                  )}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${idx}`}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-foreground/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
                  >
                    <span className="font-space font-bold">{faq.q}</span>
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
                        isOpen
                          ? "rotate-90 border-primary/40 bg-primary/10 text-primary"
                          : "border-border/70 text-muted-foreground",
                      )}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </button>

                  {/* Was a max-h-40 transition, which silently clipped the longer
                      answers (the on-premise and multi-tenancy ones both overflow).
                      height:auto has no ceiling. */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`faq-panel-${idx}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.32, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <p className="px-6 pb-6 text-muted-foreground text-sm leading-relaxed">
                          {faq.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </SectionShell>

      {/* --- FINAL CTA --- */}
      {!initialIsTenant && (
        <section className="relative overflow-hidden border-t border-border/60 px-4 py-28 md:py-36">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-primary/[0.04]" />
            <div className="absolute left-1/2 top-1/2 h-[28rem] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[110px]" />
            <div className="tech-grid absolute inset-0 opacity-30" />
          </div>

          <Reveal className="relative z-10 mx-auto max-w-3xl text-center">
            <Eyebrow>{t("landing.cta.eyebrow", "Get started")}</Eyebrow>
            <h2 className="text-balance font-space text-[2.5rem] font-bold leading-[1.05] tracking-[-0.025em] md:text-6xl">
              {t("landing.cta.title_part1", "Ready to deploy your")}{" "}
              <span className="font-serif font-normal italic tracking-[-0.03em] text-primary">
                {t("landing.cta.title_part2", "Hive workspace?")}
              </span>
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
              {t(
                "landing.cta.desc",
                "Pick a plan and get your isolated tenant node provisioned in minutes — or contact the admin team for a managed setup.",
              )}
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/auth/signup">
                <Button className="gap-2 rounded-full border-none bg-primary px-8 py-6 font-space text-base font-bold uppercase tracking-wider text-primary-foreground shadow-xl shadow-primary/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/90">
                  {t("landing.cta.pill_plan", "Start Free — Pick a Plan")}
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/sign-in">
                <Button
                  variant="outline"
                  className="rounded-full border-border/70 px-8 py-6 font-space text-base font-bold uppercase tracking-wider transition-all duration-300 hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                >
                  {t("landing.how.admin_signin", "Admin Sign In")}
                </Button>
              </Link>
            </div>
            <p className="mt-7 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {t(
                "landing.cta.note",
                "No credit card required for Larva & Startup plans · Powered by ArifPay",
              )}
            </p>
          </Reveal>
        </section>
      )}

      {/* --- FOOTER --- */}
      <footer
        id="contact"
        className="relative z-10 border-t border-border bg-card pt-20 pb-8 px-6 overflow-hidden"
      >
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-primary/5 blur-[100px] pointer-events-none"></div>

        <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-4 gap-12 relative z-10">
          <div className="md:col-span-2">
            {/* 🚀 Using SafeLogo for the footer as well */}
            <SafeLogo
              src={rawLogoUrl}
              alt={appTitle}
              className="h-10 w-auto object-contain mb-4 transition-transform hover:scale-105"
              fallback={
                <h2
                  className={`font-space text-3xl font-bold mb-2 uppercase ${initialIsTenant ? "text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400" : "text-primary"}`}
                >
                  {appTitle}
                </h2>
              }
            />

            <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mb-6">
              {brandSettings?.footer_text ||
                t('landing.footer.tagline', 'The robust Enterprise Resource Planning system. Streamlining Finance, HR, Smart Mobility, and Logistics for the modern Ethiopian business.')}
            </p>
            <div className="flex items-center border-b border-border pb-2 max-w-xs mt-6 group">
              <span className="text-primary font-mono mr-2">
                system@{initialTenantSlug}:~$
              </span>
              <input
                type="text"
                placeholder={t('landing.footer.newsletter', 'enter email for updates')}
                className="bg-transparent border-none outline-none text-foreground w-full font-mono text-sm focus:ring-0 placeholder:text-muted-foreground/50"
              />
              <ArrowRight className="h-4 w-4 text-primary cursor-pointer group-hover:translate-x-2 transition-transform duration-300" />
            </div>
          </div>

          {/* These were <li>s with cursor-pointer and no handler — they looked
              clickable and did nothing. Every entry now goes somewhere real:
              an on-page section, or a route that exists. */}
          <FooterColumn
            title={t("landing.footer.modules", "Modules")}
            links={[
              { label: t("landing.nav.fintech", "Financial Ledger"), section: "fintech" },
              { label: t("landing.nav.mobility", "Smart Mobility"), section: "mobility" },
              { label: t("landing.nav.hr", "Human Resources"), section: "hr" },
              { label: t("landing.security.eyebrow", "Trust & Governance"), section: "security" },
              { label: t("landing.nav.pricing", "Pricing"), section: "pricing" },
            ]}
            onSection={scrollToSection}
          />

          <FooterColumn
            title={t("landing.footer.company", "Company")}
            links={[
              { label: t("landing.footer.docs", "Documentation"), href: "/api-docs" },
              { label: t("landing.footer.sales", "Contact Sales"), href: "/request-demo" },
              { label: t("landing.nav.demo", "Request a demo"), href: "/request-demo" },
              { label: t("landing.nav.faq", "FAQ"), section: "faq" },
              { label: t("landing.nav.proof", "Customer outcomes"), section: "proof" },
            ]}
            onSection={scrollToSection}
          />
        </div>

        <div className="mx-auto max-w-6xl mt-16 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground font-mono relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-full border border-border">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse-hex"></div>
              {initialIsTenant
                ? t('landing.footer.node_online', '{appTitle} NODE: ONLINE').replace('{appTitle}', appTitle)
                : t('landing.footer.cluster_online', 'HIVE CLUSTER: ONLINE')}
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end text-center md:text-right gap-3">
            {initialIsTenant && (
              <div className="flex flex-col items-center justify-center gap-2 relative group mt-2">
                <img
                  src="/logos/hive_icon.png"
                  alt="Hive Icon"
                  className="h-6 w-6 drop-shadow-md group-hover:scale-110 transition-transform duration-300"
                />
                <div className="bg-primary/10 px-3 py-1 rounded-lg border border-primary/20 overflow-hidden relative">
                  <div className="absolute inset-0 bg-primary/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                  <span className="font-bold text-primary uppercase tracking-widest text-[11px] relative z-10">
                    {t('landing.footer.powered', 'POWERED BY HIVE ERP')}
                  </span>
                </div>
              </div>
            )}
            <p className="text-sm text-muted-foreground/80 mt-2">
              {t('landing.footer.developed_by', 'Developed by')}{" "}
              <span className="text-foreground font-bold hover:text-primary transition-colors cursor-pointer px-1">
                {t('landing.footer.techive', 'Techive Technology Solutions')}
              </span>{" "}
              &copy; 2026
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Page() {
  return <LandingUI />;
}
