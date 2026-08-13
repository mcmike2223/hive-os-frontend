"use client";

import * as React from "react";
import Link from "next/link";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  Activity,
  ArrowRight,
  LineChart,
  ShieldCheck,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/store/use-translation";

import { DURATION, EASE, springSoft, stagger, wordUp } from "../motion";
import { CountUp } from "./count-up";

type Props = {
  isTenant: boolean;
  appTitle: string;
  /** The hexagon particle canvas, owned by the page so its lifecycle is unchanged. */
  canvasSlot?: React.ReactNode;
};

export function LandingHero({ isTenant, appTitle, canvasSlot }: Props) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const sectionRef = React.useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  // One useScroll for the whole section; every parallax below derives from it.
  const textY = useTransform(scrollYProgress, [0, 1], [0, -140]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const ambienceY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const ambienceOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const headline = isTenant
    ? {
        lead: t("landing.hero.unified_mgmt", "Unified Management"),
        accent: appTitle,
        tail: t("landing.hero.dashboard", "Dashboard"),
      }
    : {
        lead: t("landing.hero.unify_ops", "Unify Your"),
        accent: t("landing.hero.enterprise", "Enterprise"),
        tail: t("landing.hero.operations", "Operations"),
      };

  return (
    <section
      ref={sectionRef}
      className="relative z-10 flex min-h-screen flex-col items-center justify-start overflow-hidden px-4 pb-0 pt-28 text-center md:pt-32"
    >
      {/* ── Ambience: drifting grid, three-blob aurora and the particle canvas,
             all fading out as the hero scrolls away so they never compete with
             the sections below. ────────────────────────────────────────── */}
      <motion.div
        style={reduced ? undefined : { y: ambienceY, opacity: ambienceOpacity }}
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div
          className={cn(
            "absolute inset-0 opacity-[0.35]",
            "[background-image:linear-gradient(to_right,hsl(var(--border)/0.35)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.35)_1px,transparent_1px)]",
            "[background-size:50px_50px]",
            "[mask-image:radial-gradient(ellipse_at_50%_35%,black_10%,transparent_70%)]",
            !reduced && "animate-[grid-drift_9s_linear_infinite]",
          )}
        />

        <div className="absolute inset-0 overflow-hidden">
          <div
            className={cn(
              "absolute left-1/2 top-1/3 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[130px]",
              !reduced && "animate-[aurora-a_19s_ease-in-out_infinite]",
            )}
          />
          <div
            className={cn(
              "absolute left-[28%] top-[46%] h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/12 blur-[120px]",
              !reduced && "animate-[aurora-b_23s_ease-in-out_infinite]",
            )}
          />
          <div
            className={cn(
              "absolute left-[72%] top-[28%] h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400/10 blur-[110px]",
              !reduced && "animate-[aurora-c_29s_ease-in-out_infinite]",
            )}
          />
        </div>

        {canvasSlot}
      </motion.div>

      <motion.div
        style={reduced ? undefined : { y: textY, opacity: textOpacity }}
        variants={stagger(0.09)}
        initial="hidden"
        animate="show"
        className="relative z-10 flex w-full max-w-5xl flex-col items-center"
      >
        {/* Status pill */}
        <motion.div variants={wordUp}>
          <div className="liquid-glass mb-7 inline-flex items-center gap-2 rounded-full px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {isTenant
                ? `${t("landing.hero.connected_node", "Connected Node")}: ${appTitle}`
                : t("landing.hero.dev_by", "Developed by Techive Technology Solutions")}
            </span>
          </div>
        </motion.div>

        {/* Headline. Two grotesk words plus one Instrument Serif italic — the
            serif carries the whole editorial register, so it is used exactly
            once on the page. */}
        <h1 className="max-w-4xl font-space text-5xl font-black leading-[1.05] tracking-tighter md:text-7xl md:leading-[1.02]">
          <MaskedLine reduced={reduced}>{headline.lead}</MaskedLine>
          <MaskedLine reduced={reduced} className="mt-1 md:mt-2">
            <span className="bg-gradient-to-r from-primary via-primary/70 to-primary bg-[length:200%_auto] bg-clip-text text-transparent [animation:shimmer-text_6s_linear_infinite]">
              {headline.accent}
            </span>{" "}
            <span className="font-serif font-normal italic tracking-[-1px] text-foreground">
              {headline.tail}
            </span>
          </MaskedLine>
        </h1>

        <motion.p
          variants={wordUp}
          className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl"
        >
          {isTenant
            ? t(
                "landing.hero.access_node",
                "Access the central node for :appTitle. Oversee HR, track freight logistics, and manage financial ledgers in real-time.",
                { appTitle },
              )
            : t(
                "landing.hero.hive_desc",
                "Hive is the comprehensive ERP solution built for scalable businesses in Ethiopia. Connect your Finance, HR, and Supply Chain with local tax and banking integrations.",
              )}
        </motion.p>

        {/* CTAs */}
        <motion.div
          variants={wordUp}
          className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
        >
          <Link href={isTenant ? "/sign-in" : "/auth/signup"} className="w-full sm:w-auto">
            <motion.span
              whileHover={reduced ? undefined : { scale: 1.03 }}
              whileTap={reduced ? undefined : { scale: 0.98 }}
              transition={springSoft}
              className="block"
            >
              <Button className="group h-14 w-full rounded-full border-none bg-primary px-8 font-space text-base font-bold uppercase tracking-wider text-primary-foreground shadow-xl shadow-primary/25 sm:w-auto">
                {isTenant
                  ? t("landing.nav.signin", "Sign In")
                  : t("landing.cta.pill_plan", "Start Free — Pick a Plan")}
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </motion.span>
          </Link>
          <Link href="/request-demo" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="h-14 w-full rounded-full border-border/70 px-8 font-space text-base font-bold uppercase tracking-wider backdrop-blur-md transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary sm:w-auto"
            >
              {t("landing.hero.cta_demo", "Book a Demo")}
            </Button>
          </Link>
        </motion.div>

        {/* Trust line — every claim here is already stated elsewhere on the page. */}
        <motion.ul
          variants={wordUp}
          className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/80"
        >
          {[
            t("landing.hero.trust_card", "No credit card required"),
            t("landing.hero.trust_pay", "ArifPay secured"),
            t("landing.hero.trust_host", "INSA-compliant hosting"),
          ].map((claim, index) => (
            <li key={claim} className="flex items-center gap-5">
              {index > 0 && <span className="h-1 w-1 rounded-full bg-border" />}
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-primary" />
                {claim}
              </span>
            </li>
          ))}
        </motion.ul>
      </motion.div>

      <HeroConsole progress={scrollYProgress} reduced={Boolean(reduced)} />

      {/* Dissolve the console into the next section */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-40 bg-gradient-to-t from-background to-transparent" />

      {/* Scroll cue. Sits above the dissolve and fades with the hero copy so it
          does not linger over the section below. */}
      {!reduced && (
        <motion.div
          style={{ opacity: textOpacity }}
          className="pointer-events-none absolute bottom-6 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-2"
        >
          <span className="flex h-8 w-5 items-start justify-center rounded-full border border-border/70 p-1.5">
            <span className="h-1.5 w-1 rounded-full bg-primary [animation:scroll-cue_2s_ease-in-out_infinite]" />
          </span>
        </motion.div>
      )}
    </section>
  );
}

/**
 * One headline line, revealed from behind its own baseline.
 *
 * `overflow-hidden` on the wrapper is what sells it: the inner span translates
 * up from fully below the line box, so the text appears to rise out of the
 * baseline rather than fade in on top of the page. The wrapper needs the extra
 * vertical padding or the mask clips descenders and the serif's italic swash.
 */
function MaskedLine({
  children,
  className,
  reduced,
}: {
  children: React.ReactNode;
  className?: string;
  reduced: boolean | null;
}) {
  return (
    <span className={cn("block overflow-hidden pb-[0.12em] pt-[0.04em]", className)}>
      <motion.span
        variants={
          reduced
            ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2 } } }
            : {
                hidden: { y: "110%", opacity: 0 },
                show: {
                  y: "0%",
                  opacity: 1,
                  transition: { duration: 0.95, ease: EASE },
                },
              }
        }
        className="block"
      >
        {children}
      </motion.span>
    </span>
  );
}

/* ── The product console ────────────────────────────────────────────────── */

function HeroConsole({
  progress,
  reduced,
}: {
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
  reduced: boolean;
}) {
  const { t } = useTranslation();
  const ref = React.useRef<HTMLDivElement>(null);

  // The deck "lands": it enters tilted and flattens as you scroll. A spring on
  // the raw progress keeps the rotation from stepping on low-frequency wheels.
  const { scrollYProgress: enter } = useScroll({
    target: ref,
    offset: ["start end", "start 0.35"],
  });
  const smooth = useSpring(enter, { stiffness: 120, damping: 26, mass: 0.6 });
  const landRotateX = useTransform(smooth, [0, 1], [14, 0]);
  const scale = useTransform(smooth, [0, 1], [0.93, 1]);

  // Inner panels drift at different rates on the way out — the depth cue.
  const railY = useTransform(progress, [0, 1], [0, -20]);
  const listY = useTransform(progress, [0, 1], [0, -42]);
  const mainY = useTransform(progress, [0, 1], [0, -64]);

  // Pointer parallax. Springs are deliberately soft: the deck should feel like
  // a heavy object being nudged, not a card snapping to the cursor. Both values
  // return to 0 on leave so the console rests flat.
  const pointerX = useSpring(0, { stiffness: 90, damping: 20, mass: 0.7 });
  const pointerY = useSpring(0, { stiffness: 90, damping: 20, mass: 0.7 });
  const tiltY = useTransform(pointerX, [-0.5, 0.5], [-7, 7]);
  const tiltX = useTransform(pointerY, [-0.5, 0.5], [5, -5]);
  // The landing rotation and the pointer tilt share one axis, so they are
  // summed rather than fighting over `rotateX`.
  const rotateX = useTransform([landRotateX, tiltX] as const, ([a, b]) => (a as number) + (b as number));

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (reduced) return;
      const rect = event.currentTarget.getBoundingClientRect();
      pointerX.set((event.clientX - rect.left) / rect.width - 0.5);
      pointerY.set((event.clientY - rect.top) / rect.height - 0.5);
    },
    [pointerX, pointerY, reduced],
  );

  const handlePointerLeave = React.useCallback(() => {
    pointerX.set(0);
    pointerY.set(0);
  }, [pointerX, pointerY]);

  const motionStyle = reduced ? undefined : { rotateX, rotateY: tiltY, scale };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.slow, ease: EASE, delay: 0.45 }}
      className="relative z-20 mt-16 w-full max-w-6xl [perspective:2000px] md:mt-20"
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px]" />

      <motion.div
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{ ...motionStyle, transformOrigin: "center bottom" }}
        className="group relative grid h-[440px] grid-cols-[72px_1fr] overflow-hidden rounded-2xl border border-primary/25 bg-background/60 shadow-[0_30px_80px_-20px_hsl(var(--background))] backdrop-blur-xl transition-colors duration-500 hover:border-primary/50 md:h-[620px] md:grid-cols-[80px_250px_1fr]"
      >
        {/* Scan sweep — slowed and dimmed from the original 3s/0.5 opacity,
            which read as a rendering glitch rather than telemetry. */}
        {!reduced && (
          <div className="pointer-events-none absolute inset-x-0 z-50 h-px bg-primary/40 shadow-[0_0_12px_hsl(var(--primary))] [animation:scan-beam_6s_cubic-bezier(0.4,0,0.2,1)_infinite]" />
        )}

        {/* Icon rail */}
        <motion.div
          style={reduced ? undefined : { y: railY }}
          className="z-10 flex flex-col items-center gap-6 border-r border-border bg-muted/20 pt-8"
        >
          {[LineChart, Truck, Users, Wallet].map((Icon, index) => (
            <div
              key={index}
              className={cn(
                "flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg transition-all hover:scale-110",
                index === 0
                  ? "border border-primary/30 bg-primary/10 text-primary shadow-[0_0_15px_hsl(var(--primary)/0.2)]"
                  : "text-muted-foreground hover:bg-primary/5 hover:text-primary",
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
          ))}
          <div className="mb-5 mt-auto text-muted-foreground">
            <Activity className="h-5 w-5 animate-pulse" />
          </div>
        </motion.div>

        {/* Module list */}
        <motion.div
          style={reduced ? undefined : { y: listY }}
          className="relative z-10 hidden border-r border-border bg-muted/5 p-8 text-left font-mono text-sm md:block"
        >
          <div className="mb-6 text-xs uppercase tracking-widest text-muted-foreground">
            &gt; {t("landing.preview.system_modules", "System Modules")}
          </div>
          <div className="space-y-6">
            {[
              { label: t("landing.preview.gl", "General Ledger"), status: t("landing.preview.synced", "SYNCED"), tone: "ok" },
              { label: t("landing.preview.freight", "Freight & Fleet"), status: t("landing.preview.active", "ACTIVE"), tone: "ok" },
              { label: t("landing.preview.payroll_proc", "Payroll Proc."), status: t("landing.preview.pending", "PENDING"), tone: "warn" },
            ].map((row) => (
              // items-start + a non-shrinking status: Amharic labels ("የደመወዝ
              // ክፍያ ሂደት") are roughly twice the width of "Payroll Proc.", and
              // with items-center both columns wrapped and interleaved.
              <div key={row.label} className="group/item flex cursor-pointer items-start justify-between gap-3">
                <span className="min-w-0 flex-1 text-muted-foreground transition-colors group-hover/item:text-primary">
                  {row.label}
                </span>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 whitespace-nowrap pt-0.5 text-[11px]",
                    row.tone === "ok" ? "text-emerald-500" : "text-amber-500",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 animate-pulse rounded-full",
                      row.tone === "ok" ? "bg-emerald-500" : "bg-amber-500",
                    )}
                  />
                  {row.status}
                </span>
              </div>
            ))}
          </div>

          <div className="absolute inset-x-8 bottom-8 overflow-hidden rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs text-primary shadow-inner">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/10 to-transparent [animation:shimmer-text_3s_infinite]" />
            {t("landing.preview.server_status", "SERVER STATUS")}
            <br />
            <span className="text-lg font-bold">{t("landing.preview.optimal", "OPTIMAL")}</span>
            <div className="mt-3 h-1 w-full overflow-hidden rounded bg-primary/20">
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 0.98 }}
                viewport={{ once: true }}
                transition={{ duration: 1.4, ease: EASE, delay: 0.6 }}
                className="h-full origin-left bg-primary shadow-[0_0_10px_hsl(var(--primary))]"
              />
            </div>
          </div>
        </motion.div>

        {/* Executive summary */}
        <motion.div
          style={reduced ? undefined : { y: mainY }}
          className="relative z-10 overflow-hidden bg-card/10 p-6 text-left md:p-8"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

          <div className="flex items-end justify-between border-b border-border pb-6">
            <div>
              <h2 className="font-space text-2xl font-bold md:text-3xl">
                {t("landing.executive_summary.title", "Executive Summary")}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-primary">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                {t("landing.executive_summary.real_time", "REAL-TIME DATA")}
                {/* The figures in this console are a product shot, not a
                    customer's books. Tenant financials are private and the
                    public stats endpoint deliberately does not expose them, so
                    the panel says plainly what it is showing. */}
                <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("landing.preview.sample_note", "Illustrative figures")}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-space text-3xl font-black tracking-tight drop-shadow-lg md:text-4xl">
                <CountUp to={24.5} decimals={1} suffix="M ETB" />
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">
                {t("landing.executive_summary.gross_revenue", "GROSS REVENUE (YTD)")}
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <ConsoleStat
              label={t("landing.executive_summary.active_loads", "ACTIVE LOADS")}
              value={<CountUp to={142} />}
              foot={
                <span className="flex items-center gap-1 text-emerald-500">
                  <ArrowRight className="h-3 w-3 -rotate-45" />
                  {t("landing.executive_summary.in_transit", "12 In Transit")}
                </span>
              }
            />
            <ConsoleStat
              label={t("landing.executive_summary.employee_headcount", "EMPLOYEE HEADCOUNT")}
              value={<CountUp to={420} />}
              foot={t("landing.executive_summary.across_branches", "Across 4 Branches")}
            />
            <ConsoleStat
              label={t("landing.executive_summary.system_latency", "SYSTEM LATENCY")}
              value={<CountUp to={12} suffix="ms" />}
              foot={
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 0.05 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: EASE, delay: 0.8 }}
                    className="h-full origin-left bg-primary shadow-[0_0_10px_hsl(var(--primary))]"
                  />
                </div>
              }
            />
          </div>

          <RevenueChart />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Monthly revenue bars. Illustrative sample data for the product shot — the
 * shape is what sells the module, so it is deliberately plausible rather than
 * flat, and it is never labelled as a real customer's figures.
 */
const REVENUE_SERIES = [
  1.4, 1.7, 1.5, 2.1, 2.4, 2.2, 2.8, 3.1, 2.9, 3.4, 3.8, 4.2,
];
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function RevenueChart() {
  const { t } = useTranslation();
  const peak = Math.max(...REVENUE_SERIES);

  return (
    <div className="mt-6 hidden rounded-lg border border-border bg-card/40 p-5 md:block">
      <div className="mb-5 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {t("landing.preview.revenue_trend", "REVENUE TREND · 12 MONTHS")}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-500">
          <ArrowRight className="h-3 w-3 -rotate-45" />
          {t("landing.preview.revenue_delta", "+18.4% QoQ")}
        </span>
      </div>
      {/* items-stretch, not items-end: each column needs a definite height for
          the bar's percentage height to resolve against. */}
      <div className="flex h-32 items-stretch gap-1.5">
        {REVENUE_SERIES.map((value, index) => (
          <div key={index} className="group/bar flex flex-1 flex-col justify-end gap-2">
            <motion.div
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.5 + index * 0.045 }}
              // 82% leaves room for the month label below the tallest bar.
              style={{ height: `${(value / peak) * 82}%`, originY: 1 }}
              className="w-full rounded-sm bg-gradient-to-t from-primary/30 to-primary transition-opacity group-hover/bar:opacity-80"
            />
            <span className="text-center font-mono text-[9px] text-muted-foreground">
              {MONTHS[index]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConsoleStat({
  label,
  value,
  foot,
}: {
  label: string;
  value: React.ReactNode;
  foot: React.ReactNode;
}) {
  return (
    <div className="group relative cursor-pointer overflow-hidden rounded-lg border border-border bg-card/50 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)]">
      <div className="mb-2 font-mono text-[11px] text-muted-foreground transition-colors group-hover:text-primary">
        {label}
      </div>
      <div className="font-space text-3xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{foot}</div>
    </div>
  );
}
