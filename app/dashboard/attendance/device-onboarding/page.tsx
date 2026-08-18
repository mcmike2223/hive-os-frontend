import type { Metadata } from "next";

import { DeviceOnboardingWorkspace } from "@/modules/attendance/components/device-onboarding-workspace";

export const metadata: Metadata = {
  title: "Attendance Device Onboarding | Hive",
  description:
    "Register, setup, test, and onboard biometric attendance devices and connectors with tenant isolation.",
};

export default function DeviceOnboardingPage() {
  return <DeviceOnboardingWorkspace />;
}
