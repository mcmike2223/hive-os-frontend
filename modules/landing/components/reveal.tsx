"use client";

import * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";
import { fadeUp, inView, respectMotion, scaleIn, stagger } from "../motion";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** `up` for copy, `scale` for cards and panels. */
  variant?: "up" | "scale";
  delay?: number;
  as?: "div" | "section" | "li" | "article";
};

/** Single-element scroll entrance. */
export function Reveal({ children, className, variant = "up", delay = 0, as = "div" }: RevealProps) {
  const reduced = useReducedMotion();
  const base: Variants = variant === "scale" ? scaleIn : fadeUp;
  const Component = motion[as];

  return (
    <Component
      {...inView}
      variants={respectMotion(reduced, base)}
      transition={{ delay }}
      className={className}
    >
      {children}
    </Component>
  );
}

/**
 * Parent orchestrator — pair with `RevealItem` children. Keeps the sequencing in
 * one place so every grid on the page enters at the same cadence.
 */
export function RevealGroup({
  children,
  className,
  step = 0.08,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  step?: number;
  delay?: number;
}) {
  return (
    <motion.div {...inView} variants={stagger(step, delay)} className={className}>
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
  variant = "up",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "up" | "scale";
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      variants={respectMotion(reduced, variant === "scale" ? scaleIn : fadeUp)}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Bento/pricing tile wrapper: adds the cursor-tracked spotlight declared in
 * globals.css. Writes CSS custom properties directly rather than through React
 * state so pointer movement never triggers a re-render.
 */
export function SpotlightCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    el.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }, []);

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      className={cn("spotlight-tile relative", className)}
    >
      {children}
    </div>
  );
}
