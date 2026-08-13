import type { Step } from "react-joyride";

/**
 * Builds the sidebar portion of the System Tour from the *rendered* navigation
 * rather than a hardcoded list.
 *
 * The previous approach enumerated a fixed set of `#tour-nav-*` anchors, which
 * meant:
 *   - sub-modules (and their sub-modules) were never visited at all, so the tour
 *     jumped from a module group straight to the next top-level tab;
 *   - anything without a hand-written step was skipped silently;
 *   - on a tenant node the list was wrong by construction, because a tenant only
 *     renders the modules it subscribes to and the tabs its roles permit.
 *
 * Walking the DOM fixes all three at once: whatever the sidebar actually shows —
 * for this user, on this node, with these subscriptions — is exactly what the
 * tour walks, in visual order, parents before children.
 *
 * Targets are passed as elements, not selectors: most nested rows carry no `id`.
 */

type Translate = (key: string, fallback: string) => string;

/** Roots are walked in order; each contains one section of the sidebar. */
const NAV_ROOTS = ["#tour-sidebar-nav", "#tour-sidebar-secondary"] as const;

/**
 * Hand-written copy for the entries that deserve it, keyed by route. Anything
 * not listed falls back to a generated line so coverage is never gated on
 * someone remembering to add a string.
 */
const CURATED_DESC: Record<string, { key: string; fallback: string }> = {
  "/dashboard": { key: "tour.overview_desc", fallback: "View real-time telemetry, revenue, and active staff metrics." },
  "/dashboard/audit-logs": { key: "tour.audit_desc", fallback: "Every system action is cryptographically sealed here." },
  "/dashboard/security": { key: "tour.security_desc", fallback: "Manage operator clearances, roles, and granular security." },
  "/dashboard/subscriptions": { key: "tour.subscriptions_desc", fallback: "Review which feature modules each tenant has licensed, and activate or suspend their access." },
  "/dashboard/tenants": { key: "tour.tenants_desc", fallback: "Provision, monitor, and configure active tenant databases." },
  "/dashboard/landing-templates": { key: "tour.landing_templates_desc", fallback: "Configure global landing templates and themes for tenants." },
  "/dashboard/inventory": { key: "tour.inventory_desc", fallback: "Manage assets, products, and warehouse logistics with tenant-aware precision." },
  "/dashboard/hospitality": { key: "tour.hospitality_desc", fallback: "Real-time table management, reservations, and service orders for lounges and restaurants." },
  "/dashboard/storage": { key: "tour.storage_desc", fallback: "Monitor tenant-aware file systems and volume capacities." },
  "/dashboard/settings": { key: "tour.settings_desc", fallback: "Configure deep system parameters and UI themes." },
  "/dashboard/api-docs": { key: "tour.api_docs_desc", fallback: "Explore the live API schema to integrate external applications." },
  "/dashboard/workflow": { key: "tour.approvals_desc", fallback: "Review and action workflow requests waiting on your clearance level." },
};

const isVisible = (el: Element): boolean => {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  const style = window.getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
};

/** First text line only — nav rows can carry unread badges and chevrons. */
const readLabel = (el: HTMLElement): string =>
  (el.innerText || el.textContent || "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? "";

export const buildSidebarTourSteps = (t: Translate): Step[] => {
  if (typeof document === "undefined") return [];

  const steps: Step[] = [];
  const seen = new Set<Element>();

  for (const rootSelector of NAV_ROOTS) {
    const root = document.querySelector(rootSelector);
    if (!root) continue;

    // querySelectorAll returns document order, which for the sidebar is the same
    // as visual order — so a group header is always emitted before its children.
    const rows = root.querySelectorAll<HTMLElement>("a[href], button[aria-controls]");

    rows.forEach((el) => {
      if (seen.has(el) || !isVisible(el)) return;
      seen.add(el);

      const label = readLabel(el);
      if (!label) return;

      const href = el.getAttribute("href");
      const isGroup = el.tagName === "BUTTON";
      const curated = href ? CURATED_DESC[href] : undefined;

      let content: string;
      if (curated) {
        content = t(curated.key, curated.fallback);
      } else if (isGroup) {
        content = t(
          "tour.nav_group_desc",
          "Groups the related workspaces below. Each one is covered next.",
        ).replace("{label}", label);
      } else {
        content = t(
          "tour.nav_item_desc",
          "Opens {label}, where you manage this part of the workspace.",
        ).replace("{label}", label);
      }

      steps.push({
        target: el,
        title: label,
        content,
        placement: "right",
      });
    });
  }

  return steps;
};
