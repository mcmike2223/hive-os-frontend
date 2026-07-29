"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarRange,
  CheckCircle2,
  ExternalLink,
  Factory,
  RefreshCw,
  Route,
  UsersRound,
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
import { initEcho } from "@/lib/echo";
import {
  getAccessToken,
  getTenantId,
  getWorkspaceScopeKey,
} from "@/lib/runtime-context";
import {
  Employee,
  Paginated,
  RosterPeriod,
  ScheduleEmployeeOption,
  ScheduleTemplate,
  SchedulingWorkspace,
  ShiftSwapRequest,
  TemporarySchedule,
  WorkSchedule,
} from "@/modules/humanresources/api";
import { attendanceFetch } from "@/modules/attendance/api";

const controlClass =
  "h-11 border-slate-500 focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-cyan-300";
const selectClass =
  "h-11 w-full rounded-md border border-slate-500 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-cyan-300";
const checkboxClass =
  "h-5 w-5 shrink-0 rounded border-slate-600 text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-300 dark:focus-visible:ring-cyan-300";
const today = () => new Date().toISOString().slice(0, 10);

type ActionMode = "rotation" | "roster" | "temporary" | "swap";

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

function idempotencyKey(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}:${crypto.randomUUID()}`;
  }
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatDateRange(startsOn: string, endsOn: string) {
  return startsOn === endsOn
    ? formatDate(startsOn)
    : `${formatDate(startsOn)} – ${formatDate(endsOn)}`;
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function sourceLabel(value?: string) {
  return (
    {
      temporary_schedule: "Temporary override",
      roster_entry: "Published roster",
      employee_schedule: "Employee assignment",
      schedule_assignment: "Rotation assignment",
      schedule_template: "Rotation template",
    }[value ?? ""] ?? "Not assigned"
  );
}

function statusClass(status: string) {
  if (status === "approved" || status === "published") {
    return "border-teal-800 bg-teal-50 text-teal-950 dark:border-teal-200 dark:bg-teal-950 dark:text-teal-100";
  }
  if (status === "rejected" || status === "withdrawn") {
    return "border-red-700 bg-red-50 text-red-900 dark:border-red-300 dark:bg-red-950 dark:text-red-100";
  }
  return "border-amber-800 bg-amber-50 text-amber-950 dark:border-amber-200 dark:bg-amber-950 dark:text-amber-100";
}

function ActionError({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [message]);

  return (
    <div
      ref={ref}
      id="schedule-action-error"
      tabIndex={-1}
      className="rounded-lg border border-red-700 bg-red-50 p-3 text-sm font-semibold text-red-900 outline-none focus-visible:ring-2 focus-visible:ring-red-700 dark:border-red-300 dark:bg-red-950 dark:text-red-100"
    >
      {message}
    </div>
  );
}

function SchedulingActionDialog({
  open,
  onOpenChange,
  workspace,
  employees,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: SchedulingWorkspace;
  employees: ScheduleEmployeeOption[];
}) {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const rosterEmployeeHintId = useId();
  const cycleHintId = useId();
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState("");
  const availableModes = useMemo<ActionMode[]>(() => {
    const modes: ActionMode[] = [];
    if (workspace.permissions.can_manage_templates) modes.push("rotation");
    if (workspace.permissions.can_manage_rosters) modes.push("roster");
    if (workspace.permissions.can_create_temporary) modes.push("temporary");
    if (workspace.permissions.can_request_swap) modes.push("swap");
    return modes;
  }, [workspace.permissions]);
  const [mode, setMode] = useState<ActionMode>("rotation");
  const [rotation, setRotation] = useState({
    code: "",
    name: "",
    cycle_length: "7",
    anchor_date: today(),
    employee_id: "",
  });
  const [cycleDays, setCycleDays] = useState<string[]>(
    Array.from({ length: 7 }, () => "rest"),
  );
  const [roster, setRoster] = useState({
    code: "",
    name: "",
    template_id: "",
    starts_on: today(),
    ends_on: today(),
    employee_ids: [] as number[],
  });
  const [temporary, setTemporary] = useState({
    employee_id: "",
    work_schedule_id: "",
    starts_on: today(),
    ends_on: today(),
    reason_type: "emergency_coverage",
    reason: "",
    is_rest_day: false,
  });
  const [swap, setSwap] = useState({
    requester_employee_id: "",
    counterparty_employee_id: "",
    requester_work_date: today(),
    counterparty_work_date: today(),
    reason: "",
  });

  useEffect(() => {
    if (!open) return;
    const firstMode = availableModes[0] ?? "swap";
    setMode(firstMode);
    setError("");
    setErrorField("");
    setRotation({
      code: `ROT-${today().replaceAll("-", "")}`,
      name: "",
      cycle_length: "7",
      anchor_date: today(),
      employee_id: workspace.employee ? String(workspace.employee.id) : "",
    });
    setCycleDays(Array.from({ length: 7 }, () => "rest"));
    setRoster({
      code: `RST-${today().replaceAll("-", "")}`,
      name: "",
      template_id: workspace.templates[0]
        ? String(workspace.templates[0].id)
        : "",
      starts_on: today(),
      ends_on: today(),
      employee_ids: workspace.employee ? [workspace.employee.id] : [],
    });
    setTemporary({
      employee_id: workspace.employee ? String(workspace.employee.id) : "",
      work_schedule_id: workspace.work_schedules[0]
        ? String(workspace.work_schedules[0].id)
        : "",
      starts_on: today(),
      ends_on: today(),
      reason_type: "emergency_coverage",
      reason: "",
      is_rest_day: false,
    });
    setSwap({
      requester_employee_id: workspace.employee
        ? String(workspace.employee.id)
        : "",
      counterparty_employee_id: "",
      requester_work_date: today(),
      counterparty_work_date: today(),
      reason: "",
    });
  }, [availableModes, open, workspace]);

  useEffect(() => {
    const length = Math.max(
      1,
      Math.min(84, Number(rotation.cycle_length) || 1),
    );
    setCycleDays((current) =>
      Array.from({ length }, (_, index) => current[index] ?? "rest"),
    );
  }, [rotation.cycle_length]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "rotation") {
        const created = await attendanceFetch<{ data: ScheduleTemplate }>(
          "/schedule-templates",
          {
            method: "POST",
            body: JSON.stringify({
              code: rotation.code,
              name: rotation.name,
              description:
                "Rotation created from the scheduling command board.",
              timezone: "Africa/Addis_Ababa",
              cycle_length_days: Number(rotation.cycle_length),
              rotation_direction: "forward",
              anchor_date: rotation.anchor_date,
              holiday_treatment: "use_shift",
              effective_from: rotation.anchor_date,
              is_active: true,
              days: cycleDays.map((selection, index) => ({
                cycle_day: index + 1,
                work_schedule_id:
                  selection === "rest" ? null : Number(selection),
                label:
                  selection === "rest"
                    ? `Cycle day ${index + 1} rest`
                    : `Cycle day ${index + 1}`,
                is_rest_day: selection === "rest",
              })),
            }),
          },
        );
        if (rotation.employee_id) {
          await attendanceFetch(`/schedule-templates/${created.data.id}/assign`, {
            method: "POST",
            body: JSON.stringify({
              scope_type: "employee",
              employee_ids: [Number(rotation.employee_id)],
              priority: 200,
              effective_from: rotation.anchor_date,
            }),
          });
        }
        return "Rotation created and assigned.";
      }

      if (mode === "roster") {
        await attendanceFetch<{ data: RosterPeriod }>("/rosters", {
          method: "POST",
          body: JSON.stringify({
            code: roster.code,
            name: roster.name,
            schedule_template_id: Number(roster.template_id),
            starts_on: roster.starts_on,
            ends_on: roster.ends_on,
            employee_ids: roster.employee_ids,
          }),
        });
        return "Draft roster generated with conflict checks.";
      }

      if (mode === "temporary") {
        await attendanceFetch<{ data: TemporarySchedule }>("/temporary-schedules", {
          method: "POST",
          body: JSON.stringify({
            employee_id: Number(temporary.employee_id),
            work_schedule_id: temporary.is_rest_day
              ? null
              : Number(temporary.work_schedule_id),
            starts_on: temporary.starts_on,
            ends_on: temporary.ends_on,
            is_rest_day: temporary.is_rest_day,
            reason_type: temporary.reason_type,
            reason: temporary.reason,
            idempotency_key: idempotencyKey("temporary-schedule"),
            submit: true,
          }),
        });
        return "Temporary schedule sent for Workflow approval.";
      }

      await attendanceFetch<{ data: ShiftSwapRequest }>("/shift-swaps", {
        method: "POST",
        body: JSON.stringify({
          requester_employee_id: Number(swap.requester_employee_id),
          counterparty_employee_id: Number(swap.counterparty_employee_id),
          requester_work_date: swap.requester_work_date,
          counterparty_work_date: swap.counterparty_work_date,
          reason: swap.reason,
          idempotency_key: idempotencyKey("shift-swap"),
          submit: true,
        }),
      });
      return "Shift swap sent for Workflow approval.";
    },
    onSuccess: async (message) => {
      toast.success(message);
      onOpenChange(false);
      await queryClient.invalidateQueries({
        queryKey: ["hr-scheduling", scope],
      });
    },
    onError: (failure) => {
      setErrorField("form");
      setError(
        failure instanceof Error
          ? failure.message
          : "Schedule action: the request could not be completed.",
      );
    },
  });

  function validationError(): [string, string] | null {
    if (mode === "rotation") {
      if (!rotation.name.trim()) {
        return ["rotation-name", "Rotation name: enter a descriptive name."];
      }
      if (!cycleDays.some((day) => day !== "rest")) {
        return [
          "rotation-cycle",
          "Rotation cycle: select at least one working shift.",
        ];
      }
    }
    if (mode === "roster") {
      if (!roster.name.trim()) {
        return ["roster-name", "Roster name: enter a descriptive name."];
      }
      if (!roster.template_id) {
        return ["roster-template", "Rotation template: select a template."];
      }
      if (!roster.employee_ids.length) {
        return [
          "roster-employees",
          "Roster employees: select at least one employee.",
        ];
      }
    }
    if (mode === "temporary") {
      if (!temporary.employee_id) {
        return ["temporary-employee", "Employee: select an employee."];
      }
      if (!temporary.is_rest_day && !temporary.work_schedule_id) {
        return [
          "temporary-shift",
          "Replacement shift: select a shift or mark this as a rest day.",
        ];
      }
      if (temporary.reason.trim().length < 10) {
        return [
          "temporary-reason",
          "Reason: enter at least 10 characters explaining the temporary schedule.",
        ];
      }
    }
    if (mode === "swap") {
      if (!swap.requester_employee_id) {
        return ["swap-requester", "Your employee: select an employee."];
      }
      if (!swap.counterparty_employee_id) {
        return ["swap-counterparty", "Swap with: select another employee."];
      }
      if (swap.requester_employee_id === swap.counterparty_employee_id) {
        return ["swap-counterparty", "Swap with: choose a different employee."];
      }
      if (swap.reason.trim().length < 10) {
        return [
          "swap-reason",
          "Reason: enter at least 10 characters explaining the shift swap.",
        ];
      }
    }
    return null;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = validationError();
    if (invalid) {
      setErrorField(invalid[0]);
      setError(invalid[1]);
      return;
    }
    setError("");
    setErrorField("");
    mutation.mutate();
  }

  const describedBy = (field: string, hint?: string) =>
    error && (errorField === field || errorField === "form")
      ? "schedule-action-error"
      : hint;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto border-slate-500 sm:max-w-3xl dark:border-slate-400"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle ref={titleRef} tabIndex={-1}>
              Schedule action
            </DialogTitle>
            <DialogDescription>
              Use one guided form for rotations, rosters, temporary coverage,
              and employee shift swaps.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-5">
            {error && <ActionError message={error} />}

            <div className="space-y-2">
              <Label htmlFor="schedule-action-mode">Action</Label>
              <select
                id="schedule-action-mode"
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value as ActionMode);
                  setError("");
                  setErrorField("");
                }}
                className={selectClass}
              >
                {availableModes.includes("rotation") && (
                  <option value="rotation">Create and assign rotation</option>
                )}
                {availableModes.includes("roster") && (
                  <option value="roster">Generate roster</option>
                )}
                {availableModes.includes("temporary") && (
                  <option value="temporary">Request temporary coverage</option>
                )}
                {availableModes.includes("swap") && (
                  <option value="swap">Request shift swap</option>
                )}
              </select>
            </div>

            {mode === "rotation" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="rotation-code">Rotation code</Label>
                    <Input
                      id="rotation-code"
                      value={rotation.code}
                      onChange={(event) =>
                        setRotation((current) => ({
                          ...current,
                          code: event.target.value,
                        }))
                      }
                      className={controlClass}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rotation-name">
                      Rotation name (required)
                    </Label>
                    <Input
                      id="rotation-name"
                      value={rotation.name}
                      onChange={(event) =>
                        setRotation((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      className={controlClass}
                      aria-invalid={errorField === "rotation-name" || undefined}
                      aria-describedby={describedBy("rotation-name")}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rotation-length">
                      Cycle length in days
                    </Label>
                    <Input
                      id="rotation-length"
                      type="number"
                      min={1}
                      max={84}
                      value={rotation.cycle_length}
                      onChange={(event) =>
                        setRotation((current) => ({
                          ...current,
                          cycle_length: event.target.value,
                        }))
                      }
                      className={controlClass}
                      aria-describedby={cycleHintId}
                      required
                    />
                    <p
                      id={cycleHintId}
                      className="text-xs text-slate-600 dark:text-slate-300"
                    >
                      Use any reusable pattern from 1 to 84 days.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rotation-anchor">First cycle date</Label>
                    <Input
                      id="rotation-anchor"
                      type="date"
                      value={rotation.anchor_date}
                      onChange={(event) =>
                        setRotation((current) => ({
                          ...current,
                          anchor_date: event.target.value,
                        }))
                      }
                      className={controlClass}
                      required
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="rotation-employee">
                      Assign to employee
                    </Label>
                    <select
                      id="rotation-employee"
                      value={rotation.employee_id}
                      onChange={(event) =>
                        setRotation((current) => ({
                          ...current,
                          employee_id: event.target.value,
                        }))
                      }
                      className={selectClass}
                    >
                      <option value="">Create without assigning</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.primary_name} · {employee.employee_number}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <fieldset
                  className="rounded-xl border border-slate-500 p-4 dark:border-slate-400"
                  aria-describedby={describedBy("rotation-cycle")}
                >
                  <legend className="px-2 font-black">Rotation cycle</legend>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {cycleDays.map((selection, index) => (
                      <div className="space-y-2" key={index}>
                        <Label htmlFor={`rotation-cycle-${index}`}>
                          Day {index + 1}
                        </Label>
                        <select
                          id={`rotation-cycle-${index}`}
                          value={selection}
                          onChange={(event) =>
                            setCycleDays((current) =>
                              current.map((value, dayIndex) =>
                                dayIndex === index ? event.target.value : value,
                              ),
                            )
                          }
                          className={selectClass}
                          aria-invalid={
                            errorField === "rotation-cycle" || undefined
                          }
                        >
                          <option value="rest">Rest day</option>
                          {workspace.work_schedules.map((schedule) => (
                            <option key={schedule.id} value={schedule.id}>
                              {schedule.name} · {formatTime(schedule.starts_at)}
                              –{formatTime(schedule.ends_at)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            {mode === "roster" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="roster-code">Roster code</Label>
                    <Input
                      id="roster-code"
                      value={roster.code}
                      onChange={(event) =>
                        setRoster((current) => ({
                          ...current,
                          code: event.target.value,
                        }))
                      }
                      className={controlClass}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="roster-name">Roster name (required)</Label>
                    <Input
                      id="roster-name"
                      value={roster.name}
                      onChange={(event) =>
                        setRoster((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      className={controlClass}
                      aria-invalid={errorField === "roster-name" || undefined}
                      aria-describedby={describedBy("roster-name")}
                      required
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="roster-template">
                      Rotation template (required)
                    </Label>
                    <select
                      id="roster-template"
                      value={roster.template_id}
                      onChange={(event) =>
                        setRoster((current) => ({
                          ...current,
                          template_id: event.target.value,
                        }))
                      }
                      className={selectClass}
                      aria-invalid={
                        errorField === "roster-template" || undefined
                      }
                      aria-describedby={describedBy("roster-template")}
                      required
                    >
                      <option value="">Select a rotation</option>
                      {workspace.templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} · {template.cycle_length_days}-day
                          cycle
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="roster-start">Roster starts</Label>
                    <Input
                      id="roster-start"
                      type="date"
                      value={roster.starts_on}
                      onChange={(event) =>
                        setRoster((current) => ({
                          ...current,
                          starts_on: event.target.value,
                        }))
                      }
                      className={controlClass}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="roster-end">Roster ends</Label>
                    <Input
                      id="roster-end"
                      type="date"
                      min={roster.starts_on}
                      value={roster.ends_on}
                      onChange={(event) =>
                        setRoster((current) => ({
                          ...current,
                          ends_on: event.target.value,
                        }))
                      }
                      className={controlClass}
                      required
                    />
                  </div>
                </div>

                <fieldset
                  className="rounded-xl border border-slate-500 p-4 dark:border-slate-400"
                  aria-describedby={describedBy(
                    "roster-employees",
                    rosterEmployeeHintId,
                  )}
                >
                  <legend className="px-2 font-black">
                    Roster employees (required)
                  </legend>
                  <p
                    id={rosterEmployeeHintId}
                    className="mb-3 text-xs text-slate-600 dark:text-slate-300"
                  >
                    Select every employee to include in this generated roster.
                  </p>
                  <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
                    {employees.map((employee) => {
                      const id = `roster-employee-${employee.id}`;
                      const checked = roster.employee_ids.includes(employee.id);
                      return (
                        <label
                          key={employee.id}
                          htmlFor={id}
                          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-500 px-3 py-2 text-sm font-semibold dark:border-slate-400"
                        >
                          <input
                            id={id}
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setRoster((current) => ({
                                ...current,
                                employee_ids: checked
                                  ? current.employee_ids.filter(
                                      (employeeId) =>
                                        employeeId !== employee.id,
                                    )
                                  : [...current.employee_ids, employee.id],
                              }))
                            }
                            className={checkboxClass}
                          />
                          <span>
                            {employee.primary_name}
                            <span className="block text-xs font-normal text-slate-600 dark:text-slate-300">
                              {employee.employee_number}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </>
            )}

            {mode === "temporary" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="temporary-employee">
                    Employee (required)
                  </Label>
                  <select
                    id="temporary-employee"
                    value={temporary.employee_id}
                    onChange={(event) =>
                      setTemporary((current) => ({
                        ...current,
                        employee_id: event.target.value,
                      }))
                    }
                    className={selectClass}
                    aria-invalid={
                      errorField === "temporary-employee" || undefined
                    }
                    aria-describedby={describedBy("temporary-employee")}
                    required
                  >
                    <option value="">Select an employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.primary_name} · {employee.employee_number}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="temporary-start">Starts on</Label>
                  <Input
                    id="temporary-start"
                    type="date"
                    value={temporary.starts_on}
                    onChange={(event) =>
                      setTemporary((current) => ({
                        ...current,
                        starts_on: event.target.value,
                      }))
                    }
                    className={controlClass}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="temporary-end">Ends on</Label>
                  <Input
                    id="temporary-end"
                    type="date"
                    min={temporary.starts_on}
                    value={temporary.ends_on}
                    onChange={(event) =>
                      setTemporary((current) => ({
                        ...current,
                        ends_on: event.target.value,
                      }))
                    }
                    className={controlClass}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="temporary-reason-type">Coverage reason</Label>
                  <select
                    id="temporary-reason-type"
                    value={temporary.reason_type}
                    onChange={(event) =>
                      setTemporary((current) => ({
                        ...current,
                        reason_type: event.target.value,
                      }))
                    }
                    className={selectClass}
                  >
                    <option value="shift_replacement">Shift replacement</option>
                    <option value="leave_coverage">Leave coverage</option>
                    <option value="training">Training</option>
                    <option value="business_travel">Business travel</option>
                    <option value="branch_transfer">Branch transfer</option>
                    <option value="production_peak">Production peak</option>
                    <option value="seasonal_hours">Seasonal hours</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="emergency_coverage">
                      Emergency coverage
                    </option>
                    <option value="remote_work">Remote work</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="temporary-shift">Replacement shift</Label>
                  <select
                    id="temporary-shift"
                    value={temporary.work_schedule_id}
                    onChange={(event) =>
                      setTemporary((current) => ({
                        ...current,
                        work_schedule_id: event.target.value,
                      }))
                    }
                    className={selectClass}
                    disabled={temporary.is_rest_day}
                    aria-invalid={errorField === "temporary-shift" || undefined}
                    aria-describedby={describedBy("temporary-shift")}
                  >
                    <option value="">Select a shift</option>
                    {workspace.work_schedules.map((schedule) => (
                      <option key={schedule.id} value={schedule.id}>
                        {schedule.name} · {formatTime(schedule.starts_at)}–
                        {formatTime(schedule.ends_at)}
                      </option>
                    ))}
                  </select>
                </div>
                <label
                  htmlFor="temporary-rest-day"
                  className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-500 px-3 py-2 text-sm font-semibold sm:col-span-2 dark:border-slate-400"
                >
                  <input
                    id="temporary-rest-day"
                    type="checkbox"
                    checked={temporary.is_rest_day}
                    onChange={(event) =>
                      setTemporary((current) => ({
                        ...current,
                        is_rest_day: event.target.checked,
                      }))
                    }
                    className={checkboxClass}
                  />
                  Make this period a temporary rest period
                </label>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="temporary-reason">Reason (required)</Label>
                  <Textarea
                    id="temporary-reason"
                    value={temporary.reason}
                    onChange={(event) =>
                      setTemporary((current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                    className="min-h-24 border-slate-500 focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-cyan-300"
                    aria-invalid={
                      errorField === "temporary-reason" || undefined
                    }
                    aria-describedby={describedBy("temporary-reason")}
                    required
                  />
                </div>
              </div>
            )}

            {mode === "swap" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="swap-requester">
                    Your employee (required)
                  </Label>
                  <select
                    id="swap-requester"
                    value={swap.requester_employee_id}
                    onChange={(event) =>
                      setSwap((current) => ({
                        ...current,
                        requester_employee_id: event.target.value,
                      }))
                    }
                    className={selectClass}
                    aria-invalid={errorField === "swap-requester" || undefined}
                    aria-describedby={describedBy("swap-requester")}
                    required
                  >
                    <option value="">Select an employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.primary_name} · {employee.employee_number}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="swap-counterparty">
                    Swap with (required)
                  </Label>
                  <select
                    id="swap-counterparty"
                    value={swap.counterparty_employee_id}
                    onChange={(event) =>
                      setSwap((current) => ({
                        ...current,
                        counterparty_employee_id: event.target.value,
                      }))
                    }
                    className={selectClass}
                    aria-invalid={
                      errorField === "swap-counterparty" || undefined
                    }
                    aria-describedby={describedBy("swap-counterparty")}
                    required
                  >
                    <option value="">Select another employee</option>
                    {employees
                      .filter(
                        (employee) =>
                          String(employee.id) !== swap.requester_employee_id,
                      )
                      .map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.primary_name} · {employee.employee_number}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="swap-requester-date">Your shift date</Label>
                  <Input
                    id="swap-requester-date"
                    type="date"
                    value={swap.requester_work_date}
                    onChange={(event) =>
                      setSwap((current) => ({
                        ...current,
                        requester_work_date: event.target.value,
                      }))
                    }
                    className={controlClass}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="swap-counterparty-date">
                    Their shift date
                  </Label>
                  <Input
                    id="swap-counterparty-date"
                    type="date"
                    value={swap.counterparty_work_date}
                    onChange={(event) =>
                      setSwap((current) => ({
                        ...current,
                        counterparty_work_date: event.target.value,
                      }))
                    }
                    className={controlClass}
                    required
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="swap-reason">Reason (required)</Label>
                  <Textarea
                    id="swap-reason"
                    value={swap.reason}
                    onChange={(event) =>
                      setSwap((current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                    className="min-h-24 border-slate-500 focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-cyan-300"
                    aria-invalid={errorField === "swap-reason" || undefined}
                    aria-describedby={describedBy("swap-reason")}
                    required
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 border-slate-600"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="min-h-11 bg-blue-800 text-white hover:bg-blue-900 dark:bg-cyan-200 dark:text-slate-950 dark:hover:bg-cyan-100"
              disabled={mutation.isPending}
            >
              {mutation.isPending
                ? "Saving…"
                : mode === "rotation"
                  ? "Create rotation"
                  : mode === "roster"
                    ? "Generate roster"
                    : "Send for approval"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ScheduleWorkspace() {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const { hasAnyPermission, isLoaded } = usePermissions();
  const canOpen = hasAnyPermission([
    "view_own_schedule",
    "view_team_time",
    "manage_work_schedules",
    "manage_schedule_templates",
    "manage_team_rosters",
    "request_shift_swap",
  ]);
  const canFetchEmployees = hasAnyPermission([
    "view_team_time",
    "manage_work_schedules",
    "manage_schedule_templates",
    "manage_team_rosters",
    "approve_shift_swaps",
  ]);
  const [start, setStart] = useState(today());
  const [employeeId, setEmployeeId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const refreshTimer = useRef<number | null>(null);
  const statusId = useId();

  const workspace = useQuery({
    queryKey: ["hr-scheduling", scope, start, employeeId],
    queryFn: () =>
      attendanceFetch<{ data: SchedulingWorkspace }>(
        `/scheduling/workspace?starts_on=${start}&days=14${
          employeeId ? `&employee_id=${employeeId}` : ""
        }`,
      ),
    enabled: isLoaded && canOpen,
    refetchInterval: realtimeConnected ? 60_000 : 20_000,
  });
  const employees = useQuery({
    queryKey: ["hr-scheduling", scope, "employees"],
    queryFn: () => attendanceFetch<Paginated<Employee>>("/employees?per_page=200"),
    enabled: isLoaded && canFetchEmployees,
  });
  const data = workspace.data?.data;
  const visibleEmployees = useMemo(() => {
    const rows = employees.data?.data ?? data?.swap_candidates ?? [];
    if (data?.employee && !rows.some((item) => item.id === data.employee?.id)) {
      return [data.employee, ...rows];
    }
    return rows.length ? rows : data?.employee ? [data.employee] : [];
  }, [data?.employee, data?.swap_candidates, employees.data?.data]);

  useEffect(() => {
    const token =
      getAccessToken() ||
      (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    if (!token || !canOpen) return;

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
        ![
          "schedule_template",
          "schedule_assignment",
          "temporary_schedule",
          "shift_swap_request",
          "roster_period",
        ].includes(event.resource)
      ) {
        return;
      }
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: ["hr-scheduling", scope],
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
  }, [canOpen, queryClient, scope]);

  const publishRoster = useMutation({
    mutationFn: (roster: RosterPeriod) =>
      attendanceFetch<{ data: RosterPeriod }>(`/rosters/${roster.id}/publish`, {
        method: "POST",
      }),
    onSuccess: async () => {
      toast.success("Roster published.");
      await queryClient.invalidateQueries({
        queryKey: ["hr-scheduling", scope],
      });
    },
    onError: (failure) =>
      toast.error(
        failure instanceof Error
          ? failure.message
          : "Roster publication failed.",
      ),
  });

  if (isLoaded && !canOpen) return null;

  const latestRoster = data?.rosters[0] ?? null;
  const openShifts =
    data?.rosters.reduce(
      (total, roster) =>
        total + roster.entries.filter((entry) => entry.is_open).length,
      0,
    ) ?? 0;
  const conflicts =
    data?.rosters.reduce(
      (total, roster) => total + (roster.conflict_summary?.length ?? 0),
      0,
    ) ?? 0;
  const pendingChanges =
    (data?.temporary_schedules.filter((item) => item.status === "submitted")
      .length ?? 0) +
    (data?.shift_swaps.filter((item) => item.status === "submitted").length ??
      0);
  const scheduledDays =
    data?.timeline.filter(
      (day) => day.work_schedule && !day.resolution?.is_rest_day,
    ).length ?? 0;
  const hasActions =
    data &&
    (data.permissions.can_manage_templates ||
      data.permissions.can_manage_rosters ||
      data.permissions.can_create_temporary ||
      data.permissions.can_request_swap);
  const changeRows = [
    ...(data?.temporary_schedules.map((item) => ({
      key: `temporary-${item.id}`,
      number: item.request_number,
      type: "Temporary schedule",
      employee: item.employee?.primary_name ?? "Employee",
      period: formatDateRange(item.starts_on, item.ends_on),
      status: item.status,
      workflow: item.workflow_status,
    })) ?? []),
    ...(data?.shift_swaps.map((item) => ({
      key: `swap-${item.id}`,
      number: item.request_number,
      type: "Shift swap",
      employee: `${item.requester_employee?.primary_name ?? "Employee"} ↔ ${
        item.counterparty_employee?.primary_name ?? "Employee"
      }`,
      period: formatDateRange(
        item.requester_work_date,
        item.counterparty_work_date,
      ),
      status: item.status,
      workflow: item.workflow_status,
    })) ?? []),
  ].slice(0, 12);

  return (
    <section aria-labelledby="schedule-workspace-title" className="space-y-5">
      <Card className="overflow-hidden border-slate-500 dark:border-slate-400">
        <CardContent className="p-0">
          <div className="border-b border-slate-500 bg-slate-950 p-5 text-white dark:border-slate-400 dark:bg-cyan-950">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-cyan-200">
                  <Route aria-hidden="true" className="h-5 w-5" />
                  <p className="text-xs font-black uppercase tracking-[0.16em]">
                    Workforce routing
                  </p>
                </div>
                <h2
                  id="schedule-workspace-title"
                  className="mt-2 text-2xl font-black"
                >
                  Scheduling command board
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-200">
                  One place to see resolved shifts, build rotations, generate
                  conflict-checked rosters, and route exceptions through
                  Workflow.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 border-slate-300 bg-transparent text-white hover:bg-slate-800 hover:text-white"
                  onClick={() => void workspace.refetch()}
                  disabled={workspace.isFetching}
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={`h-4 w-4 ${
                      workspace.isFetching
                        ? "motion-safe:animate-spin motion-reduce:animate-none"
                        : ""
                    }`}
                  />
                  Refresh schedule
                </Button>
                {hasActions && (
                  <Button
                    type="button"
                    className="min-h-11 bg-cyan-200 text-slate-950 hover:bg-cyan-100"
                    onClick={() => setDialogOpen(true)}
                  >
                    <CalendarRange aria-hidden="true" className="h-4 w-4" />
                    Schedule action
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="schedule-start-date">Timeline starts</Label>
              <Input
                id="schedule-start-date"
                type="date"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className={controlClass}
              />
            </div>
            {canFetchEmployees && (
              <div className="space-y-2">
                <Label htmlFor="schedule-employee">Employee</Label>
                <select
                  id="schedule-employee"
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  className={selectClass}
                >
                  <option value="">My linked employee</option>
                  {visibleEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.primary_name} · {employee.employee_number}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <p
              id={statusId}
              role="status"
              className="rounded-lg border border-slate-500 px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-400 dark:text-slate-200"
            >
              {realtimeConnected
                ? "Live schedule updates connected"
                : "Checking for live updates"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Scheduled days",
            value: scheduledDays,
            detail: "In this 14-day view",
            icon: CheckCircle2,
          },
          {
            label: "Open shifts",
            value: openShifts,
            detail: "Need coverage",
            icon: UsersRound,
          },
          {
            label: "Detected conflicts",
            value: conflicts,
            detail: "Warnings and blockers",
            icon: AlertTriangle,
          },
          {
            label: "Pending approvals",
            value: pendingChanges,
            detail: "Temporary and swap",
            icon: ArrowRightLeft,
          },
        ].map(({ label, value, detail, icon: Icon }) => (
          <Card key={label} className="border-slate-500 dark:border-slate-400">
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                  {label}
                </p>
                <p className="mt-2 text-3xl font-black">{value}</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {detail}
                </p>
              </div>
              <Icon
                aria-hidden="true"
                className="h-7 w-7 text-blue-800 dark:text-cyan-200"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-500 dark:border-slate-400">
        <CardContent className="p-0">
          <div className="border-b border-slate-500 p-5 dark:border-slate-400">
            <h3 className="text-xl font-black">Resolved 14-day route</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {data?.employee
                ? `${data.employee.primary_name} · ${data.employee.employee_number}`
                : "Link this user to an employee record to resolve a personal schedule."}
            </p>
          </div>
          <ol
            className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7"
            aria-label="Resolved fourteen-day employee schedule"
          >
            {data?.timeline.length ? (
              data.timeline.map((day) => (
                <li
                  key={day.date}
                  className="relative min-h-40 overflow-hidden rounded-xl border border-slate-500 bg-white p-4 dark:border-slate-400 dark:bg-slate-950"
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-1.5"
                    style={{
                      backgroundColor: day.work_schedule?.color ?? "#64748B",
                    }}
                  />
                  <time
                    dateTime={day.date}
                    className="text-xs font-black uppercase tracking-[0.1em] text-slate-600 dark:text-slate-300"
                  >
                    {formatDate(day.date)}
                  </time>
                  <p className="mt-4 font-black">
                    {day.resolution?.is_rest_day
                      ? "Rest day"
                      : (day.work_schedule?.name ?? "Unassigned")}
                  </p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                    {day.work_schedule
                      ? `${formatTime(day.work_schedule.starts_at)}–${formatTime(
                          day.work_schedule.ends_at,
                        )}${day.work_schedule.is_night_shift ? " · overnight" : ""}`
                      : day.resolution?.is_rest_day
                        ? "No working interval"
                        : "Needs a schedule source"}
                  </p>
                  <p className="mt-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {sourceLabel(day.resolution?.source_type)}
                    {day.resolution?.cycle_day
                      ? ` · cycle day ${day.resolution.cycle_day}`
                      : ""}
                  </p>
                </li>
              ))
            ) : (
              <li className="col-span-full rounded-xl border border-dashed border-slate-500 p-8 text-center text-sm text-slate-600 dark:border-slate-400 dark:text-slate-300">
                {workspace.isLoading
                  ? "Resolving schedule…"
                  : "No employee schedule could be resolved for this period."}
              </li>
            )}
          </ol>
        </CardContent>
      </Card>

      <div className="grid gap-5 2xl:grid-cols-[1.35fr_1fr]">
        <Card className="border-slate-500 dark:border-slate-400">
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b border-slate-500 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-400">
              <div>
                <h3 className="text-xl font-black">Latest roster</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {latestRoster
                    ? `${latestRoster.name} · ${formatDateRange(
                        latestRoster.starts_on,
                        latestRoster.ends_on,
                      )}`
                    : "Generated roster entries will appear here."}
                </p>
              </div>
              {latestRoster?.status === "draft" &&
                data?.permissions.can_manage_rosters && (
                  <Button
                    type="button"
                    className="min-h-11 bg-blue-800 text-white hover:bg-blue-900 dark:bg-cyan-200 dark:text-slate-950"
                    onClick={() => publishRoster.mutate(latestRoster)}
                    disabled={publishRoster.isPending}
                  >
                    Publish roster
                  </Button>
                )}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>
                  Latest generated roster entries with employee, date, shift,
                  and coverage state.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Employee or opening</TableHead>
                    <TableHead scope="col">Work date</TableHead>
                    <TableHead scope="col">Shift</TableHead>
                    <TableHead scope="col">Coverage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {latestRoster?.entries.length ? (
                    latestRoster.entries.slice(0, 40).map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-semibold">
                          {entry.is_open
                            ? "Open shift"
                            : (entry.employee?.primary_name ??
                              (entry.is_rest_day ? "Rest day" : "Unassigned"))}
                          {entry.employee?.employee_number && (
                            <span className="block text-xs font-normal text-slate-600 dark:text-slate-300">
                              {entry.employee.employee_number}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <time dateTime={entry.work_date}>
                            {formatDate(entry.work_date)}
                          </time>
                        </TableCell>
                        <TableCell>
                          {entry.work_schedule?.name ??
                            (entry.is_rest_day ? "Rest" : "Not assigned")}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold capitalize ${statusClass(
                              entry.is_open ? "submitted" : "approved",
                            )}`}
                          >
                            {entry.is_open ? "Open" : entry.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-10 text-center text-slate-600 dark:text-slate-300"
                      >
                        No roster has been generated yet.
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
            <div className="flex items-start justify-between gap-4 border-b border-slate-500 p-5 dark:border-slate-400">
              <div>
                <h3 className="text-xl font-black">Approval queue</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Temporary schedules and swaps use the shared Workflow inbox.
                </p>
              </div>
              <Link
                href="/dashboard/workflow/approvals"
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-600 px-3 py-2 text-sm font-bold text-slate-900 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-300 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:ring-cyan-300"
              >
                Open inbox
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>
                  Recent temporary schedule and shift-swap requests with domain
                  and Workflow status.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Request</TableHead>
                    <TableHead scope="col">Employee</TableHead>
                    <TableHead scope="col">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changeRows.length ? (
                    changeRows.map((item) => (
                      <TableRow key={item.key}>
                        <TableCell>
                          <span className="font-semibold">{item.type}</span>
                          <span className="block font-mono text-xs text-slate-600 dark:text-slate-300">
                            {item.number}
                          </span>
                          <span className="block text-xs text-slate-600 dark:text-slate-300">
                            {item.period}
                          </span>
                        </TableCell>
                        <TableCell>{item.employee}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold capitalize ${statusClass(
                              item.status,
                            )}`}
                          >
                            {item.status.replaceAll("_", " ")}
                          </span>
                          {item.workflow && (
                            <span className="mt-1 block text-xs capitalize text-slate-600 dark:text-slate-300">
                              Workflow: {item.workflow}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="py-10 text-center text-slate-600 dark:text-slate-300"
                      >
                        No temporary schedule or shift-swap requests yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {latestRoster?.conflict_summary?.length ? (
        <Card className="border-amber-800 bg-amber-50 dark:border-amber-200 dark:bg-amber-950">
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <Factory
                aria-hidden="true"
                className="h-5 w-5 text-amber-900 dark:text-amber-100"
              />
              <h3 className="font-black text-amber-950 dark:text-amber-50">
                Coverage and fatigue checks
              </h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-amber-950 dark:text-amber-50">
              {latestRoster.conflict_summary.map((conflict, index) => (
                <li
                  key={`${conflict.code}-${conflict.work_date}-${index}`}
                  className="rounded-lg border border-amber-800 p-3 dark:border-amber-200"
                >
                  <span className="font-black capitalize">
                    {conflict.blocking ? "Blocking" : "Warning"} ·{" "}
                    {conflict.code.replaceAll("_", " ")}
                  </span>
                  <span className="mt-1 block">{conflict.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {data && (
        <SchedulingActionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          workspace={data}
          employees={visibleEmployees}
        />
      )}
    </section>
  );
}
