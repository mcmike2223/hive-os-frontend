import { Shield } from "lucide-react";
import type { FrontendModuleDefinition } from "@/modules/types";

export const identityModule: FrontendModuleDefinition = {
  id: "identity",
  name: "Identity",
  description: "Authentication, operators, roles, permissions, and profile security.",
  backendModule: "Modules\\Identity",
  routePrefixes: ["/dashboard/security", "/sign-in", "/forgot-password", "/reset-password"],
  navItems: [
    {
      moduleId: "identity",
      translationKey: "nav.security",
      fallbackLabel: "Identity & Access",
      href: "/dashboard/security",
      icon: Shield,
      permissions: ["manage_users", "view_users", "manage_roles", "view_roles", "view_permissions"],
      subscriptionSlug: "security_management",
      tourId: "tour-nav-security",
      placement: "primary",
    },
  ],
};
