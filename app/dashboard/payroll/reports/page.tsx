import type { Metadata } from "next";

import { PayrollReportingWorkspace } from "@/modules/payroll/components/payroll-reporting-workspace";

export const metadata: Metadata = {
  title: "Payroll Reports | Hive",
  description:
    "Review payroll readiness, work-entry classifications, reconciliation evidence, and downloadable reports.",
};

export default function PayrollReportsPage() {
  return <PayrollReportingWorkspace />;
}
