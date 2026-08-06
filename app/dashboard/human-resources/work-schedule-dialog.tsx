"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
  attendanceFetch,
  type Employee,
  type WorkSchedule,
} from "@/modules/attendance/api";

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
}: {
  id: string;
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </Label>
      {children}
    </div>
  );
}

export function ScheduleDialog({
  open,
  onOpenChange,
  employees,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    starts_at: "08:00",
    ends_at: "17:00",
    break_minutes: "60",
    grace_minutes: "10",
    weekly_hours: "48",
    employee_id: "",
    effective_from: today(),
  });
  useEffect(() => {
    if (open) {
      setError("");
      setForm({
        code: "",
        name: "",
        starts_at: "08:00",
        ends_at: "17:00",
        break_minutes: "60",
        grace_minutes: "10",
        weekly_hours: "48",
        employee_id: "",
        effective_from: today(),
      });
    }
  }, [open]);
  const mutation = useMutation({
    mutationFn: async () => {
      const result = await attendanceFetch<{ data: WorkSchedule }>("/work-schedules", {
        method: "POST",
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          timezone: "Africa/Addis_Ababa",
          working_days: [1, 2, 3, 4, 5, 6],
          starts_at: form.starts_at,
          ends_at: form.ends_at,
          break_minutes: Number(form.break_minutes),
          grace_minutes: Number(form.grace_minutes),
          weekly_hours: Number(form.weekly_hours),
          is_night_shift: form.ends_at <= form.starts_at,
          is_active: true,
        }),
      });
      if (form.employee_id) {
        await attendanceFetch(`/work-schedules/${result.data.id}/assign`, {
          method: "POST",
          body: JSON.stringify({
            employee_id: Number(form.employee_id),
            effective_from: form.effective_from,
          }),
        });
      }
      return result;
    },
    onSuccess: async () => {
      toast.success("Work schedule created.");
      onOpenChange(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["hr-schedules"] }),
        queryClient.invalidateQueries({ queryKey: ["hr-scheduling"] }),
        queryClient.invalidateQueries({ queryKey: ["hr-attendance"] }),
      ]);
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "The work schedule could not be created.",
      ),
  });
  const describedBy = error ? "hr-operations-error" : undefined;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add work schedule</DialogTitle>
          <DialogDescription>
            Define a six-day Ethiopian private-sector schedule. If the end is
            earlier than the start, Hive treats it as an overnight shift.
          </DialogDescription>
        </DialogHeader>
        <form
          id="schedule-form"
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
          <Field id="schedule-name" label="Schedule name" required>
            <Input
              id="schedule-name"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              required
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy}
              className={controlClass}
            />
          </Field>
          <Field id="schedule-code" label="Schedule code" required>
            <Input
              id="schedule-code"
              value={form.code}
              onChange={(event) =>
                setForm({ ...form, code: event.target.value })
              }
              required
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy}
              className={controlClass}
            />
          </Field>
          <Field id="schedule-start" label="Starts at" required>
            <Input
              id="schedule-start"
              type="time"
              value={form.starts_at}
              onChange={(event) =>
                setForm({ ...form, starts_at: event.target.value })
              }
              required
              className={controlClass}
            />
          </Field>
          <Field id="schedule-end" label="Ends at" required>
            <Input
              id="schedule-end"
              type="time"
              value={form.ends_at}
              onChange={(event) =>
                setForm({ ...form, ends_at: event.target.value })
              }
              required
              className={controlClass}
            />
          </Field>
          <Field id="schedule-break" label="Break minutes" required>
            <Input
              id="schedule-break"
              type="number"
              min="0"
              max="240"
              value={form.break_minutes}
              onChange={(event) =>
                setForm({ ...form, break_minutes: event.target.value })
              }
              required
              className={controlClass}
            />
          </Field>
          <Field id="schedule-grace" label="Arrival grace minutes" required>
            <Input
              id="schedule-grace"
              type="number"
              min="0"
              max="120"
              value={form.grace_minutes}
              onChange={(event) =>
                setForm({ ...form, grace_minutes: event.target.value })
              }
              required
              className={controlClass}
            />
          </Field>
          <Field id="schedule-hours" label="Weekly hours" required>
            <Input
              id="schedule-hours"
              type="number"
              min="1"
              max="48"
              step="0.5"
              value={form.weekly_hours}
              onChange={(event) =>
                setForm({ ...form, weekly_hours: event.target.value })
              }
              required
              className={controlClass}
            />
          </Field>
          <Field id="schedule-employee" label="Assign immediately">
            <select
              id="schedule-employee"
              value={form.employee_id}
              onChange={(event) =>
                setForm({ ...form, employee_id: event.target.value })
              }
              className={selectClass}
            >
              <option value="">No immediate assignment</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.primary_name}
                </option>
              ))}
            </select>
          </Field>
          {form.employee_id && (
            <div className="sm:col-span-2">
              <Field
                id="schedule-effective"
                label="Assignment effective date"
                required
              >
                <Input
                  id="schedule-effective"
                  type="date"
                  value={form.effective_from}
                  onChange={(event) =>
                    setForm({ ...form, effective_from: event.target.value })
                  }
                  required
                  className={controlClass}
                />
              </Field>
            </div>
          )}
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
            form="schedule-form"
            disabled={
              mutation.isPending || !form.name.trim() || !form.code.trim()
            }
          >
            Save schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
