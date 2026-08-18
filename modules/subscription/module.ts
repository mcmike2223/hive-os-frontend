import { Layers } from "lucide-react";
import type { FrontendModuleDefinition } from "@/modules/types";

export const subscriptionModule: FrontendModuleDefinition = {
  id: "subscription",
  name: "Subscription",
  description: "Tenant subscription management, renewals, and module access controls.",
  backendModule: "Modules\\Subscription",
  routePrefixes: ["/dashboard/subscriptions"],
  navItems: [
    {
      moduleId: "subscription",
      translationKey: "nav.subscriptions",
      fallbackLabel: "Module Subscriptions",
      href: "/dashboard/subscriptions",
      icon: Layers,
      permissions: ["view_module_subscriptions", "manage_module_subscriptions"],
      tourId: "tour-nav-subscriptions",
      placement: "primary",
    },
  ],
};
