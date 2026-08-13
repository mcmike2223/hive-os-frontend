import {
  BadgeDollarSign,
  Boxes,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Code2,
  Fingerprint,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  LifeBuoy,
  Package,
  PlayCircle,
  Route,
  Scale,
  ShieldCheck,
  ShoppingCart,
  Store,
  UsersRound,
  UtensilsCrossed,
  Wallet,
  Warehouse,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type LandingNavLink = {
  /** Anchor id on this page (scrolled to) — mutually exclusive with `href`. */
  section?: string;
  /** Real route. Only routes that exist are listed; see the audit in the PR. */
  href?: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  badge?: string;
};

export type LandingNavGroup = {
  heading: string;
  links: LandingNavLink[];
};

export type LandingNavItem = {
  key: string;
  label: string;
  section?: string;
  href?: string;
  /** Present ⇒ renders as a mega-menu trigger with a chevron. */
  groups?: LandingNavGroup[];
  /** Optional promoted card rendered in the mega menu's right rail. */
  feature?: {
    title: string;
    description: string;
    href: string;
    cta: string;
  };
};

type Translate = (key: string, fallback?: string, replacements?: Record<string, unknown>) => string;

/**
 * Header navigation, derived from the modules Hive actually ships
 * (see FEATURE_MODULES in @/modules) rather than from generic SaaS boilerplate.
 *
 * Every `href` below resolves to a real page. `/marketplace` is deliberately
 * absent: it has no index route, only `/marketplace/{product,category,...}`
 * subpaths, so linking it bare would 404 — B2B traffic goes to /b2b-preview.
 */
export function buildLandingNav(t: Translate): LandingNavItem[] {
  return [
    {
      key: "platform",
      label: t("landing.nav.platform", "Platform"),
      section: "modules",
      groups: [
        {
          heading: t("landing.nav.group.operations", "Operations"),
          links: [
            {
              label: t("landing.nav.hospitality", "Hospitality & POS"),
              description: t(
                "landing.nav.hospitality_desc",
                "Front desk, waiter POS, kitchen display, tables & reservations.",
              ),
              icon: UtensilsCrossed,
              href: "/savory-preview",
            },
            {
              label: t("landing.nav.inventory", "Inventory & Catalog"),
              description: t(
                "landing.nav.inventory_desc",
                "Products, categories, suppliers and quality assurance.",
              ),
              icon: Package,
              section: "modules",
            },
            {
              label: t("landing.nav.warehouse", "Warehouse"),
              description: t(
                "landing.nav.warehouse_desc",
                "Multi-warehouse shelves, locations and stock movements.",
              ),
              icon: Warehouse,
              section: "modules",
            },
            {
              label: t("landing.nav.mobility", "Smart Mobility"),
              description: t(
                "landing.nav.mobility_desc",
                "Freight, fleet telemetry and dispatch across your routes.",
              ),
              icon: Route,
              section: "mobility",
            },
          ],
        },
        {
          heading: t("landing.nav.group.people", "People"),
          links: [
            {
              label: t("landing.nav.hr", "Human Resources"),
              description: t(
                "landing.nav.hr_desc",
                "Employees, org chart, positions, leave and compliance.",
              ),
              icon: UsersRound,
              section: "hr",
            },
            {
              label: t("landing.nav.attendance", "Attendance"),
              description: t(
                "landing.nav.attendance_desc",
                "Biometric device onboarding, live logs and reports.",
              ),
              icon: Fingerprint,
              section: "hr",
            },
            {
              label: t("landing.nav.payroll", "Payroll"),
              description: t(
                "landing.nav.payroll_desc",
                "Ethiopian income tax bands, pension and payslip runs.",
              ),
              icon: Wallet,
              section: "hr",
            },
            {
              label: t("landing.nav.lms", "Learning Management"),
              description: t(
                "landing.nav.lms_desc",
                "Courses, learners and completion reporting.",
              ),
              icon: GraduationCap,
              href: "/courses",
            },
          ],
        },
        {
          heading: t("landing.nav.group.business", "Business"),
          links: [
            {
              label: t("landing.nav.fintech", "Finance & Ledger"),
              description: t(
                "landing.nav.fintech_desc",
                "ERCA-compliant VAT, multi-currency ledger, bank reconciliation.",
              ),
              icon: BadgeDollarSign,
              section: "fintech",
            },
            {
              label: t("landing.nav.b2b", "B2B Marketplace"),
              description: t(
                "landing.nav.b2b_desc",
                "Supplier catalogues, quotations and wholesale checkout.",
              ),
              icon: ShoppingCart,
              href: "/b2b-preview",
            },
            {
              label: t("landing.nav.projects", "Project Management"),
              description: t(
                "landing.nav.projects_desc",
                "Projects, tasks, team workload and delivery reports.",
              ),
              icon: ClipboardCheck,
              section: "modules",
            },
            {
              label: t("landing.nav.workflow", "Workflow & Approvals"),
              description: t(
                "landing.nav.workflow_desc",
                "Approval chains, business rules and role-based routing.",
              ),
              icon: Workflow,
              section: "modules",
            },
          ],
        },
      ],
      feature: {
        title: t("landing.nav.feature_title", "One tenant. Every module."),
        description: t(
          "landing.nav.feature_desc",
          "Each workspace runs on its own isolated database schema. Switch modules on and off without a migration.",
        ),
        href: "#architecture",
        cta: t("landing.nav.feature_cta", "See the architecture"),
      },
    },
    {
      key: "solutions",
      label: t("landing.nav.solutions", "Solutions"),
      groups: [
        {
          heading: t("landing.nav.group.by_industry", "By industry"),
          links: [
            {
              label: t("landing.nav.sol_restaurant", "Restaurants & Hotels"),
              description: t(
                "landing.nav.sol_restaurant_desc",
                "Offline-capable POS, KDS and front desk in one workspace.",
              ),
              icon: UtensilsCrossed,
              href: "/savory-preview",
            },
            {
              label: t("landing.nav.sol_wholesale", "Wholesale & Distribution"),
              description: t(
                "landing.nav.sol_wholesale_desc",
                "Sell to business buyers with tiered pricing and quotations.",
              ),
              icon: Store,
              href: "/b2b-preview",
            },
            {
              label: t("landing.nav.sol_education", "Training & Education"),
              description: t(
                "landing.nav.sol_education_desc",
                "Publish courses, enrol learners, certify completion.",
              ),
              icon: GraduationCap,
              href: "/courses",
            },
            {
              label: t("landing.nav.sol_enterprise", "Enterprise & Corporate"),
              description: t(
                "landing.nav.sol_enterprise_desc",
                "Multi-branch finance, HR and logistics under one ledger.",
              ),
              icon: Building2,
              section: "architecture",
            },
          ],
        },
        {
          heading: t("landing.nav.group.by_need", "By need"),
          links: [
            {
              label: t("landing.nav.sol_compliance", "Ethiopian tax compliance"),
              description: t(
                "landing.nav.sol_compliance_desc",
                "Automated VAT, ERCA filing formats and audit trails.",
              ),
              icon: ClipboardCheck,
              section: "fintech",
            },
            {
              label: t("landing.nav.sol_payments", "Local payment rails"),
              description: t(
                "landing.nav.sol_payments_desc",
                "Telebirr, CBE, Chapa and ArifPay reconciled automatically.",
              ),
              icon: Wallet,
              section: "fintech",
            },
            {
              label: t("landing.nav.sol_offline", "Working offline"),
              description: t(
                "landing.nav.sol_offline_desc",
                "POS and field apps queue locally and sync when the link returns.",
              ),
              icon: Boxes,
              section: "architecture",
            },
            {
              label: t("landing.nav.sol_onprem", "On-premise deployment"),
              description: t(
                "landing.nav.sol_onprem_desc",
                "Run the whole stack inside your own data centre.",
              ),
              icon: LayoutDashboard,
              section: "architecture",
            },
            {
              label: t("landing.nav.sol_security", "Security & audit"),
              description: t(
                "landing.nav.sol_security_desc",
                "Schema isolation, role-based access and an append-only trail.",
              ),
              icon: ShieldCheck,
              section: "security",
            },
            {
              label: t("landing.nav.sol_compare", "Compare to what you use now"),
              description: t(
                "landing.nav.sol_compare_desc",
                "Spreadsheets and imported ERPs, side by side with Hive.",
              ),
              icon: Scale,
              section: "compare",
            },
          ],
        },
      ],
      feature: {
        title: t("landing.nav.sol_feature_title", "Not sure which fits?"),
        description: t(
          "landing.nav.sol_feature_desc",
          "Walk through your operation with our team and we will map it to a module stack and a plan.",
        ),
        href: "/request-demo",
        cta: t("landing.nav.sol_feature_cta", "Request a demo"),
      },
    },
    {
      key: "how-it-works",
      label: t("landing.nav.how", "How it works"),
      section: "how-it-works",
    },
    {
      key: "pricing",
      label: t("landing.nav.pricing", "Pricing"),
      section: "pricing",
    },
    {
      key: "resources",
      label: t("landing.nav.resources", "Resources"),
      groups: [
        {
          heading: t("landing.nav.group.learn", "Learn"),
          links: [
            {
              label: t("landing.nav.docs", "API Documentation"),
              description: t("landing.nav.docs_desc", "REST endpoints, webhooks and auth."),
              icon: Code2,
              href: "/api-docs",
            },
            {
              label: t("landing.nav.faq", "FAQ"),
              description: t("landing.nav.faq_desc", "Deployment, data residency and integrations."),
              icon: HelpCircle,
              section: "faq",
            },
            {
              label: t("landing.nav.demo", "Request a demo"),
              description: t("landing.nav.demo_desc", "A guided walkthrough with our team."),
              icon: PlayCircle,
              href: "/request-demo",
            },
            {
              label: t("landing.nav.book", "Book a table demo"),
              description: t("landing.nav.book_desc", "See the hospitality booking flow live."),
              icon: CalendarClock,
              href: "/book",
            },
          ],
        },
        {
          heading: t("landing.nav.group.support", "Support"),
          links: [
            {
              label: t("landing.nav.proof", "Customer outcomes"),
              description: t("landing.nav.proof_desc", "What teams running Hive report back."),
              icon: LifeBuoy,
              section: "proof",
            },
            {
              label: t("landing.nav.contact", "Contact us"),
              description: t("landing.nav.contact_desc", "Addis Ababa HQ, sales and support."),
              icon: Building2,
              section: "contact",
            },
          ],
        },
      ],
    },
  ];
}

/** Section ids the scroll-spy observes, in document order. */
export const LANDING_SECTION_IDS = [
  "modules",
  "fintech",
  "mobility",
  "hr",
  "architecture",
  "field",
  "security",
  "proof",
  "compare",
  "how-it-works",
  "pricing",
  "faq",
  "contact",
] as const;
