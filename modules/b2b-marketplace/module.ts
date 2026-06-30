import { Store, LayoutTemplate } from "lucide-react";
import type { FrontendModuleDefinition } from "../types";

export const b2bMarketplaceModule: FrontendModuleDefinition = {
  id: "b2b-marketplace",
  name: "B2B Marketplace",
  description: "Wholesale B2B operations and sourcing",
  backendModule: "B2BMarketplace",
  routePrefixes: ["/b2b-marketplace"],
  navItems: [
    {
      moduleId: "b2b-marketplace",
      translationKey: "nav.b2bMarketplace",
      fallbackLabel: "B2B Marketplace",
      href: "/dashboard/b2b-marketplace",
      icon: Store,
      permissions: ["view_b2b_marketplace"],
      subscriptionSlug: "b2b_marketplace",
      placement: "primary",
    },
    {
      moduleId: "b2b-marketplace",
      translationKey: "nav.b2bLanding",
      fallbackLabel: "Marketplace Landing",
      href: "/dashboard/b2b-marketplace/landing",
      icon: LayoutTemplate,
      permissions: ["manage_b2b_marketplace"],
      subscriptionSlug: "b2b_marketplace",
      placement: "primary",
    },
  ],
};
