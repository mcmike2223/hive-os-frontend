"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/store/use-translation";

import { DURATION, EASE, springSoft } from "../motion";
import {
  buildLandingNav,
  LANDING_SECTION_IDS,
  type LandingNavItem,
  type LandingNavLink,
} from "../nav";

type Props = {
  /** Rendered inside the brand link — the page's SafeLogo with its text fallback. */
  brand: React.ReactNode;
  isTenant: boolean;
  onNavigateSection: (sectionId: string) => void;
};

/** Delay before a hovered mega menu closes, so a diagonal mouse path survives. */
const CLOSE_INTENT_MS = 140;

export function LandingNavbar({ brand, isTenant, onNavigateSection }: Props) {
  // `dictionary` is pulled in purely as a memo dependency below — see buildLandingNav.
  const { t, locale, dictionary } = useTranslation();
  const reduced = useReducedMotion();

  const [scrolled, setScrolled] = React.useState(false);
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<string | null>(null);

  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = React.useRef<HTMLElement>(null);

  // Keyed on `locale`/`dictionary`, NOT on `t`. `t` is a stable Zustand store
  // method whose identity never changes, so `[t]` meant the nav was built once
  // against the empty initial dictionary and never rebuilt when the translations
  // arrived — every other string on the page switched to Amharic and the nav
  // stayed in English.
  const items = React.useMemo(() => buildLandingNav(t), [t, locale, dictionary]);
  const openItem = items.find((item) => item.key === openKey);

  // ── Condense the bar into a floating pill past the fold ──────────────────
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Scroll spy. IntersectionObserver rather than a scroll handler so it does
  //    not contend with the hero parallax on the same frame. ─────────────────
  React.useEffect(() => {
    const targets = LANDING_SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => Boolean(el),
    );
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // ── Dismissal: Escape, and any click outside the bar ─────────────────────
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenKey(null);
      setMobileOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setOpenKey(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  // Lock the page while the mobile drawer owns the screen.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  React.useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenKey(null), CLOSE_INTENT_MS);
  };

  const goToSection = (sectionId: string) => {
    setOpenKey(null);
    setMobileOpen(false);
    onNavigateSection(sectionId);
  };

  const isItemActive = (item: LandingNavItem) => {
    if (item.section && activeSection === item.section) return true;
    return Boolean(
      item.groups?.some((group) =>
        group.links.some((link) => link.section && link.section === activeSection),
      ),
    );
  };

  return (
    <>
      <motion.header
        ref={navRef}
        initial={false}
        animate={{
          paddingTop: scrolled ? 10 : 16,
          paddingBottom: scrolled ? 10 : 16,
        }}
        transition={reduced ? { duration: 0 } : { duration: DURATION.fast, ease: EASE }}
        className="fixed inset-x-0 top-0 z-50 px-3 sm:px-6"
      >
        {/* The mega panel is a sibling of the bar, not a child of a trigger, so
            it centres on the nav container and can never be pushed off-screen by
            a trigger that sits near the viewport edge. */}
        <motion.div
          initial={false}
          animate={{ maxWidth: scrolled ? 1180 : 1920 }}
          transition={reduced ? { duration: 0 } : { duration: DURATION.fast, ease: EASE }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          className="relative mx-auto"
        >
        <motion.nav
          className={cn(
            "flex items-center justify-between gap-3 rounded-full px-4 py-2 transition-[background-color,border-color,box-shadow] duration-500 md:px-6",
            scrolled
              ? "liquid-glass border border-border/60 bg-background/70 shadow-[0_10px_40px_-12px_hsl(var(--background))] backdrop-blur-xl"
              : "border border-transparent bg-transparent",
          )}
        >
          {/* Brand */}
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2 rounded-full font-space text-xl font-bold tracking-tight transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {brand}
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-0.5 lg:flex">
            {items.map((item) => {
              const active = isItemActive(item);
              const open = openKey === item.key;

              if (!item.groups) {
                return (
                  <NavPill
                    key={item.key}
                    active={active}
                    onClick={() => item.section && goToSection(item.section)}
                  >
                    {item.label}
                  </NavPill>
                );
              }

              return (
                <div
                  key={item.key}
                  onMouseEnter={() => {
                    cancelClose();
                    setOpenKey(item.key);
                  }}
                >
                  <NavPill
                    active={active || open}
                    expanded={open}
                    onClick={() => setOpenKey(open ? null : item.key)}
                  >
                    {item.label}
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-300",
                        open && "rotate-180",
                      )}
                    />
                  </NavPill>
                </div>
              );
            })}
          </div>

          {/* Right rail */}
          <div className="flex shrink-0 items-center gap-1.5">
            <LanguageSwitcher />
            <ThemeToggle />
            <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
            {isTenant && (
              <Link href="/sign-in" className="hidden sm:block">
                <Button
                  variant="ghost"
                  className="h-9 rounded-full px-4 font-space text-sm font-bold uppercase tracking-wider transition-all hover:bg-primary/10 hover:text-primary"
                >
                  {t("landing.nav.signin", "Sign In")}
                </Button>
              </Link>
            )}
            {!isTenant && (
              <Link href="/auth/signup" className="hidden sm:block">
                <motion.span
                  whileHover={reduced ? undefined : { scale: 1.04 }}
                  whileTap={reduced ? undefined : { scale: 0.97 }}
                  transition={springSoft}
                  className="relative block overflow-hidden rounded-full"
                >
                  <Button className="group relative h-9 overflow-hidden rounded-full border-none bg-primary px-5 font-space text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/25">
                    {/* Specular sweep on hover */}
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    <span className="relative">{t("landing.nav.deploy", "Get Started Free")}</span>
                  </Button>
                </motion.span>
              </Link>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label={t("landing.nav.open_menu", "Open menu")}
              aria-expanded={mobileOpen}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 lg:hidden"
            >
              <Menu className="h-[18px] w-[18px]" />
            </button>
          </div>
        </motion.nav>

        <AnimatePresence>
          {openItem?.groups && (
            <MegaMenu
              key={openItem.key}
              item={openItem}
              reduced={Boolean(reduced)}
              onSection={goToSection}
              onClose={() => setOpenKey(null)}
            />
          )}
        </AnimatePresence>
        </motion.div>
      </motion.header>

      <MobileNav
        open={mobileOpen}
        items={items}
        isTenant={isTenant}
        reduced={Boolean(reduced)}
        onClose={() => setMobileOpen(false)}
        onSection={goToSection}
      />
    </>
  );
}

/* ── Desktop pill ───────────────────────────────────────────────────────── */

function NavPill({
  children,
  active,
  expanded,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className={cn(
        "relative flex items-center gap-1 rounded-full px-3.5 py-2 font-space text-[13px] font-bold uppercase tracking-wide transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="landing-nav-pill"
          transition={springSoft}
          className="absolute inset-0 -z-10 rounded-full bg-primary/10"
        />
      )}
      {children}
    </button>
  );
}

/* ── Mega menu ──────────────────────────────────────────────────────────── */

function MegaMenu({
  item,
  reduced,
  onSection,
  onClose,
}: {
  item: LandingNavItem;
  reduced: boolean;
  onSection: (id: string) => void;
  onClose: () => void;
}) {
  // Width tracks content: one column per link group, plus one for the promoted
  // card. A fixed width made the two-group Resources menu read as mostly gutter.
  const groupCount = item.groups?.length ?? 0;
  const columns = groupCount + (item.feature ? 1 : 0);
  const width = `${Math.min(columns * 15.5 + 2, 62)}rem`;

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
      transition={{ duration: DURATION.fast, ease: EASE }}
      // Centred on the nav container (not the trigger) and capped at the
      // viewport, so a menu hanging off a right-hand trigger cannot overflow.
      style={{ width: `min(94vw, ${width})` }}
      className={cn(
        "absolute left-1/2 top-[calc(100%+12px)] z-10 -translate-x-1/2 rounded-3xl border border-border/60",
        // Invisible bridge across the gap between bar and panel, so travelling
        // from the trigger to a link never leaves the hover subtree.
        "before:absolute before:inset-x-0 before:-top-3 before:h-3 before:content-['']",
        // Opaque by default; only thinned where the backdrop filter can
        // actually blur what is behind it, otherwise the page shows through.
        "bg-popover p-5 shadow-2xl supports-[backdrop-filter]:bg-popover/95 supports-[backdrop-filter]:backdrop-blur-2xl",
      )}
    >
      <div
        className="grid gap-5 lg:[grid-template-columns:var(--mega-cols)]"
        style={
          {
            "--mega-cols": item.feature
              ? `repeat(${groupCount}, minmax(0, 1fr)) 15rem`
              : `repeat(${groupCount}, minmax(0, 1fr))`,
          } as React.CSSProperties
        }
      >
        {item.groups?.map((group) => (
          <div key={group.heading}>
            <p className="mb-2 px-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {group.heading}
            </p>
            <ul className="space-y-0.5">
              {group.links.map((link) => (
                <li key={link.label}>
                  <MegaLink link={link} onSection={onSection} onClose={onClose} />
                </li>
              ))}
            </ul>
          </div>
        ))}

        {item.feature && (
          <Link
            href={item.feature.href}
            onClick={onClose}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/12 to-primary/[0.03] p-5 transition-colors hover:border-primary/50"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl transition-all duration-700 group-hover:bg-primary/30" />
            <div className="relative">
              <p className="font-space text-base font-bold leading-snug">{item.feature.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {item.feature.description}
              </p>
            </div>
            <span className="relative mt-5 inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-primary">
              {item.feature.cta}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        )}
      </div>
    </motion.div>
  );
}

function MegaLink({
  link,
  onSection,
  onClose,
}: {
  link: LandingNavLink;
  onSection: (id: string) => void;
  onClose: () => void;
}) {
  const Icon = link.icon;

  const body = (
    <>
      {Icon && (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
          <Icon className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
          {link.label}
          {link.badge && (
            <span className="rounded-md bg-primary px-1.5 py-px text-[10px] font-bold uppercase text-primary-foreground">
              {link.badge}
            </span>
          )}
        </span>
        {link.description && (
          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
            {link.description}
          </span>
        )}
      </span>
    </>
  );

  const className =
    "group flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-primary/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

  if (link.href) {
    return (
      <Link href={link.href} onClick={onClose} className={className}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => link.section && onSection(link.section)} className={className}>
      {body}
    </button>
  );
}

/* ── Mobile drawer ──────────────────────────────────────────────────────── */

function MobileNav({
  open,
  items,
  isTenant,
  reduced,
  onClose,
  onSection,
}: {
  open: boolean;
  items: LandingNavItem[];
  isTenant: boolean;
  reduced: boolean;
  onClose: () => void;
  onSection: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState<string | null>(null);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.fast }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm lg:hidden"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("landing.nav.menu", "Navigation")}
            initial={reduced ? { opacity: 0 } : { x: "100%" }}
            animate={reduced ? { opacity: 1 } : { x: 0 }}
            exit={reduced ? { opacity: 0 } : { x: "100%" }}
            transition={reduced ? { duration: 0.15 } : { duration: 0.42, ease: EASE }}
            className="fixed inset-y-0 right-0 z-[70] flex w-[min(92vw,26rem)] flex-col border-l border-border bg-background lg:hidden"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <span className="font-space text-sm font-bold uppercase tracking-widest text-muted-foreground">
                {t("landing.nav.menu", "Navigation")}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("landing.nav.close_menu", "Close menu")}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="hive-mobile-sidebar-scroll flex-1 px-3 py-4">
              {items.map((item) => {
                if (!item.groups) {
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => item.section && onSection(item.section)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-3.5 text-left font-space text-sm font-bold uppercase tracking-wide text-foreground transition-colors hover:bg-muted/50"
                    >
                      {item.label}
                    </button>
                  );
                }

                const isOpen = expanded === item.key;
                return (
                  <div key={item.key}>
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : item.key)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-3.5 text-left font-space text-sm font-bold uppercase tracking-wide text-foreground transition-colors hover:bg-muted/50"
                    >
                      {item.label}
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform duration-300",
                          isOpen && "rotate-180",
                        )}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: EASE }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-0.5 border-l border-border/70 pb-2 pl-3 ml-3">
                            {item.groups.flatMap((group) => group.links).map((link) => (
                              <MegaLink
                                key={link.label}
                                link={link}
                                onSection={onSection}
                                onClose={onClose}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 border-t border-border p-4">
              {!isTenant && (
                <Link href="/auth/signup" onClick={onClose} className="block">
                  <Button className="h-12 w-full rounded-xl border-none bg-primary font-space font-bold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/20">
                    {t("landing.hero.cta_free", "Get Started Free")}
                  </Button>
                </Link>
              )}
              {isTenant && (
                <Link href="/sign-in" onClick={onClose} className="block">
                  <Button
                    variant="outline"
                    className="h-12 w-full rounded-xl font-space font-bold uppercase tracking-wider"
                  >
                    {t("landing.nav.signin", "Sign In")}
                  </Button>
                </Link>
              )}
              <div className="flex items-center justify-center gap-3 pt-2">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
