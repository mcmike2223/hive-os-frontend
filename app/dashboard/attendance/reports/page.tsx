import type { Metadata } from "next";

import { AttendanceReportingWorkspace } from "@/modules/attendance/components/attendance-reporting-workspace";

export const metadata: Metadata = {
  title: "Attendance Reports | Hive",
  description:
    "Review daily, weekly, monthly, and custom workforce evidence with CSV, Excel, and PDF exports.",
};

export default function AttendanceReportsPage() {
  return <AttendanceReportingWorkspace />;
}
