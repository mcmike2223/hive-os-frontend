"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarRange,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  ShieldCheck,
  TimerReset,
  UsersRound,
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
import {
  attendanceDownload,
  attendanceFetch,
} from "@/modules/attendance/api";

type Granularity = "daily" | "weekly" | "monthly";
type ExportFormat = "csv" | "xlsx" | "pdf";
type AttendanceReport = "attendance" | "leave" | "schedule";

type Option = {
  id: number;
  name?: string;
  unit_type?: string;
  employee_number?: string;
  primary_name?: string;
};

type CategoryPoint = {
  key: string;
  label: string;
  value: number;
};

type TrendPoint = {
  period: string;
  label: string;
  recorded: number;
  scheduled_hours: number;
  worked_hours: number;
  payable_hours: number;
  leave_hours: number;
  overtime_hours: number;
  late_hours: number;
  exceptions: number;
};

type AttendanceRow = {
  id: number;
  date: string;
  employee_id: number;
  employee_number: string | null;
  employee_name: string | null;
  organization_unit: string | null;
  status: string;
  scheduled_hours: number;
  worked_hours: number;
  payable_hours: number;
  leave_hours: number;
  overtime_hours: number;
  late_minutes: number;
  early_departure_minutes: number;
  exception_count: number;
  reconciliation_status: string | null;
};

type AttendanceReportData = {
  meta: {
    from: string;
    to: string;
    granularity: Granularity;
    generated_at: string;
    source: string;
  };
  filters: {
    organization_units: Option[];
    employees: Option[];
  };
  metrics: {
    active_employees: number;
    recorded_employees: number;
    recorded_days: number;
    scheduled_hours: number;
    worked_hours: number;
    payable_hours: number;
    leave_hours: number;
    holiday_hours: number;
    overtime_hours: number;
    late_hours: number;
    early_departure_hours: number;
    exception_count: number;
    approved_leave_requests: number;
    pending_leave_requests: number;
    roster_slots: number;
    assigned_roster_slots: number;
    open_roster_slots: number;
    rest_roster_slots: number;
  };
  trend: TrendPoint[];
  status_distribution: CategoryPoint[];
  leave_statuses: CategoryPoint[];
  roster_coverage: CategoryPoint[];
  records: {
    data: AttendanceRow[];
    meta: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    };
  };
};

type Filters = {
  from: string;
  to: string;
  granularity: Granularity;
  organization_unit_id: string;
  employee_id: string;
  status: string;
  page: number;
};

const fieldClass =
  "min-h-11 w-full rounded-md border border-slate-500 bg-white px-3 text-sm text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 dark:border-slate-400 dark:bg-slate-950 dark:text-white dark:focus-visible:ring-blue-300";

function localDate(daysAgo = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

const defaultFilters: Filters = {
  from: localDate(29),
  to: localDate(),
  granularity: "daily",
  organization_unit_id: "",
  employee_id: "",
  status: "",
  page: 1,
};

function buildQuery(filters: Filters): string {
  const params = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    granularity: filters.granularity,
    page: String(filters.page),
    per_page: "25",
  });

  if (filters.organization_unit_id) {
    params.set("organization_unit_id", filters.organization_unit_id);
  }
  if (filters.employee_id) params.set("employee_id", filters.employee_id);
  if (filters.status) params.set("status", filters.status);

  return params.toString();
}

function hours(value: number): string {
  return `${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} h`;
}

function label(value: string | null): string {
  if (!value) return "Not reconciled";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) =>
    letter.toUpperCase(),
  );
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
        <span className="rounded-xl bg-blue-100 p-3 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}

function ChartPanel({
  id,
  title,
  description,
  children,
  table,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
  table: ReactNode;
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
            className="h-80 [--chart-exception:#b91c1c] [--chart-leave:#b45309] [--chart-scheduled:#1d4ed8] [--chart-worked:#047857] dark:[--chart-exception:#fca5a5] dark:[--chart-leave:#fbbf24] dark:[--chart-scheduled:#60a5fa] dark:[--chart-worked:#34d399]"
          >
            {children}
          </div>
          <details className="mt-4 rounded-xl border border-slate-500 bg-slate-50 p-4 dark:border-slate-400 dark:bg-slate-900">
            <summary className="min-h-11 cursor-pointer py-2 font-bold text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 dark:text-blue-200 dark:focus-visible:ring-blue-300">
              View exact chart values
            </summary>
            <div className="mt-3 overflow-x-auto">{table}</div>
          </details>
        </figure>
      </CardContent>
    </Card>
  );
}

export function AttendanceReportingWorkspace() {
  const [draft, setDraft] = useState(defaultFilters);
  const [filters, setFilters] = useState(defaultFilters);
  const [report, setReport] = useState<AttendanceReport>("attendance");
  const queryString = useMemo(() => buildQuery(filters), [filters]);
  const reportQuery = useQuery({
    queryKey: ["attendance-reports", queryString],
    queryFn: () =>
      attendanceFetch<{ data: AttendanceReportData }>(
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
      await attendanceDownload(
        `/reports/${report}/export?${exportQuery.toString()}`,
        `${report}-report.${format}`,
      );
    },
    onSuccess: () => toast.success("Workforce report downloaded."),
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Unable to export the report.",
      ),
  });

  const data = reportQuery.data?.data;
  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draft.from > draft.to) {
      toast.error("Start date must be on or before the end date.");
      return;
    }
    setFilters({ ...draft, page: 1 });
  };
  const changePage = (page: number) => {
    const next = { ...filters, page };
    setFilters(next);
    setDraft(next);
  };

  return (
    <section
      aria-labelledby="attendance-reports-title"
      className="space-y-6 p-4 sm:p-6 lg:p-8"
    >
      <header className="overflow-hidden rounded-3xl border border-slate-500 bg-slate-950 px-5 py-7 text-white shadow-xl sm:px-8 dark:border-slate-400">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
              Workforce evidence · Phase 12
            </p>
            <h1
              id="attendance-reports-title"
              className="mt-2 text-3xl font-black tracking-tight sm:text-4xl"
            >
              Attendance intelligence
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
              Compare scheduled, worked, leave, overtime, and exception evidence
              before it reaches payroll. Totals and exports use the same
              tenant-scoped records.
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
          <CardTitle>Report period and scope</CardTitle>
          <CardDescription>
            Daily, weekly, and monthly views support a maximum 366-day range.
            Selecting filters does not refresh until you apply them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            aria-label="Attendance report filters"
            onSubmit={applyFilters}
            className="grid gap-4 lg:grid-cols-6"
          >
            <div>
              <Label htmlFor="attendance-report-from">Starts on</Label>
              <input
                id="attendance-report-from"
                type="date"
                required
                className={fieldClass}
                value={draft.from}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    from: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="attendance-report-to">Ends on</Label>
              <input
                id="attendance-report-to"
                type="date"
                required
                className={fieldClass}
                value={draft.to}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    to: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="attendance-report-grain">Group results</Label>
              <select
                id="attendance-report-grain"
                className={fieldClass}
                value={draft.granularity}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    granularity: event.target.value as Granularity,
                  }))
                }
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <Label htmlFor="attendance-report-unit">Organization unit</Label>
              <select
                id="attendance-report-unit"
                className={fieldClass}
                value={draft.organization_unit_id}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    organization_unit_id: event.target.value,
                  }))
                }
              >
                <option value="">All units</option>
                {(data?.filters.organization_units ?? []).map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="attendance-report-employee">Employee</Label>
              <select
                id="attendance-report-employee"
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
            : "The attendance report could not be loaded."}
        </div>
      ) : !data ? (
        <p className="rounded-xl border border-slate-500 p-6 text-slate-700 dark:border-slate-400 dark:text-slate-200">
          Loading workforce evidence…
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              title="Worked versus scheduled"
              value={hours(data.metrics.worked_hours)}
              detail={`${hours(data.metrics.scheduled_hours)} scheduled · ${data.metrics.recorded_days.toLocaleString()} employee-days`}
              icon={<Clock3 aria-hidden="true" />}
            />
            <Metric
              title="Payroll-ready time"
              value={hours(data.metrics.payable_hours)}
              detail={`${hours(data.metrics.leave_hours)} leave · ${hours(data.metrics.holiday_hours)} holiday`}
              icon={<ShieldCheck aria-hidden="true" />}
            />
            <Metric
              title="Overtime recorded"
              value={hours(data.metrics.overtime_hours)}
              detail={`${hours(data.metrics.late_hours)} late · ${hours(data.metrics.early_departure_hours)} early departure`}
              icon={<TimerReset aria-hidden="true" />}
            />
            <Metric
              title="Exceptions requiring review"
              value={data.metrics.exception_count.toLocaleString()}
              detail={`${data.metrics.open_roster_slots.toLocaleString()} open roster slots · ${data.metrics.pending_leave_requests.toLocaleString()} pending leave`}
              icon={<AlertTriangle aria-hidden="true" />}
            />
          </div>

          <ChartPanel
            id="workforce-period-pulse"
            title="Operational period pulse"
            description={`${label(data.meta.granularity)} comparison from ${data.meta.from} through ${data.meta.to}. Line styles and exact values supplement colour.`}
            table={
              <Table>
                <TableCaption>
                  Exact operational pulse values for the selected reporting
                  period.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Period</TableHead>
                    <TableHead scope="col">Scheduled</TableHead>
                    <TableHead scope="col">Worked</TableHead>
                    <TableHead scope="col">Leave</TableHead>
                    <TableHead scope="col">Overtime</TableHead>
                    <TableHead scope="col">Exceptions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.trend.map((point) => (
                    <TableRow key={point.period}>
                      <TableHead scope="row">{point.label}</TableHead>
                      <TableCell>{hours(point.scheduled_hours)}</TableCell>
                      <TableCell>{hours(point.worked_hours)}</TableCell>
                      <TableCell>{hours(point.leave_hours)}</TableCell>
                      <TableCell>{hours(point.overtime_hours)}</TableCell>
                      <TableCell>{point.exceptions}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.trend}
                margin={{ top: 12, right: 16, bottom: 8, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="scheduled_hours"
                  name="Scheduled hours"
                  stroke="var(--chart-scheduled)"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="worked_hours"
                  name="Worked hours"
                  stroke="var(--chart-worked)"
                  strokeWidth={3}
                  strokeDasharray="9 4"
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="leave_hours"
                  name="Leave hours"
                  stroke="var(--chart-leave)"
                  strokeWidth={2}
                  strokeDasharray="3 4"
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="overtime_hours"
                  name="Overtime hours"
                  stroke="var(--chart-exception)"
                  strokeWidth={2}
                  strokeDasharray="12 4 2 4"
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>

          <div className="grid gap-5 xl:grid-cols-3">
            <ChartPanel
              id="attendance-status-distribution"
              title="Attendance outcomes"
              description="Calculated employee-days grouped by current attendance status."
              table={
                <Table>
                  <TableCaption>
                    Exact attendance outcome counts.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Outcome</TableHead>
                      <TableHead scope="col">Employee-days</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.status_distribution.map((point) => (
                      <TableRow key={point.key}>
                        <TableHead scope="row">{point.label}</TableHead>
                        <TableCell>{point.value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.status_distribution}
                  layout="vertical"
                  margin={{ left: 28, right: 12 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="label" type="category" width={90} />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    name="Employee-days"
                    fill="var(--chart-scheduled)"
                    radius={[0, 6, 6, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <Card className="border-slate-500 dark:border-slate-400">
              <CardHeader>
                <CardTitle className="text-xl">Leave effect</CardTitle>
                <CardDescription>
                  Requests overlapping the selected period by current workflow
                  status.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  {data.leave_statuses.length ? (
                    data.leave_statuses.map((point) => (
                      <div
                        key={point.key}
                        className="flex items-center justify-between gap-4 rounded-xl border border-slate-500 p-3 dark:border-slate-400"
                      >
                        <dt>{point.label}</dt>
                        <dd className="font-mono text-lg font-black tabular-nums">
                          {point.value}
                        </dd>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      No leave requests overlap this period.
                    </p>
                  )}
                </dl>
              </CardContent>
            </Card>

            <Card className="border-slate-500 dark:border-slate-400">
              <CardHeader>
                <CardTitle className="text-xl">Roster coverage</CardTitle>
                <CardDescription>
                  Assigned, open, and rest-day roster slots for this reporting
                  period.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  {data.roster_coverage.map((point) => (
                    <div
                      key={point.key}
                      className="flex items-center justify-between gap-4 rounded-xl border border-slate-500 p-3 dark:border-slate-400"
                    >
                      <dt>{point.label}</dt>
                      <dd className="font-mono text-lg font-black tabular-nums">
                        {point.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-500 dark:border-slate-400">
            <CardHeader>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                <div>
                  <CardTitle>Export audit-ready evidence</CardTitle>
                  <CardDescription>
                    CSV streams large results; XLSX and PDF apply the same
                    period and scope filters as this dashboard.
                  </CardDescription>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_auto]">
                  <div>
                    <Label htmlFor="attendance-export-report">
                      Report contents
                    </Label>
                    <select
                      id="attendance-export-report"
                      className={fieldClass}
                      value={report}
                      onChange={(event) =>
                        setReport(event.target.value as AttendanceReport)
                      }
                    >
                      <option value="attendance">
                        Attendance evidence
                      </option>
                      <option value="leave">Leave effects</option>
                      <option value="schedule">Schedule coverage</option>
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
              <CardTitle>Employee attendance evidence</CardTitle>
              <CardDescription>
                Current calculation versions only. Records are ordered newest
                first and remain tenant-scoped.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption>
                    Page {data.records.meta.current_page} of{" "}
                    {data.records.meta.last_page};{" "}
                    {data.records.meta.total.toLocaleString()} attendance
                    records match the selected filters.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Date</TableHead>
                      <TableHead scope="col">Employee</TableHead>
                      <TableHead scope="col">Unit</TableHead>
                      <TableHead scope="col">Status</TableHead>
                      <TableHead scope="col">Scheduled</TableHead>
                      <TableHead scope="col">Worked</TableHead>
                      <TableHead scope="col">Leave</TableHead>
                      <TableHead scope="col">Overtime</TableHead>
                      <TableHead scope="col">Exceptions</TableHead>
                      <TableHead scope="col">Reconciliation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.records.data.length ? (
                      data.records.data.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.date}</TableCell>
                          <TableCell>
                            <span className="font-semibold">
                              {row.employee_name ?? "Unknown employee"}
                            </span>
                            <span className="block font-mono text-xs text-slate-600 dark:text-slate-300">
                              {row.employee_number ?? "No employee number"}
                            </span>
                          </TableCell>
                          <TableCell>{row.organization_unit ?? "—"}</TableCell>
                          <TableCell>{label(row.status)}</TableCell>
                          <TableCell>{hours(row.scheduled_hours)}</TableCell>
                          <TableCell>{hours(row.worked_hours)}</TableCell>
                          <TableCell>{hours(row.leave_hours)}</TableCell>
                          <TableCell>{hours(row.overtime_hours)}</TableCell>
                          <TableCell>{row.exception_count}</TableCell>
                          <TableCell>
                            {label(row.reconciliation_status)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={10}
                          className="py-10 text-center text-slate-600 dark:text-slate-300"
                        >
                          No attendance records match this report scope.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-500 p-4 dark:border-slate-400">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Showing up to {data.records.meta.per_page} records per page.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={data.records.meta.current_page <= 1}
                    onClick={() =>
                      changePage(data.records.meta.current_page - 1)
                    }
                  >
                    Previous page
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={
                      data.records.meta.current_page >=
                      data.records.meta.last_page
                    }
                    onClick={() =>
                      changePage(data.records.meta.current_page + 1)
                    }
                  >
                    Next page
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <UsersRound aria-hidden="true" className="size-4" />
            {data.metrics.recorded_employees.toLocaleString()} of{" "}
            {data.metrics.active_employees.toLocaleString()} active employees
            have recorded attendance in this scope. Last calculated{" "}
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
