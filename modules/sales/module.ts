import {
  BadgeDollarSign,
  Users,
  Tags,
  FileText,
  ClipboardList,
  Target,
} from "lucide-react";
import type { FrontendModuleDefinition } from "@/modules/types";

const common = {
  moduleId: "sales" as const,
  subscriptionSlug: "sales_management",
  placement: "primary" as const,
};

export const salesModule: FrontendModuleDefinition = {
  id: "sales",
  name: "Sales Management",
  description:
    "Customer accounts and credit terms, tiered price lists, quotations that convert to orders, availability against live stock, delivery and invoicing hand-off, targets and commission.",
  backendModule: "Modules\\Sales",
  routePrefixes: ["/dashboard/sales"],
  navItems: [
    {
      ...common,
      translationKey: "nav.sales_overview",
      fallbackLabel: "Sales",
      href: "/dashboard/sales",
      icon: BadgeDollarSign,
      permissions: ["view_sales", "manage_sales"],
    },
    {
      ...common,
      translationKey: "nav.sales_orders",
      fallbackLabel: "Sales Orders",
      href: "/dashboard/sales/orders",
      icon: ClipboardList,
      permissions: [
        "view_sales",
        "manage_sales_orders",
        "approve_sales_orders",
        "record_sales_deliveries",
        "manage_sales",
      ],
    },
    {
      ...common,
      translationKey: "nav.sales_quotations",
      fallbackLabel: "Quotations",
      href: "/dashboard/sales/quotations",
      icon: FileText,
      permissions: ["view_sales", "manage_sales_quotations", "manage_sales"],
    },
    {
      ...common,
      translationKey: "nav.sales_customers",
      fallbackLabel: "Customers",
      href: "/dashboard/sales/customers",
      icon: Users,
      permissions: ["view_sales", "manage_sales_customers", "manage_sales"],
    },
    {
      ...common,
      translationKey: "nav.sales_pricing",
      fallbackLabel: "Price Lists",
      href: "/dashboard/sales/pricing",
      icon: Tags,
      permissions: ["view_sales", "manage_sales_pricing", "manage_sales"],
      placement: "secondary",
    },
    {
      ...common,
      translationKey: "nav.sales_targets",
      fallbackLabel: "Targets & Commission",
      href: "/dashboard/sales/targets",
      icon: Target,
      permissions: [
        "view_sales",
        "manage_sales_targets",
        "manage_sales_commissions",
        "approve_sales_commissions",
        "manage_sales",
      ],
      placement: "secondary",
    },
  ],
};
