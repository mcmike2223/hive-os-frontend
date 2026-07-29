import type { Metadata } from "next";
import { HumanResourcesClient } from "../client";

export const metadata: Metadata = {
  title: "Ethiopian Workforce Compliance | Hive ERP",
  description:
    "Review, validate, and activate effective-dated Ethiopian workforce compliance policy versions.",
};

export default function CompliancePage() {
  return <HumanResourcesClient defaultTab="compliance" />;
}
