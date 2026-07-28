import type { Metadata } from "next";

import { HumanResourcesClient } from "../client";

export const metadata: Metadata = {
  title: "Attendance and scheduling | Human Resources | Hive",
  description:
    "Record attendance, resolve employee shifts, build rotations, generate rosters, and manage schedule approvals.",
};

export default function AttendancePage() {
  return <HumanResourcesClient defaultTab="attendance" />;
}
