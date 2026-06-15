import type { Metadata } from "next";

import { moduleMetadata } from "@/lib/seo";

export function generateMetadata(): Promise<Metadata> {
  return moduleMetadata("booking");
}

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
