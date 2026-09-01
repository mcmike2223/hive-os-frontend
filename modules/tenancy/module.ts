import { Network } from "lucide-react";
import type { FrontendModuleDefinition } from "@/modules/types";

export const tenancyModule: FrontendModuleDefinition = {
  id: "tenancy",
  name: "Tenancy",
  description: "Tenant provisioning, lifecycle management, and node operations.",
  backendModule: "Modules\\Tenancy",
  routePrefixes: ["/dashboard/tenants"],
  navItems: [
    {
      moduleId: "tenancy",
      translationKey: "nav.tenants",
      fallbackLabel: "Tenant Accounts",
      href: "/dashboard/tenants",
      icon: Network,
      permissions: ["manage_tenants", "view_tenants"],
      tourId: "tour-nav-tenants",
      placement: "primary",
    },
  ],
};
