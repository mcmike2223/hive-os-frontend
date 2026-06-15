import type { Metadata } from "next";

import { moduleMetadata } from "@/lib/seo";

export function generateMetadata(): Promise<Metadata> {
  return moduleMetadata("marketplace");
}

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
