import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Request a Configurable Demo | HIVE.OS",
  description: "Request a time-limited HIVE.OS demo configured for your business type, modules, and sub-modules.",
};

export default function RequestDemoLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
