import { Truck, Car, Route, Fuel, Wrench, FileWarning } from "lucide-react";
import type { FrontendModuleDefinition } from "@/modules/types";

const common = {
  moduleId: "fleet" as const,
  subscriptionSlug: "fleet_management",
  placement: "primary" as const,
};

export const fleetModule: FrontendModuleDefinition = {
  id: "fleet",
  name: "Fleet Management",
  description:
    "Vehicles and drivers, key assignments, trips against a forward-only odometer, tank-to-tank fuel efficiency, preventive schedules due by distance or date, and document expiry before it bites.",
  backendModule: "Modules\\Fleet",
  routePrefixes: ["/dashboard/fleet"],
  navItems: [
    {
      ...common,
      translationKey: "nav.fleet_overview",
      fallbackLabel: "Fleet",
      href: "/dashboard/fleet",
      icon: Truck,
      permissions: ["view_fleet", "manage_fleet"],
    },
    {
      ...common,
      translationKey: "nav.fleet_vehicles",
      fallbackLabel: "Vehicles & Drivers",
      href: "/dashboard/fleet/vehicles",
      icon: Car,
      permissions: [
        "view_fleet",
        "manage_fleet_vehicles",
        "manage_fleet_drivers",
        "assign_fleet_vehicles",
        "manage_fleet",
      ],
    },
    {
      ...common,
      translationKey: "nav.fleet_trips",
      fallbackLabel: "Trips",
      href: "/dashboard/fleet/trips",
      icon: Route,
      permissions: ["view_fleet", "manage_fleet_trips", "manage_fleet"],
    },
    {
      ...common,
      translationKey: "nav.fleet_fuel",
      fallbackLabel: "Fuel",
      href: "/dashboard/fleet/fuel",
      icon: Fuel,
      permissions: ["view_fleet", "record_fleet_fuel", "manage_fleet"],
    },
    {
      ...common,
      translationKey: "nav.fleet_maintenance",
      fallbackLabel: "Maintenance",
      href: "/dashboard/fleet/maintenance",
      icon: Wrench,
      permissions: ["view_fleet", "manage_fleet_maintenance", "manage_fleet"],
      placement: "secondary",
    },
    {
      ...common,
      translationKey: "nav.fleet_documents",
      fallbackLabel: "Documents",
      href: "/dashboard/fleet/documents",
      icon: FileWarning,
      permissions: ["view_fleet", "manage_fleet_documents", "manage_fleet"],
      placement: "secondary",
    },
  ],
};
