import type { Metadata } from "next";

import { AttendanceUserLinkingWorkspace } from "@/modules/attendance/components/attendance-user-linking-workspace";

export const metadata: Metadata = {
  title: "User Account Linking | Hive Attendance",
  description: "Link user accounts to employee records and manage Attendance enrolment across the tenant.",
};

export default function UserLinkingPage() {
  return <AttendanceUserLinkingWorkspace />;
}
