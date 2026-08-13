import type { Metadata } from "next";

import { AttendanceWorkspace } from "@/modules/attendance/components/attendance-workspace";

export const metadata: Metadata = {
  title: "Attendance Management | Hive",
  description:
    "Manage workforce schedules, time capture, attendance devices, corrections, and payroll-ready reconciliation.",
};

export default function AttendancePage() {
  return (
    <>
      <h1 className="sr-only">Attendance Management</h1>
      <AttendanceWorkspace />
    </>
  );
}
