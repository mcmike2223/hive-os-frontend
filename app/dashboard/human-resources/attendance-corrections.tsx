"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ExternalLink,
  FilePenLine,
  RefreshCw,
  ShieldCheck,
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
import {
  AttendanceCalculation,
  AttendanceCorrectionRequest,
  AttendanceCorrectionType,
  AttendanceEventType,
  AttendanceException,
  Paginated,
} from "@/modules/humanresources/api";
import { attendanceFetch } from "@/modules/attendance/api";

const controlClass =
  "h-11 border-slate-500 focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-cyan-300";
const selectClass =
  "h-11 w-full rounded-md border border-slate-500 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-cyan-300";
const eventLabels: Record<AttendanceEventType, string> = {
  clock_in: "Clock in",
  clock_out: "Clock out",
  break_start: "Start break",
  break_end: "End break",
};
const correctionLabels: Record<AttendanceCorrectionType, string> = {
  add_event: "Add a missing event",
  replace_event: "Replace an incorrect event",
  void_event: "Void an invalid event",
};

function idempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `attendance-correction:${crypto.randomUUID()}`;
  }
  return `attendance-correction:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatDateTime(value: string | null, timezone?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

function toLocalInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function dateTimeFor(date: string) {
  const now = new Date();
  return `${date}T${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function CorrectionError({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [message]);

  return (
    <div
      ref={ref}
      id="attendance-correction-error"
      tabIndex={-1}
      className="rounded-lg border border-red-700 bg-red-50 p-3 text-sm font-semibold text-red-800 outline-none focus-visible:ring-2 focus-visible:ring-red-700 dark:border-red-300 dark:bg-red-950 dark:text-red-200"
    >
      {message}
    </div>
  );
}

function CorrectionDialog({
  open,
  onOpenChange,
  calculations,
  selectedCalculation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calculations: AttendanceCalculation[];
  selectedCalculation: AttendanceCalculation | null;
}) {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const recordHintId = useId();
  const eventHintId = useId();
  const reasonHintId = useId();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    calculation_id: "",
    correction_type: "add_event" as AttendanceCorrectionType,
    target_event_id: "",
    proposed_event_type: "clock_out" as AttendanceEventType,
    proposed_occurred_at: "",
    reason: "",
  });
  const calculation = calculations.find(
    (item) => item.id === Number(form.calculation_id),
  );
  const effectiveEvents = calculation?.result_snapshot.effective_events ?? [];
  const needsTarget = ["replace_event", "void_event"].includes(
    form.correction_type,
  );
  const needsProposedEvent = form.correction_type !== "void_event";

  useEffect(() => {
    if (!open) return;
    const initial = selectedCalculation ?? calculations[0] ?? null;
    setError("");
    setForm({
      calculation_id: initial ? String(initial.id) : "",
      correction_type: "add_event",
      target_event_id: "",
      proposed_event_type: "clock_out",
      proposed_occurred_at: dateTimeFor(
        initial?.attendance_date ?? new Date().toISOString().slice(0, 10),
      ),
      reason: "",
    });
  }, [calculations, open, selectedCalculation]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!calculation) {
        throw new Error(
          "Attendance record: select the calculated workday that needs correction.",
        );
      }
      if (needsTarget && !form.target_event_id) {
        throw new Error(
          "Original event: select the event that should be replaced or voided.",
        );
      }
      if (needsProposedEvent && !form.proposed_occurred_at) {
        throw new Error(
          "Corrected date and time: enter the verified event time.",
        );
      }
      if (form.reason.trim().length < 10) {
        throw new Error(
          "Correction reason: explain the verified issue in at least 10 characters.",
        );
      }

      return attendanceFetch<{ data: AttendanceCorrectionRequest }>(
        "/attendance/correction-requests",
        {
          method: "POST",
          body: JSON.stringify({
            attendance_record_id: calculation.attendance_record_id,
            correction_type: form.correction_type,
            target_event_id: needsTarget
              ? Number(form.target_event_id)
              : undefined,
            proposed_event_type: needsProposedEvent
              ? form.proposed_event_type
              : undefined,
            proposed_occurred_at: needsProposedEvent
              ? new Date(form.proposed_occurred_at).toISOString()
              : undefined,
            reason: form.reason.trim(),
            idempotency_key: idempotencyKey(),
            submit: true,
          }),
        },
      );
    },
    onSuccess: () => {
      toast.success("Attendance correction sent for approval.");
      void queryClient.invalidateQueries({
        queryKey: ["hr-attendance", scope],
      });
      onOpenChange(false);
    },
    onError: (failure) =>
      setError(
        errorMessage(
          failure,
          "The attendance correction could not be sent for approval.",
        ),
      ),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    mutation.mutate();
  };

  const chooseTargetEvent = (eventId: string) => {
    const target = effectiveEvents.find(
      (event) => event.id === Number(eventId),
    );
    setForm((current) => ({
      ...current,
      target_event_id: eventId,
      proposed_event_type: target?.event_type ?? current.proposed_event_type,
      proposed_occurred_at: target
        ? toLocalInput(target.occurred_at)
        : current.proposed_occurred_at,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-500 sm:max-w-2xl dark:border-slate-400">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Request an attendance correction</DialogTitle>
            <DialogDescription>
              Describe the verified change. The original punch remains
              immutable, and the adjustment is applied only after the configured
              Workflow approval finishes.
            </DialogDescription>
          </DialogHeader>

          <div className="my-5 space-y-4">
            {error && <CorrectionError message={error} />}

            <div className="space-y-2">
              <Label htmlFor="correction-record">
                Attendance record <span aria-hidden="true">*</span>
              </Label>
              <select
                id="correction-record"
                value={form.calculation_id}
                onChange={(event) => {
                  const next = calculations.find(
                    (item) => item.id === Number(event.target.value),
                  );
                  setForm((current) => ({
                    ...current,
                    calculation_id: event.target.value,
                    target_event_id: "",
                    proposed_occurred_at: dateTimeFor(
                      next?.attendance_date ??
                        new Date().toISOString().slice(0, 10),
                    ),
                  }));
                }}
                required
                aria-invalid={Boolean(error && !form.calculation_id)}
                aria-describedby={
                  error ? "attendance-correction-error" : recordHintId
                }
                className={selectClass}
              >
                <option value="">Select a calculated workday</option>
                {calculations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.employee?.primary_name ?? "My attendance"} ·{" "}
                    {item.attendance_date} · version {item.version}
                  </option>
                ))}
              </select>
              <p
                id={recordHintId}
                className="text-xs leading-5 text-slate-600 dark:text-slate-300"
              >
                The request is tied to this calculation version and daily
                record.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="correction-type">
                Correction needed <span aria-hidden="true">*</span>
              </Label>
              <select
                id="correction-type"
                value={form.correction_type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    correction_type: event.target
                      .value as AttendanceCorrectionType,
                    target_event_id: "",
                  }))
                }
                required
                className={selectClass}
              >
                {Object.entries(correctionLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {needsTarget && (
              <div className="space-y-2">
                <Label htmlFor="correction-target-event">
                  Original event <span aria-hidden="true">*</span>
                </Label>
                <select
                  id="correction-target-event"
                  value={form.target_event_id}
                  onChange={(event) => chooseTargetEvent(event.target.value)}
                  required
                  aria-invalid={Boolean(error && !form.target_event_id)}
                  aria-describedby={
                    error ? "attendance-correction-error" : eventHintId
                  }
                  className={selectClass}
                >
                  <option value="">Select an event</option>
                  {effectiveEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {eventLabels[event.event_type]} ·{" "}
                      {formatDateTime(
                        event.occurred_at,
                        calculation?.result_snapshot.timezone,
                      )}
                    </option>
                  ))}
                </select>
                <p
                  id={eventHintId}
                  className="text-xs leading-5 text-slate-600 dark:text-slate-300"
                >
                  The original event stays in the audit ledger after approval.
                </p>
              </div>
            )}

            {needsProposedEvent && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="correction-event-type">
                    Corrected event <span aria-hidden="true">*</span>
                  </Label>
                  <select
                    id="correction-event-type"
                    value={form.proposed_event_type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        proposed_event_type: event.target
                          .value as AttendanceEventType,
                      }))
                    }
                    required
                    className={selectClass}
                  >
                    {Object.entries(eventLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="correction-event-time">
                    Corrected date and time <span aria-hidden="true">*</span>
                  </Label>
                  <Input
                    id="correction-event-time"
                    type="datetime-local"
                    value={form.proposed_occurred_at}
                    max={toLocalInput(new Date().toISOString())}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        proposed_occurred_at: event.target.value,
                      }))
                    }
                    required
                    aria-invalid={Boolean(error && !form.proposed_occurred_at)}
                    aria-describedby={
                      error ? "attendance-correction-error" : undefined
                    }
                    className={controlClass}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="correction-reason">
                Verified reason <span aria-hidden="true">*</span>
              </Label>
              <Textarea
                id="correction-reason"
                value={form.reason}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
                required
                minLength={10}
                maxLength={2000}
                aria-invalid={Boolean(error && form.reason.trim().length < 10)}
                aria-describedby={
                  error ? "attendance-correction-error" : reasonHintId
                }
                className="min-h-28 border-slate-500 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-cyan-300"
              />
              <p
                id={reasonHintId}
                className="text-xs leading-5 text-slate-600 dark:text-slate-300"
              >
                Include the source used to verify the change; do not include
                passwords, access codes, or unrelated personal data.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="min-h-11"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="min-h-11"
            >
              <ShieldCheck aria-hidden="true" />
              {mutation.isPending
                ? "Sending for approval…"
                : "Send for approval"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AttendanceCorrections({ date }: { date: string }) {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const { hasAnyPermission, isLoaded } = usePermissions();
  const canSeeTeamCalculations = hasAnyPermission([
    "view_attendance",
    "view_team_attendance",
    "manage_attendance",
    "review_attendance_exceptions",
  ]);
  const canSeeOwnCalculations = hasAnyPermission([
    "view_own_attendance",
    "request_attendance_correction",
    "manage_attendance",
  ]);
  const canRequestCorrection = hasAnyPermission([
    "request_attendance_correction",
    "manage_attendance",
  ]);
  const canSeeCorrectionQueue = hasAnyPermission([
    "view_attendance",
    "manage_attendance",
    "review_attendance_exceptions",
    "approve_attendance_corrections",
  ]);
  const canRecalculate = hasAnyPermission([
    "reprocess_attendance_events",
    "manage_attendance",
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCalculation, setSelectedCalculation] =
    useState<AttendanceCalculation | null>(null);

  const calculations = useQuery({
    queryKey: ["hr-attendance", scope, "calculations", date],
    queryFn: async () => {
      if (canSeeTeamCalculations) {
        return attendanceFetch<Paginated<AttendanceCalculation>>(
          `/attendance/calculations?date=${date}&per_page=100`,
        );
      }
      const mine = await attendanceFetch<{ data: AttendanceCalculation[] }>(
        `/attendance/my-calculations?date=${date}`,
      );
      return {
        data: mine.data,
        meta: {
          current_page: 1,
          last_page: 1,
          total: mine.data.length,
        },
      };
    },
    enabled: isLoaded && (canSeeTeamCalculations || canSeeOwnCalculations),
  });
  const exceptions = useQuery({
    queryKey: ["hr-attendance", scope, "exceptions", date],
    queryFn: () =>
      attendanceFetch<Paginated<AttendanceException>>(
        `/attendance/exceptions?date=${date}&per_page=100`,
      ),
    enabled: isLoaded && canSeeTeamCalculations,
  });
  const corrections = useQuery({
    queryKey: ["hr-attendance", scope, "corrections", date],
    queryFn: async () => {
      if (canSeeCorrectionQueue) {
        return attendanceFetch<Paginated<AttendanceCorrectionRequest>>(
          `/attendance/correction-requests?date=${date}&per_page=100`,
        );
      }
      const mine = await attendanceFetch<{ data: AttendanceCorrectionRequest[] }>(
        `/attendance/my-correction-requests?date=${date}`,
      );
      return {
        data: mine.data,
        meta: {
          current_page: 1,
          last_page: 1,
          total: mine.data.length,
        },
      };
    },
    enabled:
      isLoaded &&
      (canSeeCorrectionQueue || canRequestCorrection || canSeeOwnCalculations),
  });
  const recalculate = useMutation({
    mutationFn: (recordId: number) =>
      attendanceFetch<{ data: AttendanceCalculation }>(
        `/attendance/records/${recordId}/recalculate`,
        { method: "POST" },
      ),
    onSuccess: (response) => {
      toast.success(
        `Attendance recalculated as version ${response.data.version}.`,
      );
      void queryClient.invalidateQueries({
        queryKey: ["hr-attendance", scope],
      });
    },
    onError: (failure) =>
      toast.error(
        errorMessage(
          failure,
          "The attendance record could not be recalculated.",
        ),
      ),
  });

  const calculationRows = calculations.data?.data ?? [];
  const exceptionRows =
    exceptions.data?.data ??
    calculationRows.flatMap((calculation) => calculation.exceptions ?? []);
  const correctionRows = corrections.data?.data ?? [];
  const pendingCorrections = correctionRows.filter(
    (item) => item.status === "submitted",
  ).length;
  const totals = useMemo(
    () => ({
      worked: calculationRows.reduce(
        (sum, item) => sum + item.worked_minutes,
        0,
      ),
      scheduled: calculationRows.reduce(
        (sum, item) => sum + item.scheduled_minutes,
        0,
      ),
    }),
    [calculationRows],
  );

  if (
    isLoaded &&
    !canSeeTeamCalculations &&
    !canSeeOwnCalculations &&
    !canRequestCorrection
  ) {
    return null;
  }

  const openCorrection = (calculation: AttendanceCalculation) => {
    setSelectedCalculation(calculation);
    setDialogOpen(true);
  };

  return (
    <section aria-labelledby="attendance-control-title" className="space-y-4">
      <Card className="overflow-hidden border-slate-500 dark:border-slate-400">
        <CardContent className="p-0">
          <div className="border-b border-slate-500 bg-slate-50 p-5 dark:border-slate-400 dark:bg-slate-950">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-blue-800 dark:text-cyan-200">
                  <Calculator aria-hidden="true" className="h-4 w-4" />
                  Calculation control
                </p>
                <h3
                  id="attendance-control-title"
                  className="mt-1 text-2xl font-black"
                >
                  From calculated time to approved correction
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Every workday has a reproducible calculation version.
                  Exceptions identify what needs attention; approved corrections
                  append adjustments without changing raw punches.
                </p>
              </div>
              {canRequestCorrection && calculationRows.length > 0 && (
                <Button
                  type="button"
                  onClick={() => {
                    setSelectedCalculation(calculationRows[0]);
                    setDialogOpen(true);
                  }}
                  className="min-h-11"
                >
                  <FilePenLine aria-hidden="true" />
                  Request correction
                </Button>
              )}
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Current versions", calculationRows.length],
                ["Detected exceptions", exceptionRows.length],
                ["Pending corrections", pendingCorrections],
                [
                  "Worked / scheduled",
                  `${formatMinutes(totals.worked)} / ${formatMinutes(
                    totals.scheduled,
                  )}`,
                ],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-xl border border-slate-500 bg-white p-3 dark:border-slate-400 dark:bg-slate-900"
                >
                  <dt className="text-xs font-bold uppercase tracking-[0.1em] text-slate-600 dark:text-slate-300">
                    {label}
                  </dt>
                  <dd className="mt-1 text-xl font-black">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableCaption>
                Current attendance calculation versions for {date}, including
                scheduled, worked, break, and variance minutes.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Employee</TableHead>
                  <TableHead scope="col">Version</TableHead>
                  <TableHead scope="col">Scheduled</TableHead>
                  <TableHead scope="col">Worked</TableHead>
                  <TableHead scope="col">Break</TableHead>
                  <TableHead scope="col">Variance</TableHead>
                  <TableHead scope="col">Result</TableHead>
                  <TableHead scope="col">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculationRows.length ? (
                  calculationRows.map((calculation) => (
                    <TableRow key={calculation.id}>
                      <TableCell className="font-semibold">
                        {calculation.employee?.primary_name ?? "My attendance"}
                        {calculation.employee?.employee_number && (
                          <span className="block text-xs font-normal text-slate-600 dark:text-slate-300">
                            {calculation.employee.employee_number}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono">
                        v{calculation.version}
                      </TableCell>
                      <TableCell>
                        {formatMinutes(calculation.scheduled_minutes)}
                      </TableCell>
                      <TableCell>
                        {formatMinutes(calculation.worked_minutes)}
                      </TableCell>
                      <TableCell>
                        {formatMinutes(calculation.break_minutes)}
                      </TableCell>
                      <TableCell className="text-xs leading-5">
                        Late {formatMinutes(calculation.late_minutes)}
                        <br />
                        Early{" "}
                        {formatMinutes(calculation.early_departure_minutes)}
                        <br />
                        Overtime {formatMinutes(calculation.overtime_minutes)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex rounded-full border border-slate-700 bg-slate-50 px-2 py-1 text-xs font-bold capitalize text-slate-900 dark:border-slate-300 dark:bg-slate-900 dark:text-slate-100">
                          {calculation.result_snapshot.status.replaceAll(
                            "_",
                            " ",
                          )}
                        </span>
                        <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">
                          {calculation.exception_count} exception
                          {calculation.exception_count === 1 ? "" : "s"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-40 flex-col gap-2">
                          {canRequestCorrection && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => openCorrection(calculation)}
                              className="min-h-11 justify-start"
                            >
                              <FilePenLine aria-hidden="true" />
                              Correct
                            </Button>
                          )}
                          {canRecalculate && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() =>
                                recalculate.mutate(
                                  calculation.attendance_record_id,
                                )
                              }
                              disabled={recalculate.isPending}
                              className="min-h-11 justify-start"
                            >
                              <RefreshCw
                                aria-hidden="true"
                                className={
                                  recalculate.isPending
                                    ? "animate-spin motion-reduce:animate-none"
                                    : ""
                                }
                              />
                              Recalculate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-10 text-center text-slate-600 dark:text-slate-300"
                    >
                      {calculations.isLoading
                        ? "Calculating attendance…"
                        : "No calculation version is available for this date. A version is created when attendance events are processed."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-slate-500 dark:border-slate-400">
          <CardContent className="p-0">
            <div className="border-b border-slate-500 p-5 dark:border-slate-400">
              <h3 className="flex items-center gap-2 text-xl font-black">
                <AlertTriangle
                  aria-hidden="true"
                  className="h-5 w-5 text-amber-800 dark:text-amber-200"
                />
                Detected exceptions
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Rule results from the current calculation version.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>
                  Current attendance exceptions for {date}, with severity and
                  blocking status.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Employee</TableHead>
                    <TableHead scope="col">Exception</TableHead>
                    <TableHead scope="col">Severity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exceptionRows.length ? (
                    exceptionRows.map((exception) => (
                      <TableRow key={exception.id}>
                        <TableCell className="font-semibold">
                          {exception.employee?.primary_name ?? "My attendance"}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">
                            {exception.code.replaceAll("_", " ")}
                          </span>
                          <span className="mt-1 block max-w-md text-xs leading-5 text-slate-600 dark:text-slate-300">
                            {exception.message}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              exception.severity === "error"
                                ? "inline-flex rounded-full border border-red-700 bg-red-50 px-2 py-1 text-xs font-bold capitalize text-red-900 dark:border-red-300 dark:bg-red-950 dark:text-red-100"
                                : exception.severity === "warning"
                                  ? "inline-flex rounded-full border border-amber-800 bg-amber-50 px-2 py-1 text-xs font-bold capitalize text-amber-950 dark:border-amber-200 dark:bg-amber-950 dark:text-amber-100"
                                  : "inline-flex rounded-full border border-blue-800 bg-blue-50 px-2 py-1 text-xs font-bold capitalize text-blue-950 dark:border-cyan-200 dark:bg-slate-950 dark:text-cyan-100"
                            }
                          >
                            {exception.severity}
                            {exception.is_blocking ? " · blocking" : ""}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="py-10 text-center text-slate-600 dark:text-slate-300"
                      >
                        No exceptions were detected in the current calculation.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-500 dark:border-slate-400">
          <CardContent className="p-0">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-500 p-5 dark:border-slate-400">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-black">
                  <CheckCircle2
                    aria-hidden="true"
                    className="h-5 w-5 text-teal-800 dark:text-teal-200"
                  />
                  Correction approvals
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Requests and final adjustment state for {date}.
                </p>
              </div>
              {canSeeCorrectionQueue && (
                <Button asChild variant="outline" className="min-h-11">
                  <Link href="/dashboard/workflow/approvals">
                    Open approval inbox
                    <ExternalLink aria-hidden="true" />
                  </Link>
                </Button>
              )}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>
                  Attendance correction requests for {date}, including Workflow
                  and application status.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Request</TableHead>
                    <TableHead scope="col">Employee</TableHead>
                    <TableHead scope="col">Change</TableHead>
                    <TableHead scope="col">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {correctionRows.length ? (
                    correctionRows.map((correction) => (
                      <TableRow key={correction.id}>
                        <TableCell className="font-mono text-xs">
                          {correction.correction_number}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {correction.employee?.primary_name ?? "My attendance"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {correctionLabels[correction.correction_type]}
                          {correction.proposed_event_type && (
                            <span className="block text-xs text-slate-600 dark:text-slate-300">
                              {eventLabels[correction.proposed_event_type]} ·{" "}
                              {formatDateTime(correction.proposed_occurred_at)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex rounded-full border border-slate-700 bg-slate-50 px-2 py-1 text-xs font-bold capitalize text-slate-900 dark:border-slate-300 dark:bg-slate-900 dark:text-slate-100">
                            {correction.status.replaceAll("_", " ")}
                          </span>
                          {correction.workflow_status && (
                            <span className="mt-1 block text-xs capitalize text-slate-600 dark:text-slate-300">
                              Workflow {correction.workflow_status}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-10 text-center text-slate-600 dark:text-slate-300"
                      >
                        No correction requests for this date.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <CorrectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        calculations={calculationRows}
        selectedCalculation={selectedCalculation}
      />
    </section>
  );
}
