import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Landing Builder | HIVE.OS",
  description: "Visual and code workspace for HIVE landing templates.",
};

export default function LandingBuilderLayout({ children }: { children: ReactNode }) {
  return children;
}
