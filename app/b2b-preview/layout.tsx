import type { Metadata } from "next";

import { moduleMetadata } from "@/lib/seo";

export function generateMetadata(): Promise<Metadata> {
  return moduleMetadata("b2b-preview");
}

export default function B2BPreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
