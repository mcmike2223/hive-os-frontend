import type { Metadata } from "next";
import { HumanResourcesClient } from "./client";

export const metadata: Metadata = { title: "Human Resources | HIVE.OS" };

export default function HumanResourcesPage() {
  return <HumanResourcesClient defaultTab="dashboard" />;
}
