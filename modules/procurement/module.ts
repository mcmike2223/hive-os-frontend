import {
  BadgeCheck,
  BarChart3,
  ClipboardList,
  FileCheck2,
  LayoutDashboard,
  PackageCheck,
  ReceiptText,
  ScrollText,
  ShoppingCart,
} from "lucide-react";
import type { FrontendModuleDefinition } from "@/modules/types";

const common = {
  moduleId: "procurement" as const,
  subscriptionSlug: "procurement_management",
  placement: "primary" as const,
};

export const procurementModule: FrontendModuleDefinition = {
  id: "procurement",
  name: "Procurement Management",
  description:
    "Source-to-pay control from request and supplier competition through receiving, matching, and audit.",
  backendModule: "Modules\\ProcurementManagement",
  routePrefixes: ["/dashboard/procurement", "/dashboard/inventory/procurement"],
  navItems: [
    {
      ...common,
      translationKey: "nav.procurement_overview",
      fallbackLabel: "Procurement Overview",
      href: "/dashboard/procurement",
      icon: LayoutDashboard,
      permissions: ["view_procurement", "manage_procurement"],
      tourId: "tour-nav-procurement",
    },
    {
      ...common,
      translationKey: "nav.procurement_suppliers",
      fallbackLabel: "Suppliers",
      href: "/dashboard/procurement/suppliers",
      icon: BadgeCheck,
      permissions: [
        "view_procurement",
        "manage_procurement_suppliers",
        "manage_procurement",
      ],
    },
    {
      ...common,
      translationKey: "nav.procurement_requisitions",
      fallbackLabel: "Requisitions",
      href: "/dashboard/procurement/requisitions",
      icon: ClipboardList,
      permissions: [
        "view_procurement",
        "create_procurement_requisitions",
        "approve_procurement_requisitions",
        "manage_procurement",
      ],
    },
    {
      ...common,
      translationKey: "nav.procurement_sourcing",
      fallbackLabel: "Sourcing & Bids",
      href: "/dashboard/procurement/sourcing",
      icon: FileCheck2,
      permissions: [
        "view_procurement",
        "manage_procurement_sourcing",
        "evaluate_procurement_bids",
        "manage_procurement",
      ],
    },
    {
      ...common,
      translationKey: "nav.procurement_orders",
      fallbackLabel: "Purchase Orders",
      href: "/dashboard/procurement/orders",
      icon: ShoppingCart,
      permissions: [
        "view_procurement",
        "create_procurement_orders",
        "approve_procurement_orders",
        "manage_procurement",
      ],
    },
    {
      ...common,
      translationKey: "nav.procurement_receiving",
      fallbackLabel: "Receiving & Inspection",
      href: "/dashboard/procurement/receiving",
      icon: PackageCheck,
      permissions: [
        "view_procurement",
        "receive_procurement_goods",
        "inspect_procurement_goods",
        "manage_procurement",
      ],
    },
    {
      ...common,
      translationKey: "nav.procurement_invoices",
      fallbackLabel: "Invoice Matching",
      href: "/dashboard/procurement/invoices",
      icon: ReceiptText,
      permissions: [
        "view_procurement",
        "manage_supplier_invoices",
        "approve_supplier_invoices",
        "manage_procurement",
      ],
    },
    {
      ...common,
      translationKey: "nav.procurement_agreements",
      fallbackLabel: "Agreements",
      href: "/dashboard/procurement/agreements",
      icon: ScrollText,
      permissions: [
        "view_procurement",
        "manage_procurement_agreements",
        "manage_procurement",
      ],
    },
    {
      ...common,
      translationKey: "nav.procurement_reports",
      fallbackLabel: "Reports & Audit",
      href: "/dashboard/procurement/reports",
      icon: BarChart3,
      permissions: [
        "view_procurement_reports",
        "export_procurement_reports",
        "manage_procurement",
      ],
    },
  ],
};
