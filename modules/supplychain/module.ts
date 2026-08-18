import {
  Truck,
  Gauge,
  LineChart,
  PackageSearch,
  ArrowLeftRight,
  Undo2,
  Ship,
  Route as RouteIcon,
} from "lucide-react";
import type { FrontendModuleDefinition } from "@/modules/types";

const common = {
  moduleId: "supplychain" as const,
  subscriptionSlug: "supply_chain_management",
  placement: "primary" as const,
};

export const supplyChainModule: FrontendModuleDefinition = {
  id: "supplychain",
  name: "Supply Chain Management",
  description:
    "Plan demand and replenishment against live stock and open orders, move stock between warehouses, run delivery rounds with proof of delivery, handle returns, and cost imports at landed value.",
  backendModule: "Modules\\SupplyChain",
  routePrefixes: ["/dashboard/supply-chain"],
  navItems: [
    {
      ...common,
      translationKey: "nav.supply_chain_overview",
      fallbackLabel: "Supply Chain",
      href: "/dashboard/supply-chain",
      icon: Gauge,
      permissions: ["view_supply_chain", "manage_supply_chain"],
    },
    {
      ...common,
      translationKey: "nav.supply_chain_replenishment",
      fallbackLabel: "Replenishment",
      href: "/dashboard/supply-chain/replenishment",
      icon: PackageSearch,
      permissions: ["view_supply_chain", "view_replenishment", "run_replenishment", "manage_supply_chain"],
    },
    {
      ...common,
      translationKey: "nav.supply_chain_planning",
      fallbackLabel: "Demand Planning",
      href: "/dashboard/supply-chain/planning",
      icon: LineChart,
      permissions: ["view_supply_chain", "view_demand_planning", "manage_demand_planning", "manage_supply_chain"],
    },
    {
      ...common,
      translationKey: "nav.supply_chain_shipments",
      fallbackLabel: "Shipments",
      href: "/dashboard/supply-chain/shipments",
      icon: Truck,
      permissions: ["view_supply_chain", "view_shipments", "manage_shipments", "record_deliveries", "manage_supply_chain"],
    },
    {
      ...common,
      translationKey: "nav.supply_chain_transfers",
      fallbackLabel: "Stock Transfers",
      href: "/dashboard/supply-chain/transfers",
      icon: ArrowLeftRight,
      permissions: ["view_supply_chain", "view_stock_transfers", "manage_stock_transfers", "manage_supply_chain"],
    },
    {
      ...common,
      translationKey: "nav.supply_chain_returns",
      fallbackLabel: "Returns",
      href: "/dashboard/supply-chain/returns",
      icon: Undo2,
      permissions: ["view_supply_chain", "view_customer_returns", "manage_customer_returns", "manage_supply_chain"],
    },
    {
      ...common,
      translationKey: "nav.supply_chain_landed_costs",
      fallbackLabel: "Landed Cost",
      href: "/dashboard/supply-chain/landed-costs",
      icon: Ship,
      permissions: ["view_supply_chain", "view_landed_costs", "manage_landed_costs", "manage_supply_chain"],
    },
    {
      ...common,
      translationKey: "nav.supply_chain_routes",
      fallbackLabel: "Delivery Routes",
      href: "/dashboard/supply-chain/routes",
      icon: RouteIcon,
      permissions: ["view_supply_chain", "view_delivery_routes", "manage_delivery_routes", "manage_supply_chain"],
      placement: "secondary",
    },
  ],
};
