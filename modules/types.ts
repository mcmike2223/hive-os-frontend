import type { LucideIcon } from "lucide-react";

export type ModuleId =
  | "core"
  | "identity"
  | "tenancy"
  | "subscription"
  | "hospitality"
  | "inventory"
  | "warehouse"
  | "production"
  | "workflow"
  | "projectmanagement"
  | "humanresources"
  | "identitycards"
  | "attendance"
  | "payroll"
  | "finance"
  | "performance"
  | "procurement"
  | "supplychain"
  | "sales"
  | "crm"
  | "fleet"
  | "service"
  | "internal-audit"
  | "strategy"
  | "vantage"
  | "agriculture"
  | "lms"
  | "b2b-marketplace"
  | "landing-templates"
  | "support_bot";
export type DashboardNavPlacement = "primary" | "secondary";

export interface ModuleNavItem {
  moduleId: ModuleId;
  translationKey: string;
  fallbackLabel: string;
  href: string;
  icon: LucideIcon;
  permissions?: string[];
  subscriptionSlug?: string | string[];
  businessTypes?: string[];
  tourId?: string;
  placement: DashboardNavPlacement;
  audience?: "all" | "central" | "tenant";
}

export interface FrontendModuleDefinition {
  id: ModuleId;
  name: string;
  description: string;
  backendModule: string;
  routePrefixes: string[];
  navItems: ModuleNavItem[];
}
