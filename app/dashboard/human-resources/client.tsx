"use client";

import { HrDashboardOverview } from './hr-dashboard-overview';

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CalendarDays,
  CirclePlus,
  ExternalLink,
  FileWarning,
  Fingerprint,
  GitPullRequestArrow,
  Network,
  ShieldCheck,
  Settings2,
  UserRoundCheck,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { getWorkspaceScopeKey } from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import {
  Employee,
  HrSummary,
  OrganizationUnit,
  Paginated,
  Position,
  ReferenceOption,
  hrFetch,
  hrReferenceOptions,
  referenceOptionLabel,
} from "@/modules/humanresources/api";
import { AttendancePanel, LeavePanel } from "./leave-attendance";
import { ErpReferenceSettings } from "@/components/settings/erp-reference-settings";
import {
  EmployeeDirectoryDataTable,
  OrganizationDataTable,
  PositionDataTable,
} from "./hr-data-tables";
import { OrganigramPanel } from "./organigram";
import { HrPoliciesPanel } from "./policies";
import { HrPayrollPanel } from "./hr-payroll-panel";
import { HrRecruitmentPanel } from "./hr-recruitment-panel";
import { HrAppraisalPanel } from "./hr-appraisal-panel";
import { HrAssetsPanel } from "./hr-assets-panel";
import { HrExpensesPanel } from "./hr-expenses-panel";
import {
  EmployeeRelationsPanel,
  HrFormsPanel,
  EmployeeProfilePanel,
  EmployeeTransfersPanel,
} from "./hr-extended-panels";
import { Wallet, UserCheck, Award, Laptop, Receipt } from "lucide-react";

const controlClass =
  "h-11 border-slate-500 focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300";
const selectClass =
  "h-11 w-full rounded-md border border-slate-500 bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300";

type EmployeeForm = {
  user_id: string;
  primary_name: string;
  work_email: string;
  date_of_birth: string;
  employment_status: string;
  employment_regime: string;
  hired_on: string;
  contract_type: string;
  contract_reference: string;
  contract_started_on: string;
  contract_ends_on: string;
  fixed_term_reason: string;
  probation_working_days: string;
  probation_ends_on: string;
  contract_signed_at: string;
  organization_unit_id: string;
  position_id: string;
  hours_per_day: string;
  hours_per_week: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_EMPLOYEE: EmployeeForm = {
  user_id: "",
  primary_name: "",
  work_email: "",
  date_of_birth: "",
  employment_status: "active",
  employment_regime: "ethiopia_private",
  hired_on: today(),
  contract_type: "indefinite",
  contract_reference: "",
  contract_started_on: today(),
  contract_ends_on: "",
  fixed_term_reason: "",
  probation_working_days: "0",
  probation_ends_on: "",
  contract_signed_at: "",
  organization_unit_id: "",
  position_id: "",
  hours_per_day: "8",
  hours_per_week: "48",
};

type WorkspaceUserOption = {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
};

type UnitForm = {
  code: string;
  name: string;
  unit_type: string;
  parent_id: string;
  cost_center_code: string;
  location: string;
};
const EMPTY_UNIT: UnitForm = {
  code: "",
  name: "",
  unit_type: "department",
  parent_id: "",
  cost_center_code: "",
  location: "",
};
type PositionForm = {
  organization_unit_id: string;
  code: string;
  title: string;
  description: string;
  employment_type_code: string;
  job_grade_code: string;
  authorized_headcount: string;
  is_managerial: string;
};
const EMPTY_POSITION: PositionForm = {
  organization_unit_id: "",
  code: "",
  title: "",
  description: "",
  employment_type_code: "",
  job_grade_code: "",
  authorized_headcount: "1",
  is_managerial: "false",
};

type CodeOption = {
  code: string;
  label: string;
};

type ReferenceOptionsByCatalog = Record<string, ReferenceOption[]>;

const HR_FORM_CATALOGS = [
  "employee-statuses",
  "employment-regimes",
  "contract-types",
  "organization-unit-types",
  "organization-locations",
  "work-locations",
  "employment-types",
  "job-grades",
] as const;

const FALLBACK_REFERENCE_OPTIONS: Record<string, CodeOption[]> = {
  "employee-statuses": [
    { code: "draft", label: "Draft" },
    { code: "active", label: "Active" },
    { code: "probation", label: "Probation" },
    { code: "on_leave", label: "On leave" },
    { code: "suspended", label: "Suspended" },
    { code: "terminated", label: "Terminated" },
  ],
  "employment-regimes": [
    { code: "ethiopia_private", label: "Ethiopia private sector" },
    { code: "ethiopia_civil_service", label: "Ethiopia civil service" },
    { code: "other", label: "Other employment regime" },
  ],
  "contract-types": [
    { code: "indefinite", label: "Indefinite" },
    { code: "fixed_term", label: "Fixed term" },
    { code: "apprenticeship", label: "Apprenticeship" },
    { code: "seasonal", label: "Seasonal" },
    { code: "casual", label: "Casual" },
  ],
  "organization-unit-types": [
    { code: "company", label: "Company" },
    { code: "division", label: "Division" },
    { code: "directorate", label: "Directorate" },
    { code: "department", label: "Department" },
    { code: "section", label: "Section" },
    { code: "branch", label: "Branch" },
    { code: "team", label: "Team" },
    { code: "project", label: "Project" },
  ],
};

function codeOptions(
  options: ReferenceOption[] | undefined,
  catalog: string,
  currentValue?: string,
): CodeOption[] {
  const configured = (options ?? [])
    .filter((option): option is ReferenceOption & { code: string } =>
      Boolean(option.code),
    )
    .map((option) => ({
      code: option.code,
      label: referenceOptionLabel(option),
    }));
  const result = configured.length
    ? configured
    : (FALLBACK_REFERENCE_OPTIONS[catalog] ?? []);

  if (currentValue && !result.some((option) => option.code === currentValue)) {
    return [
      ...result,
      {
        code: currentValue,
        label: `${currentValue.replaceAll("_", " ")} (inactive)`,
      },
    ];
  }

  return result;
}

function FieldError({ message }: { message: string }) {
  const alertRef = useRef<HTMLDivElement>(null);
  React.useEffect(() => alertRef.current?.focus(), []);

  return (
    <div
      ref={alertRef}
      id="hr-form-error"
      role="alert"
      tabIndex={-1}
      className="rounded-lg border border-red-700 bg-red-50 p-3 text-sm font-medium text-red-800 outline-none focus-visible:ring-2 focus-visible:ring-red-700 dark:border-red-300 dark:bg-red-950 dark:text-red-200"
    >
      {message}
    </div>
  );
}

function FormField({
  id,
  label,
  required,
  help,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </Label>
      {children}
      {help && (
        <p
          id={`${id}-help`}
          className="text-xs leading-5 text-slate-600 dark:text-slate-300"
        >
          {help}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "active"
      ? "border-emerald-700 bg-emerald-50 text-emerald-800 dark:border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200"
      : status === "probation"
        ? "border-amber-700 bg-amber-50 text-amber-900 dark:border-amber-300 dark:bg-amber-950 dark:text-amber-100"
        : "border-slate-500 bg-slate-100 text-slate-800 dark:border-slate-400 dark:bg-slate-900 dark:text-slate-200";
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize",
        style,
      )}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function EmployeeDialog({
  open,
  onOpenChange,
  employee,
  units,
  positions,
  referenceOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  units: OrganizationUnit[];
  positions: Position[];
  referenceOptions: ReferenceOptionsByCatalog;
}) {
  const queryClient = useQueryClient();
  const scope = getWorkspaceScopeKey();
  const errorRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<EmployeeForm>(EMPTY_EMPLOYEE);
  const [error, setError] = useState("");
  const unassignedUsersQuery = useQuery({
    queryKey: ["hr-unassigned-users", scope],
    queryFn: () =>
      hrFetch<{ data: WorkspaceUserOption[] }>("/employees/unassigned-users"),
    enabled: open && !employee,
  });
  const unassignedUsers = unassignedUsersQuery.data?.data ?? [];
  const selectedWorkspaceUser = unassignedUsers.find(
    (user) => String(user.id) === form.user_id,
  );

  React.useEffect(() => {
    if (!open) return;
    setError("");
    setForm(
      employee
        ? {
            ...EMPTY_EMPLOYEE,
            user_id: employee.user_id ? String(employee.user_id) : "",
            primary_name: employee.primary_name,
            work_email: employee.work_email ?? "",
            date_of_birth: employee.date_of_birth ?? "",
            employment_status: employee.employment_status,
            employment_regime: employee.employment_regime,
            hired_on: employee.hired_on,
            contract_type: employee.contract_type,
            contract_reference: employee.contract_reference ?? "",
            contract_started_on: employee.contract_started_on,
            contract_ends_on: employee.contract_ends_on ?? "",
            fixed_term_reason: employee.fixed_term_reason ?? "",
            probation_working_days: String(employee.probation_working_days),
            probation_ends_on: employee.probation_ends_on ?? "",
            contract_signed_at: employee.contract_signed_at?.slice(0, 16) ?? "",
          }
        : {
            ...EMPTY_EMPLOYEE,
            hired_on: today(),
            contract_started_on: today(),
          },
    );
  }, [employee, open]);

  const filteredPositions = useMemo(
    () =>
      positions.filter(
        (position) =>
          !form.organization_unit_id ||
          position.organization_unit_id === Number(form.organization_unit_id),
      ),
    [form.organization_unit_id, positions],
  );
  const employmentStatuses = codeOptions(
    referenceOptions["employee-statuses"],
    "employee-statuses",
    form.employment_status,
  );
  const employmentRegimes = codeOptions(
    referenceOptions["employment-regimes"],
    "employment-regimes",
    form.employment_regime,
  );
  const contractTypes = codeOptions(
    referenceOptions["contract-types"],
    "contract-types",
    form.contract_type,
  );
  const mutation = useMutation({
    mutationFn: () => {
      if (!employee && !selectedWorkspaceUser) {
        throw new Error(
          "Choose a registered user from this workspace before saving.",
        );
      }

      const payload = {
        user_id: form.user_id ? Number(form.user_id) : null,
        primary_name:
          selectedWorkspaceUser?.name.trim() || form.primary_name.trim(),
        work_email:
          selectedWorkspaceUser?.email.trim() || form.work_email || null,
        date_of_birth: form.date_of_birth || null,
        employment_status: form.employment_status,
        employment_regime: form.employment_regime,
        hired_on: form.hired_on,
        contract_type: form.contract_type,
        contract_reference: form.contract_reference || null,
        contract_started_on: form.contract_started_on,
        contract_ends_on: form.contract_ends_on || null,
        fixed_term_reason: form.fixed_term_reason || null,
        probation_working_days: Number(form.probation_working_days),
        probation_ends_on: form.probation_ends_on || null,
        contract_signed_at: form.contract_signed_at || null,
        ...(!employee && form.organization_unit_id && form.position_id
          ? {
              organization_unit_id: Number(form.organization_unit_id),
              position_id: Number(form.position_id),
              hours_per_day: Number(form.hours_per_day),
              hours_per_week: Number(form.hours_per_week),
            }
          : {}),
      };
      return hrFetch(`/employees${employee ? `/${employee.id}` : ""}`, {
        method: employee ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success(
        employee ? "Employee record updated." : "Employee record created.",
      );
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
      queryClient.invalidateQueries({ queryKey: ["hr-summary"] });
      queryClient.invalidateQueries({ queryKey: ["hr-positions"] });
      queryClient.invalidateQueries({
        queryKey: ["hr-unassigned-users", scope],
      });
    },
    onError: (failure) => {
      setError(
        failure instanceof Error
          ? failure.message
          : "The employee record could not be saved.",
      );
      requestAnimationFrame(() => errorRef.current?.focus());
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>
            {employee ? `Edit ${employee.primary_name}` : "Add employee"}
          </DialogTitle>
          <DialogDescription>
            {employee
              ? "Update employment details for this registered workspace user."
              : "Choose a registered workspace user, then capture their employment details."}
          </DialogDescription>
        </DialogHeader>
        <form
          id="employee-form"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            mutation.mutate();
          }}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6 pt-4">
            {error && (
              <div ref={errorRef} tabIndex={-1}>
                <FieldError message={error} />
              </div>
            )}
            <p className="rounded-xl border border-teal-700 bg-teal-50 p-3 text-sm font-semibold text-teal-950 dark:border-teal-300 dark:bg-teal-950 dark:text-teal-100">
              Employment choices come from ERP reference data settings. HR
              administrators can activate, deactivate, or rename them from the
              Settings section.
            </p>
            {!employee ? (
              <section
                aria-labelledby="workspace-user-heading"
                className="rounded-xl border border-amber-700 bg-amber-50 p-4 dark:border-amber-300 dark:bg-amber-950"
              >
                <h3
                  id="workspace-user-heading"
                  className="text-sm font-bold text-amber-950 dark:text-amber-100"
                >
                  Registered workspace user
                </h3>
                <div className="mt-3">
                  <FormField
                    id="employee-user-id"
                    label="User"
                    required
                    help="Only unlinked users registered in this central or tenant workspace are shown. Their account name and email are used automatically."
                  >
                    <select
                      id="employee-user-id"
                      value={form.user_id}
                      onChange={(event) => {
                        const selectedId = event.target.value;
                        const selected = unassignedUsers.find(
                          (user) => String(user.id) === selectedId,
                        );
                        setForm((current) => ({
                          ...current,
                          user_id: selectedId,
                          primary_name: selected?.name ?? "",
                          work_email: selected?.email ?? "",
                        }));
                      }}
                      required
                      disabled={
                        unassignedUsersQuery.isLoading ||
                        unassignedUsersQuery.isError ||
                        unassignedUsers.length === 0
                      }
                      aria-describedby="employee-user-id-help"
                      className={selectClass}
                    >
                      <option value="">
                        {unassignedUsersQuery.isLoading
                          ? "Loading registered users…"
                          : unassignedUsersQuery.isError
                            ? "Registered users could not be loaded"
                            : unassignedUsers.length === 0
                              ? "No unlinked registered users are available"
                              : `Select a registered user (${unassignedUsers.length} available)`}
                      </option>
                      {unassignedUsers.map((user) => (
                        <option
                          key={user.id}
                          value={user.id}
                          disabled={!user.is_active}
                        >
                          {user.name} ({user.email})
                          {!user.is_active ? " — inactive" : ""}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
                {unassignedUsersQuery.isError && (
                  <p
                    role="status"
                    className="mt-3 text-sm font-semibold text-red-800 dark:text-red-200"
                  >
                    {unassignedUsersQuery.error instanceof Error
                      ? unassignedUsersQuery.error.message
                      : "Registered users could not be loaded."}
                  </p>
                )}
                {selectedWorkspaceUser && (
                  <dl className="mt-4 grid gap-3 rounded-lg border border-amber-700 bg-white p-3 text-sm dark:border-amber-300 dark:bg-slate-950 sm:grid-cols-2">
                    <div>
                      <dt className="font-semibold text-slate-600 dark:text-slate-300">
                        Name from account
                      </dt>
                      <dd className="mt-1 font-bold">
                        {selectedWorkspaceUser.name}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-600 dark:text-slate-300">
                        Email from account
                      </dt>
                      <dd className="mt-1 break-all font-bold">
                        {selectedWorkspaceUser.email}
                      </dd>
                    </div>
                  </dl>
                )}
              </section>
            ) : (
              <section
                aria-labelledby="linked-user-heading"
                className="rounded-xl border border-slate-500 bg-slate-50 p-4 dark:border-slate-400 dark:bg-slate-950"
              >
                <h3 id="linked-user-heading" className="text-sm font-bold">
                  Registered workspace user
                </h3>
                <p className="mt-2 font-semibold">{form.primary_name}</p>
                {form.work_email && (
                  <p className="mt-1 break-all text-sm text-slate-700 dark:text-slate-200">
                    {form.work_email}
                  </p>
                )}
              </section>
            )}
            <fieldset className="grid gap-4 rounded-xl border border-slate-300 p-4 dark:border-slate-600 sm:grid-cols-2">
              <legend className="px-2 text-sm font-bold">
                Employee details
              </legend>
              <div className="rounded-lg border border-slate-500 bg-slate-50 p-3 dark:border-slate-400 dark:bg-slate-950 sm:col-span-2">
                <p className="text-sm font-bold text-foreground">
                  Employee number
                </p>
                <p className="mt-1 font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {employee
                    ? employee.employee_number
                    : "Assigned automatically when you save this employee"}
                </p>
              </div>
              <FormField
                id="employee-date-of-birth"
                label="Date of birth"
                help="Required when age-specific employment protections apply."
              >
                <Input
                  id="employee-date-of-birth"
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) =>
                    setForm({ ...form, date_of_birth: e.target.value })
                  }
                  aria-describedby="employee-date-of-birth-help"
                  className={controlClass}
                />
              </FormField>
            </fieldset>
            <fieldset className="grid gap-4 rounded-xl border border-slate-300 p-4 dark:border-slate-600 sm:grid-cols-2 lg:grid-cols-3">
              <legend className="px-2 text-sm font-bold">
                Employment terms
              </legend>
              <FormField
                id="employment-status"
                label="Employment status"
                required
              >
                <select
                  id="employment-status"
                  value={form.employment_status}
                  onChange={(e) =>
                    setForm({ ...form, employment_status: e.target.value })
                  }
                  required
                  className={selectClass}
                >
                  {employmentStatuses.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                id="employment-regime"
                label="Employment regime"
                required
              >
                <select
                  id="employment-regime"
                  value={form.employment_regime}
                  onChange={(e) =>
                    setForm({ ...form, employment_regime: e.target.value })
                  }
                  required
                  className={selectClass}
                >
                  {employmentRegimes.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField id="hired-on" label="Hire date" required>
                <Input
                  id="hired-on"
                  type="date"
                  value={form.hired_on}
                  onChange={(e) =>
                    setForm({ ...form, hired_on: e.target.value })
                  }
                  required
                  className={controlClass}
                />
              </FormField>
              <FormField id="contract-type" label="Contract type" required>
                <select
                  id="contract-type"
                  value={form.contract_type}
                  onChange={(e) =>
                    setForm({ ...form, contract_type: e.target.value })
                  }
                  required
                  className={selectClass}
                >
                  {contractTypes.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                id="contract-started-on"
                label="Contract start"
                required
              >
                <Input
                  id="contract-started-on"
                  type="date"
                  value={form.contract_started_on}
                  onChange={(e) =>
                    setForm({ ...form, contract_started_on: e.target.value })
                  }
                  required
                  className={controlClass}
                />
              </FormField>
              <FormField id="contract-ends-on" label="Contract end">
                <Input
                  id="contract-ends-on"
                  type="date"
                  value={form.contract_ends_on}
                  onChange={(e) =>
                    setForm({ ...form, contract_ends_on: e.target.value })
                  }
                  className={controlClass}
                />
              </FormField>
              <FormField id="contract-reference" label="Contract reference">
                <Input
                  id="contract-reference"
                  value={form.contract_reference}
                  onChange={(e) =>
                    setForm({ ...form, contract_reference: e.target.value })
                  }
                  className={controlClass}
                />
              </FormField>
              <FormField
                id="probation-days"
                label="Probation working days"
                help="The Ethiopian private-sector profile prevents values above 60."
              >
                <Input
                  id="probation-days"
                  type="number"
                  min="0"
                  max="60"
                  value={form.probation_working_days}
                  onChange={(e) =>
                    setForm({ ...form, probation_working_days: e.target.value })
                  }
                  aria-describedby="probation-days-help"
                  required
                  className={controlClass}
                />
              </FormField>
              <FormField id="probation-ends-on" label="Probation end">
                <Input
                  id="probation-ends-on"
                  type="date"
                  value={form.probation_ends_on}
                  onChange={(e) =>
                    setForm({ ...form, probation_ends_on: e.target.value })
                  }
                  className={controlClass}
                />
              </FormField>
              <FormField id="contract-signed-at" label="Contract signed at">
                <Input
                  id="contract-signed-at"
                  type="datetime-local"
                  value={form.contract_signed_at}
                  onChange={(e) =>
                    setForm({ ...form, contract_signed_at: e.target.value })
                  }
                  className={controlClass}
                />
              </FormField>
              {form.contract_type === "fixed_term" && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <FormField
                    id="fixed-term-reason"
                    label="Fixed-term reason"
                    required
                    help="Document why a time-limited contract is legally and operationally appropriate."
                  >
                    <Textarea
                      id="fixed-term-reason"
                      value={form.fixed_term_reason}
                      onChange={(e) =>
                        setForm({ ...form, fixed_term_reason: e.target.value })
                      }
                      required
                      aria-describedby="fixed-term-reason-help"
                      className="border-slate-500 focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300"
                    />
                  </FormField>
                </div>
              )}
            </fieldset>
            {!employee && (
              <fieldset className="grid gap-4 rounded-xl border border-slate-300 p-4 dark:border-slate-600 sm:grid-cols-2">
                <legend className="px-2 text-sm font-bold">
                  Initial assignment
                </legend>
                <FormField id="employee-unit" label="Organization unit">
                  <select
                    id="employee-unit"
                    value={form.organization_unit_id}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        organization_unit_id: e.target.value,
                        position_id: "",
                      })
                    }
                    className={selectClass}
                  >
                    <option value="">Assign later</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField id="employee-position" label="Position">
                  <select
                    id="employee-position"
                    value={form.position_id}
                    onChange={(e) =>
                      setForm({ ...form, position_id: e.target.value })
                    }
                    disabled={!form.organization_unit_id}
                    className={selectClass}
                  >
                    <option value="">Select a position</option>
                    {filteredPositions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.title}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField id="hours-per-day" label="Hours per day">
                  <Input
                    id="hours-per-day"
                    type="number"
                    min="0.25"
                    max="8"
                    step="0.25"
                    value={form.hours_per_day}
                    onChange={(e) =>
                      setForm({ ...form, hours_per_day: e.target.value })
                    }
                    className={controlClass}
                  />
                </FormField>
                <FormField id="hours-per-week" label="Hours per week">
                  <Input
                    id="hours-per-week"
                    type="number"
                    min="0.25"
                    max="48"
                    step="0.25"
                    value={form.hours_per_week}
                    onChange={(e) =>
                      setForm({ ...form, hours_per_week: e.target.value })
                    }
                    className={controlClass}
                  />
                </FormField>
              </fieldset>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t border-slate-500 bg-background px-6 py-4 dark:border-slate-400">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
              className="min-h-11 w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                (!employee && !selectedWorkspaceUser)
              }
              className="min-h-11 w-full sm:w-auto"
            >
              {mutation.isPending
                ? "Saving…"
                : employee
                  ? "Save employee"
                  : "Add employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UnitDialog({
  open,
  onOpenChange,
  units,
  referenceOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: OrganizationUnit[];
  referenceOptions: ReferenceOptionsByCatalog;
}) {
  const queryClient = useQueryClient();
  const errorRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState(EMPTY_UNIT);
  const [error, setError] = useState("");
  const unitTypes = codeOptions(
    referenceOptions["organization-unit-types"],
    "organization-unit-types",
    form.unit_type,
  );
  const locationOptions = [
    ...(referenceOptions["organization-locations"] ?? []),
    ...(referenceOptions["work-locations"] ?? []),
  ];
  React.useEffect(() => {
    if (open) {
      setForm(EMPTY_UNIT);
      setError("");
    }
  }, [open]);
  const mutation = useMutation({
    mutationFn: () =>
      hrFetch("/organization-units", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          parent_id: form.parent_id ? Number(form.parent_id) : null,
          is_active: true,
          sort_order: 0,
        }),
      }),
    onSuccess: () => {
      toast.success("Organization unit created.");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["hr-units"] });
    },
    onError: (failure) => {
      setError(
        failure instanceof Error
          ? failure.message
          : "The organization unit could not be saved.",
      );
      requestAnimationFrame(() => errorRef.current?.focus());
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add organization unit</DialogTitle>
          <DialogDescription>
            Build a reporting structure that positions and employee assignments
            can reference.
          </DialogDescription>
        </DialogHeader>
        <form
          id="unit-form"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          {error && (
            <div ref={errorRef} className="sm:col-span-2">
              <FieldError message={error} />
            </div>
          )}
          <FormField id="unit-name" label="Unit name" required>
            <Input
              id="unit-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className={controlClass}
            />
          </FormField>
          <FormField id="unit-code" label="Unit code" required>
            <Input
              id="unit-code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
              className={controlClass}
            />
          </FormField>
          <FormField id="unit-type" label="Unit type" required>
            <select
              id="unit-type"
              value={form.unit_type}
              onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
              className={selectClass}
            >
              {unitTypes.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="unit-parent" label="Parent unit">
            <select
              id="unit-parent"
              value={form.parent_id}
              onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
              className={selectClass}
            >
              <option value="">Top-level unit</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="cost-center" label="Cost centre code">
            <Input
              id="cost-center"
              value={form.cost_center_code}
              onChange={(e) =>
                setForm({ ...form, cost_center_code: e.target.value })
              }
              className={controlClass}
            />
          </FormField>
          <FormField id="unit-location" label="Location">
            <Input
              id="unit-location"
              list="hr-location-options"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className={controlClass}
            />
            <datalist id="hr-location-options">
              {locationOptions.map((option) => (
                <option
                  key={`${option.value}-${option.code ?? "location"}`}
                  value={referenceOptionLabel(option)}
                />
              ))}
            </datalist>
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="unit-form"
            disabled={
              mutation.isPending || !form.name.trim() || !form.code.trim()
            }
          >
            Add unit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PositionDialog({
  open,
  onOpenChange,
  units,
  referenceOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: OrganizationUnit[];
  referenceOptions: ReferenceOptionsByCatalog;
}) {
  const queryClient = useQueryClient();
  const errorRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState(EMPTY_POSITION);
  const [error, setError] = useState("");
  const employmentTypes = codeOptions(
    referenceOptions["employment-types"],
    "employment-types",
    form.employment_type_code,
  );
  const jobGrades = codeOptions(
    referenceOptions["job-grades"],
    "job-grades",
    form.job_grade_code,
  );
  React.useEffect(() => {
    if (open) {
      setForm(EMPTY_POSITION);
      setError("");
    }
  }, [open]);
  const mutation = useMutation({
    mutationFn: () =>
      hrFetch("/positions", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          organization_unit_id: Number(form.organization_unit_id),
          authorized_headcount: Number(form.authorized_headcount),
          is_managerial: form.is_managerial === "true",
          is_safety_sensitive: false,
          is_active: true,
          employment_type_code: form.employment_type_code || null,
          job_grade_code: form.job_grade_code || null,
        }),
      }),
    onSuccess: () => {
      toast.success("Position created.");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["hr-positions"] });
      queryClient.invalidateQueries({ queryKey: ["hr-summary"] });
    },
    onError: (failure) => {
      setError(
        failure instanceof Error
          ? failure.message
          : "The position could not be saved.",
      );
      requestAnimationFrame(() => errorRef.current?.focus());
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add position</DialogTitle>
          <DialogDescription>
            Define an authorized seat in the organization before assigning an
            employee.
          </DialogDescription>
        </DialogHeader>
        <form
          id="position-form"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          {error && (
            <div ref={errorRef} className="sm:col-span-2">
              <FieldError message={error} />
            </div>
          )}
          <FormField id="position-title" label="Position title" required>
            <Input
              id="position-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              className={controlClass}
            />
          </FormField>
          <FormField id="position-code" label="Position code" required>
            <Input
              id="position-code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
              className={controlClass}
            />
          </FormField>
          <FormField id="position-unit" label="Organization unit" required>
            <select
              id="position-unit"
              value={form.organization_unit_id}
              onChange={(e) =>
                setForm({ ...form, organization_unit_id: e.target.value })
              }
              required
              className={selectClass}
            >
              <option value="">Select a unit</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            id="position-headcount"
            label="Authorized headcount"
            required
          >
            <Input
              id="position-headcount"
              type="number"
              min="1"
              value={form.authorized_headcount}
              onChange={(e) =>
                setForm({ ...form, authorized_headcount: e.target.value })
              }
              required
              className={controlClass}
            />
          </FormField>
          <FormField id="position-employment-type" label="Employment type">
            <select
              id="position-employment-type"
              value={form.employment_type_code}
              onChange={(e) =>
                setForm({ ...form, employment_type_code: e.target.value })
              }
              className={selectClass}
            >
              <option value="">Not specified</option>
              {employmentTypes.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="position-job-grade" label="Job grade">
            <select
              id="position-job-grade"
              value={form.job_grade_code}
              onChange={(e) =>
                setForm({ ...form, job_grade_code: e.target.value })
              }
              className={selectClass}
            >
              <option value="">Not specified</option>
              {jobGrades.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="position-managerial" label="Managerial position">
            <select
              id="position-managerial"
              value={form.is_managerial}
              onChange={(e) =>
                setForm({ ...form, is_managerial: e.target.value })
              }
              className={selectClass}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="position-description" label="Position description">
              <Textarea
                id="position-description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="border-slate-500 focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300"
              />
            </FormField>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="position-form"
            disabled={
              mutation.isPending ||
              !form.organization_unit_id ||
              !form.title.trim() ||
              !form.code.trim()
            }
          >
            Add position
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function HumanResourcesClient({ defaultTab }: { defaultTab?: string } = {}) {
  const scope = getWorkspaceScopeKey();
  const { hasAnyPermission, hasPermission, isLoaded } = usePermissions();
  const [tab, setTab] = useState(defaultTab || "dashboard");
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [positionOpen, setPositionOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const canViewEmployees = hasAnyPermission([
    "view_employees",
    "manage_employees",
  ]);
  const canManageEmployees = hasPermission("manage_employees");
  const canViewOrganization = hasAnyPermission([
    "view_hr_organization",
    "manage_hr_organization",
  ]);
  const canManageOrganization = hasPermission("manage_hr_organization");
  const canViewPositions = hasAnyPermission([
    "view_hr_positions",
    "manage_hr_positions",
  ]);
  const canManagePositions = hasPermission("manage_hr_positions");
  const canViewCompliance = hasAnyPermission([
    "view_hr_compliance",
    "manage_hr_compliance",
  ]);
  const canViewHrSettings = hasAnyPermission([
    "view_hr_settings",
    "manage_hr_settings",
  ]);
  const canManageHrSettings = hasPermission("manage_hr_settings");
  const canUseLeave = hasAnyPermission([
    "request_leave",
    "view_leave_requests",
    "manage_leave_requests",
    "approve_leave_requests",
    "view_leave_balances",
  ]);
  const canUseAttendance = hasAnyPermission([
    "record_attendance",
    "view_attendance",
    "manage_attendance",
    "manage_work_schedules",
  ]);
  const summary = useQuery({
    queryKey: ["hr-summary", scope],
    queryFn: () => hrFetch<{ data: HrSummary }>("/summary"),
    enabled: isLoaded && canViewEmployees,
  });
  const units = useQuery({
    queryKey: ["hr-units", scope],
    queryFn: () =>
      hrFetch<Paginated<OrganizationUnit>>("/organization-units?per_page=100"),
    enabled: isLoaded && canViewOrganization,
  });
  const positions = useQuery({
    queryKey: ["hr-positions", scope],
    queryFn: () => hrFetch<Paginated<Position>>("/positions?per_page=100"),
    enabled: isLoaded && canViewPositions,
  });
  const allEmployeesQuery = useQuery({
    queryKey: ["all-employees-list", scope],
    queryFn: () => hrFetch<Paginated<Employee>>("/employees?per_page=500"),
    enabled: isLoaded,
  });
  const compliance = useQuery({
    queryKey: ["hr-compliance-profile", scope],
    queryFn: () =>
      hrFetch<{ data: Record<string, string | number | boolean> }>(
        "/compliance-profile",
      ),
    enabled: isLoaded && canViewCompliance,
  });
  const referenceOptions = useQuery({
    queryKey: ["hr-form-reference-options", scope],
    queryFn: async (): Promise<ReferenceOptionsByCatalog> =>
      Object.fromEntries(
        await Promise.all(
          HR_FORM_CATALOGS.map(async (catalog) => [
            catalog,
            await hrReferenceOptions(catalog),
          ]),
        ),
      ),
    enabled:
      isLoaded &&
      (canManageEmployees || canManageOrganization || canManagePositions),
    staleTime: 5 * 60 * 1000,
  });
  const metrics = summary.data?.data;
  const cards = [
    {
      label: "Active workforce",
      value: metrics?.active ?? 0,
      note: `${metrics?.total ?? 0} total records`,
      icon: UserRoundCheck,
    },
    {
      label: "Open positions",
      value: metrics?.open_positions ?? 0,
      note: "Authorized seats available",
      icon: BriefcaseBusiness,
    },
    {
      label: "Terms missing",
      value: metrics?.written_terms_missing ?? 0,
      note: "Past the 15-day checkpoint",
      icon: FileWarning,
    },
    {
      label: "Contracts ending",
      value: metrics?.contracts_expiring_soon ?? 0,
      note: "Within the next 30 days",
      icon: CalendarClock,
    },
  ];

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab) setTab(requestedTab);
  }, []);

  const handleTabChange = (nextTab: string) => {
    setTab(nextTab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", nextTab);
    window.history.replaceState(window.history.state, "", url);
  };

  const selectedTab =
    tab === "dashboard" ||
    (tab === "employees" && canViewEmployees) ||
    (tab === "transfers" && canViewEmployees) ||
    (tab === "relations" && canViewEmployees) ||
    (tab === "forms" && canViewEmployees) ||
    (tab === "profile" && canViewEmployees) ||
    (tab === "organigram" && canViewEmployees) ||
    (tab === "organization" && canViewOrganization) ||
    (tab === "positions" && canViewPositions) ||
    (tab === "compliance" && canViewCompliance) ||
    (tab === "policies" && (canViewEmployees || canViewHrSettings)) ||
    (tab === "leave" && canUseLeave) ||
    (tab === "attendance" && canUseAttendance) ||
    tab === "payroll" ||
    tab === "recruitment" ||
    tab === "appraisals" ||
    tab === "assets" ||
    tab === "expenses" ||
    (tab === "settings" && canViewHrSettings)
      ? tab
      : "dashboard";
  if (
    isLoaded &&
    !hasAnyPermission([
      "view_employees",
      "manage_employees",
      "view_hr_organization",
      "manage_hr_organization",
      "view_hr_positions",
      "manage_hr_positions",
      "request_leave",
      "view_leave_requests",
      "manage_leave_requests",
      "view_attendance",
      "manage_attendance",
      "record_attendance",
      "view_hr_settings",
      "manage_hr_settings",
    ])
  )
    return (
      <section className="p-6">
        <h1 className="text-2xl font-bold">Human Resources</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          You do not have permission to view this workspace.
        </p>
      </section>
    );
  return (
    <section
      aria-labelledby="hr-page-title"
      className="space-y-6 p-4 sm:p-6 lg:p-8"
    >
      <header className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 text-white shadow-xl">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-end lg:p-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">
              Workforce record
            </p>
            <h1
              id="hr-page-title"
              className="mt-3 text-3xl font-black tracking-tight sm:text-4xl"
            >
              Human Resources
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
              Design the organization, assign accountable positions, and
              maintain employment records with visible legal checkpoints.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/workflow?module=human_resources"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-400 px-4 py-2 text-sm font-bold text-white outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <GitPullRequestArrow aria-hidden="true" className="h-4 w-4" />
              HR approval workflows
            </Link>
            {canManageOrganization && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setUnitOpen(true)}
                className="h-11 border-slate-400 bg-transparent text-white hover:bg-slate-800 hover:text-white focus-visible:ring-white"
              >
                <Building2 aria-hidden="true" />
                Add unit
              </Button>
            )}
            {canManageEmployees && (
              <Button
                type="button"
                onClick={() => {
                  setEditingEmployee(null);
                  setEmployeeOpen(true);
                }}
                className="h-11 bg-amber-300 font-bold text-slate-950 hover:bg-amber-200 focus-visible:ring-white"
              >
                <CirclePlus aria-hidden="true" />
                Add employee
              </Button>
            )}
          </div>
        </div>
        {canViewEmployees && (
          <div className="grid border-t border-slate-700 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ label, value, note, icon: Icon }) => (
              <div
                key={label}
                className="border-b border-slate-700 p-5 last:border-b-0 sm:border-r xl:border-b-0"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <Icon aria-hidden="true" className="h-4 w-4 text-amber-300" />
                  {label}
                </div>
                <p className="mt-2 text-3xl font-black tabular-nums">{value}</p>
                <p className="mt-1 text-xs text-slate-300">{note}</p>
              </div>
            ))}
          </div>
        )}
      </header>
      <Tabs
        value={selectedTab}
        onValueChange={handleTabChange}
        className="space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
            <span className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Active Section: <span className="text-foreground capitalize font-extrabold">{selectedTab.replaceAll("_", " ")}</span>
            </span>
          </div>
          <span className="text-xs text-slate-400">Navigate between HR sections directly via the Sidebar</span>
        </div>
        <TabsContent value="dashboard">
          <HrDashboardOverview />
        </TabsContent>
        <TabsContent value="employees">
          <EmployeeDirectoryDataTable
            canManage={canManageEmployees}
            statusOptions={codeOptions(
              referenceOptions.data?.["employee-statuses"],
              "employee-statuses",
            )}
            onEdit={(employee) => {
              setEditingEmployee(employee);
              setEmployeeOpen(true);
            }}
          />
        </TabsContent>
        <TabsContent value="transfers">
          <EmployeeTransfersPanel />
        </TabsContent>
        <TabsContent value="organigram">
          <OrganigramPanel
            canManage={canManageEmployees}
            statusOptions={codeOptions(
              referenceOptions.data?.["employee-statuses"],
              "employee-statuses",
            )}
            onEditEmployee={(employee) => {
              setEditingEmployee(employee);
              setEmployeeOpen(true);
            }}
          />
        </TabsContent>
        <TabsContent value="organization">
          <Card className="border-slate-300 dark:border-slate-600">
            <CardContent className="p-0">
              <div className="flex items-center justify-between gap-4 border-b border-slate-300 p-5 dark:border-slate-600">
                <div>
                  <h2 className="text-xl font-black">Organization structure</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Units create the reporting and cost-allocation backbone.
                  </p>
                </div>
                {canManageOrganization && (
                  <Button onClick={() => setUnitOpen(true)}>
                    <CirclePlus aria-hidden="true" />
                    Add unit
                  </Button>
                )}
              </div>
              <div className="p-4">
                <OrganizationDataTable />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="positions">
          <Card className="border-slate-300 dark:border-slate-600">
            <CardContent className="p-0">
              <div className="flex items-center justify-between gap-4 border-b border-slate-300 p-5 dark:border-slate-600">
                <div>
                  <h2 className="text-xl font-black">Position control</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Compare authorized seats with active assignments.
                  </p>
                </div>
                {canManagePositions && (
                  <Button onClick={() => setPositionOpen(true)}>
                    <CirclePlus aria-hidden="true" />
                    Add position
                  </Button>
                )}
              </div>
              <div className="p-4">
                <PositionDataTable />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {canViewCompliance && (
          <TabsContent value="compliance">
            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-slate-300 dark:border-slate-600">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-emerald-100 p-3 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      <BadgeCheck aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black">
                        Ethiopian private-sector profile
                      </h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Versioned controls currently applied to private
                        employment records.
                      </p>
                    </div>
                  </div>
                  <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                    {[
                      [
                        "Minimum working age",
                        compliance.data?.data.minimum_working_age,
                      ],
                      [
                        "Maximum probation",
                        `${compliance.data?.data.maximum_probation_working_days ?? 60} working days`,
                      ],
                      [
                        "Written particulars due",
                        `${compliance.data?.data.written_terms_due_days ?? 15} days`,
                      ],
                      [
                        "Normal working time",
                        `${compliance.data?.data.maximum_hours_per_day ?? 8} hours/day · ${compliance.data?.data.maximum_hours_per_week ?? 48} hours/week`,
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="rounded-xl border border-slate-300 p-4 dark:border-slate-600"
                      >
                        <dt className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                          {label}
                        </dt>
                        <dd className="mt-2 font-black">
                          {String(value ?? "—")}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <a
                    href={String(
                      compliance.data?.data.legal_source_url ??
                        "https://natlex.ilo.org/dyn/natlex2/natlex2/files/download/109825/ETH109825.pdf",
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-500 px-4 py-2 font-bold text-foreground outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-700 dark:border-slate-400 dark:hover:bg-slate-900 dark:focus-visible:ring-amber-300"
                  >
                    Open legal source{" "}
                    <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  </a>
                </CardContent>
              </Card>
              <Card className="border-amber-700 bg-amber-50 dark:border-amber-300 dark:bg-amber-950">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      aria-hidden="true"
                      className="mt-0.5 text-amber-800 dark:text-amber-200"
                    />
                    <div>
                      <h2 className="text-xl font-black text-amber-950 dark:text-amber-100">
                        Operational checkpoints
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-amber-950 dark:text-amber-100">
                        Hive reports potential issues; it does not silently
                        rewrite contracts or replace legal review. Rules carry a
                        source and effective date so changes remain auditable.
                      </p>
                    </div>
                  </div>
                  <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-amber-950 dark:text-amber-100">
                    <li>
                      {metrics?.written_terms_missing ?? 0} employment records
                      are missing signed terms after the configured checkpoint.
                    </li>
                    <li>
                      {metrics?.contracts_expiring_soon ?? 0} fixed-term
                      contracts end within 30 days.
                    </li>
                    <li>
                      Young-worker and working-time limits are checked when
                      assignments are saved.
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
        {canViewEmployees && (
          <TabsContent value="policies">
            <HrPoliciesPanel canManage={canManageEmployees} />
          </TabsContent>
        )}
        {canUseLeave && (
          <TabsContent value="leave">
            <LeavePanel />
          </TabsContent>
        )}
        {canUseAttendance && (
          <TabsContent value="attendance">
            <AttendancePanel />
          </TabsContent>
        )}
        <TabsContent value="relations">
          <EmployeeRelationsPanel />
        </TabsContent>
        <TabsContent value="forms">
          <HrFormsPanel />
        </TabsContent>
        <TabsContent value="profile">
          <EmployeeProfilePanel canManage={canManageEmployees} />
        </TabsContent>
        <TabsContent value="payroll">
          <HrPayrollPanel employees={allEmployeesQuery.data?.data ?? []} />
        </TabsContent>

        <TabsContent value="recruitment">
          <HrRecruitmentPanel />
        </TabsContent>

        <TabsContent value="appraisals">
          <HrAppraisalPanel employees={allEmployeesQuery.data?.data ?? []} />
        </TabsContent>

        <TabsContent value="assets">
          <HrAssetsPanel employees={allEmployeesQuery.data?.data ?? []} />
        </TabsContent>

        <TabsContent value="expenses">
          <HrExpensesPanel employees={allEmployeesQuery.data?.data ?? []} />
        </TabsContent>

        {canViewHrSettings && (
          <TabsContent value="settings">
            <ErpReferenceSettings canManage={canManageHrSettings} />
          </TabsContent>
        )}
      </Tabs>
      <EmployeeDialog
        open={employeeOpen}
        onOpenChange={setEmployeeOpen}
        employee={editingEmployee}
        units={units.data?.data ?? []}
        positions={positions.data?.data ?? []}
        referenceOptions={referenceOptions.data ?? {}}
      />
      <UnitDialog
        open={unitOpen}
        onOpenChange={setUnitOpen}
        units={units.data?.data ?? []}
        referenceOptions={referenceOptions.data ?? {}}
      />
      <PositionDialog
        open={positionOpen}
        onOpenChange={setPositionOpen}
        units={units.data?.data ?? []}
        referenceOptions={referenceOptions.data ?? {}}
      />
    </section>
  );
}
