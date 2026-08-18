import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Procurement Reports and Audit - Hive.OS",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
