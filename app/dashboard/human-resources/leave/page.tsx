import type { Metadata } from "next";
import { HumanResourcesClient } from "../client";

export const metadata: Metadata = {
  title: "Leave requests | Human Resources | Hive",
  description:
    "Plan, submit, and track employee leave through policy, balance, and approval workflows.",
};

export default function LeavePage() {
  return <HumanResourcesClient defaultTab="leave" />;
}
