import { LifeBuoy, Ticket, ClipboardCheck, HardHat, CalendarClock, UserCog } from "lucide-react";
import type { FrontendModuleDefinition } from "@/modules/types";

const common = {
  moduleId: "service" as const,
  subscriptionSlug: "service_management",
  placement: "primary" as const,
};

export const serviceModule: FrontendModuleDefinition = {
  id: "service",
  name: "Service and Maintenance",
  description:
    "Customer equipment under warranty and contract, faults measured against a real response and resolution clock, work orders costed from parts and labour, first-time-fix reporting, and preventive plans that come due before something breaks.",
  backendModule: "Modules\\ServiceManagement",
  routePrefixes: ["/dashboard/service"],
  navItems: [
    {
      ...common,
      translationKey: "nav.service_overview",
      fallbackLabel: "Service",
      href: "/dashboard/service",
      icon: LifeBuoy,
      permissions: ["view_service", "manage_service"],
    },
    {
      ...common,
      translationKey: "nav.service_requests",
      fallbackLabel: "Service Requests",
      href: "/dashboard/service/requests",
      icon: Ticket,
      permissions: ["view_service", "manage_service_requests", "manage_service"],
    },
    {
      ...common,
      translationKey: "nav.service_work_orders",
      fallbackLabel: "Work Orders",
      href: "/dashboard/service/work-orders",
      icon: ClipboardCheck,
      permissions: [
        "view_service",
        "manage_service_work_orders",
        "complete_service_work",
        "manage_service",
      ],
    },
    {
      ...common,
      translationKey: "nav.service_engineers",
      fallbackLabel: "Engineers",
      href: "/dashboard/service/engineers",
      icon: UserCog,
      permissions: ["view_service", "manage_service_technicians", "manage_service"],
      placement: "secondary",
    },
    {
      ...common,
      translationKey: "nav.service_assets",
      fallbackLabel: "Assets & Contracts",
      href: "/dashboard/service/assets",
      icon: HardHat,
      permissions: [
        "view_service",
        "manage_service_assets",
        "manage_service_contracts",
        "manage_service",
      ],
      placement: "secondary",
    },
    {
      ...common,
      translationKey: "nav.service_plans",
      fallbackLabel: "Preventive Maintenance",
      href: "/dashboard/service/plans",
      icon: CalendarClock,
      permissions: ["view_service", "manage_service_plans", "manage_service"],
      placement: "secondary",
    },
  ],
};
