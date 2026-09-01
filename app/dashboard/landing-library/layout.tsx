import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Landing Studio | HIVE.OS",
  description: "Create, version, preview, and distribute tenant-safe landing templates.",
};

export default function LandingLibraryLayout({ children }: { children: ReactNode }) {
  return children;
}
