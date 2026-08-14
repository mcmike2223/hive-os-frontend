import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Financial Management - Hive.OS",
  description: "Tenant accounting, receivables, payables, banking, budgets, VAT, and financial reporting.",
};

export default function FinanceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
