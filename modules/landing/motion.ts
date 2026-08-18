import type { Transition, Variants } from "framer-motion";

/**
 * One motion vocabulary for the whole marketing surface (landing + auth).
 *
 * The page previously improvised per element — `animate-in slide-in-from-bottom-4
 * duration-1000` here, `delay-300` there — which is why nothing felt like it
 * belonged to the same product. Every entrance now composes from these.
 */

/** Expo-out. Fast departure, long settle — reads as "confident", not "bouncy". */
export const EASE = [0.16, 1, 0.3, 1] as const;

export const DURATION = {
  fast: 0.35,
  base: 0.55,
  slow: 0.8,
} as const;

export const springSoft: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
  mass: 0.8,
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DURATION.base, ease: EASE } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 16 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: DURATION.slow, ease: EASE },
  },
};

/** Per-word headline reveal. Tighter offset than fadeUp so long lines stay legible. */
export const wordUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE },
  },
};

/**
 * Parent orchestrator. Keep child counts at or below ~6 per stagger — beyond
 * that the sequence stops reading as choreography and starts reading as a
 * loading skeleton.
 */
export const stagger = (children = 0.08, delay = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: children, delayChildren: delay },
  },
});

/** Shared `whileInView` config: fire once, slightly before the element is centred. */
export const inView = {
  initial: "hidden",
  whileInView: "show",
  viewport: { once: true, margin: "-15% 0px -10% 0px" },
} as const;

/**
 * Collapses any variant set to a plain fade when the user has asked for reduced
 * motion. Call with the result of framer-motion's `useReducedMotion()`.
 */
export const respectMotion = (reduced: boolean | null, variants: Variants): Variants =>
  reduced
    ? {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { duration: 0.2 } },
      }
    : variants;
