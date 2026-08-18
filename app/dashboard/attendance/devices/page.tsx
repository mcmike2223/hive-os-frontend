import type { Metadata } from "next";

import { DeviceManagementWorkspace } from "@/modules/attendance/components/device-management-workspace";

export const metadata: Metadata = {
  title: "Attendance Device Management | Hive",
  description:
    "Monitor device status, connection health, synchronization logs, credentials, and employee mappings.",
};

export default function DeviceManagementPage() {
  return <DeviceManagementWorkspace />;
}
