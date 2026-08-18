import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Supplier Invoice Matching - Hive.OS",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
