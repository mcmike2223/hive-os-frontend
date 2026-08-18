import type { Metadata } from "next";
export const metadata: Metadata = { title: "Purchase Requisitions - Hive.OS" };
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
