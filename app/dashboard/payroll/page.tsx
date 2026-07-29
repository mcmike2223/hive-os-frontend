import type { Metadata } from "next";

import { PayrollWorkspace } from "@/modules/payroll/components/payroll-workspace";

export const metadata: Metadata = {
  title: "Payroll Management | Hive",
  description:
    "Generate traceable payroll work entries, reconcile attendance and leave, finalize and lock periods, and queue adjustments.",
};

export default function PayrollPage() {
  return <PayrollWorkspace />;
}
