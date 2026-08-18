/**
 * Single source of truth for brand typography.
 *
 * Both the settings UI (which renders the pickers) and `applyBrandRuntime`
 * (which writes the CSS variables) read from here, so a font added below is
 * immediately selectable on the central console and on every tenant node
 * without touching either call site.
 *
 * `bundled` families are self-hosted from `app/fonts` via next/font/local and
 * are guaranteed to render. The rest resolve to system stacks — no network
 * fetch, no layout shift, available on every platform.
 */

export type BrandFontCategory = "sans" | "serif" | "mono";

export type BrandFontOption = {
  /** Persisted in the `font_family` brand setting. */
  value: string;
  label: string;
  /** CSS font-family list. Generic tails are appended by globals.css. */
  stack: string;
  category: BrandFontCategory;
  /** True when the family ships with the app rather than relying on the OS. */
  bundled: boolean;
};

export const DEFAULT_FONT_FAMILY = "Inter";

export const BRAND_FONTS: readonly BrandFontOption[] = [
  {
    value: "Inter",
    label: "Inter",
    stack: "var(--font-inter)",
    category: "sans",
    bundled: true,
  },
  {
    value: "Space Grotesk",
    label: "Space Grotesk",
    stack: "var(--font-space), var(--font-inter)",
    category: "sans",
    bundled: true,
  },
  {
    value: "JetBrains Mono",
    label: "JetBrains Mono",
    stack: "var(--font-mono)",
    category: "mono",
    bundled: true,
  },
  {
    value: "System UI",
    label: "System UI",
    stack: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI'",
    category: "sans",
    bundled: false,
  },
  {
    value: "Helvetica",
    label: "Helvetica / Arial",
    stack: "'Helvetica Neue', Helvetica, Arial",
    category: "sans",
    bundled: false,
  },
  {
    value: "Georgia",
    label: "Georgia",
    stack: "Georgia, Cambria, 'Times New Roman'",
    category: "serif",
    bundled: false,
  },
  {
    value: "Times New Roman",
    label: "Times New Roman",
    stack: "'Times New Roman', Times",
    category: "serif",
    bundled: false,
  },
  {
    value: "Courier New",
    label: "Courier New",
    stack: "'Courier New', Courier",
    category: "mono",
    bundled: false,
  },
] as const;

/** Values accepted by the backend's `font_family` validation rule. */
export const BRAND_FONT_VALUES = BRAND_FONTS.map((font) => font.value);

export const findBrandFont = (fontFamily?: string | null): BrandFontOption => {
  const normalized = (fontFamily || DEFAULT_FONT_FAMILY).trim().toLowerCase();

  return (
    BRAND_FONTS.find((font) => font.value.toLowerCase() === normalized) ??
    // Legacy rows stored "system-ui"; keep them resolving to the same option.
    BRAND_FONTS.find((font) => font.value.toLowerCase().replace(/\s+/g, "-") === normalized) ??
    BRAND_FONTS[0]
  );
};

/**
 * Family only — globals.css appends the generic fallback tail when it
 * substitutes this into --font-sans.
 */
export const resolveBrandFontStack = (fontFamily?: string | null): string =>
  findBrandFont(fontFamily).stack;

/* ------------------------------------------------------------------ *
 * Remaining typography settings.
 *
 * The backend has persisted font_size / font_weight / font_style /
 * text_transformation since the brand matrix shipped, but nothing ever read
 * them — saving them changed nothing. Each option below maps to a CSS value
 * applied at :root by `applyBrandRuntime`.
 * ------------------------------------------------------------------ */

export type BrandChoice = { value: string; label: string; css: string };

/** Scales the whole UI via the root font size. `--brand-font-size` is a multiplier. */
export const BRAND_FONT_SIZES: readonly BrandChoice[] = [
  { value: "compact", label: "Compact", css: "0.9375" },
  { value: "default", label: "Default", css: "1" },
  { value: "comfortable", label: "Comfortable", css: "1.0625" },
  { value: "large", label: "Large", css: "1.125" },
] as const;

export const BRAND_FONT_WEIGHTS: readonly BrandChoice[] = [
  { value: "light", label: "Light", css: "300" },
  { value: "normal", label: "Normal", css: "400" },
  { value: "medium", label: "Medium", css: "500" },
  { value: "semibold", label: "Semibold", css: "600" },
] as const;

export const BRAND_FONT_STYLES: readonly BrandChoice[] = [
  { value: "normal", label: "Normal", css: "normal" },
  { value: "italic", label: "Italic", css: "italic" },
  { value: "oblique", label: "Oblique", css: "oblique" },
] as const;

/** Applies to the uppercase micro-labels only, never to body copy. */
export const BRAND_TEXT_TRANSFORMS: readonly BrandChoice[] = [
  { value: "none", label: "None", css: "none" },
  { value: "uppercase", label: "Uppercase", css: "uppercase" },
  { value: "lowercase", label: "Lowercase", css: "lowercase" },
  { value: "capitalize", label: "Capitalize", css: "capitalize" },
] as const;

const resolveChoice = (
  choices: readonly BrandChoice[],
  value: string | null | undefined,
  fallback: string,
): string => {
  const normalized = (value ?? "").trim().toLowerCase();
  const match = choices.find((choice) => choice.value === normalized);
  if (match) return match.css;

  // Legacy rows stored raw CSS ("14px", "700", "uppercase") before these
  // settings had a controlled vocabulary. Pass a recognised one straight
  // through so an old value keeps working instead of snapping to default.
  const passthrough = choices.find((choice) => choice.css === normalized);
  return passthrough ? passthrough.css : fallback;
};

/**
 * Only the named scales resize the console. Legacy rows hold raw pixel values
 * (the old default was "14px") from when this setting was inert — honouring
 * those would shrink every existing tenant's UI by 12.5% on deploy, so anything
 * outside the vocabulary resolves to 1 until an admin picks a scale.
 */
export const resolveFontSizeScale = (value?: string | null): string =>
  resolveChoice(BRAND_FONT_SIZES, value, "1");

export const resolveFontWeight = (value?: string | null): string =>
  resolveChoice(BRAND_FONT_WEIGHTS, value, "400");

export const resolveFontStyle = (value?: string | null): string =>
  resolveChoice(BRAND_FONT_STYLES, value, "normal");

export const resolveTextTransform = (value?: string | null): string =>
  resolveChoice(BRAND_TEXT_TRANSFORMS, value, "uppercase");

/**
 * Coerces a stored setting to a value the picker can actually display.
 *
 * Legacy rows hold raw CSS ("14px", "700") from before these settings had a
 * controlled vocabulary. Feeding one to a Select leaves the trigger blank —
 * the control shows nothing while the UI renders the default — so anything
 * unrecognised snaps to the fallback option.
 */
export const normalizeBrandChoice = (
  choices: readonly BrandChoice[],
  value: string | null | undefined,
  fallback: string,
): string => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (choices.some((choice) => choice.value === normalized)) return normalized;

  // Map a legacy raw-CSS value onto the option that produces it, when one exists.
  const byCss = choices.find((choice) => choice.css === normalized);
  return byCss ? byCss.value : fallback;
};
