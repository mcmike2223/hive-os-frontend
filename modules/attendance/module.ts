import { BarChart3, Cpu, Fingerprint, PlusCircle, Settings } from "lucide-react";

import type { FrontendModuleDefinition } from "@/modules/types";

export const attendanceModule: FrontendModuleDefinition = {
  id: "attendance",
  name: "Attendance Management",
  description:
    "Scheduling, time capture, devices, corrections, and payroll-ready reconciliation.",
  backendModule: "Modules\\Attendance",
  routePrefixes: [
    "/dashboard/attendance",
    "/dashboard/attendance/device-onboarding",
    "/dashboard/attendance/devices",
    "/dashboard/attendance/reports",
  ],
  navItems: [
    {
      moduleId: "attendance",
      translationKey: "nav.attendance",
      fallbackLabel: "Attendance Management",
      href: "/dashboard/attendance",
      icon: Fingerprint,
      subscriptionSlug: ["attendance_management", "human_resources"],
      permissions: [
        "record_attendance",
        "record_own_attendance",
        "view_own_attendance",
        "view_team_attendance",
        "view_attendance",
        "manage_attendance",
        "view_own_schedule",
        "view_team_time",
      ],
      placement: "primary",
    },
    {
      moduleId: "attendance",
      translationKey: "nav.attendance_device_onboarding",
      fallbackLabel: "Device Onboarding",
      href: "/dashboard/attendance/device-onboarding",
      icon: PlusCircle,
      subscriptionSlug: ["attendance_management", "human_resources"],
      permissions: [
        "view_attendance_devices",
        "manage_attendance_devices",
        "manage_attendance",
      ],
      placement: "primary",
    },
    {
      moduleId: "attendance",
      translationKey: "nav.attendance_devices",
      fallbackLabel: "Device Management",
      href: "/dashboard/attendance/devices",
      icon: Settings,
      subscriptionSlug: ["attendance_management", "human_resources"],
      permissions: [
        "view_attendance_devices",
        "manage_attendance_devices",
        "manage_attendance",
      ],
      placement: "primary",
    },
    {
      moduleId: "attendance",
      translationKey: "nav.attendance_reports",
      fallbackLabel: "Attendance Reports",
      href: "/dashboard/attendance/reports",
      icon: BarChart3,
      subscriptionSlug: ["attendance_management", "human_resources"],
      permissions: [
        "view_workforce_reports",
        "view_attendance",
        "manage_attendance",
      ],
      placement: "primary",
    },
  ],
};
