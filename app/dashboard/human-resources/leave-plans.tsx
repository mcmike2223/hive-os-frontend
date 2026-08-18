"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  History,
  Layers3,
  Link2,
  NotebookTabs,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRoundCog,
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
  Employee,
  LeaveAccrualRun,
  LeaveAllocation,
  LeaveLedgerTransaction,
  LeavePlan,
  LeavePlanAssignment,
  LeavePlanRule,
  LeavePlanVersion,
  LeaveType,
  OrganizationUnit,
  Paginated,
  Position,
  hrFetch,
} from "@/modules/humanresources/api";
import {
  PanelCardGridSkeleton,
  PanelTableSkeleton,
} from "@/components/ui/loading-states";

const controlClass =
  "h-11 border-input bg-background text-foreground focus-visible:ring-2 focus-visible:ring-primary";
const selectClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary";
const today = () => new Date().toISOString().slice(0, 10);

type RuleDraft = {
  leave_type_id: string;
  entitlement_days: string;
  allocation_method: "fixed" | "daily" | "monthly" | "yearly" | "anniversary";
  frequency: "daily" | "monthly" | "yearly" | "anniversary";
  accrual_amount: string;
  accrual_day: string;
  maximum_balance: string;
  carry_forward_limit: string;
};

function newRule(leaveTypeId = ""): RuleDraft {
  return {
    leave_type_id: leaveTypeId,
    entitlement_days: "18",
    allocation_method: "monthly",
    frequency: "monthly",
    accrual_amount: "1.5",
    accrual_day: "1",
    maximum_balance: "30",
    carry_forward_limit: "10",
  };
}

function Field({
  id,
  label,
  required,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
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

function FormError({
  id,
  message,
}: {
  id: string;
  message: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message) ref.current?.focus();
  }, [message]);

  if (!message) return null;

  return (
    <div
      ref={ref}
      id={id}
      role="alert"
      tabIndex={-1}
      className="rounded-lg border border-red-700 bg-red-50 p-3 text-sm font-semibold text-red-800 outline-none focus-visible:ring-2 focus-visible:ring-red-700 dark:border-red-300 dark:bg-red-950 dark:text-red-200"
    >
      {message}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const styles =
    status === "active" || status === "completed" || status === "posted"
      ? "border-emerald-700 bg-emerald-50 text-emerald-800 dark:border-emerald-300 dark:bg-emerald-950 dark:text-emerald-100"
      : status === "draft" ||
          status === "queued" ||
          status === "running"
        ? "border-amber-700 bg-amber-50 text-amber-950 dark:border-amber-300 dark:bg-amber-950 dark:text-amber-100"
        : status === "completed_with_errors"
          ? "border-red-700 bg-red-50 text-red-800 dark:border-red-300 dark:bg-red-950 dark:text-red-100"
          : "border-slate-500 bg-slate-100 text-slate-800 dark:border-slate-400 dark:bg-slate-900 dark:text-slate-100";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${styles}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function formatQuantity(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isInteger(number)
    ? number.toLocaleString()
    : number.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** Human summary of a ledger row. `quantity` = change to *available* days. */
function describeLedgerEntry(entry: LeaveLedgerTransaction) {
  const available = Number(entry.quantity ?? 0);
  const reserved = Number(entry.reserved_delta ?? 0);
  const used = Number(entry.used_delta ?? 0);
  const credited =
    Number(entry.entitlement_delta ?? 0) +
    Number(entry.carried_delta ?? 0) +
    Number(entry.adjusted_delta ?? 0);
  const signed = (value: number) =>
    `${value > 0 ? "+" : ""}${formatQuantity(value)}`;

  switch (entry.transaction_type) {
    case "reservation":
      return {
        event: "Leave submitted",
        availableLabel: signed(available),
        detail: `${formatQuantity(Math.abs(reserved))} day(s) held until approval`,
      };
    case "consumption":
      return {
        event: "Leave approved",
        availableLabel:
          available === 0 ? "No change" : signed(available),
        detail: `${formatQuantity(Math.abs(used))} day(s) moved from held → used`,
      };
    case "release":
      return {
        event: "Hold cleared",
        availableLabel: signed(available),
        detail: "Request rejected, withdrawn, or sent back",
      };
    case "allocation":
    case "accrual":
    case "opening_balance":
    case "one_time":
      return {
        event: "Days credited",
        availableLabel: signed(available || credited),
        detail:
          entry.transaction_type === "accrual"
            ? "From an accrual run"
            : "Manual or opening credit",
      };
    case "carry_forward":
      return {
        event: "Carry forward",
        availableLabel: signed(available),
        detail: "Brought from a prior period",
      };
    case "adjustment":
      return {
        event: "Adjustment",
        availableLabel: signed(available),
        detail: entry.note?.trim() || "Manual balance adjustment",
      };
    default:
      return {
        event: entry.transaction_type.replaceAll("_", " "),
        availableLabel: signed(available),
        detail: entry.note?.trim() || null,
      };
  }
}

function currentVersion(plan: LeavePlan) {
  return (
    plan.versions.find((version) => version.status === "active") ??
    plan.versions[0]
  );
}

function CreatePlanDialog({
  open,
  onOpenChange,
  leaveTypes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaveTypes: LeaveType[];
}) {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    effective_from: today().slice(0, 4) + "-01-01",
    priority: "10",
    is_default: false,
    legal_reference: "",
  });
  const [rules, setRules] = useState<RuleDraft[]>([newRule()]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm({
      code: "",
      name: "",
      description: "",
      effective_from: today().slice(0, 4) + "-01-01",
      priority: "10",
      is_default: false,
      legal_reference: "",
    });
    setRules([newRule(String(leaveTypes[0]?.id ?? ""))]);
  }, [leaveTypes, open]);

  const mutation = useMutation({
    mutationFn: () =>
      hrFetch<{ data: LeavePlan }>("/leave/plans", {
        method: "POST",
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          description: form.description.trim() || null,
          country_code: "ET",
          priority: Number(form.priority),
          is_default: form.is_default,
          effective_from: form.effective_from,
          effective_to: null,
          eligibility_rules: {
            employment_statuses: ["active", "probation", "on_leave"],
            minimum_service_days: 0,
          },
          combination_mode: "exclusive",
          legal_reference: form.legal_reference.trim() || null,
          change_summary: "Initial controlled plan version.",
          activate: true,
          rules: rules.map((rule) => ({
            leave_type_id: Number(rule.leave_type_id),
            entitlement_days: rule.entitlement_days
              ? Number(rule.entitlement_days)
              : null,
            allocation_method: rule.allocation_method,
            unit: "days",
            rounding_mode: "nearest",
            rounding_precision: 2,
            maximum_balance: rule.maximum_balance
              ? Number(rule.maximum_balance)
              : null,
            carry_forward_limit: rule.carry_forward_limit
              ? Number(rule.carry_forward_limit)
              : null,
            carry_forward_expiry_days: rule.carry_forward_limit ? 90 : null,
            negative_balance_limit: 0,
            waiting_period_days: 0,
            prorate_on_hire: true,
            prorate_on_termination: true,
            encashment_allowed: false,
            rules: {},
            accrual_rules:
              rule.allocation_method === "fixed"
                ? []
                : [
                    {
                      frequency: rule.frequency,
                      amount: Number(rule.accrual_amount),
                      accrual_day:
                        rule.frequency === "monthly" && rule.accrual_day
                          ? Number(rule.accrual_day)
                          : null,
                      service_tiers: [],
                      suspension_rules: {},
                      maximum_per_period: Number(rule.accrual_amount),
                      is_active: true,
                    },
                  ],
          })),
        }),
      }),
    onSuccess: () => {
      toast.success("Leave plan activated.");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["hr-leave-plans", scope] });
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "The leave plan could not be created.",
      ),
  });

  const updateRule = <K extends keyof RuleDraft>(
    index: number,
    field: K,
    value: RuleDraft[K],
  ) => {
    setRules((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };
  const invalid =
    !form.code.trim() ||
    !form.name.trim() ||
    !form.effective_from ||
    rules.length === 0 ||
    rules.some(
      (rule) =>
        !rule.leave_type_id ||
        !rule.entitlement_days ||
        (rule.allocation_method !== "fixed" && !rule.accrual_amount),
    ) ||
    new Set(rules.map((rule) => rule.leave_type_id)).size !== rules.length;
  const describedBy = error ? "leave-plan-create-error" : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create leave plan</DialogTitle>
          <DialogDescription>
            Define the plan and its first effective-dated entitlement version.
            The version is activated when you save.
          </DialogDescription>
        </DialogHeader>
        <FormError id="leave-plan-create-error" message={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="leave-plan-code" label="Plan code" required>
            <Input
              id="leave-plan-code"
              value={form.code}
              onChange={(event) =>
                setForm((value) => ({ ...value, code: event.target.value }))
              }
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy}
              className={controlClass}
              placeholder="ET-STANDARD"
            />
          </Field>
          <Field id="leave-plan-name" label="Plan name" required>
            <Input
              id="leave-plan-name"
              value={form.name}
              onChange={(event) =>
                setForm((value) => ({ ...value, name: event.target.value }))
              }
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy}
              className={controlClass}
              placeholder="Ethiopia standard leave"
            />
          </Field>
          <Field id="leave-plan-effective" label="Effective from" required>
            <Input
              id="leave-plan-effective"
              type="date"
              value={form.effective_from}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  effective_from: event.target.value,
                }))
              }
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy}
              className={controlClass}
            />
          </Field>
          <Field
            id="leave-plan-priority"
            label="Resolution priority"
            hint="Higher numbers win when two assignments have the same scope."
          >
            <Input
              id="leave-plan-priority"
              type="number"
              min="0"
              max="10000"
              value={form.priority}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  priority: event.target.value,
                }))
              }
              className={controlClass}
            />
          </Field>
          <Field id="leave-plan-reference" label="Legal reference">
            <Input
              id="leave-plan-reference"
              value={form.legal_reference}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  legal_reference: event.target.value,
                }))
              }
              className={controlClass}
              placeholder="Labour Proclamation No. 1156/2019"
            />
          </Field>
          <div className="flex items-end">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-slate-500 px-3 text-sm font-bold dark:border-slate-400">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    is_default: event.target.checked,
                  }))
                }
                className="h-5 w-5 accent-teal-700"
              />
              Organization default plan
            </label>
          </div>
          <div className="sm:col-span-2">
            <Field id="leave-plan-description" label="Description">
              <Textarea
                id="leave-plan-description"
                value={form.description}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    description: event.target.value,
                  }))
                }
                className="min-h-24 border-slate-500 dark:border-slate-400"
              />
            </Field>
          </div>
        </div>
        <section
          aria-labelledby="leave-plan-rules-heading"
          className="space-y-3 border-t border-slate-400 pt-5 dark:border-slate-600"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 id="leave-plan-rules-heading" className="font-black">
                Entitlement rules
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Add one rule for every leave type covered by this plan.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() =>
                setRules((items) => [
                  ...items,
                  newRule(String(leaveTypes[0]?.id ?? "")),
                ])
              }
            >
              <Plus aria-hidden="true" />
              Add leave type
            </Button>
          </div>
          {rules.map((rule, index) => (
            <div
              key={index}
              className="rounded-xl border border-slate-500 bg-slate-50 p-4 dark:border-slate-500 dark:bg-slate-950"
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  id={`leave-rule-type-${index}`}
                  label="Leave type"
                  required
                >
                  <select
                    id={`leave-rule-type-${index}`}
                    value={rule.leave_type_id}
                    onChange={(event) =>
                      updateRule(index, "leave_type_id", event.target.value)
                    }
                    className={selectClass}
                  >
                    <option value="">Select a type</option>
                    {leaveTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  id={`leave-rule-entitlement-${index}`}
                  label="Annual entitlement"
                  required
                >
                  <Input
                    id={`leave-rule-entitlement-${index}`}
                    type="number"
                    min="0"
                    step="0.25"
                    value={rule.entitlement_days}
                    onChange={(event) =>
                      updateRule(index, "entitlement_days", event.target.value)
                    }
                    className={controlClass}
                  />
                </Field>
                <Field
                  id={`leave-rule-method-${index}`}
                  label="Allocation method"
                  required
                >
                  <select
                    id={`leave-rule-method-${index}`}
                    value={rule.allocation_method}
                    onChange={(event) =>
                      updateRule(
                        index,
                        "allocation_method",
                        event.target.value as RuleDraft["allocation_method"],
                      )
                    }
                    className={selectClass}
                  >
                    <option value="fixed">Fixed annual grant</option>
                    <option value="daily">Daily accrual</option>
                    <option value="monthly">Monthly accrual</option>
                    <option value="yearly">Yearly accrual</option>
                    <option value="anniversary">Hire anniversary</option>
                  </select>
                </Field>
                <Field
                  id={`leave-rule-maximum-${index}`}
                  label="Maximum balance"
                >
                  <Input
                    id={`leave-rule-maximum-${index}`}
                    type="number"
                    min="0"
                    step="0.25"
                    value={rule.maximum_balance}
                    onChange={(event) =>
                      updateRule(index, "maximum_balance", event.target.value)
                    }
                    className={controlClass}
                  />
                </Field>
                {rule.allocation_method !== "fixed" && (
                  <>
                    <Field
                      id={`leave-rule-frequency-${index}`}
                      label="Accrual frequency"
                      required
                    >
                      <select
                        id={`leave-rule-frequency-${index}`}
                        value={rule.frequency}
                        onChange={(event) =>
                          updateRule(
                            index,
                            "frequency",
                            event.target.value as RuleDraft["frequency"],
                          )
                        }
                        className={selectClass}
                      >
                        <option value="daily">Daily</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                        <option value="anniversary">Hire anniversary</option>
                      </select>
                    </Field>
                    <Field
                      id={`leave-rule-amount-${index}`}
                      label="Accrual amount"
                      required
                    >
                      <Input
                        id={`leave-rule-amount-${index}`}
                        type="number"
                        min="0.0001"
                        step="0.25"
                        value={rule.accrual_amount}
                        onChange={(event) =>
                          updateRule(
                            index,
                            "accrual_amount",
                            event.target.value,
                          )
                        }
                        className={controlClass}
                      />
                    </Field>
                  </>
                )}
                <Field
                  id={`leave-rule-carry-${index}`}
                  label="Carry-forward limit"
                >
                  <Input
                    id={`leave-rule-carry-${index}`}
                    type="number"
                    min="0"
                    step="0.25"
                    value={rule.carry_forward_limit}
                    onChange={(event) =>
                      updateRule(
                        index,
                        "carry_forward_limit",
                        event.target.value,
                      )
                    }
                    className={controlClass}
                  />
                </Field>
                <div className="flex items-end justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 border-red-700 text-red-800 dark:border-red-300 dark:text-red-200"
                    disabled={rules.length === 1}
                    onClick={() =>
                      setRules((items) =>
                        items.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    aria-label={`Remove entitlement rule ${index + 1}`}
                  >
                    <Trash2 aria-hidden="true" />
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </section>
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
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || invalid}
            className="min-h-11"
          >
            {mutation.isPending ? "Creating…" : "Create and activate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewVersionDialog({
  plan,
  onOpenChange,
}: {
  plan: LeavePlan | null;
  onOpenChange: (open: boolean) => void;
}) {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!plan) return;
    setEffectiveFrom(today());
    setSummary("");
    setError("");
  }, [plan]);

  const mutation = useMutation({
    mutationFn: () =>
      hrFetch<{ data: LeavePlanVersion }>(
        `/leave/plans/${plan?.id}/versions`,
        {
          method: "POST",
          body: JSON.stringify({
            effective_from: effectiveFrom,
            effective_to: null,
            eligibility_rules:
              currentVersion(plan as LeavePlan)?.eligibility_rules ?? {},
            combination_mode:
              currentVersion(plan as LeavePlan)?.combination_mode ??
              "exclusive",
            legal_reference:
              currentVersion(plan as LeavePlan)?.legal_reference ?? null,
            change_summary: summary.trim(),
            clone_current: true,
            rules: [],
          }),
        },
      ),
    onSuccess: () => {
      toast.success("Draft leave-plan version created.");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["hr-leave-plans", scope] });
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "The version could not be created.",
      ),
  });

  return (
    <Dialog open={Boolean(plan)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New version for {plan?.name}</DialogTitle>
          <DialogDescription>
            Clone the latest rules into a draft. Review it in the version
            history, then activate it when its effective period is ready.
          </DialogDescription>
        </DialogHeader>
        <FormError id="leave-version-error" message={error} />
        <Field id="leave-version-effective" label="Effective from" required>
          <Input
            id="leave-version-effective"
            type="date"
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "leave-version-error" : undefined}
            className={controlClass}
          />
        </Field>
        <Field id="leave-version-summary" label="Change summary" required>
          <Textarea
            id="leave-version-summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "leave-version-error" : undefined}
            className="min-h-28 border-slate-500 dark:border-slate-400"
            placeholder="Explain why this entitlement version is changing."
          />
        </Field>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={
              mutation.isPending || !effectiveFrom || !summary.trim() || !plan
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Creating…" : "Create draft version"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignmentDialog({
  open,
  onOpenChange,
  plans,
  employees,
  units,
  positions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: LeavePlan[];
  employees: Employee[];
  units: OrganizationUnit[];
  positions: Position[];
}) {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    leave_plan_id: "",
    scope_type: "default",
    scope_value: "",
    effective_from: today(),
    priority: "0",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm({
      leave_plan_id: String(plans.find((plan) => plan.status === "active")?.id ?? ""),
      scope_type: "default",
      scope_value: "",
      effective_from: today(),
      priority: "0",
    });
  }, [open, plans]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        employee_id: null,
        organization_unit_id: null,
        position_id: null,
        employment_type_code: null,
        job_grade_code: null,
        contract_type: null,
        is_default: form.scope_type === "default",
        priority: Number(form.priority),
        effective_from: form.effective_from,
        effective_to: null,
        assignment_source: "manual",
      };
      if (form.scope_type !== "default") {
        payload[form.scope_type] = ["employee_id", "organization_unit_id", "position_id"].includes(
          form.scope_type,
        )
          ? Number(form.scope_value)
          : form.scope_value.trim();
      }
      return hrFetch<{ data: LeavePlanAssignment }>(
        `/leave/plans/${form.leave_plan_id}/assignments`,
        { method: "POST", body: JSON.stringify(payload) },
      );
    },
    onSuccess: () => {
      toast.success("Leave plan assignment saved.");
      onOpenChange(false);
      queryClient.invalidateQueries({
        queryKey: ["hr-leave-plan-assignments", scope],
      });
      queryClient.invalidateQueries({ queryKey: ["hr-leave-plans", scope] });
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "The assignment could not be saved.",
      ),
  });
  const options =
    form.scope_type === "employee_id"
      ? employees.map((employee) => ({
          value: String(employee.id),
          label: `${employee.primary_name} · ${employee.employee_number}`,
        }))
      : form.scope_type === "organization_unit_id"
        ? units.map((unit) => ({
            value: String(unit.id),
            label: `${unit.name} · ${unit.code}`,
          }))
        : form.scope_type === "position_id"
          ? positions.map((position) => ({
              value: String(position.id),
              label: `${position.title} · ${position.code}`,
            }))
          : [];
  const valueNeeded = form.scope_type !== "default";
  const isLookupScope = [
    "employee_id",
    "organization_unit_id",
    "position_id",
  ].includes(form.scope_type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Assign leave plan</DialogTitle>
          <DialogDescription>
            Tell the system who follows this leave plan. Start with
            Organization default for everyone, or pick a team / person for
            exceptions. A specific employee always wins over a team or default.
          </DialogDescription>
        </DialogHeader>
        <FormError id="leave-assignment-error" message={error} />
        <Field id="leave-assignment-plan" label="Leave plan" required>
          <select
            id="leave-assignment-plan"
            value={form.leave_plan_id}
            onChange={(event) =>
              setForm((value) => ({
                ...value,
                leave_plan_id: event.target.value,
              }))
            }
            className={selectClass}
          >
            <option value="">Select an active plan</option>
            {plans
              .filter((plan) => plan.status === "active")
              .map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} · {plan.code}
                </option>
              ))}
          </select>
        </Field>
        <Field id="leave-assignment-scope" label="Assignment scope" required>
          <select
            id="leave-assignment-scope"
            value={form.scope_type}
            onChange={(event) =>
              setForm((value) => ({
                ...value,
                scope_type: event.target.value,
                scope_value: "",
              }))
            }
            className={selectClass}
          >
            <option value="default">Organization default</option>
            <option value="employee_id">Employee</option>
            <option value="organization_unit_id">Organization unit</option>
            <option value="position_id">Position</option>
            <option value="employment_type_code">Employment type code</option>
            <option value="job_grade_code">Job grade code</option>
            <option value="contract_type">Contract type</option>
          </select>
        </Field>
        {valueNeeded && (
          <Field
            id="leave-assignment-value"
            label={
              form.scope_type === "employee_id"
                ? "Employee"
                : form.scope_type === "organization_unit_id"
                  ? "Organization unit"
                  : form.scope_type === "position_id"
                    ? "Position"
                    : "Scope value"
            }
            required
            hint={
              isLookupScope
                ? undefined
                : "Use the exact code configured in ERP reference data."
            }
          >
            {isLookupScope ? (
              <select
                id="leave-assignment-value"
                value={form.scope_value}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    scope_value: event.target.value,
                  }))
                }
                className={selectClass}
              >
                <option value="">Select a value</option>
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id="leave-assignment-value"
                value={form.scope_value}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    scope_value: event.target.value,
                  }))
                }
                aria-describedby="leave-assignment-value-hint"
                className={controlClass}
              />
            )}
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="leave-assignment-effective" label="Effective from" required>
            <Input
              id="leave-assignment-effective"
              type="date"
              value={form.effective_from}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  effective_from: event.target.value,
                }))
              }
              className={controlClass}
            />
          </Field>
          <Field id="leave-assignment-priority" label="Extra priority">
            <Input
              id="leave-assignment-priority"
              type="number"
              min="0"
              max="10000"
              value={form.priority}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  priority: event.target.value,
                }))
              }
              className={controlClass}
            />
          </Field>
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
            type="button"
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              !form.leave_plan_id ||
              !form.effective_from ||
              (valueNeeded && !form.scope_value.trim())
            }
            className="min-h-11"
          >
            {mutation.isPending ? "Assigning…" : "Assign plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AllocationDialog({
  open,
  onOpenChange,
  employees,
  leaveTypes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  leaveTypes: LeaveType[];
}) {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    employee_id: "",
    leave_type_id: "",
    quantity: "",
    effective_on: today(),
    source: "manual",
    explanation: "",
    idempotency_key: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm({
      employee_id: "",
      leave_type_id: String(leaveTypes[0]?.id ?? ""),
      quantity: "",
      effective_on: today(),
      source: "manual",
      explanation: "",
      idempotency_key: `manual-${Date.now()}`,
    });
  }, [leaveTypes, open]);

  const mutation = useMutation({
    mutationFn: () =>
      hrFetch("/leave/allocations", {
        method: "POST",
        body: JSON.stringify({
          employee_id: Number(form.employee_id),
          leave_type_id: Number(form.leave_type_id),
          quantity: Number(form.quantity),
          effective_on: form.effective_on,
          source: form.source,
          explanation: form.explanation.trim(),
          idempotency_key: form.idempotency_key,
        }),
      }),
    onSuccess: () => {
      toast.success("Leave allocation posted to the ledger.");
      onOpenChange(false);
      queryClient.invalidateQueries({
        queryKey: ["hr-leave-allocations", scope],
      });
      queryClient.invalidateQueries({ queryKey: ["hr-leave-ledger", scope] });
      queryClient.invalidateQueries({ queryKey: ["hr-leave-balances"] });
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "The allocation could not be posted.",
      ),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Allocate leave days</DialogTitle>
          <DialogDescription>
            Add an authorized entitlement credit. This creates an immutable
            allocation and ledger entry.
          </DialogDescription>
        </DialogHeader>
        <FormError id="leave-allocation-error" message={error} />
        <Field id="leave-allocation-employee" label="Employee" required>
          <select
            id="leave-allocation-employee"
            value={form.employee_id}
            onChange={(event) =>
              setForm((value) => ({
                ...value,
                employee_id: event.target.value,
              }))
            }
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="leave-allocation-type" label="Leave type" required>
            <select
              id="leave-allocation-type"
              value={form.leave_type_id}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  leave_type_id: event.target.value,
                }))
              }
              className={selectClass}
            >
              <option value="">Select a leave type</option>
              {leaveTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="leave-allocation-quantity" label="Days" required>
            <Input
              id="leave-allocation-quantity"
              type="number"
              min="0.0001"
              max="10000"
              step="0.25"
              value={form.quantity}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  quantity: event.target.value,
                }))
              }
              className={controlClass}
            />
          </Field>
          <Field id="leave-allocation-date" label="Effective date" required>
            <Input
              id="leave-allocation-date"
              type="date"
              value={form.effective_on}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  effective_on: event.target.value,
                }))
              }
              className={controlClass}
            />
          </Field>
          <Field id="leave-allocation-source" label="Allocation source" required>
            <select
              id="leave-allocation-source"
              value={form.source}
              onChange={(event) =>
                setForm((value) => ({ ...value, source: event.target.value }))
              }
              className={selectClass}
            >
              <option value="manual">Manual allocation</option>
              <option value="opening_balance">Opening balance</option>
              <option value="one_time">One-time award</option>
            </select>
          </Field>
        </div>
        <Field id="leave-allocation-explanation" label="Explanation" required>
          <Textarea
            id="leave-allocation-explanation"
            value={form.explanation}
            onChange={(event) =>
              setForm((value) => ({
                ...value,
                explanation: event.target.value,
              }))
            }
            className="min-h-28 border-slate-500 dark:border-slate-400"
            placeholder="Record the authorization or business reason."
          />
        </Field>
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
            type="button"
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              !form.employee_id ||
              !form.leave_type_id ||
              !form.quantity ||
              !form.effective_on ||
              !form.explanation.trim()
            }
            className="min-h-11"
          >
            {mutation.isPending ? "Posting…" : "Post allocation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccrualDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const [asOfDate, setAsOfDate] = useState(today());
  const [mode, setMode] = useState<"sync" | "queue">("sync");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setAsOfDate(today());
    setMode("sync");
    setError("");
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      hrFetch<{ data: LeaveAccrualRun | { status: "queued" } }>(
        "/leave/accrual-runs",
        {
          method: "POST",
          body: JSON.stringify({
            as_of_date: asOfDate,
            idempotency_key: `leave-accrual-run:${asOfDate}`,
            mode,
          }),
        },
      ),
    onSuccess: () => {
      toast.success(
        mode === "queue"
          ? "Accrual run queued."
          : "Accrual run completed and ledger entries were posted.",
      );
      onOpenChange(false);
      queryClient.invalidateQueries({
        queryKey: ["hr-leave-accrual-runs", scope],
      });
      queryClient.invalidateQueries({
        queryKey: ["hr-leave-allocations", scope],
      });
      queryClient.invalidateQueries({ queryKey: ["hr-leave-ledger", scope] });
      queryClient.invalidateQueries({ queryKey: ["hr-leave-balances"] });
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "The accrual run could not be started.",
      ),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Run leave accruals</DialogTitle>
          <DialogDescription>
            Evaluate active employee assignments and post every due entitlement
            once for the selected date.
          </DialogDescription>
        </DialogHeader>
        <FormError id="leave-accrual-error" message={error} />
        <Field id="leave-accrual-date" label="Accrual date" required>
          <Input
            id="leave-accrual-date"
            type="date"
            value={asOfDate}
            onChange={(event) => setAsOfDate(event.target.value)}
            className={controlClass}
          />
        </Field>
        <Field
          id="leave-accrual-mode"
          label="Run mode"
          hint="Use background queue for a large workforce."
        >
          <select
            id="leave-accrual-mode"
            value={mode}
            onChange={(event) =>
              setMode(event.target.value as "sync" | "queue")
            }
            className={selectClass}
          >
            <option value="sync">Run now</option>
            <option value="queue">Background queue</option>
          </select>
        </Field>
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
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !asOfDate}
            className="min-h-11"
          >
            <Play aria-hidden="true" />
            {mutation.isPending ? "Running…" : "Start accrual run"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function scopeValue(assignment: LeavePlanAssignment) {
  if (assignment.employee)
    return `${assignment.employee.primary_name} · ${assignment.employee.employee_number}`;
  if (assignment.organization_unit)
    return `${assignment.organization_unit.name} · ${assignment.organization_unit.code}`;
  if (assignment.position)
    return `${assignment.position.title} · ${assignment.position.code}`;
  return (
    assignment.employment_type_code ??
    assignment.job_grade_code ??
    assignment.contract_type ??
    "Everyone"
  );
}

function PlanRules({ rules }: { rules: LeavePlanRule[] }) {
  if (!rules.length) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-300">
        No entitlement rules were stored for this version.
      </p>
    );
  }

  return (
    <ul className="grid gap-2 lg:grid-cols-2">
      {rules.map((rule) => (
        <li
          key={rule.id}
          className="rounded-lg border border-slate-400 bg-white p-3 dark:border-slate-600 dark:bg-slate-950"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-bold">{rule.leave_type.name}</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {rule.allocation_method.replaceAll("_", " ")}
                {rule.accrual_rules[0]
                  ? ` · ${formatQuantity(rule.accrual_rules[0].amount)} ${rule.accrual_rules[0].frequency}`
                  : ""}
              </p>
            </div>
            <span className="font-mono text-sm font-black">
              {formatQuantity(rule.entitlement_days)} days
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-300 pt-3 text-xs dark:border-slate-700">
            <div>
              <dt className="text-slate-600 dark:text-slate-300">
                Maximum balance
              </dt>
              <dd className="mt-1 font-bold">
                {rule.maximum_balance === null
                  ? "No cap"
                  : `${formatQuantity(rule.maximum_balance)} days`}
              </dd>
            </div>
            <div>
              <dt className="text-slate-600 dark:text-slate-300">
                Carry forward
              </dt>
              <dd className="mt-1 font-bold">
                {rule.carry_forward_limit === null
                  ? "Not capped"
                  : `${formatQuantity(rule.carry_forward_limit)} days`}
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

export function LeavePlanWorkspace() {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const { hasAnyPermission, hasPermission, isLoaded } = usePermissions();
  const canViewPlans = hasAnyPermission([
    "view_leave_plans",
    "manage_leave_plans",
  ]);
  const canManagePlans = hasPermission("manage_leave_plans");
  const canAssign = hasPermission("assign_leave_plans");
  const canAllocate = hasPermission("allocate_leave");
  const canRunAccruals = hasPermission("run_leave_accruals");
  const canViewLedger = hasAnyPermission([
    "view_leave_balances",
    "view_workforce_audit",
  ]);
  const canViewEmployees = hasAnyPermission([
    "view_employees",
    "manage_employees",
  ]);
  const visible =
    canViewPlans ||
    canManagePlans ||
    canAssign ||
    canAllocate ||
    canRunAccruals ||
    canViewLedger;
  const [createOpen, setCreateOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [allocationOpen, setAllocationOpen] = useState(false);
  const [accrualOpen, setAccrualOpen] = useState(false);
  const [versionPlan, setVersionPlan] = useState<LeavePlan | null>(null);

  const plans = useQuery({
    queryKey: ["hr-leave-plans", scope],
    queryFn: () => hrFetch<{ data: LeavePlan[] }>("/leave/plans"),
    enabled: isLoaded && (canViewPlans || canManagePlans || canAssign),
  });
  const leaveTypes = useQuery({
    queryKey: ["hr-leave-types", scope],
    queryFn: () => hrFetch<{ data: LeaveType[] }>("/leave/types"),
    enabled:
      isLoaded && (canManagePlans || canAllocate || canRunAccruals || canViewPlans),
  });
  const employees = useQuery({
    queryKey: ["hr-leave-plan-employees", scope],
    queryFn: () => hrFetch<Paginated<Employee>>("/employees?per_page=100"),
    enabled: isLoaded && canViewEmployees && (canAssign || canAllocate),
  });
  const units = useQuery({
    queryKey: ["hr-leave-plan-units", scope],
    queryFn: () =>
      hrFetch<Paginated<OrganizationUnit>>("/organization-units?per_page=100"),
    enabled: isLoaded && canAssign,
  });
  const positions = useQuery({
    queryKey: ["hr-leave-plan-positions", scope],
    queryFn: () => hrFetch<Paginated<Position>>("/positions?per_page=100"),
    enabled: isLoaded && canAssign,
  });
  const assignments = useQuery({
    queryKey: ["hr-leave-plan-assignments", scope],
    queryFn: () =>
      hrFetch<Paginated<LeavePlanAssignment>>(
        "/leave/plan-assignments?per_page=50",
      ),
    enabled: isLoaded && (canViewPlans || canAssign),
  });
  const allocations = useQuery({
    queryKey: ["hr-leave-allocations", scope],
    queryFn: () =>
      hrFetch<Paginated<LeaveAllocation>>("/leave/allocations?per_page=25"),
    enabled: isLoaded && (canAllocate || canViewLedger),
  });
  const accrualRuns = useQuery({
    queryKey: ["hr-leave-accrual-runs", scope],
    queryFn: () =>
      hrFetch<Paginated<LeaveAccrualRun>>("/leave/accrual-runs?per_page=20"),
    enabled: isLoaded && (canRunAccruals || canViewLedger),
    refetchInterval: (query) =>
      query.state.data?.data.some((run) =>
        ["queued", "running"].includes(run.status),
      )
        ? 3000
        : false,
  });
  const ledger = useQuery({
    queryKey: ["hr-leave-ledger", scope],
    queryFn: () =>
      hrFetch<Paginated<LeaveLedgerTransaction>>("/leave/ledger?per_page=50"),
    enabled: isLoaded && canViewLedger,
  });

  const activate = useMutation({
    mutationFn: ({
      planId,
      versionId,
    }: {
      planId: number;
      versionId: number;
    }) =>
      hrFetch(`/leave/plans/${planId}/versions/${versionId}/activate`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("Leave-plan version activated.");
      queryClient.invalidateQueries({ queryKey: ["hr-leave-plans", scope] });
    },
    onError: (failure) =>
      toast.error(
        failure instanceof Error
          ? failure.message
          : "The version could not be activated.",
      ),
  });
  const latestRun = accrualRuns.data?.data[0];
  const activePlans = useMemo(
    () => (plans.data?.data ?? []).filter((plan) => plan.status === "active"),
    [plans.data?.data],
  );

  if (!isLoaded || !visible) return null;

  return (
    <section
      aria-labelledby="leave-plan-workspace-heading"
      className="space-y-5 border-t border-slate-400 pt-6 dark:border-slate-600"
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800 dark:text-teal-200">
            Phase 3 · entitlement operations
          </p>
          <h3
            id="leave-plan-workspace-heading"
            className="mt-2 text-2xl font-black"
          >
            Leave plans and ledger
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Define how many leave days people earn, link the plan to the
            workforce, then credit days (manually or by monthly accrual). Leave
            requests spend from those balances.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {canManagePlans && (
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="min-h-11 bg-teal-800 text-white hover:bg-teal-900 dark:bg-teal-600 dark:text-slate-950 dark:hover:bg-teal-500"
            >
              <Plus aria-hidden="true" />
              Create plan
            </Button>
          )}
          {canAssign && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssignmentOpen(true)}
              className="min-h-11"
            >
              <UserRoundCog aria-hidden="true" />
              Assign
            </Button>
          )}
          {canAllocate && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setAllocationOpen(true)}
              className="min-h-11"
            >
              <NotebookTabs aria-hidden="true" />
              Allocate
            </Button>
          )}
          {canRunAccruals && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setAccrualOpen(true)}
              className="min-h-11"
            >
              <Play aria-hidden="true" />
              Run accruals
            </Button>
          )}
        </div>
      </div>

      <ol className="grid gap-2 rounded-2xl border border-slate-500 bg-slate-50 p-3 sm:grid-cols-4 dark:border-slate-500 dark:bg-slate-950">
        {[
          {
            label: "Plan",
            detail: `${activePlans.length} active`,
            icon: Layers3,
          },
          {
            label: "Version",
            detail: "Effective dated",
            icon: History,
          },
          {
            label: "Who gets it",
            detail: `${assignments.data?.meta.total ?? 0} linked`,
            icon: Link2,
          },
          {
            label: "Balance history",
            detail: `${ledger.data?.meta.total ?? 0} changes`,
            icon: ShieldCheck,
          },
        ].map((step, index) => (
          <li
            key={step.label}
            className="flex min-h-20 items-center gap-3 rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 font-mono text-sm font-black text-white dark:bg-slate-100 dark:text-slate-950">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-black">
                <step.icon aria-hidden="true" className="h-4 w-4" />
                {step.label}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {step.detail}
              </p>
            </div>
            {index < 3 && (
              <ArrowRight
                aria-hidden="true"
                className="ml-auto hidden h-4 w-4 text-slate-500 sm:block"
              />
            )}
          </li>
        ))}
      </ol>

      {plans.isError ? (
        <p className="rounded-xl border border-red-700 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-300 dark:bg-red-950 dark:text-red-100">
          Leave plans could not be loaded. Check your leave-plan permission and
          try again.
        </p>
      ) : canViewPlans || canManagePlans || canAssign ? (
        plans.isLoading ? (
          <PanelCardGridSkeleton count={2} className="xl:grid-cols-2" />
        ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {(plans.data?.data ?? []).map((plan) => {
            const version = currentVersion(plan);
            return (
              <Card
                key={plan.id}
                className="overflow-hidden border-slate-500 dark:border-slate-500"
              >
                <CardContent className="p-0">
                  <div className="border-b border-slate-400 bg-slate-50 p-5 dark:border-slate-600 dark:bg-slate-950">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-black">{plan.name}</h4>
                          <StatusChip status={plan.status} />
                          {plan.is_default && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-teal-700 bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-900 dark:border-teal-300 dark:bg-teal-950 dark:text-teal-100">
                              <BadgeCheck
                                aria-hidden="true"
                                className="h-3.5 w-3.5"
                              />
                              Default
                            </span>
                          )}
                        </div>
                        <p className="mt-2 font-mono text-xs text-slate-600 dark:text-slate-300">
                          {plan.code}
                        </p>
                      </div>
                      {canManagePlans && (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => setVersionPlan(plan)}
                        >
                          <Plus aria-hidden="true" />
                          New version
                        </Button>
                      )}
                    </div>
                    <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-slate-600 dark:text-slate-300">
                          Current version
                        </dt>
                        <dd className="mt-1 font-mono font-black">
                          {version ? `v${version.version_number}` : "None"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-600 dark:text-slate-300">
                          Effective
                        </dt>
                        <dd className="mt-1 font-bold">
                          {version?.effective_from ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-600 dark:text-slate-300">
                          Assignments
                        </dt>
                        <dd className="mt-1 font-black">
                          {plan.assignments_count}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <details className="group">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-bold outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-700 dark:hover:bg-slate-900 dark:focus-visible:ring-amber-300">
                      Version history and entitlement rules
                      <History
                        aria-hidden="true"
                        className="h-4 w-4 transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <div className="space-y-4 border-t border-slate-300 p-5 dark:border-slate-700">
                      {plan.versions.map((item) => (
                        <section
                          key={item.id}
                          aria-labelledby={`leave-version-${item.id}`}
                          className="space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h5
                                id={`leave-version-${item.id}`}
                                className="font-mono font-black"
                              >
                                Version {item.version_number}
                              </h5>
                              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                {item.effective_from} –{" "}
                                {item.effective_to ?? "open ended"} ·{" "}
                                {item.change_summary ?? "No change summary"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusChip status={item.status} />
                              {canManagePlans && item.status === "draft" && (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="min-h-11"
                                  disabled={activate.isPending}
                                  onClick={() =>
                                    activate.mutate({
                                      planId: plan.id,
                                      versionId: item.id,
                                    })
                                  }
                                >
                                  Activate
                                </Button>
                              )}
                            </div>
                          </div>
                          <PlanRules rules={item.rules} />
                        </section>
                      ))}
                    </div>
                  </details>
                </CardContent>
              </Card>
            );
          })}
          {!plans.isLoading && !(plans.data?.data.length ?? 0) && (
            <div className="rounded-2xl border border-dashed border-slate-500 p-8 text-center xl:col-span-2 dark:border-slate-400">
              <Layers3
                aria-hidden="true"
                className="mx-auto h-8 w-8 text-slate-500"
              />
              <p className="mt-3 font-black">No leave plans yet</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Create the first plan to centralize entitlement, assignment,
                accrual, and ledger rules.
              </p>
            </div>
          )}
        </div>
        )
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        {(canViewPlans || canAssign) && (
          <Card className="border-slate-500 dark:border-slate-500">
            <CardContent className="p-0">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-400 p-5 dark:border-slate-600">
                <div>
                  <h4 className="font-black">Assignment register</h4>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  The exact workforce scopes currently linked to a plan.
                  </p>
                </div>
                {canAssign && (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => setAssignmentOpen(true)}
                  >
                    <UserRoundCog aria-hidden="true" />
                    Assign people
                  </Button>
                )}
              </div>
              {assignments.isLoading ? (
                <div className="p-4">
                  <PanelTableSkeleton rows={5} cols={4} />
                </div>
              ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption>
                    Active plan links, newest first.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Plan</TableHead>
                      <TableHead scope="col">Applies to</TableHead>
                      <TableHead scope="col">Who / where</TableHead>
                      <TableHead scope="col">From date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.data?.data.length ? (
                      assignments.data.data.slice(0, 12).map((assignment) => (
                        <TableRow key={assignment.id}>
                          <TableCell className="font-bold">
                            {assignment.plan?.name ?? "Unknown plan"}
                          </TableCell>
                          <TableCell>{assignment.scope_label}</TableCell>
                          <TableCell>{scopeValue(assignment)}</TableCell>
                          <TableCell>
                            {assignment.effective_from}
                            <span className="block text-xs text-slate-600 dark:text-slate-300">
                              {assignment.effective_to ?? "No end date"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-28 text-center">
                          <p className="font-semibold">Nobody is linked yet</p>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            Click Assign (or Assign people) → pick a plan →
                            choose Organization default for everyone, or a
                            specific team / employee.
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              )}
            </CardContent>
          </Card>
        )}

        {(canRunAccruals || canViewLedger) && (
          <Card className="border-slate-500 dark:border-slate-500">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-black">Accrual health</h4>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Latest idempotent run and posting totals.
                  </p>
                </div>
                <CalendarClock
                  aria-hidden="true"
                  className="text-amber-700 dark:text-amber-300"
                />
              </div>
              {latestRun ? (
                <>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-slate-300 py-4 dark:border-slate-700">
                    <div>
                      <p className="font-mono text-sm font-black">
                        {latestRun.as_of_date}
                      </p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        {latestRun.employees_processed} employees checked
                      </p>
                    </div>
                    <StatusChip status={latestRun.status} />
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <div>
                      <dt className="text-xs text-slate-600 dark:text-slate-300">
                        Credits posted
                      </dt>
                      <dd className="mt-1 text-2xl font-black">
                        {latestRun.transactions_posted}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-600 dark:text-slate-300">
                        Already credited
                      </dt>
                      <dd className="mt-1 text-2xl font-black">
                        {latestRun.items_skipped}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-600 dark:text-slate-300">
                        Errors
                      </dt>
                      <dd className="mt-1 text-2xl font-black">
                        {latestRun.errors_count}
                      </dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="mt-6 rounded-xl border border-dashed border-slate-500 p-5 text-center text-sm text-slate-600 dark:border-slate-400 dark:text-slate-300">
                  No accrual run has been recorded.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {(canAllocate || canViewLedger) && (
        <Card className="border-slate-500 dark:border-slate-500">
          <CardContent className="p-0">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-400 p-5 dark:border-slate-600">
              <div>
                <h4 className="font-black">Recent allocations</h4>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Credits posted with{" "}
                  <span className="font-semibold">Allocate</span> or generated
                  by an accrual run.
                </p>
              </div>
              <p className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
                {allocations.data?.meta.total ?? 0} total
              </p>
            </div>
            {allocations.isLoading ? (
              <div className="p-4">
                <PanelTableSkeleton rows={5} cols={5} />
              </div>
            ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>
                  Credits that increased leave balances.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Date</TableHead>
                    <TableHead scope="col">Employee</TableHead>
                    <TableHead scope="col">Leave type</TableHead>
                    <TableHead scope="col">Source</TableHead>
                    <TableHead scope="col" className="text-right">
                      Days
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.data?.data.length ? (
                    allocations.data.data.slice(0, 12).map((allocation) => (
                      <TableRow key={allocation.id}>
                        <TableCell>{allocation.effective_on}</TableCell>
                        <TableCell>
                          <span className="font-bold">
                            {allocation.employee.primary_name}
                          </span>
                          <span className="block text-xs text-slate-600 dark:text-slate-300">
                            {allocation.employee.employee_number}
                          </span>
                        </TableCell>
                        <TableCell>{allocation.leave_type.name}</TableCell>
                        <TableCell className="capitalize">
                          {allocation.source.replaceAll("_", " ")}
                        </TableCell>
                        <TableCell className="text-right font-mono font-black">
                          +{formatQuantity(allocation.quantity)}{" "}
                          {allocation.unit}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-28 text-center">
                        <p className="font-semibold">No allocations yet</p>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          Use Allocate in the toolbar for an opening balance, or
                          Run accruals after people are assigned.
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            )}
          </CardContent>
        </Card>
      )}

      {canViewLedger && (
        <Card className="border-slate-500 dark:border-slate-500">
          <CardContent className="p-0">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-400 p-5 dark:border-slate-600">
              <div>
                <h4 className="flex items-center gap-2 font-black">
                  <ShieldCheck
                    aria-hidden="true"
                    className="h-5 w-5 text-emerald-700 dark:text-emerald-300"
                  />
                  Leave balance history
                </h4>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Every balance change is an append-only entry with an
                  idempotency key.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: ["hr-leave-ledger", scope],
                  })
                }
              >
                <RefreshCw aria-hidden="true" />
                Refresh
              </Button>
            </div>
            {ledger.isLoading ? (
              <div className="p-4">
                <PanelTableSkeleton rows={6} cols={5} />
              </div>
            ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>
                  Newest balance changes first.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Date</TableHead>
                    <TableHead scope="col">Employee</TableHead>
                    <TableHead scope="col">Event</TableHead>
                    <TableHead scope="col">Leave type</TableHead>
                    <TableHead scope="col" className="text-right">
                      Available
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.data?.data.length ? (
                    ledger.data.data.map((entry) => {
                      const description = describeLedgerEntry(entry);
                      return (
                        <TableRow key={entry.id}>
                          <TableCell>{entry.effective_on}</TableCell>
                          <TableCell>
                            <span className="font-bold">
                              {entry.employee?.primary_name ?? "Legacy entry"}
                            </span>
                            <span className="block text-xs text-slate-600 dark:text-slate-300">
                              {entry.employee?.employee_number ?? "No employee"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">
                              {description.event}
                            </span>
                            {description.detail ? (
                              <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">
                                {description.detail}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            {entry.leave_type?.name ?? "Legacy leave type"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-black">
                            {description.availableLabel}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-28 text-center">
                        No balance changes yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            )}
          </CardContent>
        </Card>
      )}

      <CreatePlanDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        leaveTypes={leaveTypes.data?.data ?? []}
      />
      <NewVersionDialog
        plan={versionPlan}
        onOpenChange={(open) => {
          if (!open) setVersionPlan(null);
        }}
      />
      <AssignmentDialog
        open={assignmentOpen}
        onOpenChange={setAssignmentOpen}
        plans={plans.data?.data ?? []}
        employees={employees.data?.data ?? []}
        units={units.data?.data ?? []}
        positions={positions.data?.data ?? []}
      />
      <AllocationDialog
        open={allocationOpen}
        onOpenChange={setAllocationOpen}
        employees={employees.data?.data ?? []}
        leaveTypes={leaveTypes.data?.data ?? []}
      />
      <AccrualDialog open={accrualOpen} onOpenChange={setAccrualOpen} />
    </section>
  );
}
