"use client";

import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coffee,
  Fingerprint,
  History,
  LogIn,
  LogOut,
  Plus,
  Radio,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { AttendanceCorrections } from "@/app/dashboard/human-resources/attendance-corrections";
import { AttendanceCaptureWorkspace } from "@/app/dashboard/human-resources/attendance-capture-workspace";
import { AttendanceReconciliation } from "@/app/dashboard/human-resources/attendance-reconciliation";
import { ScheduleWorkspace } from "@/app/dashboard/human-resources/schedule-workspace";
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
import { initEcho } from "@/lib/echo";
import {
  getAccessToken,
  getTenantId,
  getWorkspaceScopeKey,
} from "@/lib/runtime-context";
import {
  AttendanceEvent,
  AttendanceEventType,
  AttendanceRecord,
  AttendanceSelfServiceStatus,
  AttendanceSummary,
  Employee,
  Paginated,
} from "@/modules/humanresources/api";
import { attendanceFetch } from "@/modules/attendance/api";

const controlClass =
  "h-11 border-slate-500 focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-cyan-300";
const selectClass =
  "h-11 w-full rounded-md border border-slate-500 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-cyan-300";
const today = () => new Date().toISOString().slice(0, 10);
const eventLabels: Record<AttendanceEventType, string> = {
  clock_in: "Clock in",
  clock_out: "Clock out",
  break_start: "Start break",
  break_end: "End break",
};
const stateLabels: Record<AttendanceSelfServiceStatus["state"], string> = {
  off_duty: "Off duty",
  on_duty: "On duty",
  on_break: "On break",
};

type EchoPrivateChannel = {
  listen: (
    event: string,
    callback: (payload: { resource?: string; occurred_at?: string }) => void,
  ) => EchoPrivateChannel;
  subscription?: {
    bind: (event: string, callback: () => void) => void;
    unbind: (event: string, callback: () => void) => void;
  };
};

function localDateTime(date: string) {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${date}T${hours}:${minutes}`;
}

function idempotencyKey(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}:${crypto.randomUUID()}`;
  }
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function formatTime(value: string | null, timezone?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function ErrorSummary({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [message]);

  return (
    <div
      ref={ref}
      id="attendance-form-error"
      tabIndex={-1}
      className="rounded-lg border border-red-700 bg-red-50 p-3 text-sm font-semibold text-red-800 outline-none focus-visible:ring-2 focus-visible:ring-red-700 dark:border-red-300 dark:bg-red-950 dark:text-red-200"
    >
      {message}
    </div>
  );
}

function ManualAttendanceDialog({
  open,
  onOpenChange,
  employees,
  selectedDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  selectedDate: string;
}) {
  const queryClient = useQueryClient();
  const scope = getWorkspaceScopeKey();
  const hintId = useId();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    employee_id: "",
    event_type: "clock_in" as AttendanceEventType,
    occurred_at: localDateTime(selectedDate),
    reason: "",
  });

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm({
      employee_id: "",
      event_type: "clock_in",
      occurred_at: localDateTime(selectedDate),
      reason: "",
    });
  }, [open, selectedDate]);

  const mutation = useMutation({
    mutationFn: () => {
      const occurredAt = new Date(form.occurred_at);
      if (!form.employee_id) {
        throw new Error(
          "Employee: select the employee for this attendance event.",
        );
      }
      if (!form.occurred_at || Number.isNaN(occurredAt.getTime())) {
        throw new Error("Event date and time: enter a valid date and time.");
      }

      const key = idempotencyKey("manual-attendance");
      return attendanceFetch<{ data: AttendanceEvent; meta: { duplicate: boolean } }>(
        "/attendance/manual-events",
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify({
            employee_id: Number(form.employee_id),
            event_type: form.event_type,
            occurred_at: occurredAt.toISOString(),
            source_timezone:
              Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            idempotency_key: key,
            metadata: form.reason.trim()
              ? { reason: form.reason.trim() }
              : undefined,
          }),
        },
      );
    },
    onSuccess: (response) => {
      toast.success(
        response.meta.duplicate
          ? "This attendance event was already recorded."
          : `${eventLabels[form.event_type]} recorded.`,
      );
      void queryClient.invalidateQueries({
        queryKey: ["hr-attendance", scope],
      });
      onOpenChange(false);
    },
    onError: (failure) =>
      setError(
        errorMessage(
          failure,
          "The manual attendance event could not be recorded.",
        ),
      ),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-500 sm:max-w-xl dark:border-slate-400">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Record manual attendance</DialogTitle>
            <DialogDescription>
              Add a verified punch without changing or deleting the raw event
              later. Corrections use a separate audited process.
            </DialogDescription>
          </DialogHeader>

          <div className="my-5 space-y-4">
            {error && <ErrorSummary message={error} />}

            <div className="space-y-2">
              <Label htmlFor="manual-attendance-employee">
                Employee <span aria-hidden="true">*</span>
              </Label>
              <select
                id="manual-attendance-employee"
                value={form.employee_id}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    employee_id: event.target.value,
                  }))
                }
                required
                aria-invalid={Boolean(error && !form.employee_id)}
                aria-describedby={error ? "attendance-form-error" : hintId}
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
                The event is stored under this employee and the active tenant.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manual-attendance-event">
                  Event <span aria-hidden="true">*</span>
                </Label>
                <select
                  id="manual-attendance-event"
                  value={form.event_type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      event_type: event.target.value as AttendanceEventType,
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
                <Label htmlFor="manual-attendance-time">
                  Event date and time <span aria-hidden="true">*</span>
                </Label>
                <Input
                  id="manual-attendance-time"
                  type="datetime-local"
                  value={form.occurred_at}
                  max={localDateTime(today())}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      occurred_at: event.target.value,
                    }))
                  }
                  required
                  aria-invalid={Boolean(error && !form.occurred_at)}
                  aria-describedby={error ? "attendance-form-error" : undefined}
                  className={controlClass}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-attendance-reason">
                Verification note
              </Label>
              <Textarea
                id="manual-attendance-reason"
                value={form.reason}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
                maxLength={500}
                placeholder="For example: verified from the signed gate register"
                className="min-h-24 border-slate-500 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-cyan-300"
              />
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
              <CheckCircle2 aria-hidden="true" />
              {mutation.isPending ? "Recording…" : "Record event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WorkdayRail({ status }: { status: AttendanceSelfServiceStatus }) {
  return (
    <ol className="mt-5 space-y-0" aria-label="Today’s attendance events">
      {status.events.length === 0 ? (
        <li className="rounded-xl border border-dashed border-slate-500 p-4 text-sm text-slate-700 dark:border-slate-400 dark:text-slate-200">
          No punches yet. Clock in when your workday starts.
        </li>
      ) : (
        status.events.map((event, index) => (
          <li
            key={event.event_uuid}
            className="relative grid grid-cols-[2.25rem_1fr] gap-3"
          >
            <div className="flex flex-col items-center" aria-hidden="true">
              <span className="mt-1 h-3 w-3 rounded-full border-2 border-teal-800 bg-teal-50 dark:border-teal-200 dark:bg-teal-950" />
              {index < status.events.length - 1 && (
                <span className="min-h-9 w-0.5 flex-1 bg-slate-500 dark:bg-slate-400" />
              )}
            </div>
            <div className="pb-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold">{eventLabels[event.event_type]}</p>
                <time
                  dateTime={event.occurred_at}
                  className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200"
                >
                  {formatTime(event.occurred_at, status.timezone)}
                </time>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {event.source === "manual"
                  ? "Recorded by an attendance manager"
                  : "Recorded through self-service"}{" "}
                · {event.processing_status}
              </p>
            </div>
          </li>
        ))
      )}
    </ol>
  );
}

export function AttendanceWorkspace({
  onAddSchedule,
}: {
  onAddSchedule?: () => void;
}) {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const { hasAnyPermission, hasPermission, isLoaded } = usePermissions();
  const canView = hasAnyPermission([
    "view_attendance",
    "view_team_attendance",
    "manage_attendance",
  ]);
  const canManage = hasAnyPermission([
    "record_team_attendance",
    "manage_attendance",
  ]);
  const canViewReconciliation = hasAnyPermission([
    "view_own_attendance",
    "record_own_attendance",
    "record_attendance",
    "view_team_attendance",
    "view_attendance",
    "manage_attendance",
    "view_workforce_audit",
  ]);
  const canReconcile = hasAnyPermission([
    "reprocess_attendance_events",
    "manage_attendance",
  ]);
  const canViewCapture = hasAnyPermission([
    "view_attendance_devices",
    "manage_attendance_devices",
    "manage_attendance_credentials",
    "operate_attendance_kiosk",
    "view_attendance_capture_audit",
    "manage_attendance",
  ]);
  const canPunch = hasAnyPermission([
    "record_attendance",
    "record_own_attendance",
    "manage_attendance",
  ]);
  const canSchedules = hasPermission("manage_work_schedules");
  const canViewSchedules = hasAnyPermission([
    "view_own_schedule",
    "view_team_time",
    "manage_work_schedules",
    "manage_schedule_templates",
    "manage_team_rosters",
    "request_shift_swap",
  ]);
  const [date, setDate] = useState(today());
  const [manualOpen, setManualOpen] = useState(false);
  const [eventEmployeeId, setEventEmployeeId] = useState("");
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastLiveUpdate, setLastLiveUpdate] = useState<string | null>(null);
  const refreshTimer = useRef<number | null>(null);
  const statusMessageId = useId();

  const summary = useQuery({
    queryKey: ["hr-attendance", scope, "summary", date],
    queryFn: () =>
      attendanceFetch<{ data: AttendanceSummary }>(`/attendance/summary?date=${date}`),
    enabled: isLoaded && canView,
    refetchInterval: realtimeConnected ? 60_000 : 15_000,
  });
  const records = useQuery({
    queryKey: ["hr-attendance", scope, "records", date, canView],
    queryFn: async () => {
      if (canView) {
        return attendanceFetch<Paginated<AttendanceRecord>>(
          `/attendance/records?date=${date}&per_page=100`,
        );
      }
      const mine = await attendanceFetch<{ data: AttendanceRecord[] }>(
        `/attendance/my-records?date=${date}`,
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
    enabled: isLoaded && (canView || canPunch),
    refetchInterval: realtimeConnected ? 60_000 : 15_000,
  });
  const selfStatus = useQuery({
    queryKey: ["hr-attendance", scope, "self-status", date],
    queryFn: () =>
      attendanceFetch<{ data: AttendanceSelfServiceStatus }>(
        `/attendance/self-service/status?date=${date}`,
      ),
    enabled: isLoaded && canPunch,
    retry: false,
    refetchInterval: realtimeConnected ? 60_000 : 15_000,
  });
  const events = useQuery({
    queryKey: [
      "hr-attendance",
      scope,
      "events",
      date,
      eventEmployeeId,
      canView,
    ],
    queryFn: async () => {
      if (canView) {
        const employeeFilter = eventEmployeeId
          ? `&employee_id=${eventEmployeeId}`
          : "";
        return attendanceFetch<Paginated<AttendanceEvent>>(
          `/attendance/events?date=${date}&per_page=100${employeeFilter}`,
        );
      }
      const mine = await attendanceFetch<{ data: AttendanceEvent[] }>(
        `/attendance/my-events?date=${date}`,
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
    enabled: isLoaded && (canView || canPunch),
    refetchInterval: realtimeConnected ? 60_000 : 15_000,
  });
  const employees = useQuery({
    queryKey: ["hr-attendance", scope, "employees"],
    queryFn: () => attendanceFetch<Paginated<Employee>>("/employees?per_page=100"),
    enabled: isLoaded && (canManage || canReconcile || canViewCapture),
  });

  useEffect(() => {
    const token =
      getAccessToken() ||
      (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    if (!token) return;

    const echo = initEcho(token);
    const tenantId = getTenantId();
    const channelName = tenantId ? `tenant.${tenantId}.hr` : "hr";
    const channel = echo.private(channelName) as unknown as EchoPrivateChannel;
    const subscribed = () => setRealtimeConnected(true);
    const subscriptionError = () => setRealtimeConnected(false);
    channel.subscription?.bind("pusher:subscription_succeeded", subscribed);
    channel.subscription?.bind("pusher:subscription_error", subscriptionError);

    const liveUpdate = (event: { resource?: string; occurred_at?: string }) => {
      if (
        event.resource &&
        !["attendance_record", "attendance_event"].includes(event.resource)
      ) {
        return;
      }
      setLastLiveUpdate(event.occurred_at ?? new Date().toISOString());
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: ["hr-attendance", scope],
        });
      }, 250);
    };
    channel.listen(".hr.updated", liveUpdate);

    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      channel.subscription?.unbind("pusher:subscription_succeeded", subscribed);
      channel.subscription?.unbind(
        "pusher:subscription_error",
        subscriptionError,
      );
      echo.leave(channelName);
      setRealtimeConnected(false);
    };
  }, [queryClient, scope]);

  const punch = useMutation({
    mutationFn: (eventType: AttendanceEventType) => {
      const key = idempotencyKey("self-attendance");
      return attendanceFetch<{ data: AttendanceEvent; meta: { duplicate: boolean } }>(
        "/attendance/self-service/events",
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify({
            event_type: eventType,
            occurred_at: new Date().toISOString(),
            source_timezone:
              Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            idempotency_key: key,
          }),
        },
      );
    },
    onSuccess: (response, eventType) => {
      toast.success(
        response.meta.duplicate
          ? "This attendance event was already recorded."
          : `${eventLabels[eventType]} recorded.`,
      );
      void queryClient.invalidateQueries({
        queryKey: ["hr-attendance", scope],
      });
    },
    onError: (failure) =>
      toast.error(
        errorMessage(failure, "The attendance event could not be recorded."),
      ),
  });

  const recordRows = records.data?.data ?? [];
  const eventRows = events.data?.data ?? [];
  const ownStatus = selfStatus.data?.data;
  const metrics = summary.data?.data ?? {
    date,
    scheduled: recordRows.length ? 1 : 0,
    recorded: recordRows.length,
    absent: 0,
    present: recordRows.filter((record) => record.status === "present").length,
    exceptions: recordRows.filter((record) =>
      ["exception", "incomplete"].includes(record.status),
    ).length,
    late: recordRows.filter((record) => record.late_minutes > 0).length,
  };
  const newestSync = useMemo(
    () =>
      lastLiveUpdate
        ? new Intl.DateTimeFormat(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(new Date(lastLiveUpdate))
        : null,
    [lastLiveUpdate],
  );
  const metricCards: Array<{
    label: string;
    value: number;
    icon: LucideIcon;
  }> = [
    { label: "Scheduled", value: metrics.scheduled, icon: Clock3 },
    { label: "Present", value: metrics.present, icon: UserRoundCheck },
    { label: "Exceptions", value: metrics.exceptions, icon: Activity },
    { label: "Unrecorded", value: metrics.absent, icon: ShieldCheck },
  ];

  if (
    isLoaded &&
    !canView &&
    !canPunch &&
    !canViewReconciliation &&
    !canViewCapture &&
    canViewSchedules
  ) {
    return <ScheduleWorkspace />;
  }

  if (
    isLoaded &&
    !canView &&
    !canPunch &&
    !canViewReconciliation &&
    !canViewCapture
  ) {
    return (
      <Card className="border-slate-500 dark:border-slate-400">
        <CardContent className="p-6">
          <h2 className="text-xl font-black">Attendance</h2>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
            Your role does not include attendance access. Ask an administrator
            to assign an attendance permission.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section aria-labelledby="attendance-workspace-title" className="space-y-5">
      <header className="overflow-hidden rounded-2xl border border-blue-700 bg-blue-50 p-5 text-slate-950 dark:border-cyan-300 dark:bg-slate-950 dark:text-slate-50">
        <div className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-blue-800 dark:text-cyan-200">
              <Fingerprint aria-hidden="true" className="h-4 w-4" />
              Workforce time
            </p>
            <h2
              id="attendance-workspace-title"
              className="mt-2 text-3xl font-black tracking-tight"
            >
              Attendance, from punch to proof
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-200">
              Record the workday, see the normalized event trail, and review the
              resulting daily record without switching pages.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 space-y-2">
              <Label htmlFor="attendance-work-date">Work date</Label>
              <Input
                id="attendance-work-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={controlClass}
              />
            </div>
            {canSchedules && onAddSchedule && (
              <Button
                type="button"
                variant="outline"
                onClick={onAddSchedule}
                className="min-h-11 border-slate-700 bg-white text-slate-950 hover:bg-slate-100 dark:border-slate-300 dark:bg-slate-900 dark:text-slate-50 dark:hover:bg-slate-800"
              >
                <CalendarDays aria-hidden="true" />
                Add schedule
              </Button>
            )}
            {canManage && (
              <Button
                type="button"
                onClick={() => setManualOpen(true)}
                className="min-h-11"
              >
                <Plus aria-hidden="true" />
                Record manual event
              </Button>
            )}
          </div>
        </div>

        <div
          id={statusMessageId}
          role="status"
          className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
        >
          <Radio
            aria-hidden="true"
            className={
              realtimeConnected
                ? "h-4 w-4 text-teal-800 dark:text-teal-200"
                : "h-4 w-4 text-amber-800 dark:text-amber-200"
            }
          />
          {realtimeConnected
            ? "Live updates connected"
            : "Polling every 15 seconds"}
          {newestSync && ` · Last live update ${newestSync}`}
        </div>
      </header>

      {canPunch && (
        <Card className="border-slate-500 dark:border-slate-400">
          <CardContent className="p-5">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)]">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
                      My workday
                    </p>
                    <h3 className="mt-1 text-2xl font-black">
                      {ownStatus
                        ? stateLabels[ownStatus.state]
                        : "Checking your attendance link"}
                    </h3>
                    {ownStatus && (
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {ownStatus.date} · {ownStatus.timezone}
                      </p>
                    )}
                  </div>
                  {selfStatus.isFetching && (
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <RefreshCw
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin motion-reduce:animate-none"
                      />
                      Refreshing
                    </span>
                  )}
                </div>

                {selfStatus.isError ? (
                  <div className="mt-5 rounded-xl border border-amber-700 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-300 dark:bg-amber-950 dark:text-amber-100">
                    {errorMessage(
                      selfStatus.error,
                      "Your user account is not linked to an employee record. Ask HR to link it before using self-service attendance.",
                    )}
                  </div>
                ) : (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {(ownStatus?.next_actions ?? []).map((action) => (
                      <Button
                        key={action}
                        type="button"
                        variant={
                          action === "clock_out" || action === "break_start"
                            ? "outline"
                            : "default"
                        }
                        onClick={() => punch.mutate(action)}
                        disabled={punch.isPending || date !== today()}
                        className="min-h-11"
                      >
                        {action === "clock_in" && <LogIn aria-hidden="true" />}
                        {action === "clock_out" && (
                          <LogOut aria-hidden="true" />
                        )}
                        {action === "break_start" && (
                          <Coffee aria-hidden="true" />
                        )}
                        {action === "break_end" && (
                          <Activity aria-hidden="true" />
                        )}
                        {eventLabels[action]}
                      </Button>
                    ))}
                    {date !== today() && (
                      <p className="w-full text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Self-service punches are available only on today’s
                        workday. Choose today to record a live event.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-500 pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0 dark:border-slate-400">
                <div className="flex items-center gap-2">
                  <History
                    aria-hidden="true"
                    className="h-5 w-5 text-teal-800 dark:text-teal-200"
                  />
                  <h3 className="font-black">Workday rail</h3>
                </div>
                {ownStatus ? (
                  <WorkdayRail status={ownStatus} />
                ) : (
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                    Your event timeline will appear here.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {canView && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map(({ label, value, icon: Icon }) => (
            <Card
              key={label}
              className="border-slate-500 dark:border-slate-400"
            >
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                    {label}
                  </p>
                  <p className="mt-2 text-3xl font-black">{value}</p>
                </div>
                <Icon
                  aria-hidden="true"
                  className="h-7 w-7 text-blue-800 dark:text-cyan-200"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-slate-500 dark:border-slate-400">
        <CardContent className="p-0">
          <div className="border-b border-slate-500 p-5 dark:border-slate-400">
            <h3 className="text-xl font-black">Daily attendance records</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Calculated records created from processed events for {date}.
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableCaption>
                Daily attendance records for {date}, including first punch, last
                punch, worked time, and status.
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
                {recordRows.length ? (
                  recordRows.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-semibold">
                        {record.employee?.primary_name ?? "My attendance"}
                        {record.employee?.employee_number && (
                          <span className="block text-xs text-slate-600 dark:text-slate-300">
                            {record.employee.employee_number}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{formatTime(record.first_in_at)}</TableCell>
                      <TableCell>{formatTime(record.last_out_at)}</TableCell>
                      <TableCell>
                        {formatMinutes(record.worked_minutes)}
                      </TableCell>
                      <TableCell>
                        {formatMinutes(record.late_minutes)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex rounded-full border border-slate-700 bg-slate-50 px-2 py-1 text-xs font-bold capitalize text-slate-900 dark:border-slate-300 dark:bg-slate-900 dark:text-slate-100">
                          {record.status.replaceAll("_", " ")}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-slate-600 dark:text-slate-300"
                    >
                      {records.isLoading
                        ? "Loading attendance records…"
                        : "No calculated attendance records for this date."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AttendanceCorrections date={date} />

      {canViewReconciliation && (
        <AttendanceReconciliation
          date={date}
          employees={employees.data?.data ?? []}
          canReconcile={canReconcile}
        />
      )}

      {canViewCapture && (
        <AttendanceCaptureWorkspace employees={employees.data?.data ?? []} />
      )}

      <ScheduleWorkspace />

      <Card className="border-slate-500 dark:border-slate-400">
        <CardContent className="p-0">
          <div className="grid gap-4 border-b border-slate-500 p-5 md:grid-cols-[1fr_minmax(14rem,20rem)] md:items-end dark:border-slate-400">
            <div>
              <h3 className="text-xl font-black">Immutable event ledger</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Normalized source events, processing state, and server receipt
                details. These entries cannot be edited or deleted.
              </p>
            </div>
            {canView && (
              <div className="space-y-2">
                <Label htmlFor="attendance-event-employee">
                  Filter events by employee
                </Label>
                <select
                  id="attendance-event-employee"
                  value={eventEmployeeId}
                  onChange={(event) => setEventEmployeeId(event.target.value)}
                  className={selectClass}
                >
                  <option value="">All visible employees</option>
                  {employees.data?.data.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.primary_name} · {employee.employee_number}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableCaption>
                Normalized attendance events for {date}, ordered newest first.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Event ID</TableHead>
                  <TableHead scope="col">Employee</TableHead>
                  <TableHead scope="col">Event</TableHead>
                  <TableHead scope="col">Time</TableHead>
                  <TableHead scope="col">Source</TableHead>
                  <TableHead scope="col">Processing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventRows.length ? (
                  eventRows.map((event) => (
                    <TableRow key={event.event_uuid}>
                      <TableCell className="font-mono text-xs">
                        {event.event_uuid.slice(0, 8)}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {event.employee?.primary_name ?? "My attendance"}
                        <span className="block text-xs font-normal text-slate-600 dark:text-slate-300">
                          {event.external_employee_identifier ?? "Linked user"}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {eventLabels[event.event_type]}
                      </TableCell>
                      <TableCell>
                        <time dateTime={event.occurred_at}>
                          {formatTime(
                            event.occurred_at,
                            event.organization_timezone,
                          )}
                        </time>
                      </TableCell>
                      <TableCell className="capitalize">
                        {event.source.replaceAll("_", " ")}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            event.processing_status === "processed"
                              ? "inline-flex rounded-full border border-teal-800 bg-teal-50 px-2 py-1 text-xs font-bold capitalize text-teal-950 dark:border-teal-200 dark:bg-teal-950 dark:text-teal-100"
                              : "inline-flex rounded-full border border-amber-800 bg-amber-50 px-2 py-1 text-xs font-bold capitalize text-amber-950 dark:border-amber-200 dark:bg-amber-950 dark:text-amber-100"
                          }
                        >
                          {event.processing_status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-slate-600 dark:text-slate-300"
                    >
                      {events.isLoading
                        ? "Loading attendance events…"
                        : "No normalized attendance events for this date."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ManualAttendanceDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        employees={employees.data?.data ?? []}
        selectedDate={date}
      />
    </section>
  );
}
