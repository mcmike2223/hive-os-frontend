"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeDollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  LockKeyhole,
  RefreshCw,
  Scale,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { payrollDownload, payrollFetch } from "@/modules/payroll/api";

type ExportFormat = "csv" | "xlsx" | "pdf";
type PayrollReport = "reconciliation" | "work-entries" | "adjustments";

type PayrollPeriod = {
  id: number;
  reference: string;
  name: string;
  starts_on: string;
  ends_on: string;
  currency: string;
  status: string;
};

type EmployeeOption = {
  id: number;
  employee_number: string;
  primary_name: string;
};

type PayrollRow = {
  id: number;
  employee_id: number;
  employee_number: string | null;
  employee_name: string | null;
  scheduled_hours: number;
  worked_hours: number;
  leave_hours: number;
  overtime_hours: number;
  absence_hours: number;
  late_minutes: number;
  early_departure_minutes: number;
  earnings_total: number;
  deductions_total: number;
  exception_count: number;
  missing_source_count: number;
  unapproved_source_count: number;
  status: string;
};

type PayrollReportData = {
  meta: {
    generated_at: string;
    source: string;
  };
  filters: {
    periods: PayrollPeriod[];
    employees: EmployeeOption[];
  };
  period: PayrollPeriod | null;
  metrics: {
    employees: number;
    scheduled_hours: number;
    worked_hours: number;
    leave_hours: number;
    overtime_hours: number;
    absence_hours: number;
    late_hours: number;
    early_departure_hours: number;
    earnings_total: number;
    deductions_total: number;
    exception_count: number;
    missing_source_count: number;
    unapproved_source_count: number;
    work_entry_count: number;
    pending_adjustments: number;
  };
  trend: {
    period: string;
    label: string;
    earnings: number;
    deductions: number;
    quantity: number;
  }[];
  time_codes: {
    key: string;
    label: string;
    entry_class: string;
    quantity: number;
    amount: number;
  }[];
  adjustment_statuses: { key: string; label: string; value: number }[];
  reconciliations: {
    data: PayrollRow[];
    meta: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    };
  };
};

type Filters = {
  period_id: string;
  employee_id: string;
  page: number;
};

const fieldClass =
  "min-h-11 w-full rounded-md border border-slate-500 bg-white px-3 text-sm text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 dark:border-slate-400 dark:bg-slate-950 dark:text-white dark:focus-visible:ring-blue-300";

function buildQuery(filters: Filters): string {
  const params = new URLSearchParams({
    page: String(filters.page),
    per_page: "25",
  });
  if (filters.period_id) params.set("period_id", filters.period_id);
  if (filters.employee_id) params.set("employee_id", filters.employee_id);
  return params.toString();
}

function label(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (c) =>
    c.toUpperCase(),
  );
}

function hours(value: number): string {
  return `${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} h`;
}

function money(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "ETB",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function Metric({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <Card className="border-slate-500 shadow-sm dark:border-slate-400">
      <CardContent className="flex min-h-32 items-start justify-between gap-4 p-5">
        <div>
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {title}
          </h2>
          <p className="mt-2 font-mono text-3xl font-black tabular-nums text-slate-950 dark:text-white">
            {value}
          </p>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
            {detail}
          </p>
        </div>
        <span className="rounded-xl bg-teal-100 p-3 text-teal-800 dark:bg-teal-950 dark:text-teal-200">
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}

function ReportChart({
  id,
  title,
  description,
  children,
  values,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
  values: ReactNode;
}) {
  return (
    <Card className="border-slate-500 dark:border-slate-400">
      <CardHeader>
        <CardTitle id={`${id}-title`} className="text-xl">
          {title}
        </CardTitle>
        <CardDescription id={`${id}-description`}>
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <figure
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-description`}
        >
          <div
            aria-hidden="true"
            className="h-80 [--chart-deduction:#b91c1c] [--chart-earning:#047857] [--chart-primary:#1d4ed8] dark:[--chart-deduction:#fca5a5] dark:[--chart-earning:#34d399] dark:[--chart-primary:#60a5fa]"
          >
            {children}
          </div>
          <details className="mt-4 rounded-xl border border-slate-500 bg-slate-50 p-4 dark:border-slate-400 dark:bg-slate-900">
            <summary className="min-h-11 cursor-pointer py-2 font-bold text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 dark:text-blue-200 dark:focus-visible:ring-blue-300">
              View exact chart values
            </summary>
            <div className="mt-3 overflow-x-auto">{values}</div>
          </details>
        </figure>
      </CardContent>
    </Card>
  );
}

export function PayrollReportingWorkspace() {
  const [draft, setDraft] = useState<Filters>({
    period_id: "",
    employee_id: "",
    page: 1,
  });
  const [filters, setFilters] = useState(draft);
  const [report, setReport] = useState<PayrollReport>("reconciliation");
  const queryString = useMemo(() => buildQuery(filters), [filters]);
  const reportQuery = useQuery({
    queryKey: ["payroll-reports", queryString],
    queryFn: () =>
      payrollFetch<{ data: PayrollReportData }>(
        `/reports/dashboard?${queryString}`,
      ),
    refetchInterval: 30_000,
  });
  const download = useMutation({
    mutationFn: async (format: ExportFormat) => {
      const exportQuery = new URLSearchParams(queryString);
      exportQuery.delete("page");
      exportQuery.delete("per_page");
      exportQuery.set("format", format);
      await payrollDownload(
        `/reports/${report}/export?${exportQuery.toString()}`,
        `${report}-report.${format}`,
      );
    },
    onSuccess: () => toast.success("Payroll report downloaded."),
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Unable to export the report.",
      ),
  });

  const data = reportQuery.data?.data;
  const currency = data?.period?.currency ?? "ETB";
  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({ ...draft, page: 1 });
  };
  const changePage = (page: number) => {
    const next = { ...filters, page };
    setFilters(next);
    setDraft(next);
  };

  return (
    <section
      aria-labelledby="payroll-reports-title"
      className="space-y-6 p-4 sm:p-6 lg:p-8"
    >
      <header className="overflow-hidden rounded-3xl border border-slate-500 bg-slate-950 px-5 py-7 text-white shadow-xl sm:px-8 dark:border-slate-400">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-200">
              Payroll evidence · Phase 12
            </p>
            <h1
              id="payroll-reports-title"
              className="mt-2 text-3xl font-black tracking-tight sm:text-4xl"
            >
              Payroll readiness
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
              Trace each pay-period result back to approved work entries,
              attendance reconciliation, leave effects, and post-lock
              adjustments.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <RefreshCw
              aria-hidden="true"
              className={`size-4 ${reportQuery.isFetching ? "animate-spin motion-reduce:animate-none" : ""}`}
            />
            {reportQuery.isFetching
              ? "Refreshing report"
              : "Refreshes every 30 seconds"}
          </div>
        </div>
      </header>

      <Card className="border-slate-500 dark:border-slate-400">
        <CardHeader>
          <CardTitle>Payroll report scope</CardTitle>
          <CardDescription>
            Select a payroll period and optionally isolate one employee.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            aria-label="Payroll report filters"
            onSubmit={applyFilters}
            className="grid gap-4 md:grid-cols-[minmax(14rem,1fr)_minmax(14rem,1fr)_auto]"
          >
            <div>
              <Label htmlFor="payroll-report-period">Payroll period</Label>
              <select
                id="payroll-report-period"
                className={fieldClass}
                value={draft.period_id}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    period_id: event.target.value,
                  }))
                }
              >
                <option value="">Latest payroll period</option>
                {(data?.filters.periods ?? []).map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name} · {label(period.status)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="payroll-report-employee">Employee</Label>
              <select
                id="payroll-report-employee"
                className={fieldClass}
                value={draft.employee_id}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    employee_id: event.target.value,
                  }))
                }
              >
                <option value="">All employees</option>
                {(data?.filters.employees ?? []).map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.primary_name} · {employee.employee_number}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                className="min-h-11 w-full"
                disabled={reportQuery.isFetching}
              >
                Apply report filters
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {reportQuery.isError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-700 bg-red-50 p-4 text-red-950 dark:border-red-300 dark:bg-red-950 dark:text-red-100"
        >
          {reportQuery.error instanceof Error
            ? reportQuery.error.message
            : "The payroll report could not be loaded."}
        </div>
      ) : !data ? (
        <p className="rounded-xl border border-slate-500 p-6 text-slate-700 dark:border-slate-400 dark:text-slate-200">
          Loading payroll evidence…
        </p>
      ) : !data.period ? (
        <div className="rounded-2xl border border-amber-700 bg-amber-50 p-6 text-amber-950 dark:border-amber-300 dark:bg-amber-950 dark:text-amber-100">
          <h2 className="text-xl font-black">No payroll period exists yet</h2>
          <p className="mt-2 text-sm">
            Create a payroll period and generate work entries before opening
            period reports.
          </p>
        </div>
      ) : (
        <>
          <Card className="border-slate-500 bg-slate-50 dark:border-slate-400 dark:bg-slate-900">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <h2 className="text-xl font-black">{data.period.name}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {data.period.starts_on} to {data.period.ends_on} ·{" "}
                  {data.period.reference}
                </p>
              </div>
              <span className="inline-flex min-h-11 items-center rounded-full border border-slate-700 px-4 font-bold text-slate-950 dark:border-slate-300 dark:text-white">
                <LockKeyhole aria-hidden="true" className="mr-2 size-4" />
                {label(data.period.status)}
              </span>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              title="Payroll earnings inputs"
              value={money(data.metrics.earnings_total, currency)}
              detail={`${data.metrics.work_entry_count.toLocaleString()} approved work entries`}
              icon={<BadgeDollarSign aria-hidden="true" />}
            />
            <Metric
              title="Payroll deductions"
              value={money(data.metrics.deductions_total, currency)}
              detail={`${hours(data.metrics.absence_hours)} absence · ${hours(data.metrics.late_hours)} late`}
              icon={<Scale aria-hidden="true" />}
            />
            <Metric
              title="Worked and leave time"
              value={hours(data.metrics.worked_hours)}
              detail={`${hours(data.metrics.leave_hours)} leave · ${hours(data.metrics.overtime_hours)} overtime`}
              icon={<WalletCards aria-hidden="true" />}
            />
            <Metric
              title="Readiness blockers"
              value={data.metrics.exception_count.toLocaleString()}
              detail={`${data.metrics.missing_source_count} missing · ${data.metrics.unapproved_source_count} unapproved · ${data.metrics.pending_adjustments} adjustments`}
              icon={<AlertTriangle aria-hidden="true" />}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <ReportChart
              id="payroll-input-trend"
              title="Daily payroll inputs"
              description="Approved earning and deduction amounts by work-entry date. Dashed lines and exact values supplement colour."
              values={
                <Table>
                  <TableCaption>
                    Exact daily payroll input values.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Date</TableHead>
                      <TableHead scope="col">Earnings</TableHead>
                      <TableHead scope="col">Deductions</TableHead>
                      <TableHead scope="col">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.trend.map((point) => (
                      <TableRow key={point.period}>
                        <TableHead scope="row">{point.period}</TableHead>
                        <TableCell>
                          {money(point.earnings, currency)}
                        </TableCell>
                        <TableCell>
                          {money(point.deductions, currency)}
                        </TableCell>
                        <TableCell>{point.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.trend}
                  margin={{ top: 12, right: 16, bottom: 8, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="earnings"
                    name="Earnings"
                    stroke="var(--chart-earning)"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="deductions"
                    name="Deductions"
                    stroke="var(--chart-deduction)"
                    strokeWidth={3}
                    strokeDasharray="8 4"
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ReportChart>

            <ReportChart
              id="payroll-time-code-mix"
              title="Time-code value"
              description="Payroll amount grouped by the approved time-code classification."
              values={
                <Table>
                  <TableCaption>
                    Exact payroll time-code amounts and quantities.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Time code</TableHead>
                      <TableHead scope="col">Class</TableHead>
                      <TableHead scope="col">Quantity</TableHead>
                      <TableHead scope="col">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.time_codes.map((point) => (
                      <TableRow key={`${point.key}-${point.entry_class}`}>
                        <TableHead scope="row">{point.label}</TableHead>
                        <TableCell>{label(point.entry_class)}</TableCell>
                        <TableCell>{point.quantity}</TableCell>
                        <TableCell>{money(point.amount, currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.time_codes}
                  layout="vertical"
                  margin={{ left: 34, right: 12 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="label" type="category" width={105} />
                  <Tooltip />
                  <Bar
                    dataKey="amount"
                    name={`Amount (${currency})`}
                    fill="var(--chart-primary)"
                    radius={[0, 6, 6, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ReportChart>
          </div>

          <Card className="border-slate-500 dark:border-slate-400">
            <CardHeader>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                <div>
                  <CardTitle>Export payroll evidence</CardTitle>
                  <CardDescription>
                    Download reconciliation, work-entry, or adjustment evidence
                    for the selected payroll period.
                  </CardDescription>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(13rem,1fr)_auto]">
                  <div>
                    <Label htmlFor="payroll-export-report">
                      Report contents
                    </Label>
                    <select
                      id="payroll-export-report"
                      className={fieldClass}
                      value={report}
                      onChange={(event) =>
                        setReport(event.target.value as PayrollReport)
                      }
                    >
                      <option value="reconciliation">Reconciliation</option>
                      <option value="work-entries">Work entries</option>
                      <option value="adjustments">Adjustments</option>
                    </select>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    {(["csv", "xlsx", "pdf"] as ExportFormat[]).map(
                      (format) => (
                        <Button
                          key={format}
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          disabled={download.isPending}
                          onClick={() => download.mutate(format)}
                        >
                          {format === "pdf" ? (
                            <FileText aria-hidden="true" />
                          ) : format === "xlsx" ? (
                            <FileSpreadsheet aria-hidden="true" />
                          ) : (
                            <Download aria-hidden="true" />
                          )}
                          Download {format.toUpperCase()}
                        </Button>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-slate-500 dark:border-slate-400">
            <CardHeader>
              <CardTitle>Employee reconciliation</CardTitle>
              <CardDescription>
                Readiness evidence by employee, including missing and
                unapproved input counts.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption>
                    Page {data.reconciliations.meta.current_page} of{" "}
                    {data.reconciliations.meta.last_page};{" "}
                    {data.reconciliations.meta.total.toLocaleString()} employee
                    reconciliations.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Employee</TableHead>
                      <TableHead scope="col">Scheduled</TableHead>
                      <TableHead scope="col">Worked</TableHead>
                      <TableHead scope="col">Leave</TableHead>
                      <TableHead scope="col">Overtime</TableHead>
                      <TableHead scope="col">Absence</TableHead>
                      <TableHead scope="col">Earnings</TableHead>
                      <TableHead scope="col">Deductions</TableHead>
                      <TableHead scope="col">Exceptions</TableHead>
                      <TableHead scope="col">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.reconciliations.data.length ? (
                      data.reconciliations.data.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <span className="font-semibold">
                              {row.employee_name ?? "Unknown employee"}
                            </span>
                            <span className="block font-mono text-xs text-slate-600 dark:text-slate-300">
                              {row.employee_number ?? "No employee number"}
                            </span>
                          </TableCell>
                          <TableCell>{hours(row.scheduled_hours)}</TableCell>
                          <TableCell>{hours(row.worked_hours)}</TableCell>
                          <TableCell>{hours(row.leave_hours)}</TableCell>
                          <TableCell>{hours(row.overtime_hours)}</TableCell>
                          <TableCell>{hours(row.absence_hours)}</TableCell>
                          <TableCell>
                            {money(row.earnings_total, currency)}
                          </TableCell>
                          <TableCell>
                            {money(row.deductions_total, currency)}
                          </TableCell>
                          <TableCell>
                            {row.exception_count}
                            {(row.missing_source_count > 0 ||
                              row.unapproved_source_count > 0) && (
                              <span className="block text-xs text-red-800 dark:text-red-200">
                                {row.missing_source_count} missing ·{" "}
                                {row.unapproved_source_count} unapproved
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{label(row.status)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={10}
                          className="py-10 text-center text-slate-600 dark:text-slate-300"
                        >
                          No reconciliation rows exist for this payroll scope.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-500 p-4 dark:border-slate-400">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Showing up to {data.reconciliations.meta.per_page} employees
                  per page.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={data.reconciliations.meta.current_page <= 1}
                    onClick={() =>
                      changePage(data.reconciliations.meta.current_page - 1)
                    }
                  >
                    Previous page
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={
                      data.reconciliations.meta.current_page >=
                      data.reconciliations.meta.last_page
                    }
                    onClick={() =>
                      changePage(data.reconciliations.meta.current_page + 1)
                    }
                  >
                    Next page
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-slate-600 dark:text-slate-300">
            Report source: {data.meta.source}. Last calculated{" "}
            <time dateTime={data.meta.generated_at}>
              {new Date(data.meta.generated_at).toLocaleString()}
            </time>
            .
          </p>
        </>
      )}
    </section>
  );
}
