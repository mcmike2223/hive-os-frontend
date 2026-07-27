"use client";

import * as React from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";
import { getBackendStorageUrl } from "@/lib/runtime-context";
import {
  buildTenantLandingPreviewHtml,
  type TenantLandingTemplate,
  type TenantLandingTheme,
} from "@/modules/tenancy/landing-template";

type BrandSettings = {
  app_title?: string | null;
  abbreviation?: string | null;
  motto?: string | null;
  mission?: string | null;
  vision?: string | null;
  core_value?: string | null;
  product?: string | null;
  address?: string | null;
  website?: string | null;
  email?: string | null;
  phone_number?: string | null;
  fax_number?: string | null;
  po_box?: string | null;
  tin_number?: string | null;
  logo_light?: string | null;
  logo_dark?: string | null;
  footer_text?: string | null;
  primary_color?: string | null;
  font_family?: string | null;
};

type TenantBusinessLandingProps = {
  brandSettings?: BrandSettings | null;
  businessLabel: string;
  template: TenantLandingTemplate;
  tenantName: string;
};

type LandingPalette = {
  accent: string;
  accentSoft: string;
  canvas: string;
  text: string;
  textStrong: string;
  muted: string;
  panel: string;
  panelSoft: string;
  shell: string;
  shellBorder: string;
  border: string;
  borderSoft: string;
  heroGlow: string;
  accentGlow: string;
  ctaGradient: string;
  secondaryButtonBg: string;
  secondaryButtonText: string;
};

const sanitizeHref = (value?: string) => {
  const href = (value ?? "").trim();

  if (!href) {
    return "#";
  }

  if (
    href.startsWith("/") ||
    href.startsWith("#") ||
    href.startsWith("http://") ||
    href.startsWith("https://")
  ) {
    return href;
  }

  return "#";
};

const normalizeHexColor = (value: string | null | undefined, fallback: string): string => {
  const raw = (value ?? "").trim();
  if (!raw) return fallback;

  const normalized = raw.length === 4
    ? `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`
    : raw;

  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toUpperCase() : fallback;
};

const hexToRgb = (hex: string) => {
  const normalized = normalizeHexColor(hex, "#0F766E").slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
};

const toRgba = (hex: string, alpha: number): string => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
};

const blendHex = (fromHex: string, toHex: string, ratio: number): string => {
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);
  const weight = Math.min(1, Math.max(0, ratio));

  const r = Math.round(from.r + (to.r - from.r) * weight);
  const g = Math.round(from.g + (to.g - from.g) * weight);
  const b = Math.round(from.b + (to.b - from.b) * weight);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
};

const resolveBrandFontFamily = (fontFamily?: string | null): string => {
  const normalized = (fontFamily ?? "").trim().toLowerCase();

  switch (normalized) {
    case "space grotesk":
      return `"Space Grotesk", "Inter", "Segoe UI", system-ui, sans-serif`;
    case "jetbrains mono":
      return `"JetBrains Mono", "Fira Code", ui-monospace, monospace`;
    case "system ui":
    case "system-ui":
      return `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    default:
      return `"Space Grotesk", "Inter", "Segoe UI", system-ui, sans-serif`;
  }
};

const resolveLandingPalette = (
  theme: TenantLandingTheme,
  brandSettings: BrandSettings | null | undefined,
  isDark: boolean,
): LandingPalette => {
  const accent = normalizeHexColor(brandSettings?.primary_color ?? theme.accent, "#0F766E");
  const accentSoft = normalizeHexColor(
    theme.accent_soft,
    isDark ? blendHex(accent, "#0F172A", 0.72) : blendHex(accent, "#FFFFFF", 0.84),
  );

  const canvas = theme.canvas || (
    isDark
      ? "radial-gradient(circle at 10% 12%, rgba(15,118,110,0.24), transparent 32%), linear-gradient(150deg, #020617 0%, #0b1324 42%, #111a2e 100%)"
      : "radial-gradient(circle at 10% 12%, rgba(15,118,110,0.14), transparent 32%), linear-gradient(150deg, #f8fafc 0%, #ecfeff 42%, #eef2ff 100%)"
  );

  const text = normalizeHexColor(theme.text, isDark ? "#D7E2EF" : "#334155");
  const textStrong = isDark ? "#F8FAFC" : "#0F172A";
  const muted = normalizeHexColor(theme.muted, isDark ? "#9FB1C8" : "#475569");
  const panel = theme.panel ?? (isDark ? "rgba(10, 18, 32, 0.78)" : "rgba(255,255,255,0.84)");
  const panelSoft = isDark ? "rgba(15, 23, 42, 0.55)" : "rgba(255,255,255,0.72)";
  const shell = isDark ? "rgba(2, 9, 21, 0.56)" : "rgba(255,255,255,0.68)";
  const shellBorder = isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.08)";
  const border = isDark ? "rgba(148,163,184,0.22)" : "rgba(15,23,42,0.1)";
  const borderSoft = isDark ? "rgba(148,163,184,0.16)" : "rgba(15,23,42,0.06)";
  const heroGlow = toRgba(accent, isDark ? 0.22 : 0.14);
  const accentGlow = toRgba(accent, isDark ? 0.34 : 0.2);
  const ctaGradient = isDark
    ? `linear-gradient(135deg, ${toRgba(accent, 0.24)} 0%, rgba(15,23,42,0.74) 100%)`
    : `linear-gradient(135deg, ${toRgba(accent, 0.14)} 0%, rgba(255,255,255,0.94) 100%)`;
  const secondaryButtonBg = isDark ? "rgba(15, 23, 42, 0.55)" : "rgba(255,255,255,0.8)";
  const secondaryButtonText = isDark ? "#E2E8F0" : "#334155";

  return {
    accent,
    accentSoft,
    canvas,
    text,
    textStrong,
    muted,
    panel,
    panelSoft,
    shell,
    shellBorder,
    border,
    borderSoft,
    heroGlow,
    accentGlow,
    ctaGradient,
    secondaryButtonBg,
    secondaryButtonText,
  };
};

function BrandLogo({
  brandSettings,
  fallback,
  isDark,
  textColor,
}: {
  brandSettings?: BrandSettings | null;
  fallback: string;
  isDark: boolean;
  textColor: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const rawLogoUrl = isDark
    ? (brandSettings?.logo_dark || brandSettings?.logo_light)
    : (brandSettings?.logo_light || brandSettings?.logo_dark);
  const logoUrl = getBackendStorageUrl(rawLogoUrl);

  React.useEffect(() => {
    setFailed(false);
  }, [logoUrl]);

  if (!logoUrl || failed) {
    return (
      <span
        className="text-sm font-black uppercase tracking-[0.22em]"
        style={{ color: textColor }}
      >
        {fallback}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Tenant logo URLs can point at configured storage domains outside Next image allowlists.
    <img
      src={logoUrl}
      alt={fallback}
      className="h-10 w-auto object-contain"
      onError={() => setFailed(true)}
    />
  );
}

export function TenantBusinessLanding({
  brandSettings,
  businessLabel,
  template,
  tenantName,
}: TenantBusinessLandingProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;
  const brandName = brandSettings?.app_title || tenantName;
  const palette = React.useMemo(
    () => resolveLandingPalette(template.theme, brandSettings, isDark),
    [brandSettings, isDark, template.theme],
  );
  const fontFamily = React.useMemo(
    () => resolveBrandFontFamily(brandSettings?.font_family),
    [brandSettings?.font_family],
  );
  const customLandingHtml = React.useMemo(() => {
    if (
      (template.rendering.mode !== "custom_code" && template.rendering.mode !== "raw_package")
      || !template.rendering.html.trim()
    ) {
      return null;
    }

    return buildTenantLandingPreviewHtml(template, brandName, businessLabel, {
      colorMode: isDark ? "dark" : "light",
      branding: brandSettings,
    });
  }, [brandName, brandSettings, businessLabel, isDark, template]);

  if (customLandingHtml) {
    return (
      <iframe
        title={`${brandName} landing page`}
        srcDoc={customLandingHtml}
        className="block h-screen min-h-screen w-full border-0"
        sandbox={
          template.rendering.mode === "raw_package"
            ? "allow-scripts allow-popups allow-top-navigation-by-user-activation"
            : "allow-popups allow-top-navigation-by-user-activation"
        }
      />
    );
  }

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{
        backgroundImage: palette.canvas,
        color: palette.text,
        fontFamily,
      }}
    >
      <div className="relative isolate">
        <div className="absolute inset-x-0 top-0 -z-10 h-[28rem] blur-3xl" style={{ backgroundColor: palette.heroGlow }} />
        <div className="absolute left-[-5rem] top-20 -z-10 h-72 w-72 rounded-full blur-3xl" style={{ backgroundColor: palette.accentGlow }} />
        <div className="absolute right-[-6rem] top-36 -z-10 h-80 w-80 rounded-full blur-3xl" style={{ backgroundColor: palette.accentSoft }} />

        <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
          <header className="sticky top-4 z-20">
            <div
              className="rounded-[2rem] px-5 py-4 shadow-[0_20px_60px_rgba(15,23,42,0.14)] backdrop-blur-2xl"
              style={{ backgroundColor: palette.shell, border: `1px solid ${palette.shellBorder}` }}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <BrandLogo
                    brandSettings={brandSettings}
                    fallback={brandName}
                    isDark={isDark}
                    textColor={palette.textStrong}
                  />
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: palette.muted }}>
                      {businessLabel}
                    </p>
                    <p className="text-sm font-semibold" style={{ color: palette.text }}>
                      {tenantName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <a href={sanitizeHref(template.hero.primary_href)}>
                    <Button
                      className="rounded-full border-0 px-6 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg"
                      style={{ backgroundColor: palette.accent, boxShadow: `0 16px 34px ${toRgba(palette.accent, 0.35)}` }}
                    >
                      {template.hero.primary_label}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </header>

          <section className="pt-12 sm:pt-16">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
              <div>
                <div
                  className="inline-flex max-w-full items-center rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em]"
                  style={{
                    backgroundColor: palette.accentSoft,
                    color: palette.accent,
                    border: `1px solid ${palette.borderSoft}`,
                  }}
                >
                  {template.hero.eyebrow}
                </div>
                {template.hero.announcement ? (
                  <p className="mt-4 text-sm font-medium" style={{ color: palette.muted }}>
                    {template.hero.announcement}
                  </p>
                ) : null}
                <h1
                  className="mt-5 max-w-4xl text-5xl font-black tracking-[-0.06em] sm:text-6xl lg:text-7xl"
                  style={{ color: palette.textStrong }}
                >
                  {template.hero.title}
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-8 sm:text-lg" style={{ color: palette.text }}>
                  {template.hero.description}
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <a href={sanitizeHref(template.hero.primary_href)}>
                    <Button
                      className="rounded-full border-0 px-7 py-6 text-sm font-black uppercase tracking-[0.18em] text-white shadow-xl"
                      style={{ backgroundColor: palette.accent, boxShadow: `0 18px 40px ${toRgba(palette.accent, 0.34)}` }}
                    >
                      {template.hero.primary_label}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </a>
                  <a href={sanitizeHref(template.hero.secondary_href)}>
                    <Button
                      variant="outline"
                      className="rounded-full px-7 py-6 text-sm font-black uppercase tracking-[0.18em]"
                      style={{
                        borderColor: palette.border,
                        backgroundColor: palette.secondaryButtonBg,
                        color: palette.secondaryButtonText,
                      }}
                    >
                      {template.hero.secondary_label}
                    </Button>
                  </a>
                </div>
              </div>

              <div className="rounded-[2.25rem] p-6 shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur-2xl" style={{ backgroundColor: palette.panel, border: `1px solid ${palette.border}` }}>
                <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: palette.muted }}>
                  Why this landing page works
                </p>
                <div className="mt-5 space-y-4">
                  {template.highlights.slice(0, 3).map((item) => (
                    <div
                      key={item.title}
                      className="rounded-[1.5rem] p-4"
                      style={{ backgroundColor: palette.panelSoft, border: `1px solid ${palette.borderSoft}` }}
                    >
                      <p
                        className="text-[11px] font-black uppercase tracking-[0.24em]"
                        style={{ color: palette.accent }}
                      >
                        {item.kicker}
                      </p>
                      <h3 className="mt-2 text-lg font-black tracking-[-0.03em]" style={{ color: palette.textStrong }}>
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6" style={{ color: palette.text }}>
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-10 grid gap-4 sm:grid-cols-3">
            {template.stats.map((stat) => (
              <div
                key={`${stat.value}-${stat.label}`}
                className="rounded-[1.75rem] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.14)] backdrop-blur-xl"
                style={{ backgroundColor: palette.panel, border: `1px solid ${palette.border}` }}
              >
                <p className="text-3xl font-black tracking-[-0.06em] sm:text-4xl" style={{ color: palette.textStrong }}>
                  {stat.value}
                </p>
                <p className="mt-2 text-sm" style={{ color: palette.muted }}>{stat.label}</p>
              </div>
            ))}
          </section>

          <section id="offers" className="mt-20">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: palette.accent }}>
                What people can do here
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.05em] sm:text-4xl" style={{ color: palette.textStrong }}>
                {template.spotlight.heading}
              </h2>
              <p className="mt-4 text-base leading-8" style={{ color: palette.text }}>
                {template.spotlight.description}
              </p>
            </div>
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {template.spotlight.items.map((item, index) => (
                <article
                  key={item.title}
                  className="rounded-[2rem] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur-xl"
                  style={{ backgroundColor: palette.panel, border: `1px solid ${palette.border}` }}
                >
                  <div
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full text-sm font-black"
                    style={{ backgroundColor: palette.accentSoft, color: palette.accent }}
                  >
                    0{index + 1}
                  </div>
                  <h3 className="mt-5 text-2xl font-black tracking-[-0.04em]" style={{ color: palette.textStrong }}>
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7" style={{ color: palette.text }}>
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-20">
            <div className="grid gap-5 lg:grid-cols-2">
              {template.testimonials.map((item) => (
                <blockquote
                  key={`${item.author}-${item.role}`}
                  className="rounded-[2rem] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur-xl"
                  style={{ backgroundColor: palette.panel, border: `1px solid ${palette.border}` }}
                >
                  <CheckCircle2 className="h-8 w-8" style={{ color: palette.accent }} />
                  <p className="mt-4 text-lg leading-8" style={{ color: palette.text }}>
                    &ldquo;{item.quote}&rdquo;
                  </p>
                  <footer className="mt-6">
                    <p className="text-sm font-black uppercase tracking-[0.16em]" style={{ color: palette.textStrong }}>
                      {item.author}
                    </p>
                    <p className="mt-1 text-sm" style={{ color: palette.muted }}>{item.role}</p>
                  </footer>
                </blockquote>
              ))}
            </div>
          </section>

          <section className="mt-20">
            <div
              className="rounded-[2.5rem] px-6 py-8 shadow-[0_35px_90px_rgba(15,23,42,0.2)] backdrop-blur-2xl sm:px-8 sm:py-10"
              style={{
                background: palette.ctaGradient,
                border: `1px solid ${palette.border}`,
              }}
            >
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: palette.accent }}>
                    Final call to action
                  </p>
                  <h2 className="mt-3 text-3xl font-black tracking-[-0.05em] sm:text-4xl" style={{ color: palette.textStrong }}>
                    {template.final_cta.title}
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-8" style={{ color: palette.text }}>
                    {template.final_cta.description}
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                  <a href={sanitizeHref(template.final_cta.primary_href)}>
                    <Button
                      className="w-full rounded-full border-0 px-7 py-6 text-sm font-black uppercase tracking-[0.18em] text-white sm:w-auto"
                      style={{ backgroundColor: palette.accent, boxShadow: `0 16px 36px ${toRgba(palette.accent, 0.34)}` }}
                    >
                      {template.final_cta.primary_label}
                    </Button>
                  </a>
                  <a href={sanitizeHref(template.final_cta.secondary_href)}>
                    <Button
                      variant="outline"
                      className="w-full rounded-full px-7 py-6 text-sm font-black uppercase tracking-[0.18em] sm:w-auto"
                      style={{
                        borderColor: palette.border,
                        backgroundColor: palette.secondaryButtonBg,
                        color: palette.secondaryButtonText,
                      }}
                    >
                      {template.final_cta.secondary_label}
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </section>

          <footer
            className="mt-12 flex flex-col gap-3 border-t px-1 py-8 text-sm sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: palette.border, color: palette.muted }}
          >
            <p>{brandSettings?.footer_text || `Powered by ${brandName}`}</p>
            <p className={cn("font-medium")} style={{ color: palette.text }}>
              Public landing page for {tenantName}
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default TenantBusinessLanding;
