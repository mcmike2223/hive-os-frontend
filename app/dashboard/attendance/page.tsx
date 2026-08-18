import type { Metadata } from "next";

import { AttendanceWorkspace } from "@/modules/attendance/components/attendance-workspace";

export const metadata: Metadata = {
  title: "Attendance Management | Hive",
  description:
    "Manage workforce schedules, time capture, attendance devices, corrections, and payroll-ready reconciliation.",
};

export default function AttendancePage() {
  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-800 dark:text-cyan-200">
          Workforce operations
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          Attendance Management
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Start with today’s attendance, then open only the task you need.
          People, devices, and reports are grouped once in the Attendance
          Management sidebar menu.
        </p>
      </header>
      <AttendanceWorkspace />
    </div>
  );
}
