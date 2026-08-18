"use client";

import * as React from "react";
import { useInView, useReducedMotion } from "framer-motion";

type Props = {
  to: number;
  /** Decimal places to render. */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
  className?: string;
};

/**
 * Counts a metric up the first time it scrolls into view.
 *
 * Deliberately rAF-driven rather than a framer-motion `animate()` on a
 * MotionValue: the hero already runs a particle canvas plus scroll transforms,
 * and a single shared frame loop per number is cheaper than spinning up a
 * MotionValue subscription for each. Renders the final value immediately under
 * `prefers-reduced-motion`.
 */
export function CountUp({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  durationMs = 1200,
  className,
}: Props) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduced = useReducedMotion();
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setValue(to);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      // easeOutCubic — matches the settle of the shared EASE curve closely
      // enough that numbers and their containers feel like one movement.
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(to * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduced, to, durationMs]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
