import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Landing Preview | HIVE.OS",
  description: "Full-page responsive preview for HIVE landing templates.",
};

export default function LandingPreviewLayout({ children }: { children: ReactNode }) {
  return children;
}
