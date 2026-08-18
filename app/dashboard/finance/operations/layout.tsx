import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Finance Compliance and Operations - Hive.OS",
  description: "Ethiopian tax controls, foreign exchange, assets, recurring journals, bank imports, and module posting events.",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
