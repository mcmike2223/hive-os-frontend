"use client";

/**
 * Lounge FX — a reusable premium-motion layer for the Savory Lounge tenant.
 * Built on framer-motion. Every effect degrades gracefully with
 * `prefers-reduced-motion` and is pointer-safe (overlays never block clicks).
 */

import * as React from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useScroll,
  useReducedMotion,
  useTransform,
  useInView,
  animate,
  AnimatePresence,
  type MotionValue,
} from "framer-motion";

const RED = "#FF1A43";
const PURPLE = "#7B16D9";

/* ----------------------------------------------------------------------------
 * ScrollProgress — neon gradient bar pinned to the very top of the viewport.
 * -------------------------------------------------------------------------- */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed left-0 top-0 z-[80] h-[3px] w-full origin-left bg-gradient-to-r from-[#FF1A43] via-[#D31A9B] to-[#7B16D9] shadow-[0_0_12px_rgba(255,26,67,0.6)]"
    />
  );
}

/* ----------------------------------------------------------------------------
 * SpotlightCursor — a soft light follows the pointer (desktop only) and glows
 * over everything via screen blend. Gives the dim-club "moving light" feel.
 * -------------------------------------------------------------------------- */
export function SpotlightCursor() {
  const reduce = useReducedMotion();
  const x = useMotionValue(-1000);
  const y = useMotionValue(-1000);
  const sx = useSpring(x, { stiffness: 220, damping: 30, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 30, mass: 0.4 });
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    if (reduce) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (!fine) return;
    setEnabled(true);
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [reduce, x, y]);

  if (!enabled) return null;

  return (
    <motion.div
      aria-hidden
      style={{ x: sx, y: sy }}
      className="pointer-events-none fixed left-0 top-0 z-[60] h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full mix-blend-screen"
    >
      <div
        className="h-full w-full rounded-full opacity-60"
        style={{
          background: `radial-gradient(circle at center, ${RED}26 0%, ${PURPLE}1f 35%, transparent 70%)`,
        }}
      />
    </motion.div>
  );
}

/* ----------------------------------------------------------------------------
 * GrainOverlay — animated film grain for a tactile, premium print feel.
 * -------------------------------------------------------------------------- */
export function GrainOverlay({ opacity = 0.05 }: { opacity?: number }) {
  const reduce = useReducedMotion();
  const grain =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.55'/></svg>`,
    );
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[55] mix-blend-overlay"
      style={{ backgroundImage: `url("${grain}")`, backgroundSize: "160px 160px", opacity }}
      animate={reduce ? undefined : { backgroundPosition: ["0px 0px", "160px 80px", "0px 0px"] }}
      transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
    />
  );
}

/* ----------------------------------------------------------------------------
 * EmberField — slow embers drifting upward. Place inside a `relative` parent.
 * -------------------------------------------------------------------------- */
export function EmberField({ count = 26 }: { count?: number }) {
  const reduce = useReducedMotion();
  const embers = React.useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 2 + Math.random() * 4,
        delay: Math.random() * 8,
        duration: 9 + Math.random() * 10,
        drift: (Math.random() - 0.5) * 80,
        color: Math.random() > 0.5 ? RED : PURPLE,
      })),
    [count],
  );

  if (reduce) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {embers.map((e) => (
        <motion.span
          key={e.id}
          className="absolute bottom-[-20px] rounded-full"
          style={{
            left: `${e.left}%`,
            width: e.size,
            height: e.size,
            background: e.color,
            boxShadow: `0 0 ${e.size * 3}px ${e.color}`,
          }}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: -700, x: e.drift, opacity: [0, 0.8, 0] }}
          transition={{ duration: e.duration, delay: e.delay, repeat: Infinity, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * ScrollCue — an animated "scroll" indicator for the bottom of the hero.
 * -------------------------------------------------------------------------- */
export function ScrollCue({
  label = "Scroll",
  className,
  onClick,
}: {
  label?: string;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.4, duration: 1 }}
      whileHover={{ scale: 1.08 }}
      className={`absolute ${className ?? "bottom-24"} left-1/2 z-30 hidden -translate-x-1/2 flex-col items-center gap-2 sm:flex cursor-pointer group/cue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1A43] rounded-2xl p-2`}
    >
      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/50 group-hover/cue:text-white/90 transition-colors">
        {label}
      </span>
      <div className="relative flex h-9 w-[22px] justify-center rounded-full border border-white/25 group-hover/cue:border-[#FF1A43]/70 group-hover/cue:shadow-[0_0_15px_rgba(255,26,67,0.4)] p-1 transition-all duration-300">
        <motion.span
          className="h-2 w-1 rounded-full bg-gradient-to-b from-[#FF1A43] to-[#7B16D9]"
          animate={{ y: [0, 10, 0], opacity: [1, 0.2, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </motion.button>
  );
}

/* ----------------------------------------------------------------------------
 * Marquee — an infinite scrolling tagline band (club energy).
 * -------------------------------------------------------------------------- */
export function Marquee({
  items,
  reverse = false,
  speed = 26,
}: {
  items: string[];
  reverse?: boolean;
  speed?: number;
}) {
  const reduce = useReducedMotion();
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-white/[0.06] bg-[#0a0612] py-5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#0a0612] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#0a0612] to-transparent" />
      <motion.div
        className="flex w-max items-center gap-10 whitespace-nowrap"
        animate={reduce ? undefined : { x: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={{ duration: speed, repeat: Infinity, ease: "linear" }}
      >
        {row.map((label, i) => (
          <span key={i} className="flex items-center gap-10">
            <span className="bg-gradient-to-r from-[#FF1A43] via-[#D31A9B] to-[#7B16D9] bg-clip-text text-xl font-black uppercase tracking-[0.2em] text-transparent sm:text-2xl">
              {label}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF1A43] shadow-[0_0_10px_rgba(255,26,67,0.7)]" />
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * MagneticButton — wraps any element and nudges it toward the cursor.
 * -------------------------------------------------------------------------- */
export function MagneticButton({
  children,
  strength = 0.35,
  className,
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 15 });
  const sy = useSpring(y, { stiffness: 200, damping: 15 });

  const onMove = (e: React.MouseEvent) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ x: sx, y: sy }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ----------------------------------------------------------------------------
 * TiltCard — 3D tilt + moving spotlight sheen on hover.
 * -------------------------------------------------------------------------- */
export function TiltCard({
  children,
  className,
  max = 9,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const mx = useMotionValue(50);
  const my = useMotionValue(50);
  const srx = useSpring(rx, { stiffness: 200, damping: 18 });
  const sry = useSpring(ry, { stiffness: 200, damping: 18 });

  const onMove = (e: React.MouseEvent) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * 2 * max);
    rx.set((0.5 - py) * 2 * max);
    mx.set(px * 100);
    my.set(py * 100);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
  };

  const sheen = useTransform(
    [mx, my] as [MotionValue<number>, MotionValue<number>],
    ([a, b]) =>
      `radial-gradient(circle at ${a}% ${b}%, rgba(255,255,255,0.14), transparent 45%)`,
  );

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 900 }}
      whileHover={reduce ? undefined : { scale: 1.015 }}
      className={`relative [transform-style:preserve-3d] ${className ?? ""}`}
    >
      {children}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[5] rounded-[inherit] opacity-0 transition-opacity duration-300 [.group:hover>&]:opacity-100"
        style={{ backgroundImage: sheen }}
      />
    </motion.div>
  );
}

/* ----------------------------------------------------------------------------
 * RevealText — word-by-word mask reveal for headings.
 * -------------------------------------------------------------------------- */
export function RevealText({
  text,
  className,
  delay = 0,
  once = true,
  trigger = "view",
}: {
  text: string;
  className?: string;
  delay?: number;
  once?: boolean;
  /** "view" reveals on scroll into view; "mount" reveals immediately on mount
   *  (use inside AnimatePresence-keyed content like hero slides, where
   *  whileInView can mis-fire on remount and leave the text hidden). */
  trigger?: "view" | "mount";
}) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  if (reduce) return <span className={className}>{text}</span>;
  return (
    <span className={className} style={{ display: "inline-block" }}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom" style={{ paddingBottom: "0.08em" }}>
          <motion.span
            className="inline-block"
            initial={{ y: "110%" }}
            {...(trigger === "mount"
              ? { animate: { y: "0%" } }
              : { whileInView: { y: "0%" }, viewport: { once } })}
            transition={{ delay: delay + i * 0.07, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/* ----------------------------------------------------------------------------
 * CountUp — animates the numeric part of a stat string ("2K+", "4.9", "120")
 * from 0 when it scrolls into view. Non-numeric strings render as-is.
 * -------------------------------------------------------------------------- */
export function CountUp({ value, className }: { value: string; className?: string }) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  const match = value.match(/[\d.,]*\d/);
  const num = match ? parseFloat(match[0].replace(/,/g, "")) : null;
  const prefix = match ? value.slice(0, match.index) : "";
  const suffix = match ? value.slice((match.index ?? 0) + match[0].length) : "";
  const isInt = num !== null && Number.isInteger(num);

  const [display, setDisplay] = React.useState(num === null || reduce ? value : `${prefix}0${suffix}`);

  React.useEffect(() => {
    if (num === null || reduce) {
      setDisplay(value);
      return;
    }
    if (!inView) return;
    const controls = animate(0, num, {
      duration: 1.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        const rendered = isInt ? Math.round(v).toLocaleString() : v.toFixed(1);
        setDisplay(`${prefix}${rendered}${suffix}`);
      },
    });
    return () => controls.stop();
     
  }, [inView, num, reduce, value]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}

/* ----------------------------------------------------------------------------
 * Reveal — generic on-scroll reveal wrapper (fade + rise).
 * -------------------------------------------------------------------------- */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? undefined : { opacity: 0, y }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export { AnimatePresence };
