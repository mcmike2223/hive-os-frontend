import type { Metadata } from "next";

import { IdentityCardWorkspace } from "@/app/dashboard/human-resources/identity-cards/identity-card-workspace";

export const metadata: Metadata = {
  title: "Employee ID Card Templates | HIVE.OS",
};

export default function EmployeeIdentityCardTemplatesPage() {
  return <IdentityCardWorkspace initialTab="templates" />;
}
