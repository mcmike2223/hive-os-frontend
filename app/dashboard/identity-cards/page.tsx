import type { Metadata } from "next";

import { IdentityCardWorkspace } from "@/app/dashboard/human-resources/identity-cards/identity-card-workspace";

export const metadata: Metadata = {
  title: "Employee ID Management | HIVE.OS",
};

export default function EmployeeIdentityCardsPage() {
  return <IdentityCardWorkspace initialTab="cards" />;
}
