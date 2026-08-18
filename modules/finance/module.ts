import {
  Banknote,
  BookOpenCheck,
  Building2,
  ChartNoAxesCombined,
  CircleDollarSign,
  FileChartColumn,
  Landmark,
  ReceiptText,
  Settings2,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import type { FrontendModuleDefinition } from "@/modules/types";

const common = { moduleId: "finance" as const, subscriptionSlug: "financial_management", placement: "primary" as const };

export const financeModule: FrontendModuleDefinition = {
  id: "finance",
  name: "Financial Management",
  description: "Double-entry accounting, receivables, payables, banking, budgets, VAT, and financial reporting.",
  backendModule: "Modules\\Finance",
  routePrefixes: ["/dashboard/finance"],
  navItems: [
    { ...common, translationKey: "nav.finance_overview", fallbackLabel: "Finance Overview", href: "/dashboard/finance", icon: ChartNoAxesCombined, permissions: ["view_finance", "manage_finance"], tourId: "tour-nav-finance" },
    { ...common, translationKey: "nav.finance_accounts", fallbackLabel: "Chart of Accounts", href: "/dashboard/finance/accounts", icon: BookOpenCheck, permissions: ["view_chart_of_accounts", "manage_chart_of_accounts", "manage_finance"] },
    { ...common, translationKey: "nav.finance_journals", fallbackLabel: "General Journal", href: "/dashboard/finance/journals", icon: ReceiptText, permissions: ["view_journals", "create_journals", "manage_finance"] },
    { ...common, translationKey: "nav.finance_sales", fallbackLabel: "Sales & Receivables", href: "/dashboard/finance/sales", icon: CircleDollarSign, permissions: ["view_sales", "manage_sales", "manage_finance"] },
    { ...common, translationKey: "nav.finance_purchases", fallbackLabel: "Purchases & Payables", href: "/dashboard/finance/purchases", icon: ShoppingCart, permissions: ["view_purchases", "manage_purchases", "manage_finance"] },
    { ...common, translationKey: "nav.finance_contacts", fallbackLabel: "Customers & Vendors", href: "/dashboard/finance/contacts", icon: Building2, permissions: ["view_finance_contacts", "manage_finance_contacts", "manage_finance"] },
    { ...common, translationKey: "nav.finance_budgets", fallbackLabel: "Budgets", href: "/dashboard/finance/budgets", icon: Banknote, permissions: ["view_budgets", "manage_budgets", "manage_finance"] },
    { ...common, translationKey: "nav.finance_banking", fallbackLabel: "Bank Reconciliation", href: "/dashboard/finance/banking", icon: Landmark, permissions: ["view_bank_reconciliations", "reconcile_banks", "manage_finance"] },
    { ...common, translationKey: "nav.finance_reports", fallbackLabel: "Financial Reports", href: "/dashboard/finance/reports", icon: FileChartColumn, permissions: ["view_finance_reports", "export_finance_reports", "manage_finance"] },
    { ...common, translationKey: "nav.finance_operations", fallbackLabel: "Compliance & Operations", href: "/dashboard/finance/operations", icon: ShieldCheck, permissions: ["view_finance", "view_finance_settings", "manage_finance"] },
    { ...common, translationKey: "nav.finance_settings", fallbackLabel: "Finance Settings", href: "/dashboard/finance/settings", icon: Settings2, permissions: ["view_finance_settings", "manage_finance_settings", "manage_finance"] },
  ],
};
