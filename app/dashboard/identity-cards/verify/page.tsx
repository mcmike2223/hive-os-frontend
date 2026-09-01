import type { Metadata } from "next";

import { IdentityCardWorkspace } from "@/app/dashboard/human-resources/identity-cards/identity-card-workspace";

export const metadata: Metadata = {
  title: "Verify Employee ID Card | HIVE.OS",
};

export default function VerifyEmployeeIdentityCardPage() {
  return <IdentityCardWorkspace initialTab="verify" />;
}
