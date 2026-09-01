import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create a workspace",
  description: "Choose a business type, subscription plan, modules, and landing page template for a new Hive workspace.",
};

export default function SignupLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
