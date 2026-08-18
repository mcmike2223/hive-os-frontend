import { Store } from "lucide-react";
import type { FrontendModuleDefinition } from "@/modules/types";

export const landingTemplatesModule: FrontendModuleDefinition = {
  id: "landing-templates",
  name: "Landing Templates",
  description: "Tenant template marketplace.",
  backendModule: "Modules\\LandingTemplates",
  routePrefixes: ["/dashboard/landing-pages"],
  navItems: [
    {
      moduleId: "landing-templates",
      translationKey: "nav.template_marketplace",
      fallbackLabel: "Template Marketplace",
      href: "/dashboard/landing-pages",
      icon: Store,
      // Visible to every tenant (and admins, who get routed to the library).
      permissions: [],
      tourId: "tour-nav-template-marketplace",
      placement: "primary",
    },
  ],
};
