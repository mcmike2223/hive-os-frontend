import { Sprout, Wheat, Trees, MapPinned, Egg } from "lucide-react";
import type { FrontendModuleDefinition } from "@/modules/types";

const common = {
  moduleId: "agriculture" as const,
  subscriptionSlug: "agriculture",
  placement: "primary" as const,
};

export const agricultureModule: FrontendModuleDefinition = {
  id: "agriculture",
  name: "Agriculture",
  description:
    "Crop production on measured land: fields and soils, crops with expected yields, seasons, plantings with costed field operations, repeat harvests with yield per hectare computed from the planted area, waste and cost per kilogram, plus livestock production and mortality.",
  backendModule: "Modules\\Agriculture",
  routePrefixes: ["/dashboard/agriculture"],
  navItems: [
    {
      ...common,
      translationKey: "nav.agriculture_overview",
      fallbackLabel: "Farm",
      href: "/dashboard/agriculture",
      icon: Sprout,
      permissions: ["view_agriculture", "manage_agriculture"],
    },
    {
      ...common,
      translationKey: "nav.agriculture_plantings",
      fallbackLabel: "Plantings",
      href: "/dashboard/agriculture/plantings",
      icon: Trees,
      permissions: [
        "view_agriculture",
        "manage_plantings",
        "record_field_activities",
        "manage_agriculture",
      ],
    },
    {
      ...common,
      translationKey: "nav.agriculture_harvests",
      fallbackLabel: "Harvests",
      href: "/dashboard/agriculture/harvests",
      icon: Wheat,
      permissions: ["view_agriculture", "record_harvests", "manage_agriculture"],
    },
    {
      ...common,
      translationKey: "nav.agriculture_fields",
      fallbackLabel: "Fields & Crops",
      href: "/dashboard/agriculture/fields",
      icon: MapPinned,
      permissions: ["view_agriculture", "manage_farm_setup", "manage_agriculture"],
      placement: "secondary",
    },
    {
      ...common,
      translationKey: "nav.agriculture_livestock",
      fallbackLabel: "Livestock",
      href: "/dashboard/agriculture/livestock",
      icon: Egg,
      permissions: ["view_agriculture", "manage_livestock", "manage_agriculture"],
      placement: "secondary",
    },
  ],
};
