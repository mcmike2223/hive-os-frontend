import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Reference",
  description: "Live, route-derived Hive API reference for central and tenant requests.",
};

export default function ApiDocsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
