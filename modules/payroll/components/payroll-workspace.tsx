"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  CircleAlert,
  FileLock2,
  ListChecks,
  Plus,
  RefreshCw,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { HrPayrollPanel } from "@/app/dashboard/human-resources/hr-payroll-panel";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { getWorkspaceScopeKey } from "@/lib/runtime-context";
import {
  Employee,
  Paginated,
  hrFetch,
} from "@/modules/humanresources/api";
import { payrollFetch } from "@/modules/payroll/api";

type PayrollPeriod = {
  id: number;
  period_uuid: string;
  reference: string;
  name: string;
  starts_on: string;
  ends_on: string;
  currency: string;
  status:
    | "draft"
    | "review"
    | "review_required"
    | "finalized"
    | "locked";
  unresolved_exceptions: number;
  work_entries_count?: number;
  reconciliations_count?: number;
};

type PayrollReconciliation = {
  id: number;
  employee_id: number;
  scheduled_minutes: number;
  worked_minutes: number;
  leave_minutes: number;
  overtime_minutes: number;
  absence_minutes: number;
  earnings_total: string;
  deductions_total: string;
  exception_count: number;
  status: string;
  employee?: Employee;
};

type PayrollWorkEntry = {
  id: number;
  work_date: string | null;
  time_code: string;
  quantity: string;
  unit: string;
  entry_class: "earning" | "deduction" | "informational";
  rate: string;
  multiplier: string;
  amount: string;
  approval_status: string;
  employee?: Employee;
};

type PayrollAdjustment = {
  id: number;
  adjustment_reference: string;
  time_code: string;
  entry_class: string;
  amount: string;
  status: string;
  reason: string;
  employee?: Employee;
};

type PayrollWorkspaceResponse = {
  data: {
    periods: PayrollPeriod[];
    selected_period: PayrollPeriod | null;
    reconciliations: PayrollReconciliation[];
    work_entries: PayrollWorkEntry[];
    adjustments: PayrollAdjustment[];
    summary: {
      earnings_total: number;
      deductions_total: number;
      employees: number;
      exceptions: number;
    };
  };
};

const inputClass =
  "h-11 border-slate-500 focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-cyan-300";
const selectClass =
  "h-11 w-full rounded-md border border-slate-500 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-cyan-300";

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function endOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
}

function formatMoney(value: string | number, currency = "ETB") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours}h ${minutes}m`;
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function PayrollWorkspace() {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("manage_payroll");
  const [periodId, setPeriodId] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [periodForm, setPeriodForm] = useState({
    name: `Payroll ${new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
    }).format(new Date())}`,
    starts_on: startOfMonth(),
    ends_on: endOfMonth(),
  });
  const [adjustmentForm, setAdjustmentForm] = useState({
    employee_id: "",
    time_code: "attendance_adjustment",
    entry_class: "earning",
    quantity: "0",
    unit: "hours",
    rate: "0",
    multiplier: "1",
    reason: "",
  });

  const employeesQuery = useQuery({
    queryKey: ["payroll-employees", scope],
    queryFn: () => hrFetch<Paginated<Employee>>("/employees?per_page=500"),
  });
  const workspaceQuery = useQuery({
    queryKey: ["payroll-workspace", scope, periodId],
    queryFn: () =>
      payrollFetch<PayrollWorkspaceResponse>(
        `/workspace${periodId ? `?period_id=${encodeURIComponent(periodId)}` : ""}`,
      ),
  });
  const workspace = workspaceQuery.data?.data;
  const period = workspace?.selected_period ?? null;
  const currency = period?.currency ?? "ETB";

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["payroll-workspace"] });

  const createPeriod = useMutation({
    mutationFn: () =>
      payrollFetch<{ data: PayrollPeriod }>("/periods", {
        method: "POST",
        body: JSON.stringify(periodForm),
      }),
    onSuccess: ({ data }) => {
      setPeriodId(String(data.id));
      setCreateOpen(false);
      toast.success("Payroll period created.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const generate = useMutation({
    mutationFn: () =>
      payrollFetch(`/periods/${period?.id}/generate`, {
        method: "POST",
        body: JSON.stringify({
          idempotency_key:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? `payroll-generation:${crypto.randomUUID()}`
              : `payroll-generation:${Date.now()}`,
        }),
      }),
    onSuccess: () => {
      toast.success("Approved attendance was converted into payroll work entries.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const finalize = useMutation({
    mutationFn: () =>
      payrollFetch(`/periods/${period?.id}/finalize`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Payroll period finalized.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const lock = useMutation({
    mutationFn: () =>
      payrollFetch(`/periods/${period?.id}/lock`, {
        method: "POST",
        body: JSON.stringify({
          reason: "Finalized payroll approved and locked from the payroll workspace.",
        }),
      }),
    onSuccess: () => {
      toast.success("Payroll period locked. Later source changes require adjustments.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const adjustment = useMutation({
    mutationFn: () =>
      payrollFetch("/adjustments", {
        method: "POST",
        body: JSON.stringify({
          ...adjustmentForm,
          payroll_period_reference: period?.reference,
          employee_id: Number(adjustmentForm.employee_id),
          quantity: Number(adjustmentForm.quantity),
          rate: Number(adjustmentForm.rate),
          multiplier: Number(adjustmentForm.multiplier),
        }),
      }),
    onSuccess: () => {
      setAdjustmentOpen(false);
      toast.success("Adjustment queued without changing the locked source period.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const periodActions = useMemo(() => {
    if (!period || !canManage) return null;
    if (["draft", "review", "review_required"].includes(period.status)) {
      return (
        <Button
          type="button"
          className="min-h-11"
          disabled={generate.isPending}
          onClick={() => generate.mutate()}
        >
          <RefreshCw
            aria-hidden="true"
            className={`mr-2 h-4 w-4 ${generate.isPending ? "animate-spin" : ""}`}
          />
          Generate work entries
        </Button>
      );
    }
    if (period.status === "finalized") {
      return (
        <Button
          type="button"
          className="min-h-11"
          disabled={lock.isPending}
          onClick={() => lock.mutate()}
        >
          <FileLock2 aria-hidden="true" className="mr-2 h-4 w-4" />
          Lock period
        </Button>
      );
    }
    return (
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        onClick={() => setAdjustmentOpen(true)}
      >
        <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
        New adjustment
      </Button>
    );
  }, [canManage, generate, lock, period]);

  function submitPeriod(event: FormEvent) {
    event.preventDefault();
    createPeriod.mutate();
  }

  function submitAdjustment(event: FormEvent) {
    event.preventDefault();
    adjustment.mutate();
  }

  return (
    <main className="space-y-6 p-4 sm:p-6" aria-labelledby="payroll-heading">
      <header className="rounded-2xl border border-slate-300 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 text-white shadow-xl dark:border-slate-700">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
              Standalone module
            </p>
            <h1 id="payroll-heading" className="mt-2 text-3xl font-bold">
              Payroll management
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              Turn approved attendance and leave outcomes into traceable work
              entries, reconcile every employee, then finalize and lock the
              period. Locked payroll is changed only through an adjustment.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <Button
                type="button"
                variant="secondary"
                className="min-h-11"
                onClick={() => setCreateOpen(true)}
              >
                <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
                New period
              </Button>
            )}
            {periodActions}
          </div>
        </div>
      </header>

      <section aria-labelledby="period-heading" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="period-heading" className="text-xl font-bold">
              Current payroll period
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Select a period to review its source coverage and totals.
            </p>
          </div>
          <div className="w-full sm:max-w-sm">
            <Label htmlFor="payroll-period-select">Payroll period</Label>
            <select
              id="payroll-period-select"
              className={selectClass}
              value={periodId || period?.id || ""}
              onChange={(event) => setPeriodId(event.target.value)}
            >
              {workspace?.periods.length ? (
                workspace.periods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {statusLabel(item.status)}
                  </option>
                ))
              ) : (
                <option value="">No payroll periods yet</option>
              )}
            </select>
          </div>
        </div>

        {workspaceQuery.isLoading ? (
          <Card>
            <CardContent className="p-6 text-sm" role="status">
              Loading payroll evidence…
            </CardContent>
          </Card>
        ) : !period ? (
          <Card>
            <CardContent className="p-8 text-center">
              <WalletCards
                aria-hidden="true"
                className="mx-auto h-10 w-10 text-indigo-700 dark:text-cyan-300"
              />
              <h3 className="mt-3 text-lg font-bold">Create the first period</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                A period defines the date range that approved attendance and
                leave evidence can enter.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Employees reconciled",
                  value: String(workspace?.summary.employees ?? 0),
                  icon: UsersRound,
                },
                {
                  label: "Approved earnings",
                  value: formatMoney(
                    workspace?.summary.earnings_total ?? 0,
                    currency,
                  ),
                  icon: BadgeDollarSign,
                },
                {
                  label: "Deductions",
                  value: formatMoney(
                    workspace?.summary.deductions_total ?? 0,
                    currency,
                  ),
                  icon: ListChecks,
                },
                {
                  label: "Exceptions",
                  value: String(workspace?.summary.exceptions ?? 0),
                  icon: CircleAlert,
                },
              ].map(({ label, value, icon: Icon }) => (
                <Card key={label} className="border-slate-300 dark:border-slate-700">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      <Icon
                        aria-hidden="true"
                        className="h-4 w-4 text-indigo-700 dark:text-cyan-300"
                      />
                      {label}
                    </div>
                    <p className="mt-2 text-2xl font-bold">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {period.status === "review" && canManage && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="min-h-11"
                  disabled={finalize.isPending}
                  onClick={() => finalize.mutate()}
                >
                  <ListChecks aria-hidden="true" className="mr-2 h-4 w-4" />
                  Finalize reviewed period
                </Button>
              </div>
            )}

            <Tabs defaultValue="reconciliation">
              <TabsList aria-label="Payroll workspace views">
                <TabsTrigger value="reconciliation">
                  Reconciliation
                </TabsTrigger>
                <TabsTrigger value="entries">Work entries</TabsTrigger>
                <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
                <TabsTrigger value="payslips">Payslips</TabsTrigger>
              </TabsList>

              <TabsContent value="reconciliation">
                <div className="overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700">
                  <Table>
                    <TableCaption>
                      Attendance, leave, earnings, deductions, and unresolved
                      differences for {period.name}.
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Scheduled</TableHead>
                        <TableHead>Worked</TableHead>
                        <TableHead>Leave</TableHead>
                        <TableHead>Overtime</TableHead>
                        <TableHead>Absence</TableHead>
                        <TableHead>Earnings</TableHead>
                        <TableHead>Deductions</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workspace?.reconciliations.length ? (
                        workspace.reconciliations.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-semibold">
                              {row.employee?.primary_name ??
                                `Employee ${row.employee_id}`}
                            </TableCell>
                            <TableCell>
                              {formatMinutes(row.scheduled_minutes)}
                            </TableCell>
                            <TableCell>
                              {formatMinutes(row.worked_minutes)}
                            </TableCell>
                            <TableCell>
                              {formatMinutes(row.leave_minutes)}
                            </TableCell>
                            <TableCell>
                              {formatMinutes(row.overtime_minutes)}
                            </TableCell>
                            <TableCell>
                              {formatMinutes(row.absence_minutes)}
                            </TableCell>
                            <TableCell>
                              {formatMoney(row.earnings_total, currency)}
                            </TableCell>
                            <TableCell>
                              {formatMoney(row.deductions_total, currency)}
                            </TableCell>
                            <TableCell>{statusLabel(row.status)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} className="py-8 text-center">
                            Generate work entries to create reconciliation
                            evidence.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="entries">
                <div className="overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700">
                  <Table>
                    <TableCaption>
                      Approved, classified payroll inputs with their rate and
                      source quantity.
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Time code</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Multiplier</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workspace?.work_entries.length ? (
                        workspace.work_entries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>{entry.work_date ?? "—"}</TableCell>
                            <TableCell className="font-semibold">
                              {entry.employee?.primary_name ?? "Unknown"}
                            </TableCell>
                            <TableCell>{statusLabel(entry.time_code)}</TableCell>
                            <TableCell>
                              {statusLabel(entry.entry_class)}
                            </TableCell>
                            <TableCell>
                              {Number(entry.quantity).toLocaleString()}{" "}
                              {entry.unit}
                            </TableCell>
                            <TableCell>
                              {formatMoney(entry.rate, currency)}
                            </TableCell>
                            <TableCell>{entry.multiplier}×</TableCell>
                            <TableCell className="font-semibold">
                              {formatMoney(entry.amount, currency)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="py-8 text-center">
                            No approved work entries are available.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="adjustments">
                <div className="overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700">
                  <Table>
                    <TableCaption>
                      Changes queued after payroll finalization or locking.
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Time code</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workspace?.adjustments.length ? (
                        workspace.adjustments.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">
                              {item.adjustment_reference}
                            </TableCell>
                            <TableCell>
                              {item.employee?.primary_name ?? "Unknown"}
                            </TableCell>
                            <TableCell>{statusLabel(item.time_code)}</TableCell>
                            <TableCell>
                              {statusLabel(item.entry_class)}
                            </TableCell>
                            <TableCell>
                              {formatMoney(item.amount, currency)}
                            </TableCell>
                            <TableCell>{statusLabel(item.status)}</TableCell>
                            <TableCell className="max-w-sm">
                              {item.reason}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center">
                            No adjustments have been queued.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="payslips">
                <HrPayrollPanel
                  employees={employeesQuery.data?.data ?? []}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <form onSubmit={submitPeriod}>
            <DialogHeader>
              <DialogTitle>Create payroll period</DialogTitle>
              <DialogDescription>
                Define the closed date range used to collect approved workforce
                inputs.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-5">
              <div>
                <Label htmlFor="period-name">Period name</Label>
                <Input
                  id="period-name"
                  className={inputClass}
                  required
                  value={periodForm.name}
                  onChange={(event) =>
                    setPeriodForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="period-start">Starts on</Label>
                  <Input
                    id="period-start"
                    type="date"
                    className={inputClass}
                    required
                    value={periodForm.starts_on}
                    onChange={(event) =>
                      setPeriodForm((current) => ({
                        ...current,
                        starts_on: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="period-end">Ends on</Label>
                  <Input
                    id="period-end"
                    type="date"
                    className={inputClass}
                    required
                    value={periodForm.ends_on}
                    onChange={(event) =>
                      setPeriodForm((current) => ({
                        ...current,
                        ends_on: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="min-h-11"
                disabled={createPeriod.isPending}
              >
                Create period
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustmentOpen} onOpenChange={setAdjustmentOpen}>
        <DialogContent>
          <form onSubmit={submitAdjustment}>
            <DialogHeader>
              <DialogTitle>Queue payroll adjustment</DialogTitle>
              <DialogDescription>
                The locked period remains unchanged. This adjustment can be
                reviewed and applied to a later open period.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-5">
              <div>
                <Label htmlFor="adjustment-employee">Employee</Label>
                <select
                  id="adjustment-employee"
                  className={selectClass}
                  required
                  value={adjustmentForm.employee_id}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({
                      ...current,
                      employee_id: event.target.value,
                    }))
                  }
                >
                  <option value="">Select an employee</option>
                  {(employeesQuery.data?.data ?? []).map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.primary_name} · {employee.employee_number}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="adjustment-code">Time code</Label>
                  <Input
                    id="adjustment-code"
                    className={inputClass}
                    required
                    value={adjustmentForm.time_code}
                    onChange={(event) =>
                      setAdjustmentForm((current) => ({
                        ...current,
                        time_code: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="adjustment-class">Entry class</Label>
                  <select
                    id="adjustment-class"
                    className={selectClass}
                    value={adjustmentForm.entry_class}
                    onChange={(event) =>
                      setAdjustmentForm((current) => ({
                        ...current,
                        entry_class: event.target.value,
                      }))
                    }
                  >
                    <option value="earning">Earning</option>
                    <option value="deduction">Deduction</option>
                    <option value="informational">Informational</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="adjustment-quantity">Quantity</Label>
                  <Input
                    id="adjustment-quantity"
                    type="number"
                    step="0.01"
                    className={inputClass}
                    required
                    value={adjustmentForm.quantity}
                    onChange={(event) =>
                      setAdjustmentForm((current) => ({
                        ...current,
                        quantity: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="adjustment-rate">Rate</Label>
                  <Input
                    id="adjustment-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass}
                    value={adjustmentForm.rate}
                    onChange={(event) =>
                      setAdjustmentForm((current) => ({
                        ...current,
                        rate: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="adjustment-multiplier">Multiplier</Label>
                  <Input
                    id="adjustment-multiplier"
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass}
                    value={adjustmentForm.multiplier}
                    onChange={(event) =>
                      setAdjustmentForm((current) => ({
                        ...current,
                        multiplier: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="adjustment-reason">Reason</Label>
                <Textarea
                  id="adjustment-reason"
                  required
                  value={adjustmentForm.reason}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setAdjustmentOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="min-h-11"
                disabled={adjustment.isPending}
              >
                Queue adjustment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
