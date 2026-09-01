import type { Metadata } from "next";

import { IdentityCardWorkspace } from "@/app/dashboard/human-resources/identity-cards/identity-card-workspace";

export const metadata: Metadata = {
  title: "Issue Employee ID Cards | HIVE.OS",
};

export default function IssueEmployeeIdentityCardsPage() {
  return <IdentityCardWorkspace initialTab="issue" />;
}
