"use client";

import {
  Activity,
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
  LineChart,
  Network,
  PieChart,
  ShieldCheck,
  SmartphoneNfc,
  Truck,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useTranslation } from "@/store/use-translation";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  getBackendApiRoot,
  getBackendStorageUrl,
  getTenantHeaders,
  getTenantId,
  isTenantHost,
} from "@/lib/runtime-context";
import { resolveLandingTemplate } from "@/modules/tenancy/landing-template";
import { TenantBusinessLanding } from "@/modules/tenancy/components/tenant-business-landing";
import { RestaurantLandingTemplate } from "@/modules/tenancy/components/restaurant-landing-template";
import B2BLandingTemplate from "@/modules/tenancy/components/b2b-landing-template";

interface LandingUIProps {
  initialPortalName: string;
  initialTenantSlug: string;
  initialIsTenant: boolean;
}

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

// --- JS DRIVEN INFINITE SCROLL PARTNER COMPONENT ---
const PartnerSlider = ({ partners }: { partners: any[] }) => {
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
    queryKey: ["publicBrandSettings", detectedTenantSlug, isTenantExperience],
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
    return getBackendStorageUrl(activeLogo);
  }, [brandSettings, isDark]);

  const appTitle = brandSettings?.app_title || initialPortalName;

  // 🌍 BROWSER METADATA SYNC
  useEffect(() => {
    if (brandSettings?.favicon) {
      const favUrl = getBackendStorageUrl(brandSettings.favicon);
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
      document.title = isTenantExperience
        ? brandSettings.app_title
        : `${brandSettings.app_title} | Enterprise Operations`;
    }
  }, [brandSettings, isTenantExperience]);

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
        let hexagons: any[] = [];

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

  const faqs = [
    {
      q: t('landing.faq.q1', 'Does Hive ERP work during internet outages?'),
      a: t('landing.faq.a1', 'Yes. Our mobile apps and POS systems feature offline-sync. They store data locally and automatically push to the central cloud once connection is restored.'),
    },
    {
      q: t('landing.faq.q2', 'Is our corporate data stored locally in Ethiopia?'),
      a: t('landing.faq.a2', 'We offer hybrid deployments. You can choose to host your Node on our secure AWS infrastructure, or deploy an On-Premise instance directly within your local data center for strict INSA compliance.'),
    },
    {
      q: t('landing.faq.q3', 'Can we integrate existing legacy software?'),
      a: t('landing.faq.a3', 'Absolutely. Hive comes with a comprehensive REST API and webhooks, allowing Techive Technology Solutions to build custom bridges to your existing software.'),
    },
    {
      q: t('landing.faq.q4', 'How does the multi-tenant architecture work?'),
      a: t('landing.faq.a4', 'Each company gets its own isolated database schema. This guarantees zero data-bleed between clients while allowing us to push instantaneous system updates to everyone simultaneously.'),
    },
  ];

  if (isTenantExperience) {
    if (isLoadingTenantLanding) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-[#080510]">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#FF1A43] border-t-transparent" />
            <p className="text-white/60 font-black tracking-widest text-xs uppercase">Loading Savory Lounge...</p>
          </div>
        </div>
      );
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
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          size="icon"
          className="fixed bottom-8 right-8 z-[100] h-12 w-12 rounded-full shadow-2xl shadow-primary/30 border border-primary/20 bg-primary/90 text-primary-foreground hover:bg-primary hover:-translate-y-1 transition-all duration-300 animate-in fade-in zoom-in"
        >
          <ArrowUp className="h-6 w-6" />
        </Button>
      )}

      {/* --- BACKGROUND --- */}
      <canvas
        id="hive-canvas"
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none opacity-30 z-0"
      />
      <div className="tech-grid fixed inset-0 z-0 pointer-events-none opacity-40" />
      <div className="vignette fixed inset-0 z-0 pointer-events-none" />

      {/* --- NAVBAR --- */}
      <nav className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-border bg-background/80 px-6 py-4 backdrop-blur-xl transition-all">
        <Link
          href="/"
          className="flex items-center gap-2 font-space text-xl font-bold tracking-tight hover:text-primary transition-colors group"
        >
          {/* 🚀 Safely render Logo without CORS fetch */}
          <SafeLogo
            src={rawLogoUrl}
            alt={appTitle}
            className="h-9 w-auto object-contain transition-transform group-hover:scale-105"
            fallback={
              <div className="flex items-center gap-2">
                <Globe className="text-primary h-5 w-5 group-hover:rotate-180 transition-transform duration-700" />
                <span>{appTitle}</span>
              </div>
            }
          />
        </Link>

        <div className="hidden md:flex items-center gap-6 text-xs font-bold text-muted-foreground font-space uppercase">
          <button
            onClick={() => scrollToSection("modules")}
            className="hover:text-primary hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
          >
            {t('landing.nav.modules', 'Modules')}
          </button>
          <button
            onClick={() => scrollToSection("fintech")}
            className="hover:text-primary hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
          >
            {t('landing.nav.payments', 'Payments')}
          </button>
          <button
            onClick={() => scrollToSection("mobility")}
            className="hover:text-primary hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
          >
            {t('landing.nav.mobility', 'Smart Mobility')}
          </button>
          <button
            onClick={() => scrollToSection("hr")}
            className="hover:text-primary hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
          >
            {t('landing.nav.payroll', 'Payroll')}
          </button>
          <button
            onClick={() => scrollToSection("architecture")}
            className="hover:text-primary hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
          >
            {t('landing.nav.architecture', 'Architecture')}
          </button>
          {!initialIsTenant && (
            <button
              onClick={() => scrollToSection("pricing")}
              className="hover:text-primary hover:-translate-y-0.5 transition-all duration-300 cursor-pointer text-primary font-black"
            >
              {t('landing.nav.pricing', 'Pricing')}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemeToggle />
          <div className="hidden sm:flex items-center gap-2 ml-2 pl-2 border-l border-border">
            <Link href="/sign-in">
              <Button
                variant="ghost"
                className="font-space font-bold uppercase tracking-wider hover:bg-primary/10 hover:text-primary transition-all duration-300"
              >
                {t('landing.nav.signin', 'Sign In')}
              </Button>
            </Link>
            {!initialIsTenant && (
              <Link href="/auth/signup">
                <Button className="font-space font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 border-none hover:scale-105 transition-all duration-300 [clip-path:polygon(10%_0,100%_0,100%_70%,90%_100%,0_100%,0_30%)]">
                  {t('landing.nav.deploy', 'Deploy Node')}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 pt-24 text-center">
        <div className="mb-6 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-mono tracking-widest text-primary shadow-[0_0_15px_hsl(var(--primary)_/_0.3)] animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <span className="mr-2 h-2 w-2 rounded-full bg-primary animate-pulse"></span>
          {initialIsTenant
            ? `${t('landing.hero.connected_node', 'CONNECTED NODE')}: ${appTitle}`
            : t('landing.hero.dev_by', "DEVELOPED BY TECHIVE TECHNOLOGY SOLUTIONS")}
        </div>

        <h1 className="max-w-5xl font-space text-5xl font-black leading-tight tracking-tighter md:text-7xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100 drop-shadow-2xl">
          {initialIsTenant ? (
            <>
              {t('landing.hero.unified_mgmt', 'Unified Management')} <br />
              <span className="relative inline-block mt-2 mb-2 group">
                <span className="absolute inset-0 bg-primary/20 blur-2xl rounded-full group-hover:bg-primary/40 transition-all duration-700"></span>
                <span className="relative bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent animate-text-shimmer uppercase">
                  {appTitle}
                </span>
              </span>{" "}
              <br /> {t('landing.hero.dashboard', 'Dashboard')}
            </>
          ) : (
            <>
              {t('landing.hero.unify_ops', 'Unify Your')} <br />{" "}
              <span className="bg-gradient-to-r from-primary via-orange-400 to-primary bg-clip-text text-transparent animate-text-shimmer">
                {t('landing.hero.enterprise_ops', 'Enterprise Operations')}
              </span>
            </>
          )}
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl font-inter animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          {initialIsTenant
            ? t('landing.hero.access_node', `Access the central node for :appTitle. Oversee HR, track freight logistics, and manage financial ledgers in real-time.`, { appTitle })
            : t('landing.hero.hive_desc', "Hive is the comprehensive ERP solution built for scalable businesses in Ethiopia. Connect your Finance, HR, and Supply Chain with local tax and banking integrations.")}
        </p>

        {/* --- 3D DASHBOARD PREVIEW --- */}
        <div className="mt-20 w-full max-w-6xl [perspective:2000px] relative z-20 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-primary/20 blur-[120px] rounded-full pointer-events-none animate-pulse-hex"></div>

          <div className="relative grid grid-cols-[80px_250px_1fr] overflow-hidden rounded-xl border border-primary/30 bg-background/60 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] h-[500px] md:h-[650px] animate-float-deck group hover:border-primary/60 transition-colors duration-500">
            <div className="absolute inset-0 w-full h-[2px] bg-primary/50 shadow-[0_0_15px_hsl(var(--primary))] z-50 animate-scan-beam pointer-events-none"></div>

            <div className="flex flex-col items-center gap-6 border-r border-border bg-muted/20 pt-8 z-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/30 shadow-[0_0_15px_hsl(var(--primary)_/_0.2)] hover:scale-110 transition-transform cursor-pointer">
                <LineChart className="h-6 w-6" />
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg hover:bg-primary/5 text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                <Truck className="h-6 w-6" />
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg hover:bg-primary/5 text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                <Users className="h-6 w-6" />
              </div>
              <div className="mt-auto mb-5 text-muted-foreground">
                <Activity className="h-6 w-6 animate-pulse" />
              </div>
            </div>

            <div className="hidden md:block border-r border-border bg-muted/5 p-8 font-mono text-sm text-left z-10 relative">
              <div className="mb-6 text-xs text-muted-foreground uppercase tracking-widest">
                &gt; {t('landing.preview.system_modules', 'System Modules')}
              </div>
              <div className="space-y-6">
                <div className="flex justify-between items-center group/item cursor-pointer">
                  <span className="text-muted-foreground group-hover/item:text-primary transition-colors">
                    {t('landing.preview.gl', 'General Ledger')}
                  </span>
                  <span className="text-green-500 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>{" "}
                    {t('landing.preview.synced', 'SYNCED')}
                  </span>
                </div>
                <div className="flex justify-between items-center group/item cursor-pointer">
                  <span className="text-muted-foreground group-hover/item:text-primary transition-colors">
                    {t('landing.preview.freight', 'Freight & Fleet')}
                  </span>
                  <span className="text-green-500 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>{" "}
                    {t('landing.preview.active', 'ACTIVE')}
                  </span>
                </div>
                <div className="flex justify-between items-center group/item cursor-pointer">
                  <span className="text-muted-foreground group-hover/item:text-primary transition-colors">
                    {t('landing.preview.payroll_proc', 'Payroll Proc.')}
                  </span>
                  <span className="text-yellow-500 animate-pulse">{t('landing.preview.pending', 'PENDING')}</span>
                </div>
              </div>

              <div className="absolute bottom-8 left-8 right-8 h-auto rounded border border-primary/20 bg-primary/5 p-4 text-primary text-xs shadow-inner overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent -translate-x-full animate-[shimmer-text_3s_infinite]"></div>
                {t('landing.preview.server_status', 'SERVER STATUS')}: <br />{" "}
                <span className="text-lg font-bold">{t('landing.preview.optimal', 'OPTIMAL')}</span>
                <div className="mt-3 h-1 w-full bg-primary/20 rounded overflow-hidden">
                  <div className="h-full bg-primary w-[98%] shadow-[0_0_10px_hsl(var(--primary))]"></div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-card/10 text-left z-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse-hex"></div>

              <div className="flex items-end justify-between border-b border-border pb-6">
                <div>
                  <h2 className="font-space text-3xl font-bold">
                    {t('landing.executive_summary.title', 'Executive Summary')}
                  </h2>
                  <div className="font-mono text-xs text-primary mt-1 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>{" "}
                    {t('landing.executive_summary.real_time', 'REAL-TIME DATA')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-space text-4xl font-black tracking-tight drop-shadow-lg">
                    24.5M ETB
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {t('landing.executive_summary.gross_revenue', 'GROSS REVENUE (YTD)')}
                  </div>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border border-border bg-card/50 p-5 relative overflow-hidden shadow-sm hover:border-primary/50 hover:shadow-[0_0_20px_hsl(var(--primary)_/_0.15)] transition-all duration-300 group cursor-pointer hover:-translate-y-1">
                  <div className="font-mono text-xs text-muted-foreground mb-2 group-hover:text-primary transition-colors">
                    {t('landing.executive_summary.active_loads', 'ACTIVE LOADS')}
                  </div>
                  <div className="font-space text-3xl font-bold">142</div>
                  <div className="text-xs text-green-500 mt-1 flex items-center gap-1">
                    <ArrowRight className="rotate-[-45deg] h-3 w-3" /> {t('landing.executive_summary.in_transit', '12 In Transit')}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card/50 p-5 relative overflow-hidden shadow-sm hover:border-primary/50 hover:shadow-[0_0_20px_hsl(var(--primary)_/_0.15)] transition-all duration-300 group cursor-pointer hover:-translate-y-1">
                  <div className="font-mono text-xs text-muted-foreground mb-2 group-hover:text-primary transition-colors">
                    {t('landing.executive_summary.employee_headcount', 'EMPLOYEE HEADCOUNT')}
                  </div>
                  <div className="font-space text-3xl font-bold">420</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('landing.executive_summary.across_branches', 'Across 4 Branches')}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card/50 p-5 relative overflow-hidden shadow-sm hover:border-primary/50 hover:shadow-[0_0_20px_hsl(var(--primary)_/_0.15)] transition-all duration-300 group cursor-pointer hover:-translate-y-1">
                  <div className="font-mono text-xs text-muted-foreground mb-2 group-hover:text-primary transition-colors">
                    {t('landing.executive_summary.system_latency', 'SYSTEM LATENCY')}
                  </div>
                  <div className="font-space text-3xl font-bold">12ms</div>
                  <div className="mt-4 h-1 w-full bg-muted rounded-full overflow-hidden relative">
                    <div className="absolute top-0 left-0 h-full bg-primary w-[5%] shadow-[0_0_10px_hsl(var(--primary))]"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- BENTO GRID MODULES --- */}
      <section
        id="modules"
        className="py-24 px-4 max-w-6xl mx-auto border-t border-border"
      >
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-primary/20 text-primary border-none shadow-none">
            {t('landing.modules.badge', 'ALL-IN-ONE SOLUTION')}
          </Badge>
          <h2 className="font-space text-4xl md:text-5xl font-bold mb-4">
            {t('landing.modules.title_part1', 'Unified')} <span className="text-primary">{t('landing.modules.title_part2', 'Ecosystem')}</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            {t('landing.modules.desc', 'Stop switching between ten different spreadsheets. Hive centralizes every aspect of your Ethiopian business operations into one seamless dashboard.')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-4 h-auto md:h-[600px]">
          <div className="md:col-span-2 md:row-span-2 rounded-2xl border border-border bg-card/50 p-8 hover:border-primary/50 transition-all duration-300 group relative overflow-hidden flex flex-col justify-between">
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-700"></div>
            <div>
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 text-primary">
                <Wallet className="w-7 h-7" />
              </div>
              <h3 className="text-3xl font-space font-bold mb-3">
                {t('landing.modules.finance_title', 'Intelligent Finance')}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-md">
                {t('landing.modules.finance_desc', 'Automated ERCA tax compliance, local bank API integrations for immediate reconciliation, and multi-currency ledger management (ETB/USD).')}
              </p>
            </div>
            <div className="mt-8 bg-background border border-border rounded-xl p-4 shadow-inner">
              <div className="flex justify-between items-center text-sm font-mono border-b border-border pb-2 mb-2">
                <span className="text-muted-foreground">{t('landing.modules.telebirr_sync', 'Telebirr Sync')}</span>
                <span className="text-green-500">{t('landing.preview.success', 'SUCCESS')}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-mono">
                <span className="text-muted-foreground">{t('landing.modules.vat_calc', 'VAT Calculation')}</span>
                <span className="text-green-500">{t('landing.modules.automated', 'AUTOMATED')}</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 md:row-span-1 rounded-2xl border border-border bg-card/50 p-8 hover:border-primary/50 transition-all duration-300 group relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  <Boxes className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-space font-bold mb-2">
                  {t('landing.modules.inventory_title', 'Inventory Management')}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t('landing.modules.inventory_desc', 'Multi-branch stock syncing, automated reorder triggers, and warehouse routing.')}
                </p>
              </div>
            </div>
          </div>

          <div className="md:col-span-1 md:row-span-1 rounded-2xl border border-border bg-card/50 p-8 hover:border-primary/50 transition-all duration-300 group relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-space font-bold mb-2">{t('landing.modules.compliance_title', 'Compliance')}</h3>
            <p className="text-muted-foreground text-sm">
              {t('landing.modules.compliance_desc', 'INSA & NBE aligned reporting.')}
            </p>
          </div>

          <div className="md:col-span-1 md:row-span-1 rounded-2xl border border-border bg-primary p-8 text-primary-foreground hover:scale-[1.02] transition-transform duration-300 shadow-xl shadow-primary/20">
            <PieChart className="w-10 h-10 mb-4 opacity-80" />
            <h3 className="text-xl font-space font-bold mb-2">{t('landing.modules.bi_title', 'Real-Time BI')}</h3>
            <p className="text-primary-foreground/80 text-sm">
              {t('landing.modules.bi_desc', 'Predictive operational analytics.')}
            </p>
          </div>
        </div>
      </section>

      {/* --- FINTECH & PAYMENT GATEWAY INTEGRATION --- */}
      <section
        id="fintech"
        className="py-24 bg-card/20 relative overflow-hidden border-t border-border"
      >
        <div className="absolute left-0 bottom-0 w-1/2 h-full bg-green-500/5 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-green-500/10 text-green-500 border-none shadow-none">
              {t('landing.fintech.pill', 'FINANCIAL ECOSYSTEM')}
            </Badge>
            <h2 className="font-space text-4xl md:text-5xl font-bold mb-4">
              {t('landing.fintech.title_part1', 'Native')} <span className="text-green-500">{t('landing.fintech.title_part2', 'Payment Gateway')}</span>{" "}
              {t('landing.fintech.title_part3', 'Sync')}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              {t('landing.fintech.desc', 'We understand the Ethiopian financial landscape. Hive bridges the gap between your operational ERP and localized payment processors.')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-background border border-border rounded-2xl p-8 hover:border-green-500/40 transition-all group shadow-sm">
              <div className="w-14 h-14 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold font-space mb-3">
                {t('landing.fintech.chapa_title', 'Chapa & ArifPay Ready')}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t('landing.fintech.chapa_desc', "Connect directly to Ethiopia's leading modern payment gateways. Auto-reconcile invoices, track digital disbursements, and accept mobile payments natively.")}
              </p>
            </div>

            <div className="bg-background border border-border rounded-2xl p-8 hover:border-blue-500/40 transition-all group shadow-sm">
              <div className="w-14 h-14 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Building2 className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold font-space mb-3">
                {t('landing.fintech.nbe_title', 'NBE Criteria Compliant')}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t('landing.fintech.nbe_desc', 'Our financial modules strictly adhere to the regulatory criteria set by the National Bank of Ethiopia, ensuring your reporting and ledger management remain fully compliant.')}
              </p>
            </div>

            <div className="bg-background border border-border rounded-2xl p-8 hover:border-purple-500/40 transition-all group shadow-sm">
              <div className="w-14 h-14 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Network className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold font-space mb-3">
                {t('landing.fintech.routing_title', 'Multi-Channel Routing')}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t('landing.fintech.routing_desc', 'Process payroll directly to CBE, distribute funds via Telebirr, or handle card payments seamlessly across branches with centralized, real-time oversight.')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- SMART MOBILITY & INFRASTRUCTURE --- */}
      <section
        id="mobility"
        className="py-24 bg-background border-y border-border relative overflow-hidden"
      >
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1">
            <Badge className="mb-4 bg-blue-500/10 text-blue-500 border-none shadow-none">
              {t('landing.mobility.badge', 'INFRASTRUCTURE MODULES')}
            </Badge>
            <h2 className="font-space text-4xl md:text-5xl font-bold mb-6">
              {t('landing.mobility.title_part1', 'Smart Mobility &')} <span className="text-blue-500">{t('landing.mobility.title_part2', 'Fleet Operations')}</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              {t('landing.mobility.desc', 'Expand beyond basic tracking. Hive features advanced integration capabilities for municipalities, transit authorities, and logistics giants.')}
            </p>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="mt-1 bg-blue-500/10 p-2 rounded-lg text-blue-500 shrink-0">
                  <Car size={20} />
                </div>
                <div>
                  <h4 className="font-bold mb-1">
                    {t('landing.mobility.traffic_title', 'Smart Traffic & Toll Management')}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {t('landing.mobility.traffic_desc', 'Automate toll collection and traffic violation processing via direct API integration with Telebirr and local transit databases.')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="mt-1 bg-blue-500/10 p-2 rounded-lg text-blue-500 shrink-0">
                  <BatteryCharging size={20} />
                </div>
                <div>
                  <h4 className="font-bold mb-1">{t('landing.mobility.ev_title', 'EV Dashboard Integration')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('landing.mobility.ev_desc', 'Manage an Electric Vehicle fleet with specialized dashboard modules tracking battery health, charging node status, and route optimization.')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 relative">
            <div className="w-full h-[400px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden relative group">
              <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors"></div>
              <div className="h-12 border-b border-border bg-muted/50 flex items-center px-4 justify-between">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <span className="font-mono text-xs font-bold text-muted-foreground tracking-widest uppercase">
                  {t('landing.mobility.node_id', 'NODE // MOBILITY')}
                </span>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-space font-bold text-xl">
                      {t('landing.mobility.active_tolls', 'Active Tolls (A.A. Expressway)')}
                    </h3>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {t('landing.mobility.telebirr_sync', 'TELEBIRR SYNC: ACTIVE')}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-500">842</div>
                    <div className="text-xs text-muted-foreground">
                      {t('landing.mobility.vehicles_processed_hr', 'Vehicles Processed/Hr')}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    {
                      plate: "A 42315 AA",
                      status: t('landing.mobility.cleared', "CLEARED"),
                      amount: `45.00 ${t('landing.hr.currency', 'ETB')}`,
                      time: t('landing.mobility.just_now', "Just Now"),
                    },
                    {
                      plate: "B 19482 OR",
                      status: t('landing.mobility.pending', "PENDING"),
                      amount: `120.00 ${t('landing.hr.currency', 'ETB')}`,
                      time: t('landing.mobility.min_ago', "1 min ago"),
                    },
                    {
                      plate: "EV 00412 AA",
                      status: t('landing.mobility.exempt', "EXEMPT"),
                      amount: `0.00 ${t('landing.hr.currency', 'ETB')}`,
                      time: t('landing.mobility.mins_ago', "5 mins ago"),
                    },
                  ].map((row, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-3 rounded bg-background border border-border"
                    >
                      <div className="font-mono text-sm font-bold bg-muted px-2 py-1 rounded">
                        {row.plate}
                      </div>
                      <div
                        className={`text-xs font-bold ${row.status === "CLEARED" ? "text-green-500" : row.status === "EXEMPT" ? "text-blue-500" : "text-yellow-500"}`}
                      >
                        {row.status}
                      </div>
                      <div className="font-mono text-sm">{row.amount}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- LOCALIZED HR & PAYROLL --- */}
      <section id="hr" className="py-24 bg-card/10 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1 order-2 md:order-1 relative">
            <div className="bg-background border border-border rounded-xl shadow-xl p-6 relative max-w-sm mx-auto transform -rotate-2 hover:rotate-0 transition-transform duration-500 z-10">
              <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-primary absolute top-3 right-3" />
              </div>
              <h3 className="font-space font-bold text-xl border-b border-border pb-4 mb-4">
                {t('landing.hr.payslip_title', 'Payslip Generation')}
              </h3>
              <div className="space-y-4 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('landing.hr.gross_salary', 'Gross Salary')}</span>
                  <span>25,000.00 {t('landing.hr.currency', 'ETB')}</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span className="text-muted-foreground">
                    {t('landing.hr.income_tax', 'Income Tax (ERCA)')}
                  </span>
                  <span>-4,550.00 {t('landing.hr.currency', 'ETB')}</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span className="text-muted-foreground">
                    {t('landing.hr.pension_emp', 'Pension (7% Emp)')}
                  </span>
                  <span>-1,750.00 {t('landing.hr.currency', 'ETB')}</span>
                </div>
                <div className="w-full h-px bg-border my-2"></div>
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>{t('landing.hr.pension_boss', 'Employer Pension (11%)')}</span>
                  <span>2,750.00 {t('landing.hr.currency', 'ETB')}</span>
                </div>
                <div className="w-full h-px bg-border my-2"></div>
                <div className="flex justify-between font-bold text-lg text-primary pt-2">
                  <span>{t('landing.hr.net_pay', 'Net Pay')}</span>
                  <span>18,700.00 {t('landing.hr.currency', 'ETB')}</span>
                </div>

              </div>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/20 blur-[80px] rounded-full -z-10"></div>
          </div>

          <div className="flex-1 order-1 md:order-2">
            <Badge className="mb-4 bg-primary/10 text-primary border-none shadow-none">
              {t('landing.hr.badge', 'HUMAN RESOURCES')}
            </Badge>
            <h2 className="font-space text-4xl md:text-5xl font-bold mb-6">
              {t('landing.hr.title_part1', 'Ethiopian')} <span className="text-primary">{t('landing.hr.title_part2', 'Payroll & Pension')}</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              {t('landing.hr.desc', "Managing payroll shouldn't require a master's degree in tax law. Hive automatically handles ERCA tax brackets and POESSA pension splits for your entire workforce.")}
            </p>
            <ul className="space-y-4">
              <li className="flex gap-4">
                <Calculator className="text-primary shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold">{t('landing.hr.deductions_title', 'Automated Deductions')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('landing.hr.deductions_desc', 'System auto-calculates the progressive income tax tiers and exact 7% (Employee) / 11% (Employer) pension splits instantly.')}
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <FileText className="text-primary shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold">{t('landing.hr.compliance_title', 'Compliance Reporting')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('landing.hr.compliance_desc', 'Generate month-end Ministry of Revenue and Pension Agency declaration formats with one click.')}
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* --- MULTI-TENANCY & DOCKER ARCHITECTURE --- */}
      <section
        id="architecture"
        className="py-24 border-y border-border relative overflow-hidden bg-background"
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1/3 h-full bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1 order-2 md:order-1">
            <div className="relative w-full aspect-square max-w-md mx-auto">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-2xl transform rotate-3 animate-pulse-hex"></div>
              <div className="absolute inset-0 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="bg-muted/50 border-b border-border p-3 flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <div className="p-6 font-mono text-sm text-muted-foreground flex-1 overflow-hidden relative">
                  <p className="text-primary mb-2">
                    {t('landing.architecture.docker_init', '# Docker Swarm Cluster Init')}
                  </p>
                  <p className="opacity-80">
                    {t('landing.architecture.deploying', 'Deploying isolated tenant environments...')}
                  </p>
                  <p className="opacity-80 mt-2">
                    &gt; docker-compose -f hive.yml up -d
                  </p>
                  <p className="text-green-500 mt-2">[+] {t('landing.architecture.running', 'Running 4/4')}</p>
                  <p className="opacity-80 pl-4">{t('landing.architecture.network_created', '✔ Network hive_mesh created')}</p>
                  <p className="opacity-80 pl-4">
                    {t('landing.architecture.container_started', '✔ Container {name} Started').replace('{name}', 'tenant_a_db')}
                  </p>
                  <p className="opacity-80 pl-4">
                    {t('landing.architecture.container_started', '✔ Container {name} Started').replace('{name}', 'tenant_b_db')}
                  </p>
                  <p className="text-primary mt-4 animate-pulse">_</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 order-1 md:order-2">
            <Badge className="mb-4 bg-primary/20 text-primary border-none shadow-none">
              {t('landing.architecture.badge', 'TECHIVE ENGINEERING')}
            </Badge>
            <h2 className="font-space text-4xl md:text-5xl font-bold mb-6">
              {t('landing.architecture.title_part1', 'Containerized')} <span className="text-primary">{t('landing.architecture.title_part2', 'Multi-Tenancy')}</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              {t('landing.architecture.desc', 'Scale without boundaries. Hive operates on a heavily optimized, Dockerized environment that strictly isolates databases at the container level.')}
            </p>
            <ul className="space-y-6">
              <li className="flex gap-4 group">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all shrink-0">
                  <Code2 size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-1">
                    {t('landing.architecture.security_title', 'Isolated Data Schemas')}
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    {t('landing.architecture.security_desc', 'Every corporate tenant operates within its own dedicated database schema, preventing catastrophic data bleed.')}
                  </p>
                </div>
              </li>
              <li className="flex gap-4 group">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all shrink-0">
                  <Database size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-1">
                    {t('landing.architecture.deployment_title', 'Hybrid Cloud & On-Prem')}
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    {t('landing.architecture.deployment_desc', 'Deploy seamlessly on AWS infrastructure or containerize the entire platform for strictly isolated On-Premise deployments.')}
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* --- FIELD OPERATIONS & MOBILE --- */}
      <section className="py-24 px-4 max-w-6xl mx-auto border-b border-border overflow-hidden">
        <div className="flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1">
            <Badge className="mb-4 bg-secondary text-secondary-foreground border-none shadow-none">
              {t('landing.field.badge', 'FIELD READY')}
            </Badge>
            <h2 className="font-space text-4xl md:text-5xl font-bold mb-6">
              {t('landing.field.title_part1', 'Built for the')} <span className="text-primary">{t('landing.field.title_part2', 'Road')}</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              {t('landing.field.desc', "Operations in Ethiopia don't always have reliable internet. Our native applications are designed with aggressive offline-caching, allowing your team to work anywhere.")}
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-card/50 border border-border">
                <CloudLightning className="text-primary w-8 h-8 shrink-0" />
                <div>
                  <h4 className="font-bold">{t('landing.field.offline_title', 'Offline-First Sync')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('landing.field.offline_desc', 'Scan waybills and register deliveries offline. System syncs when connection returns.')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-lg bg-card/50 border border-border">
                <SmartphoneNfc className="text-primary w-8 h-8 shrink-0" />
                <div>
                  <h4 className="font-bold">{t('landing.field.mobile_title', 'Mobile POS Integration')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('landing.field.mobile_desc', 'Equip sales agents with mobile point-of-sale systems linked directly to your central inventory.')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 relative flex justify-center">
            <div className="w-72 h-[600px] border-[8px] border-muted rounded-[3rem] bg-background shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-muted rounded-b-xl z-20"></div>
              <div className="absolute inset-0 bg-card/30 p-6 pt-12 flex flex-col gap-4">
                <div className="w-full h-24 rounded-xl bg-primary/20 animate-pulse"></div>
                <div className="w-3/4 h-6 rounded bg-muted"></div>
                <div className="w-full h-12 rounded-lg bg-muted/50 mt-4"></div>
                <div className="w-full h-12 rounded-lg bg-muted/50"></div>
                <div className="w-full h-12 rounded-lg bg-muted/50"></div>
                <div className="mt-auto w-full h-16 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-lg shadow-primary/40 group-hover:scale-105 transition-transform cursor-pointer">
                  {t('landing.field.sync_data', 'SYNC DATA')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ──────────────────────────────────────────────── */}
      {!initialIsTenant && (
        <section
          id="how-it-works"
          className="py-24 bg-background border-b border-border relative overflow-hidden"
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 blur-[120px] rounded-full" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/5 blur-[120px] rounded-full" />
          </div>

          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-16">
              <Badge className="mb-4 bg-indigo-500/10 text-indigo-500 border-none shadow-none">
                {t('landing.how.badge', 'TWO WAYS TO GET STARTED')}
              </Badge>
              <h2 className="font-space text-4xl md:text-5xl font-bold mb-4">
                {t('landing.how.title_part1', 'How')} <span className="text-indigo-500">{t('landing.how.title_part2', 'Onboarding')}</span> {t('landing.how.title_part3', 'Works')}
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                {t('landing.how.desc', 'Every organization on Hive chooses their own deployment path. Self-service is instant, or let our admin team provision your node manually.')}
              </p>

            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Self-Service Path */}
              <div className="relative rounded-[2rem] border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-violet-500/5 p-8 hover:shadow-lg hover:shadow-indigo-500/10 transition-all group">
                <div className="absolute top-6 right-6 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
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
              <div className="relative rounded-[2rem] border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-8 hover:shadow-lg hover:shadow-amber-500/10 transition-all group">
                <div className="absolute top-6 right-6 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20">
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
            </div>
          </div>
        </section>
      )}

      {/* ─── PRICING & PLAN COMPARISON ────────────────────────────────── */}
      {!initialIsTenant && (
        <section
          id="pricing"
          className="py-24 bg-card/20 relative overflow-hidden border-b border-border"
        >
          <div className="absolute left-0 top-0 w-96 h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute right-0 bottom-0 w-96 h-96 bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-16">
              <Badge className="mb-4 bg-primary/20 text-primary border-none shadow-none">
                {t('landing.pricing.badge', 'SUBSCRIPTION PLANS')}
              </Badge>
              <h2 className="font-space text-4xl md:text-5xl font-bold mb-4">
                {t('landing.pricing.title_part1', 'Transparent')} <span className="text-primary">{t('landing.pricing.title_part2', 'Pricing')}</span>
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                {t('landing.pricing.desc', 'Every plan includes an isolated tenant workspace, secure mailbox, and a bundled module stack. Add more modules anytime via ArifPay checkout.')}
              </p>
            </div>

            {/* Plan grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
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
                <div
                  key={plan.key}
                  className={cn(
                    "relative flex flex-col rounded-[2rem] p-6 border transition-all duration-300 hover:shadow-xl overflow-hidden",
                    plan.highlight
                      ? `ring-2 ${plan.ring} border-transparent bg-gradient-to-br ${plan.bg} shadow-lg`
                      : "border-border/50 bg-card/40 backdrop-blur-md hover:bg-card/60 hover:border-primary/30",
                  )}
                >
                  {plan.highlight && (
                    <div
                      className={cn(
                        "absolute top-0 inset-x-0 h-1 rounded-t-[2rem] bg-gradient-to-r",
                        "from-indigo-500 via-violet-500 to-purple-500",
                      )}
                    />
                  )}
                  {"highlight" in plan && plan.highlight && (
                    <div className="absolute top-5 right-5 text-[9px] font-black uppercase tracking-widest bg-indigo-500 text-white px-2 py-0.5 rounded-full">
                      {t('landing.pricing.popular', 'Popular')}
                    </div>
                  )}

                  <div
                    className={cn(
                      "text-xs font-black uppercase tracking-widest mb-1",
                      plan.color,
                    )}
                  >
                    {plan.label}
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    {plan.tagline}
                  </p>

                  <div className="mb-5">
                    <span className="text-3xl font-black text-foreground">
                      {plan.price}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      {plan.priceNote}
                    </span>
                  </div>

                  <div
                    className={cn(
                      "rounded-xl px-3 py-2 mb-5 text-xs font-bold flex items-center gap-2",
                      plan.color,
                      `bg-gradient-to-br ${plan.bg}`,
                    )}
                  >
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    {plan.storage} {t('landing.pricing.mailbox_quota', 'mailbox quota')}
                  </div>

                  <ul className="space-y-2.5 flex-1 mb-6">
                    {plan.features.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <Check
                          className={cn("h-3.5 w-3.5 shrink-0", plan.color)}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link href="/auth/signup">
                    <Button
                      size="sm"
                      className={cn(
                        "w-full rounded-xl font-bold uppercase tracking-wider text-xs gap-1.5 transition-all",
                        plan.highlight
                          ? "bg-indigo-500 hover:bg-indigo-600 text-white border-none shadow-md shadow-indigo-500/30"
                          : "variant-outline border-current/30 bg-transparent hover:bg-current/10",
                      )}
                      variant={plan.highlight ? "default" : "outline"}
                    >
                      {t('landing.pricing.get_started', 'Get Started')} <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>

            {/* Admin-provision callout */}
            <div className="mt-10 rounded-[2rem] border border-border/50 bg-card/30 backdrop-blur-md p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="font-black text-foreground">
                    {t('landing.pricing.managed_title', 'Need a managed deployment?')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('landing.pricing.managed_desc', 'Central admins can provision tenant workspaces with custom quotas and module overrides from the admin panel.')}
                  </p>
                </div>
              </div>
              <Link href="/sign-in" className="shrink-0">
                <Button
                  variant="outline"
                  className="font-space font-bold uppercase tracking-wider border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-500 transition-all gap-2 whitespace-nowrap"
                >
                  {t('landing.pricing.admin_portal', 'Admin Portal')} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 🚀 Partner Slider */}
      <PartnerSlider partners={partners} />

      {/* --- FAQ --- */}
      <section className="py-24 px-4 max-w-4xl mx-auto border-b border-border">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-muted text-muted-foreground border-none shadow-none">
            {t('landing.faq.badge', 'KNOWLEDGE BASE')}
          </Badge>
          <h2 className="font-space text-4xl font-bold mb-4">
            {t('landing.faq.title', 'Frequently Asked Questions')}
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="border border-border bg-card/30 rounded-xl overflow-hidden transition-all duration-300"
            >
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full text-left px-6 py-5 flex justify-between items-center hover:bg-muted/20 transition-colors"
              >
                <span className="font-bold font-space pr-4">{faq.q}</span>
                <ChevronRight
                  className={`w-5 h-5 text-primary transition-transform duration-300 shrink-0 ${openFaq === idx ? "rotate-90" : ""}`}
                />
              </button>

              <div
                className={`px-6 text-muted-foreground text-sm overflow-hidden transition-all duration-500 ease-in-out ${openFaq === idx ? "max-h-40 pb-6 opacity-100" : "max-h-0 py-0 opacity-0"}`}
              >
                {faq.a}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- FINAL CTA --- */}
      {!initialIsTenant && (
        <section className="py-32 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-full bg-primary/10 blur-[100px] rounded-full pointer-events-none"></div>

          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h2 className="font-space text-5xl md:text-6xl font-black mb-6">
              {t('landing.cta.title_part1', 'Ready to deploy your')}
              <br />
              <span className="text-primary">{t('landing.cta.title_part2', 'Hive workspace?')}</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              {t('landing.cta.desc', 'Pick a plan and get your isolated tenant node provisioned in minutes — or contact the admin team for a managed setup.')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/signup">
                <Button className="px-8 py-6 text-lg font-space font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/20 border-none hover:scale-105 transition-all duration-300 gap-2">
                  {t('landing.cta.pill_plan', 'Start Free — Pick a Plan')} <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/sign-in">
                <Button
                  variant="outline"
                  className="px-8 py-6 text-lg font-space font-bold uppercase tracking-wider hover:bg-primary/10 hover:text-primary transition-all duration-300"
                >
                  {t('landing.how.admin_signin', 'Admin Sign In')}
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              {t('landing.cta.note', 'No credit card required for Larva & Startup plans · Powered by ArifPay')}
            </p>
          </div>
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

          <div>
            <h4 className="font-space font-bold uppercase mb-6 text-foreground tracking-wider">
              {t('landing.footer.modules', 'Modules')}
            </h4>
            <ul className="space-y-3 text-sm text-muted-foreground font-medium">
              <li className="hover:text-primary cursor-pointer transition-all hover:translate-x-1 duration-200 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-primary opacity-0 hover:opacity-100 transition-opacity"></div>
                {t('landing.nav.fintech', 'Financial Ledger')}
              </li>
              <li className="hover:text-primary cursor-pointer transition-all hover:translate-x-1 duration-200 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-primary opacity-0 hover:opacity-100 transition-opacity"></div>
                {t('landing.nav.mobility', 'Smart Mobility')}
              </li>
              <li className="hover:text-primary cursor-pointer transition-all hover:translate-x-1 duration-200 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-primary opacity-0 hover:opacity-100 transition-opacity"></div>
                {t('landing.nav.hr', 'Human Resources')}
              </li>
              <li className="hover:text-primary cursor-pointer transition-all hover:translate-x-1 duration-200 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-primary opacity-0 hover:opacity-100 transition-opacity"></div>
                {t('landing.fields.asset', 'Asset Management')}
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-space font-bold uppercase mb-6 text-foreground tracking-wider">
              {t('landing.footer.company', 'Company')}
            </h4>
            <ul className="space-y-3 text-sm text-muted-foreground font-medium">
              <li className="hover:text-primary cursor-pointer transition-all hover:translate-x-1 duration-200 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-primary opacity-0 hover:opacity-100 transition-opacity"></div>
                {t('landing.footer.docs', 'Documentation')}
              </li>
              <li className="hover:text-primary cursor-pointer transition-all hover:translate-x-1 duration-200 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-primary opacity-0 hover:opacity-100 transition-opacity"></div>
                {t('landing.footer.sales', 'Contact Sales')}
              </li>
              <li className="hover:text-primary cursor-pointer transition-all hover:translate-x-1 duration-200 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-primary opacity-0 hover:opacity-100 transition-opacity"></div>
                {t('landing.footer.location', 'Addis Ababa HQ')}
              </li>
              <li className="hover:text-primary cursor-pointer transition-all hover:translate-x-1 duration-200 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-primary opacity-0 hover:opacity-100 transition-opacity"></div>
                {t('landing.footer.status', 'System Status')}
              </li>
            </ul>
          </div>
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
                  <span className="font-bold text-primary uppercase tracking-widest text-[10px] relative z-10">
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
