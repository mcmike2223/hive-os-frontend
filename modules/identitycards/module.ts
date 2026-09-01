import { BadgeCheck, CreditCard, FilePlus2, ScanLine } from "lucide-react";

import type { FrontendModuleDefinition } from "@/modules/types";

const common = {
  moduleId: "identitycards" as const,
  subscriptionSlug: ["employee_id_management", "human_resources"],
  permissions: [
    "view_employee_id_cards",
    "manage_employee_id_cards",
    "manage_employee_id_templates",
  ],
  placement: "primary" as const,
};

export const identityCardsModule: FrontendModuleDefinition = {
  id: "identitycards",
  name: "Employee ID Management",
  description:
    "Issue, renew, revoke, verify, and template employee identity cards linked to HR records.",
  backendModule: "Modules\\HumanResources",
  routePrefixes: [
    "/dashboard/identity-cards",
    "/dashboard/identity-cards/issue",
    "/dashboard/identity-cards/templates",
    "/dashboard/identity-cards/verify",
  ],
  navItems: [
    {
      ...common,
      translationKey: "nav.employee_id_cards",
      fallbackLabel: "Card register",
      href: "/dashboard/identity-cards",
      icon: CreditCard,
    },
    {
      ...common,
      translationKey: "nav.employee_id_issue",
      fallbackLabel: "Issue cards",
      href: "/dashboard/identity-cards/issue",
      icon: FilePlus2,
    },
    {
      ...common,
      translationKey: "nav.employee_id_templates",
      fallbackLabel: "Card templates",
      href: "/dashboard/identity-cards/templates",
      icon: BadgeCheck,
    },
    {
      ...common,
      translationKey: "nav.employee_id_verify",
      fallbackLabel: "Verify a card",
      href: "/dashboard/identity-cards/verify",
      icon: ScanLine,
    },
  ],
};
