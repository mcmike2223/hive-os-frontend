import type { Metadata } from "next";

import { moduleMetadata } from "@/lib/seo";

export function generateMetadata(): Promise<Metadata> {
  return moduleMetadata("savory-preview");
}

export default function SavoryPreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
