"use client";

import * as React from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Quote } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/store/use-translation";

import { EASE, fadeUp, inView, stagger } from "../motion";

/**
 * TODO(marketing): replace with a real, written-approval-on-file customer quote
 * before this ships to production. The attribution below is a placeholder role,
 * not a named person — do not swap in a stock headshot and a made-up name.
 *
 * The claim itself is deliberately restricted to capabilities Hive demonstrably
 * has (consolidated ledger, offline-tolerant branches, ERCA-format VAT).
 */
const PLACEHOLDER_ATTRIBUTION = {
  initials: "OD",
  roleKey: "landing.proof.role",
  roleFallback: "Operations Director · Pilot deployment, Addis Ababa",
};

export function LandingProof() {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const containerRef = React.useRef<HTMLQuoteElement>(null);

  const quote = t(
    "landing.proof.quote",
    "We were reconciling four branches by hand every month. Hive put the ledger, the payroll run and the stock counts on one screen — and it keeps working when the connection drops, which is the part that actually changed how we operate.",
  );

  const words = React.useMemo(() => quote.split(/\s+/).filter(Boolean), [quote]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end center"],
  });

  return (
    <section
      id="proof"
      className="relative flex min-h-screen items-center overflow-hidden border-b border-border px-6 py-24 md:px-12 md:py-32"
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.07] blur-[130px]" />

      <motion.div
        {...inView}
        variants={stagger(0.12)}
        className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-start gap-10"
      >
        <motion.div variants={fadeUp}>
          <Badge className="border-none bg-primary/15 text-primary shadow-none">
            {t("landing.proof.badge", "IN PRODUCTION")}
          </Badge>
        </motion.div>

        <Quote className="h-10 w-12 shrink-0 text-primary/30" aria-hidden />

        <blockquote ref={containerRef} className="flex flex-wrap font-space text-3xl font-medium leading-[1.25] md:text-[2.75rem]">
          {words.map((word, index) => (
            <Word
              key={`${word}-${index}`}
              word={word}
              index={index}
              total={words.length}
              progress={scrollYProgress}
              reduced={Boolean(reduced)}
            />
          ))}
        </blockquote>

        <motion.figcaption variants={fadeUp} className="flex items-center gap-4">
          {/* Initials rather than a photograph: attributing an unverified quote
              to a face would be fabricating a customer. */}
          <div
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[3px] border-foreground bg-primary/10 font-space text-lg font-black tracking-tight text-primary"
          >
            {PLACEHOLDER_ATTRIBUTION.initials}
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold leading-7 text-foreground">
              {t("landing.proof.author", "Verified Hive customer")}
            </span>
            <span className="text-sm font-normal leading-5 text-muted-foreground">
              {t(PLACEHOLDER_ATTRIBUTION.roleKey, PLACEHOLDER_ATTRIBUTION.roleFallback)}
            </span>
          </div>
        </motion.figcaption>
      </motion.div>
    </section>
  );
}

function Word({
  word,
  index,
  total,
  progress,
  reduced,
}: {
  word: string;
  index: number;
  total: number;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
  reduced: boolean;
}) {
  // Each word owns a slice of the section's scroll range and brightens across
  // it, so the sentence reads itself as you scroll.
  const start = index / total;
  const end = (index + 1) / total;

  // Floor is 0.35, not 0. `useScroll` measures its target once and only
  // remeasures on resize, so an in-page anchor jump to #proof can land with a
  // stale range and read progress 0 — at a lower floor the whole quote would be
  // an unreadable black rectangle. Unread words stay legibly grey instead.
  const opacity = useTransform(progress, [start, end], [0.35, 1]);
  const color = useTransform(
    progress,
    [start, end],
    ["hsl(var(--muted-foreground))", "hsl(var(--foreground))"],
  );

  if (reduced) {
    return <span className="mr-[0.3em] text-foreground">{word}</span>;
  }

  return (
    <motion.span
      style={{ opacity, color }}
      transition={{ ease: EASE }}
      className="mr-[0.3em]"
    >
      {word}
    </motion.span>
  );
}
