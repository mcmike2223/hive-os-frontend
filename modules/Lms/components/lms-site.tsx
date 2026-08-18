"use client";

import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { GraduationCap, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  getBackendApiRoot,
  getBackendStorageUrl,
  getTenantHeaders,
  getWorkspaceScopeKey,
} from "@/lib/runtime-context";
import { cn } from "@/lib/utils";

/* ============================================================================
 * Shared design tokens lifted from the lms2 (Educrat) template.
 * Kept in one place so the landing, course list, and course detail pages match.
 * ==========================================================================*/
export const LMS_TOKENS = {
  navy: "#140342",
  navy2: "#1A064F",
  navyCard: "#2B1C63",
  purple: "#6440FB",
  lavender: "#EBEAFE",
  green: "#00FF84",
  greenDark: "#04D697",
  beige: "#FEFBF4",
  starYellow: "#E59819",
  muted: "#4F547B",
  lightBg: "#F7F8FB",
  border: "#EDEDED",
} as const;

export const LMS_FONT_STACK =
  '"DM Sans", "DM Sans Fallback", ui-sans-serif, system-ui, sans-serif';
export const LMS_FONT_HREF =
  "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap";

export const LMS_MY_LEARNING_PATH = "/dashboard/learning-management?tab=my-learning";
export const LOGIN_HREF = `/lms-login?redirect=${encodeURIComponent(LMS_MY_LEARNING_PATH)}`;
export const REGISTER_HREF = "/lms-register";
export const COURSES_HREF = "/courses";

export type LmsBrandSettings = {
  app_title?: string | null;
  logo_light?: string | null;
  logo_dark?: string | null;
  primary_color?: string | null;
};

export const normalizeHexColor = (value: string | null | undefined, fallback: string): string => {
  const raw = (value ?? "").trim();
  if (!raw) return fallback;

  const normalized =
    raw.length === 4 ? `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}` : raw;

  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toUpperCase() : fallback;
};

const hexToRgb = (hex: string) => {
  const normalized = normalizeHexColor(hex, LMS_TOKENS.purple).slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
};

const toLinear = (channel: number) => {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
};

const luminance = (hex: string) => {
  const rgb = hexToRgb(hex);
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
};

const contrastRatio = (first: string, second: string) => {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
};

export const readableTextOn = (background: string) =>
  contrastRatio("#FFFFFF", background) >= 4.5 ? "#FFFFFF" : "#0F172A";

export const blendWithWhite = (hex: string, ratio: number) => {
  const rgb = hexToRgb(hex);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * ratio);
  return `#${[mix(rgb.r), mix(rgb.g), mix(rgb.b)]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
};

export const resolveTemplateImageSrc = (src: string) => {
  const trimmed = (src ?? "").trim();
  if (!trimmed) return src;
  if (
    trimmed.startsWith("/lms2/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }
  return getBackendStorageUrl(trimmed) || trimmed;
};

export function TemplateImage({
  src,
  alt,
  className,
  sizes,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const resolved = resolveTemplateImageSrc(src);
  return (
    <Image
      src={resolved}
      alt={alt}
      fill
      unoptimized={resolved.startsWith("http") || resolved.startsWith("/lms2/")}
      priority={priority}
      sizes={sizes ?? "(min-width: 1024px) 33vw, 100vw"}
      className={cn("object-cover", className)}
    />
  );
}

export function Stars({ rating, className }: { rating?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {rating ? (
        <span className="text-sm font-bold" style={{ color: LMS_TOKENS.starYellow }}>
          {rating}
        </span>
      ) : null}
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            className="size-3"
            style={{ color: LMS_TOKENS.starYellow, fill: LMS_TOKENS.starYellow }}
          />
        ))}
      </span>
    </span>
  );
}

/* Fetch the same public brand settings the landing/homepage use. */
export function useLmsPublicBrand() {
  const workspaceScope = getWorkspaceScopeKey();

  const { data } = useQuery({
    queryKey: ["publicBrandSettings", workspaceScope],
    queryFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/settings/brand/public`, {
        headers: { Accept: "application/json", ...getTenantHeaders() },
      });
      if (!res.ok) throw new Error("Failed to fetch brand settings");
      return res.json();
    },
    staleTime: 600000,
    retry: 1,
  });

  const brandSettings = (data?.data ?? null) as LmsBrandSettings | null;
  const brandName = brandSettings?.app_title || "Learning Portal";
  const accent = normalizeHexColor(brandSettings?.primary_color, LMS_TOKENS.purple);

  return { brandSettings, brandName, accent };
}

export function BrandMark({
  brandSettings,
  fallbackLabel,
  onDark = false,
}: {
  brandSettings?: LmsBrandSettings | null;
  fallbackLabel: string;
  onDark?: boolean;
}) {
  const [failed, setFailed] = React.useState(false);
  const logoUrl = getBackendStorageUrl(
    onDark
      ? brandSettings?.logo_dark || brandSettings?.logo_light
      : brandSettings?.logo_light || brandSettings?.logo_dark
  );
  const label = brandSettings?.app_title || fallbackLabel;

  React.useEffect(() => {
    setFailed(false);
  }, [logoUrl]);

  if (logoUrl && !failed) {
    return (
      <span className="relative block h-11 w-36">
        <Image
          src={logoUrl}
          alt={`${label} logo`}
          fill
          unoptimized={logoUrl.startsWith("http")}
          sizes="144px"
          className="object-contain object-left"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 text-lg font-bold tracking-tight",
        onDark ? "text-white" : "text-[#140342]"
      )}
    >
      <span
        className="grid size-10 place-items-center rounded-xl text-white"
        style={{ backgroundColor: LMS_TOKENS.purple }}
      >
        <GraduationCap className="size-5" aria-hidden="true" />
      </span>
      <span>{label}</span>
    </span>
  );
}

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Courses", href: COURSES_HREF },
  { label: "Categories", href: "/#categories" },
  { label: "Instructors", href: "/#instructors" },
  { label: "FAQ", href: "/#faq" },
];

export function LmsSiteHeader({
  brandSettings,
  brandName,
  announcement,
}: {
  brandSettings?: LmsBrandSettings | null;
  brandName: string;
  announcement?: string;
}) {
  return (
    <header className="sticky top-0 z-40" style={{ backgroundColor: LMS_TOKENS.navy }}>
      {announcement ? (
        <div
          className="px-4 py-2 text-center text-xs font-medium text-white/90"
          style={{ backgroundColor: LMS_TOKENS.purple }}
        >
          {announcement}
        </div>
      ) : null}
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8"
        aria-label="Main"
      >
        <Link
          href="/"
          className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF84] focus-visible:ring-offset-2 focus-visible:ring-offset-[#140342]"
        >
          <BrandMark brandSettings={brandSettings} fallbackLabel={brandName} onDark />
        </Link>
        <div className="hidden items-center gap-8 text-[15px] font-medium text-white/85 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-[#00FF84]">
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            asChild
            variant="ghost"
            className="hidden h-11 rounded-lg px-5 text-[15px] font-medium text-white hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            <Link href={LOGIN_HREF}>Log in</Link>
          </Button>
          <Button
            asChild
            className="h-11 rounded-lg bg-white px-6 text-[15px] font-medium text-[#140342] shadow-none transition hover:bg-[#00FF84] hover:text-[#140342]"
          >
            <Link href={REGISTER_HREF}>Sign up</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}

export function LmsSiteFooter({
  brandSettings,
  brandName,
}: {
  brandSettings?: LmsBrandSettings | null;
  brandName: string;
}) {
  return (
    <footer style={{ backgroundColor: LMS_TOKENS.navy }} className="text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 border-b border-white/10 py-10 md:flex-row">
          <BrandMark brandSettings={brandSettings} fallbackLabel={brandName} onDark />
          <nav
            className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-white/70"
            aria-label="Footer"
          >
            <Link href={COURSES_HREF} className="transition hover:text-white">Courses</Link>
            <Link href="/#categories" className="transition hover:text-white">Categories</Link>
            <Link href="/#instructors" className="transition hover:text-white">Instructors</Link>
            <Link href="/#faq" className="transition hover:text-white">FAQ</Link>
            <Link href={LOGIN_HREF} className="transition hover:text-white">Log in</Link>
          </nav>
        </div>
        <div className="flex flex-col items-center justify-between gap-3 py-6 text-sm text-white/50 md:flex-row">
          <p>© {new Date().getFullYear()} {brandName}. All rights reserved.</p>
          <p>Powered by the {brandName} learning portal.</p>
        </div>
      </div>
    </footer>
  );
}
