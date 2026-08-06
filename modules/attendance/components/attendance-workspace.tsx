"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { AttendanceWorkspace as AttendanceWorkspaceView } from "@/app/dashboard/human-resources/attendance-workspace";
import { ScheduleDialog } from "@/app/dashboard/human-resources/work-schedule-dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { getWorkspaceScopeKey } from "@/lib/runtime-context";
import {
  attendanceFetch,
  type Employee,
  type Paginated,
} from "@/modules/attendance/api";

/**
 * Attendance Management entry: punch/capture workspace plus the existing
 * work-schedule create/assign dialog (Phase 7 keeps scheduling on this page).
 */
export function AttendanceWorkspace() {
  const scope = getWorkspaceScopeKey();
  const { hasPermission, isLoaded } = usePermissions();
  const canSchedules = hasPermission("manage_work_schedules");
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const employees = useQuery({
    queryKey: ["hr-attendance", scope, "schedule-employees"],
    queryFn: () =>
      attendanceFetch<Paginated<Employee>>("/employees?per_page=100"),
    enabled: isLoaded && canSchedules,
  });

  return (
    <>
      <AttendanceWorkspaceView
        onAddSchedule={
          canSchedules ? () => setScheduleOpen(true) : undefined
        }
      />
      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        employees={employees.data?.data ?? []}
      />
    </>
  );
}
