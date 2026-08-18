"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

/**
 * Shared section furniture for the marketing page.
 *
 * Before this, every section improvised its own padding, eyebrow badge and
 * heading colour — one used a green pill, the next indigo, the next a raw
 * shadcn Badge — so the page read as a stack of unrelated templates. These
 * primitives fix the vertical rhythm and the heading grammar in one place:
 * an eyebrow, a two-tone headline (solid + serif italic accent), a lede.
 */

type Tone = "base" | "raised" | "sunken";

const TONE: Record<Tone, string> = {
  base: "bg-background",
  raised: "bg-card/20",
  sunken: "bg-card/40",
};

export function SectionShell({
  id,
  tone = "base",
  glow,
  className,
  innerClassName,
  children,
}: {
  id?: string;
  tone?: Tone;
  /** Ambient colour wash. `none` for sections that already carry a strong visual. */
  glow?: "primary" | "cool" | "warm" | "none";
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative overflow-hidden border-t border-border/60 py-24 md:py-32",
        TONE[tone],
        className,
      )}
    >
      {glow && glow !== "none" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className={cn(
              "absolute -top-24 left-1/4 h-[26rem] w-[26rem] rounded-full blur-[130px]",
              glow === "primary" && "bg-primary/10",
              glow === "cool" && "bg-sky-500/10",
              glow === "warm" && "bg-amber-500/10",
            )}
          />
          <div
            className={cn(
              "absolute -bottom-32 right-1/5 h-[22rem] w-[22rem] rounded-full blur-[130px]",
              glow === "primary" && "bg-emerald-400/[0.07]",
              glow === "cool" && "bg-indigo-500/[0.07]",
              glow === "warm" && "bg-orange-500/[0.07]",
            )}
          />
        </div>
      )}
      <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", innerClassName)}>{children}</div>
    </section>
  );
}

/** Mono eyebrow with a leading rule — the one label style for the whole page. */
export function Eyebrow({
  children,
  className,
  align = "center",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "center" | "left";
}) {
  return (
    <span
      className={cn(
        "mb-5 inline-flex items-center gap-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground",
        align === "center" && "justify-center",
        className,
      )}
    >
      <span className="h-px w-6 bg-gradient-to-r from-transparent to-primary/70" />
      <span className="text-primary">{children}</span>
      <span className="h-px w-6 bg-gradient-to-l from-transparent to-primary/70" />
    </span>
  );
}

/**
 * Headline grammar: a solid lead phrase and a serif-italic accent, the same
 * pairing the hero uses ("Unify Your Enterprise *Operations*"). Sections used to
 * tint their headings green/blue/indigo/violet, which scattered the palette
 * across five hues; the accent is now always the brand green.
 */
export function SectionHeading({
  eyebrow,
  title,
  accent,
  trailing,
  description,
  align = "center",
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  accent?: React.ReactNode;
  /** Optional plain text after the accent, e.g. "Payment Gateway *Sync*". */
  trailing?: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <Reveal
      className={cn(
        "mb-14 md:mb-16",
        align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl text-left",
        className,
      )}
    >
      {eyebrow && <Eyebrow align={align}>{eyebrow}</Eyebrow>}
      <h2 className="text-balance font-space text-[2.1rem] font-bold leading-[1.08] tracking-[-0.02em] md:text-5xl">
        {title}
        {accent && (
          <>
            {" "}
            <span className="font-serif font-normal italic tracking-[-0.03em] text-primary">
              {accent}
            </span>
          </>
        )}
        {trailing && <> {trailing}</>}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-5 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg",
            align === "center" && "mx-auto max-w-2xl",
          )}
        >
          {description}
        </p>
      )}
    </Reveal>
  );
}

/**
 * Panel chrome for the inline product shots. Replaces the three macOS
 * traffic-light dots that appeared twice on the page — borrowed furniture that
 * said "screenshot of someone else's app" rather than "this is Hive".
 */
export function WindowChrome({
  label,
  status,
  accent = "primary",
}: {
  label: string;
  status?: string;
  accent?: "primary" | "cool";
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/70 bg-muted/30 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            accent === "primary" ? "bg-primary" : "bg-sky-500",
          )}
        />
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
      </div>
      {status && (
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-[0.18em]",
            accent === "primary" ? "text-primary" : "text-sky-500",
          )}
        >
          {status}
        </span>
      )}
    </div>
  );
}

/** Icon plate used by every feature list and card on the page. */
export function IconPlate({
  children,
  size = "md",
  accent = "primary",
  className,
}: {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  accent?: "primary" | "cool" | "warm" | "violet";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl border transition-colors",
        size === "sm" && "h-9 w-9 rounded-lg",
        size === "md" && "h-11 w-11",
        size === "lg" && "h-14 w-14 rounded-2xl",
        accent === "primary" && "border-primary/20 bg-primary/10 text-primary",
        accent === "cool" && "border-sky-500/20 bg-sky-500/10 text-sky-500",
        accent === "warm" && "border-amber-500/20 bg-amber-500/10 text-amber-500",
        accent === "violet" && "border-violet-500/20 bg-violet-500/10 text-violet-500",
        className,
      )}
    >
      {children}
    </span>
  );
}
