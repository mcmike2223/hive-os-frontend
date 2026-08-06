"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  Clock3,
  Fingerprint,
  GitPullRequestArrow,
  LogIn,
  LogOut,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { getWorkspaceScopeKey } from "@/lib/runtime-context";
import { LeavePlanWorkspace } from "./leave-plans";
import { LeaveRequestWorkspace } from "./leave-requests";
import { ScheduleDialog } from "./work-schedule-dialog";
import {
  AttendanceRecord,
  AttendanceSummary,
  Employee,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  Paginated,
  WorkSchedule,
  hrFetch,
} from "@/modules/humanresources/api";

const controlClass =
  "h-11 border-slate-500 focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300";
const selectClass =
  "h-11 w-full rounded-md border border-slate-500 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300";
const today = () => new Date().toISOString().slice(0, 10);

function ErrorSummary({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div
      ref={ref}
      id="hr-operations-error"
      tabIndex={-1}
      className="rounded-lg border border-red-700 bg-red-50 p-3 text-sm font-semibold text-red-800 outline-none focus-visible:ring-2 focus-visible:ring-red-700 dark:border-red-300 dark:bg-red-950 dark:text-red-200"
    >
      {message}
    </div>
  );
}

function Field({
  id,
  label,
  required,
  children,
  hint,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </Label>
      {children}
      {hint && (
        <p
          id={`${id}-hint`}
          className="text-xs leading-5 text-slate-600 dark:text-slate-300"
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function RequestLeaveDialog({
  open,
  onOpenChange,
  types,
  employees,
  canChooseEmployee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: LeaveType[];
  employees: Employee[];
  canChooseEmployee: boolean;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    employee_id: "",
    leave_type_id: "",
    starts_on: today(),
    ends_on: today(),
    reason: "",
  });
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setError("");
      setForm({
        employee_id: "",
        leave_type_id: String(types[0]?.id ?? ""),
        starts_on: today(),
        ends_on: today(),
        reason: "",
      });
    }
  }, [open, types]);
  const mutation = useMutation({
    mutationFn: () =>
      hrFetch<{
        data: LeaveRequest;
        workflow?: { status: "pending" | "not_required" };
      }>("/leave/requests", {
        method: "POST",
        body: JSON.stringify({
          employee_id:
            canChooseEmployee && form.employee_id
              ? Number(form.employee_id)
              : null,
          leave_type_id: Number(form.leave_type_id),
          starts_on: form.starts_on,
          ends_on: form.ends_on,
          reason: form.reason || null,
        }),
      }),
    onSuccess: (result) => {
      toast.success(
        result.workflow?.status === "pending"
          ? "Leave request submitted to the approval workflow."
          : "Leave request submitted.",
      );
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["hr-leave"] });
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "The leave request could not be submitted.",
      ),
  });
  const describedBy = error ? "hr-operations-error" : undefined;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Request leave</DialogTitle>
          <DialogDescription>
            Select the employee, statutory or company leave type, and exact
            period. Hive calculates eligible days from the work schedule and
            holidays.
          </DialogDescription>
        </DialogHeader>
        <form
          id="leave-request-form"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            mutation.mutate();
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          {error && (
            <div className="sm:col-span-2">
              <ErrorSummary message={error} />
            </div>
          )}
          {canChooseEmployee && (
            <div className="sm:col-span-2">
              <Field id="leave-employee" label="Employee" required>
                <select
                  id="leave-employee"
                  value={form.employee_id}
                  onChange={(event) =>
                    setForm({ ...form, employee_id: event.target.value })
                  }
                  required
                  aria-invalid={Boolean(error)}
                  aria-describedby={describedBy}
                  className={selectClass}
                >
                  <option value="">Select an employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.primary_name} · {employee.employee_number}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          <div className="sm:col-span-2">
            <Field id="leave-type" label="Leave type" required>
              <select
                id="leave-type"
                value={form.leave_type_id}
                onChange={(event) =>
                  setForm({ ...form, leave_type_id: event.target.value })
                }
                required
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy}
                className={selectClass}
              >
                <option value="">Select a leave type</option>
                {types
                  .filter((type) => type.is_active)
                  .map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                      {type.is_paid ? " · paid" : " · unpaid"}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <Field id="leave-start" label="First day" required>
            <Input
              id="leave-start"
              type="date"
              value={form.starts_on}
              onChange={(event) =>
                setForm({
                  ...form,
                  starts_on: event.target.value,
                  ends_on:
                    event.target.value > form.ends_on
                      ? event.target.value
                      : form.ends_on,
                })
              }
              required
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy}
              className={controlClass}
            />
          </Field>
          <Field id="leave-end" label="Last day" required>
            <Input
              id="leave-end"
              type="date"
              min={form.starts_on}
              value={form.ends_on}
              onChange={(event) =>
                setForm({ ...form, ends_on: event.target.value })
              }
              required
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy}
              className={controlClass}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              id="leave-reason"
              label="Reason"
              hint="Do not include medical details unless HR specifically requires them."
            >
              <Textarea
                id="leave-reason"
                value={form.reason}
                onChange={(event) =>
                  setForm({ ...form, reason: event.target.value })
                }
                maxLength={3000}
                aria-describedby={
                  error
                    ? "leave-reason-hint hr-operations-error"
                    : "leave-reason-hint"
                }
                className="border-slate-500 focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300"
              />
            </Field>
          </div>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="leave-request-form"
            disabled={
              mutation.isPending ||
              !form.leave_type_id ||
              (canChooseEmployee && !form.employee_id)
            }
          >
            {mutation.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestStatus({
  status,
  workflowStatus,
}: {
  status: string;
  workflowStatus?: LeaveRequest["workflow_status"];
}) {
  const label =
    status === "submitted" && workflowStatus === "pending"
      ? "Awaiting workflow"
      : status;
  const styles =
    status === "approved"
      ? "border-emerald-700 bg-emerald-50 text-emerald-800 dark:border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200"
      : status === "submitted"
        ? "border-amber-700 bg-amber-50 text-amber-950 dark:border-amber-300 dark:bg-amber-950 dark:text-amber-100"
        : "border-slate-500 bg-slate-100 text-slate-800 dark:border-slate-400 dark:bg-slate-900 dark:text-slate-200";
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${styles}`}
    >
      {label}
    </span>
  );
}

export function LegacyLeavePanel() {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const { hasAnyPermission, hasPermission, isLoaded } = usePermissions();
  const canRequest = hasAnyPermission([
    "request_leave",
    "manage_leave_requests",
  ]);
  const canManage = hasPermission("manage_leave_requests");
  const canApprove = hasPermission("approve_leave_requests");
  const [dialogOpen, setDialogOpen] = useState(false);
  const types = useQuery({
    queryKey: ["hr-leave-types", scope],
    queryFn: () => hrFetch<{ data: LeaveType[] }>("/leave/types"),
    enabled: isLoaded && canRequest,
  });
  const requests = useQuery({
    queryKey: ["hr-leave", scope, canManage],
    queryFn: () =>
      canManage
        ? hrFetch<Paginated<LeaveRequest>>("/leave/requests?per_page=50")
        : hrFetch<{ data: LeaveRequest[] }>("/leave/my-requests"),
    enabled: isLoaded && canRequest,
  });
  const balances = useQuery({
    queryKey: ["hr-leave-balances", scope],
    queryFn: () => hrFetch<{ data: LeaveBalance[] }>("/leave/balances"),
    enabled: isLoaded && canRequest,
  });
  const employees = useQuery({
    queryKey: ["hr-leave-employees", scope],
    queryFn: () => hrFetch<Paginated<Employee>>("/employees?per_page=100"),
    enabled: isLoaded && canManage,
  });
  const decision = useMutation({
    mutationFn: ({
      id,
      value,
    }: {
      id: number;
      value: "approved" | "rejected";
    }) =>
      hrFetch(`/leave/requests/${id}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision: value }),
      }),
    onSuccess: (_, variables) => {
      toast.success(`Leave request ${variables.value}.`);
      queryClient.invalidateQueries({ queryKey: ["hr-leave"] });
      queryClient.invalidateQueries({ queryKey: ["hr-leave-balances"] });
    },
    onError: (failure) =>
      toast.error(
        failure instanceof Error
          ? failure.message
          : "The decision could not be saved.",
      ),
  });
  const requestRows = requests.data?.data ?? [];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div>
          <h2 className="text-2xl font-black">Leave control</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Balances are ledger-backed; submitted requests reserve entitlement
            until a decision is recorded.
          </p>
        </div>
        {canRequest && (
          <Button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="min-h-11"
          >
            <Plus aria-hidden="true" />
            Request leave
          </Button>
        )}
      </div>
      <LeavePlanWorkspace />
      {balances.data?.data.length ? (
        <section aria-labelledby="leave-balance-heading">
          <h3 id="leave-balance-heading" className="text-base font-black">
            Current entitlement
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {balances.data.data.map((balance) => (
              <Card
                key={balance.id}
                className="border-slate-500 dark:border-slate-500"
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black">{balance.leave_type.name}</p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        {balance.balance_year} balance year
                      </p>
                    </div>
                    <CalendarDays
                      aria-hidden="true"
                      className="text-amber-700 dark:text-amber-300"
                    />
                  </div>
                  <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-500 pt-4 text-center dark:border-slate-600">
                    <div>
                      <dt className="text-xs text-slate-600 dark:text-slate-300">
                        Available
                      </dt>
                      <dd className="mt-1 text-xl font-black">
                        {balance.available_days}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-600 dark:text-slate-300">
                        Reserved
                      </dt>
                      <dd className="mt-1 text-xl font-black">
                        {balance.reserved_days}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-600 dark:text-slate-300">
                        Used
                      </dt>
                      <dd className="mt-1 text-xl font-black">
                        {balance.used_days}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : balances.isError ? (
        <p className="rounded-xl border border-amber-700 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-300 dark:bg-amber-950 dark:text-amber-100">
          Your leave balance is unavailable. HR may need to link your Hive
          account to an employee record.
        </p>
      ) : null}
      <Card className="border-slate-500 dark:border-slate-600">
        <CardContent className="p-0">
          <Table>
            <TableCaption>
              {canManage
                ? "Submitted and decided leave requests across the workforce."
                : "Your submitted and decided leave requests."}
            </TableCaption>
            <TableHeader>
              <TableRow>
                {canManage && <TableHead scope="col">Employee</TableHead>}
                <TableHead scope="col">Leave type</TableHead>
                <TableHead scope="col">Period</TableHead>
                <TableHead scope="col">Days</TableHead>
                <TableHead scope="col">Status</TableHead>
                {canApprove && (
                  <TableHead scope="col" className="text-right">
                    Decision
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {requestRows.length ? (
                requestRows.map((request) => (
                  <TableRow key={request.id}>
                    {canManage && (
                      <TableCell>
                        <span className="font-bold">
                          {request.employee?.primary_name ?? "Unknown employee"}
                        </span>
                        <span className="block text-xs text-slate-600 dark:text-slate-300">
                          {request.employee?.employee_number}
                        </span>
                      </TableCell>
                    )}
                    <TableCell>{request.leave_type.name}</TableCell>
                    <TableCell>
                      {request.starts_on} – {request.ends_on}
                    </TableCell>
                    <TableCell>{request.requested_days}</TableCell>
                    <TableCell>
                      <RequestStatus
                        status={request.status}
                        workflowStatus={request.workflow_status}
                      />
                    </TableCell>
                    {canApprove && (
                      <TableCell className="text-right">
                        {request.status === "submitted" &&
                        request.workflow_status === "pending" ? (
                          <Link
                            href="/dashboard/workflow/approvals"
                            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-teal-700 px-3 py-2 font-bold text-teal-900 outline-none hover:bg-teal-50 focus-visible:ring-2 focus-visible:ring-teal-700 dark:border-teal-300 dark:text-teal-100 dark:hover:bg-teal-950 dark:focus-visible:ring-amber-300"
                          >
                            <GitPullRequestArrow
                              aria-hidden="true"
                              className="h-4 w-4"
                            />
                            Review in Workflow
                          </Link>
                        ) : request.status === "submitted" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                decision.mutate({
                                  id: request.id,
                                  value: "rejected",
                                })
                              }
                              className="min-h-11 border-red-700 text-red-800 dark:border-red-300 dark:text-red-200"
                            >
                              <X aria-hidden="true" />
                              Reject
                            </Button>
                            <Button
                              type="button"
                              onClick={() =>
                                decision.mutate({
                                  id: request.id,
                                  value: "approved",
                                })
                              }
                              className="min-h-11"
                            >
                              <Check aria-hidden="true" />
                              Approve
                            </Button>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={canManage ? (canApprove ? 6 : 5) : 4}
                    className="h-36 text-center"
                  >
                    <span className="font-bold">No leave requests yet</span>
                    <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">
                      New requests will appear here with their approval status.
                    </span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <RequestLeaveDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        types={types.data?.data ?? []}
        employees={employees.data?.data ?? []}
        canChooseEmployee={canManage}
      />
    </div>
  );
}

export function LeavePanel() {
  return (
    <div className="space-y-8">
      <LeaveRequestWorkspace />
      <LeavePlanWorkspace />
    </div>
  );
}

export function LegacyAttendancePanel() {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const { hasAnyPermission, hasPermission, isLoaded } = usePermissions();
  const canView = hasAnyPermission(["view_attendance", "manage_attendance"]);
  const canManage = hasPermission("manage_attendance");
  const canPunch = hasAnyPermission(["record_attendance", "manage_attendance"]);
  const canSchedules = hasPermission("manage_work_schedules");
  const [date, setDate] = useState(today());
  const [employeeId, setEmployeeId] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const summary = useQuery({
    queryKey: ["hr-attendance-summary", scope, date],
    queryFn: () =>
      hrFetch<{ data: AttendanceSummary }>(`/attendance/summary?date=${date}`),
    enabled: isLoaded && canView,
  });
  const records = useQuery({
    queryKey: ["hr-attendance-records", scope, date],
    queryFn: async () => {
      if (canView)
        return hrFetch<Paginated<AttendanceRecord>>(
          `/attendance/records?date=${date}&per_page=100`,
        );
      const own = await hrFetch<{ data: AttendanceRecord[] }>(
        `/attendance/my-records?date=${date}`,
      );
      return {
        data: own.data,
        meta: { current_page: 1, last_page: 1, total: own.data.length },
      };
    },
    enabled: isLoaded && (canView || canPunch),
  });
  const schedules = useQuery({
    queryKey: ["hr-schedules", scope],
    queryFn: () => hrFetch<{ data: WorkSchedule[] }>("/work-schedules"),
    enabled: isLoaded && canView,
  });
  const employees = useQuery({
    queryKey: ["hr-attendance-employees", scope],
    queryFn: () => hrFetch<Paginated<Employee>>("/employees?per_page=100"),
    enabled: isLoaded && canManage,
  });
  const punch = useMutation({
    mutationFn: (event_type: "clock_in" | "clock_out") =>
      hrFetch("/attendance/punch", {
        method: "POST",
        body: JSON.stringify({
          employee_id: canManage && employeeId ? Number(employeeId) : null,
          event_type,
          occurred_at: new Date().toISOString(),
          source: canManage ? "manual" : "self_service",
        }),
      }),
    onSuccess: (_, eventType) => {
      toast.success(
        eventType === "clock_in" ? "Clock-in recorded." : "Clock-out recorded.",
      );
      queryClient.invalidateQueries({ queryKey: ["hr-attendance"] });
    },
    onError: (failure) =>
      toast.error(
        failure instanceof Error
          ? failure.message
          : "The attendance event could not be recorded.",
      ),
  });
  const ownRecords = records.data?.data ?? [];
  const metrics = summary.data?.data ?? {
    date,
    scheduled: ownRecords.length ? 1 : 0,
    recorded: ownRecords.length,
    absent: 0,
    present: ownRecords.filter((record) => record.status === "present").length,
    exceptions: ownRecords.filter((record) =>
      ["exception", "incomplete"].includes(record.status),
    ).length,
    late: ownRecords.filter((record) => record.late_minutes > 0).length,
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div>
          <h2 className="text-2xl font-black">Attendance operations</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Idempotent punches feed daily records; exceptions remain visible
            until HR reviews them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSchedules && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setScheduleOpen(true)}
              className="min-h-11"
            >
              <Clock3 aria-hidden="true" />
              Add schedule
            </Button>
          )}
          {canPunch && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => punch.mutate("clock_in")}
                disabled={punch.isPending || (canManage && !employeeId)}
                className="min-h-11"
              >
                <LogIn aria-hidden="true" />
                Clock in
              </Button>
              <Button
                type="button"
                onClick={() => punch.mutate("clock_out")}
                disabled={punch.isPending || (canManage && !employeeId)}
                className="min-h-11"
              >
                <LogOut aria-hidden="true" />
                Clock out
              </Button>
            </>
          )}
        </div>
      </div>
      {canManage && (
        <div className="max-w-md">
          <Field
            id="attendance-employee"
            label="Employee for manual punch"
            required
          >
            <select
              id="attendance-employee"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              className={selectClass}
            >
              <option value="">Select an employee</option>
              {employees.data?.data.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.primary_name} · {employee.employee_number}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Scheduled", metrics?.scheduled ?? 0],
          ["Present", metrics?.present ?? 0],
          ["Exceptions", metrics?.exceptions ?? 0],
          ["Absent", metrics?.absent ?? 0],
        ].map(([label, value]) => (
          <Card
            key={String(label)}
            className="border-slate-500 dark:border-slate-500"
          >
            <CardContent className="p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                {label}
              </p>
              <p className="mt-2 text-3xl font-black">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-slate-500 dark:border-slate-600">
        <CardContent className="p-0">
          <div className="border-b border-slate-500 p-4 dark:border-slate-600">
            <Field id="attendance-date" label="Attendance date">
              <Input
                id="attendance-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={`${controlClass} max-w-52`}
              />
            </Field>
          </div>
          <Table>
            <TableCaption>
              Attendance records for {date}, including worked time and
              exceptions.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Employee</TableHead>
                <TableHead scope="col">First in</TableHead>
                <TableHead scope="col">Last out</TableHead>
                <TableHead scope="col">Worked</TableHead>
                <TableHead scope="col">Late</TableHead>
                <TableHead scope="col">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.data?.data.length ? (
                records.data.data.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <span className="font-bold">
                        {record.employee.primary_name}
                      </span>
                      <span className="block text-xs text-slate-600 dark:text-slate-300">
                        {record.employee.employee_number}
                      </span>
                    </TableCell>
                    <TableCell>
                      {record.first_in_at
                        ? new Date(record.first_in_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {record.last_out_at
                        ? new Date(record.last_out_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {Math.floor(record.worked_minutes / 60)}h{" "}
                      {record.worked_minutes % 60}m
                    </TableCell>
                    <TableCell>{record.late_minutes} min</TableCell>
                    <TableCell>
                      <RequestStatus status={record.status} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-36 text-center">
                    <Fingerprint
                      aria-hidden="true"
                      className="mx-auto mb-2 text-slate-500"
                    />
                    <span className="font-bold">
                      No attendance events for this date
                    </span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {schedules.data?.data.length ? (
        <section aria-labelledby="schedule-list-heading">
          <h3 id="schedule-list-heading" className="text-base font-black">
            Active work schedules
          </h3>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {schedules.data.data.map((schedule) => (
              <li
                key={schedule.id}
                className="rounded-xl border border-slate-500 p-4 dark:border-slate-500"
              >
                <p className="font-black">{schedule.name}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {schedule.starts_at.slice(0, 5)}–
                  {schedule.ends_at.slice(0, 5)} · {schedule.weekly_hours}{" "}
                  hours/week
                </p>
                <p className="mt-2 text-xs font-semibold">
                  {schedule.working_days.length} working days ·{" "}
                  {schedule.grace_minutes} min grace
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        employees={employees.data?.data ?? []}
      />
    </div>
  );
}

export { AttendanceWorkspace as AttendancePanel } from "@/modules/attendance/components/attendance-workspace";
