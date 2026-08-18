"use client";

import {
  resolveBrandFontStack,
  resolveFontSizeScale,
  resolveFontStyle,
  resolveFontWeight,
  resolveTextTransform,
} from "./brand-fonts";

type BrandThemeInput = {
  primary_color?: string | null;
  font_family?: string | null;
  font_size?: string | null;
  font_weight?: string | null;
  font_style?: string | null;
  font_color?: string | null;
  text_transformation?: string | null;
};

export const DEFAULT_PRIMARY_COLOR = "#10b981";
export const DEFAULT_FONT_FAMILY = "Inter";
const DARK_FOREGROUND = "240 5.9% 10%";
const LIGHT_FOREGROUND = "0 0% 98%";

const expandShortHex = (hex: string): string => {
  if (hex.length !== 4) return hex;

  return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
};

export const normalizeBrandHex = (value?: string | null, fallback = DEFAULT_PRIMARY_COLOR): string => {
  if (!value) return fallback;

  const normalized = expandShortHex(value.trim());

  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toUpperCase() : fallback;
};

const hexToRgb = (hex: string) => {
  const normalized = normalizeBrandHex(hex);
  const value = normalized.slice(1);

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
};

export const hexToHslChannels = (hex: string): string => {
  const { r, g, b } = hexToRgb(hex);

  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  const lightness = (max + min) / 2;

  if (delta !== 0) {
    switch (max) {
      case red:
        hue = ((green - blue) / delta + (green < blue ? 6 : 0)) * 60;
        break;
      case green:
        hue = ((blue - red) / delta + 2) * 60;
        break;
      default:
        hue = ((red - green) / delta + 4) * 60;
        break;
    }
  }

  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
};

// WCAG 2.1 relative luminance. The previous heuristic used gamma-encoded channels
// against a fixed 0.62 cutoff, which called mid-tone brand colours "dark" and put
// white on them — the default emerald scored 2.48:1, below the 4.5:1 floor.
const relativeLuminance = (r: number, g: number, b: number): number => {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrastRatio = (a: number, b: number): number =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

// Pick whichever of the two foregrounds actually contrasts better against the
// brand colour, rather than guessing from a brightness threshold.
const getReadableForeground = (hex: string): string => {
  const { r, g, b } = hexToRgb(hex);
  const brand = relativeLuminance(r, g, b);

  // Luminance of the two candidates: hsl(240 5.9% 10%) and hsl(0 0% 98%).
  const darkLuminance = relativeLuminance(24, 24, 27);
  const lightLuminance = relativeLuminance(250, 250, 250);

  return contrastRatio(brand, darkLuminance) >= contrastRatio(brand, lightLuminance)
    ? DARK_FOREGROUND
    : LIGHT_FOREGROUND;
};

const hslChannelsToRgb = (h: number, s: number, l: number) => {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - chroma / 2;
  const [r, g, b] =
    h < 60 ? [chroma, x, 0] :
    h < 120 ? [x, chroma, 0] :
    h < 180 ? [0, chroma, x] :
    h < 240 ? [0, x, chroma] :
    h < 300 ? [x, 0, chroma] :
    [chroma, 0, x];

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
};

/**
 * A brand colour picked to look good as a *fill* is usually illegible as *text*.
 * The default emerald scores 2.55:1 on the light surface, so every `text-primary`
 * label failed WCAG the moment the console was switched to light mode.
 *
 * Walks the brand hue's lightness toward the given direction until it clears 4.5:1
 * against the surface, preserving hue and saturation so it still reads as the
 * tenant's colour. Returns HSL channels for `--primary-readable`.
 */
const getReadableAccent = (hex: string, surface: { r: number; g: number; b: number }, direction: "darken" | "lighten"): string => {
  const [hue, saturation, lightness] = hexToHslChannels(hex)
    .replace(/%/g, "")
    .split(" ")
    .map(Number);

  const surfaceLuminance = relativeLuminance(surface.r, surface.g, surface.b);
  const step = direction === "darken" ? -2 : 2;

  let current = lightness;
  for (let i = 0; i <= 50; i += 1) {
    const { r, g, b } = hslChannelsToRgb(hue, saturation / 100, current / 100);
    if (contrastRatio(relativeLuminance(r, g, b), surfaceLuminance) >= 4.5) break;

    const next = current + step;
    if (next < 0 || next > 100) break;
    current = next;
  }

  return `${hue} ${saturation}% ${Math.round(current)}%`;
};

// The family list now lives in lib/brand-fonts.ts so the settings picker and this
// runtime cannot drift apart. Re-exported here to keep existing import sites working.
export { resolveBrandFontStack } from "./brand-fonts";

export const applyBrandRuntime = (settings?: BrandThemeInput | null): void => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const primaryColor = normalizeBrandHex(settings?.primary_color);
  const primaryHsl = hexToHslChannels(primaryColor);
  const primaryForeground = getReadableForeground(primaryColor);

  root.style.setProperty("--primary", primaryHsl);
  root.style.setProperty("--accent", primaryHsl);
  root.style.setProperty("--ring", primaryHsl);
  root.style.setProperty("--primary-foreground", primaryForeground);
  root.style.setProperty("--accent-foreground", primaryForeground);

  // Text-safe variants of the brand colour for each surface. globals.css picks
  // between them per theme; `.text-primary` reads the result.
  root.style.setProperty(
    "--primary-readable-light",
    getReadableAccent(primaryColor, { r: 253, g: 253, b: 252 }, "darken"),
  );
  root.style.setProperty(
    "--primary-readable-dark",
    getReadableAccent(primaryColor, { r: 5, g: 5, b: 6 }, "lighten"),
  );

  // Typography. font_size/weight/style/text_transformation have been persisted by
  // the brand matrix since it shipped but were never read, so saving them did
  // nothing. globals.css consumes each variable below.
  root.style.setProperty("--brand-font-family", resolveBrandFontStack(settings?.font_family));
  root.style.setProperty("--brand-font-scale", resolveFontSizeScale(settings?.font_size));
  root.style.setProperty("--brand-font-weight", resolveFontWeight(settings?.font_weight));
  root.style.setProperty("--brand-font-style", resolveFontStyle(settings?.font_style));
  root.style.setProperty("--brand-text-transform", resolveTextTransform(settings?.text_transformation));

  // Opt-in only. A tenant that has never set a body colour inherits the theme
  // foreground; applying the stored legacy default (#0399ff) would repaint every
  // string in the product blue.
  const fontColor = (settings?.font_color ?? "").trim();
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(fontColor)) {
    root.style.setProperty("--brand-font-color", hexToHslChannels(fontColor));
  } else {
    root.style.removeProperty("--brand-font-color");
  }

  let themeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!themeMeta) {
    themeMeta = document.createElement("meta");
    themeMeta.name = "theme-color";
    document.head.appendChild(themeMeta);
  }
  themeMeta.content = primaryColor;
};
