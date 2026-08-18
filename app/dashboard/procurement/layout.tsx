import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Procurement Management - Hive.OS",
  description:
    "Source-to-pay planning, sourcing, orders, receiving, matching, agreements, and procurement analytics.",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
