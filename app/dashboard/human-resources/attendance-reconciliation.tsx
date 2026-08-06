"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarCheck2,
  GitCompareArrows,
  LockKeyhole,
  RefreshCw,
  TriangleAlert,
  Umbrella,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getWorkspaceScopeKey } from "@/lib/runtime-context";
import {
  Employee,
  WorkforceReconciliationDay,
  WorkforceReconciliationPage,
  WorkforceReconciliationRun,
  WorkforceReconciliationStatus,
} from "@/modules/humanresources/api";
import { attendanceFetch } from "@/modules/attendance/api";

const selectClass =
  "h-11 w-full rounded-md border border-slate-500 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-cyan-300";

const statusLabels: Record<WorkforceReconciliationStatus, string> = {
  aligned: "Aligned",
  review_required: "Review required",
  payroll_protected: "Payroll protected",
  future_preview: "Future preview",
  no_context: "No source context",
};

const statusClasses: Record<WorkforceReconciliationStatus, string> = {
  aligned:
    "border-teal-800 bg-teal-50 text-teal-950 dark:border-teal-200 dark:bg-teal-950 dark:text-teal-100",
  review_required:
    "border-amber-800 bg-amber-50 text-amber-950 dark:border-amber-200 dark:bg-amber-950 dark:text-amber-100",
  payroll_protected:
    "border-blue-800 bg-blue-50 text-blue-950 dark:border-cyan-200 dark:bg-slate-950 dark:text-cyan-100",
  future_preview:
    "border-slate-700 bg-slate-50 text-slate-950 dark:border-slate-300 dark:bg-slate-900 dark:text-slate-100",
  no_context:
    "border-slate-700 bg-slate-50 text-slate-950 dark:border-slate-300 dark:bg-slate-900 dark:text-slate-100",
};

function idempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `workforce-reconciliation:${crypto.randomUUID()}`;
  }

  return `workforce-reconciliation:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "The reconciliation evidence could not be loaded.";
}

function scheduleSource(day: WorkforceReconciliationDay) {
  const source = day.explanation.context.schedule_resolution?.source_type;
  const sourceLabel = source
    ? source.replaceAll("_", " ")
    : "no resolved source";

  return day.work_schedule
    ? `${day.work_schedule.name} · ${sourceLabel}`
    : sourceLabel;
}

function coverageSource(day: WorkforceReconciliationDay) {
  if (day.leave_request) {
    return `${day.leave_request.leave_type?.name ?? "Approved leave"} · ${formatMinutes(day.leave_minutes)}`;
  }
  if (day.holiday) {
    return `${day.holiday.name} · ${day.holiday.is_paid ? "paid" : "unpaid"}`;
  }

  return "No leave or holiday";
}

function StatusBadge({ status }: { status: WorkforceReconciliationStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-xs font-black ${statusClasses[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

export function AttendanceReconciliation({
  date,
  employees,
  canReconcile,
}: {
  date: string;
  employees: Employee[];
  canReconcile: boolean;
}) {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const hintId = useId();
  const [employeeId, setEmployeeId] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!employeeId && employees.length > 0) {
      setEmployeeId(String(employees[0].id));
    }
  }, [employeeId, employees]);

  const evidence = useQuery({
    queryKey: ["hr-attendance", scope, "reconciliation", date, showHistory],
    queryFn: () => {
      const params = new URLSearchParams({
        starts_on: date,
        ends_on: date,
        per_page: "50",
      });
      if (showHistory) {
        params.set("include_history", "1");
      }
      return attendanceFetch<WorkforceReconciliationPage>(
        `/attendance/reconciliation?${params.toString()}`,
      );
    },
  });

  const reconcile = useMutation({
    mutationFn: () => {
      if (!employeeId) {
        throw new Error("Select an employee before starting reconciliation.");
      }

      return attendanceFetch<{ data: WorkforceReconciliationRun }>(
        "/attendance/reconciliation",
        {
          method: "POST",
          body: JSON.stringify({
            employee_id: Number(employeeId),
            starts_on: date,
            ends_on: date,
            idempotency_key: idempotencyKey(),
          }),
        },
      );
    },
    onSuccess: (response) => {
      const day = response.data.days[0];
      toast.success(
        day
          ? `Reconciliation complete: ${statusLabels[day.status]}.`
          : "Reconciliation completed.",
      );
      void queryClient.invalidateQueries({
        queryKey: ["hr-attendance", scope],
      });
    },
    onError: (failure) => toast.error(errorMessage(failure)),
  });

  const rows = evidence.data?.data ?? [];
  const summary = evidence.data?.meta.summary ?? {
    aligned: 0,
    review_required: 0,
    payroll_protected: 0,
    future_preview: 0,
    no_context: 0,
  };
  const total = evidence.data?.meta.total ?? 0;
  const latestProof = useMemo(() => rows[0] ?? null, [rows]);

  return (
    <Card className="border-slate-500 dark:border-slate-400">
      <CardContent className="p-0">
        <div className="grid gap-5 border-b border-slate-500 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] xl:items-end dark:border-slate-400">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-blue-800 dark:text-cyan-200">
              <GitCompareArrows aria-hidden="true" className="h-4 w-4" />
              Cross-source proof
            </p>
            <h3 className="mt-1 text-xl font-black">Source reconciliation</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Verify how the effective schedule, approved leave or holiday, and
              attendance events produced the payable result for {date}.
            </p>
          </div>

          {canReconcile && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="reconciliation-employee">Employee</Label>
                <select
                  id="reconciliation-employee"
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  aria-describedby={hintId}
                  className={selectClass}
                >
                  <option value="">Select an employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.primary_name} · {employee.employee_number}
                    </option>
                  ))}
                </select>
                <p
                  id={hintId}
                  className="text-xs leading-5 text-slate-600 dark:text-slate-300"
                >
                  Reconciliation creates a new immutable version only when the
                  effective sources changed.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => reconcile.mutate()}
                disabled={!employeeId || reconcile.isPending}
                className="min-h-11 w-full"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={
                    reconcile.isPending
                      ? "animate-spin motion-reduce:animate-none"
                      : undefined
                  }
                />
                {reconcile.isPending
                  ? "Reconciling…"
                  : "Reconcile selected date"}
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-px border-b border-slate-500 bg-slate-500 sm:grid-cols-2 xl:grid-cols-4 dark:border-slate-400 dark:bg-slate-400">
          {[
            {
              label: showHistory ? "Evidence entries" : "Current days",
              value: total,
              icon: CalendarCheck2,
            },
            { label: "Aligned", value: summary.aligned, icon: Umbrella },
            {
              label: "Needs review",
              value: summary.review_required,
              icon: TriangleAlert,
            },
            {
              label: "Payroll protected",
              value: summary.payroll_protected,
              icon: LockKeyhole,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 bg-white p-4 dark:bg-slate-950"
            >
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-600 dark:text-slate-300">
                  {label}
                </p>
                <p className="mt-1 text-2xl font-black">{value}</p>
              </div>
              <Icon
                aria-hidden="true"
                className="h-5 w-5 text-blue-800 dark:text-cyan-200"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-500 px-5 py-3 dark:border-slate-400">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {showHistory
              ? "Showing full audit history. Payroll uses only current days."
              : "Showing the current outcome per employee for this date."}
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setShowHistory((current) => !current)}
          >
            {showHistory ? "Show current only" : "Show history"}
          </Button>
        </div>

        {latestProof && (
          <div className="border-b border-slate-500 bg-blue-50 px-5 py-4 text-sm dark:border-slate-400 dark:bg-slate-950">
            <p className="font-black">Latest proof line</p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-slate-700 dark:text-slate-200">
              <span>Schedule: {scheduleSource(latestProof)}</span>
              <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>Leave / holiday: {coverageSource(latestProof)}</span>
              <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>
                Attendance: {formatMinutes(latestProof.worked_minutes)} worked
              </span>
              <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>Outcome: {statusLabels[latestProof.status]}</span>
            </p>
          </div>
        )}

        {evidence.isError ? (
          <div
            role="alert"
            className="m-5 rounded-lg border border-red-700 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-300 dark:bg-red-950 dark:text-red-200"
          >
            {errorMessage(evidence.error)}
          </div>
        ) : (
          <Table>
            <TableCaption>
              {showHistory
                ? `Reconciliation history for ${date}, newest first. Superseded rows are ignored by payroll.`
                : `Current reconciliation outcome for ${date}.`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Employee</TableHead>
                <TableHead scope="col">Schedule source</TableHead>
                <TableHead scope="col">Leave / holiday</TableHead>
                <TableHead scope="col">Expected</TableHead>
                <TableHead scope="col">Worked</TableHead>
                <TableHead scope="col">Payable</TableHead>
                <TableHead scope="col">Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length > 0 ? (
                rows.map((day) => (
                  <TableRow
                    key={day.id}
                    className={
                      showHistory && !day.is_current
                        ? "opacity-60"
                        : undefined
                    }
                  >
                    <TableCell className="font-semibold">
                      {day.employee.primary_name}
                      <span className="block text-xs font-normal text-slate-600 dark:text-slate-300">
                        {day.employee.employee_number} · {day.work_date}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-64 whitespace-normal">
                      {scheduleSource(day)}
                    </TableCell>
                    <TableCell className="max-w-64 whitespace-normal">
                      {coverageSource(day)}
                    </TableCell>
                    <TableCell>
                      {formatMinutes(day.expected_work_minutes)}
                    </TableCell>
                    <TableCell>{formatMinutes(day.worked_minutes)}</TableCell>
                    <TableCell>{formatMinutes(day.payable_minutes)}</TableCell>
                    <TableCell>
                      <StatusBadge status={day.status} />
                      <span className="mt-1 block text-xs capitalize text-slate-600 dark:text-slate-300">
                        {day.action.replaceAll("_", " ")}
                        {showHistory && !day.is_current
                          ? " · superseded"
                          : ""}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-slate-600 dark:text-slate-300"
                  >
                    {evidence.isLoading
                      ? "Loading reconciliation evidence…"
                      : "No reconciliation evidence exists for this date yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
