import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Procurement Sourcing and Bids - Hive.OS",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
