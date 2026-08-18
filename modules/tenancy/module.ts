import { LayoutTemplate, Network } from "lucide-react";
import type { FrontendModuleDefinition } from "@/modules/types";

export const tenancyModule: FrontendModuleDefinition = {
  id: "tenancy",
  name: "Tenancy",
  description: "Tenant provisioning, lifecycle management, and node operations.",
  backendModule: "Modules\\Tenancy",
  routePrefixes: ["/dashboard/tenants", "/dashboard/landing-templates", "/dashboard/landing-library"],
  navItems: [
    {
      moduleId: "tenancy",
      translationKey: "nav.tenants",
      fallbackLabel: "Tenant Nodes",
      href: "/dashboard/tenants",
      icon: Network,
      permissions: ["manage_tenants", "view_tenants"],
      tourId: "tour-nav-tenants",
      placement: "primary",
    },
    {
      // Central admins land on the new master-template engine. The legacy
      // /dashboard/landing-templates catalog editor is still reachable by URL.
      moduleId: "tenancy",
      translationKey: "nav.landing_library",
      fallbackLabel: "Landing Library",
      href: "/dashboard/landing-library",
      icon: LayoutTemplate,
      permissions: ["manage_tenants", "provision_tenants"],
      tourId: "tour-nav-landing-templates",
      placement: "primary",
    },
  ],
};
