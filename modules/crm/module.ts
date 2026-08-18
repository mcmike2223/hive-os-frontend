import {
  Handshake,
  UserPlus,
  GitBranch,
  Building2,
  CalendarClock,
  Megaphone,
} from "lucide-react";
import type { FrontendModuleDefinition } from "@/modules/types";

const common = {
  moduleId: "crm" as const,
  subscriptionSlug: "crm",
  placement: "primary" as const,
};

export const crmModule: FrontendModuleDefinition = {
  id: "crm",
  name: "Customer Relationship Management",
  description:
    "Capture and score leads, qualify them into accounts and contacts, run deals through a configurable pipeline with stage history, log every call and meeting, and measure campaigns by what they converted.",
  backendModule: "Modules\\Crm",
  routePrefixes: ["/dashboard/crm"],
  navItems: [
    {
      ...common,
      translationKey: "nav.crm_overview",
      fallbackLabel: "CRM",
      href: "/dashboard/crm",
      icon: Handshake,
      permissions: ["view_crm", "manage_crm"],
    },
    {
      ...common,
      translationKey: "nav.crm_leads",
      fallbackLabel: "Leads",
      href: "/dashboard/crm/leads",
      icon: UserPlus,
      permissions: ["view_crm", "manage_crm_leads", "manage_crm"],
    },
    {
      ...common,
      translationKey: "nav.crm_pipeline",
      fallbackLabel: "Deal Pipeline",
      href: "/dashboard/crm/pipeline",
      icon: GitBranch,
      permissions: ["view_crm", "manage_crm_opportunities", "manage_crm"],
    },
    {
      ...common,
      translationKey: "nav.crm_accounts",
      fallbackLabel: "Accounts & Contacts",
      href: "/dashboard/crm/accounts",
      icon: Building2,
      permissions: ["view_crm", "manage_crm_accounts", "manage_crm_contacts", "manage_crm"],
    },
    {
      ...common,
      translationKey: "nav.crm_activities",
      fallbackLabel: "Activities",
      href: "/dashboard/crm/activities",
      icon: CalendarClock,
      permissions: ["view_crm", "log_crm_activities", "manage_crm"],
      placement: "secondary",
    },
    {
      ...common,
      translationKey: "nav.crm_campaigns",
      fallbackLabel: "Campaigns",
      href: "/dashboard/crm/campaigns",
      icon: Megaphone,
      permissions: ["view_crm", "manage_crm_campaigns", "manage_crm"],
      placement: "secondary",
    },
  ],
};
