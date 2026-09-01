"use client";

import {
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CircleAlert,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Radio,
  ReceiptText,
  RefreshCw,
  UserCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { initEcho } from "@/lib/echo";
import {
  getAccessToken,
  getTenantId,
  getWorkspaceScopeKey,
} from "@/lib/runtime-context";
import {
  type HrDashboardAttendancePoint,
  type HrDashboardCategory,
  type HrDashboardData,
  hrFetch,
} from "@/modules/humanresources/api";

const CHART_COLOURS = [
  "hsl(var(--primary))",
  "#10b981",
  "#f59e0b",
  "#6366f1",
  "#ec4899",
  "#06b6d4",
  "#8b5cf6",
];

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "10px",
  color: "hsl(var(--popover-foreground))",
  fontSize: "12px",
};

type DashboardResponse = { data: HrDashboardData };
type ExportFormat = "csv" | "png";

type LiveEvent = {
  occurred_at?: string;
  resource?: string;
  action?: string;
};

type PusherSubscription = {
  bind: (event: string, callback: () => void) => void;
  unbind: (event: string, callback?: () => void) => void;
};

type EchoPrivateChannel = {
  listen: (event: string, callback: (payload: LiveEvent) => void) => EchoPrivateChannel;
  subscription?: PusherSubscription;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRefreshTime(value: string | null) {
  if (!value) return "Waiting for first refresh";

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);

    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function quoteCsv(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function exportCsv(
  filename: string,
  rows: Array<Record<string, string | number>>,
) {
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map(quoteCsv).join(","),
    ...rows.map((row) => headers.map((header) => quoteCsv(row[header])).join(",")),
  ].join("\r\n");

  downloadBlob(
    new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
    `${filename}.csv`,
  );
}

function copyComputedStyles(source: Element, target: Element) {
  const sourceStyle = window.getComputedStyle(source);
  const styleText = Array.from(sourceStyle)
    .map((property) => `${property}:${sourceStyle.getPropertyValue(property)};`)
    .join("");
  target.setAttribute("style", styleText);

  Array.from(source.children).forEach((child, index) => {
    const targetChild = target.children.item(index);
    if (targetChild) copyComputedStyles(child, targetChild);
  });
}

async function exportChartPng(containerId: string, filename: string) {
  const container = document.getElementById(containerId);
  const sourceSvg = container?.querySelector<SVGSVGElement>(
    ".recharts-wrapper svg.recharts-surface",
  );

  if (!sourceSvg) {
    throw new Error("The chart is not ready to export yet.");
  }

  const bounds = sourceSvg.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) {
    throw new Error("The chart has no visible export area.");
  }

  const clone = sourceSvg.cloneNode(true) as SVGSVGElement;
  copyComputedStyles(sourceSvg, clone);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(bounds.width));
  clone.setAttribute("height", String(bounds.height));
  clone.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);

  const background = document.documentElement.classList.contains("dark")
    ? "#0f172a"
    : "#ffffff";
  const backgroundRect = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "rect",
  );
  backgroundRect.setAttribute("width", "100%");
  backgroundRect.setAttribute("height", "100%");
  backgroundRect.setAttribute("fill", background);
  clone.insertBefore(backgroundRect, clone.firstChild);

  const svgBlob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: "image/svg+xml;charset=utf-8",
  });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    image.decoding = "async";
    image.src = svgUrl;
    await image.decode();

    const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(bounds.width * scale);
    canvas.height = Math.ceil(bounds.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PNG export is not supported by this browser.");

    context.scale(scale, scale);
    context.fillStyle = background;
    context.fillRect(0, 0, bounds.width, bounds.height);
    context.drawImage(image, 0, 0, bounds.width, bounds.height);

    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed."))),
        "image/png",
      );
    });
    downloadBlob(png, `${filename}.png`);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function ExportMenu({
  chartId,
  filename,
  rows,
}: {
  chartId: string;
  filename: string;
  rows: Array<Record<string, string | number>>;
}) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const runExport = async (format: ExportFormat) => {
    if (format === "csv" && rows.length === 0) {
      toast.info("There is no data to export for this chart.");
      return;
    }

    setExporting(format);
    try {
      if (format === "csv") {
        exportCsv(filename, rows);
      } else {
        await exportChartPng(chartId, filename);
      }
      toast.success(`${format.toUpperCase()} export is ready.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={exporting !== null}
        >
          {exporting ? (
            <RefreshCw aria-hidden="true" className="animate-spin" />
          ) : (
            <Download aria-hidden="true" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void runExport("csv")}>
          <FileSpreadsheet aria-hidden="true" />
          Export data as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void runExport("png")}>
          <ImageIcon aria-hidden="true" />
          Export chart as PNG
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ChartPanel({
  id,
  title,
  description,
  rows,
  summary,
  children,
  className = "",
}: {
  id: string;
  title: string;
  description: string;
  rows: Array<Record<string, string | number>>;
  summary: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const hasValues = rows.some((row) =>
    Object.entries(row).some(
      ([key, value]) => key !== "label" && key !== "period" && key !== "date" && Number(value) > 0,
    ),
  );

  return (
    <article
      className={`rounded-2xl border border-border bg-card text-card-foreground shadow-sm ${className}`}
      aria-labelledby={titleId}
    >
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id={titleId} className="text-base font-semibold text-foreground">
            {title}
          </h3>
          <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <ExportMenu chartId={id} filename={id} rows={rows} />
      </div>
      <div className="p-5">
        <div
          id={id}
          role="img"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          className="relative h-72 min-w-0"
        >
          <div aria-hidden="true" className="h-full">
            {children}
          </div>
          {!hasValues && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-lg border border-dashed border-border bg-background/95 px-4 py-3 text-center text-sm text-muted-foreground shadow-sm">
                No recorded data in this period
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 border-t border-border pt-4 text-sm">
          {summary}
        </div>
      </div>
    </article>
  );
}

function CategorySummary({
  data,
  valueFormatter = formatNumber,
}: {
  data: HrDashboardCategory[];
  valueFormatter?: (value: number) => string;
}) {
  if (data.length === 0) {
    return <p className="text-slate-600 dark:text-slate-300">No records are available.</p>;
  }

  return (
    <dl className="grid grid-cols-2 gap-x-5 gap-y-2">
      {data.map((item) => (
        <div key={item.key} className="flex min-w-0 justify-between gap-3">
          <dt className="truncate text-slate-600 dark:text-slate-300">{item.label}</dt>
          <dd className="font-mono font-semibold tabular-nums text-slate-950 dark:text-white">
            {valueFormatter(item.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone: "blue" | "green" | "amber" | "red";
}) {
  const tones = {
    blue: "border-primary/20 bg-primary/5 text-foreground hover:border-primary/40",
    green: "border-emerald-500/20 bg-emerald-500/5 text-foreground hover:border-emerald-500/40",
    amber: "border-amber-500/20 bg-amber-500/5 text-foreground hover:border-amber-500/40",
    red: "border-rose-500/20 bg-rose-500/5 text-foreground hover:border-rose-500/40",
  };

  const iconTones = {
    blue: "text-primary",
    green: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-rose-600 dark:text-rose-400",
  };

  return (
    <article className={`rounded-2xl border p-5 transition-all shadow-sm ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span aria-hidden="true" className={iconTones[tone]}>{icon}</span>
      </div>
      <p className="mt-4 font-mono text-3xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-label="Loading Human Resources analytics" className="space-y-5">
      <div className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-96 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    </div>
  );
}

export function HrDashboardOverview() {
  const queryClient = useQueryClient();
  const scope = getWorkspaceScopeKey();
  const reducedMotion = useReducedMotion();
  const [timeframe, setTimeframe] = useState(6);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastLiveUpdate, setLastLiveUpdate] = useState<string | null>(null);
  const refreshTimer = useRef<number | null>(null);
  const statusId = useId();

  const dashboardQuery = useQuery({
    queryKey: ["hr-dashboard", scope, timeframe],
    queryFn: () => hrFetch<DashboardResponse>(`/dashboard?months=${timeframe}`),
    refetchInterval: realtimeConnected ? 60_000 : 15_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    const token =
      getAccessToken() ||
      (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    if (!token) return;

    const echo = initEcho(token);
    if (!echo) return;
    const tenantId = getTenantId();
    const channelName = tenantId ? `tenant.${tenantId}.hr` : "hr";
    const channel = echo.private(channelName) as unknown as EchoPrivateChannel;
    const onSubscribed = () => setRealtimeConnected(true);
    const onSubscriptionError = () => setRealtimeConnected(false);
    const subscription = channel.subscription;

    subscription?.bind("pusher:subscription_succeeded", onSubscribed);
    subscription?.bind("pusher:subscription_error", onSubscriptionError);

    const onLiveUpdate = (event: LiveEvent) => {
      setLastLiveUpdate(event.occurred_at ?? new Date().toISOString());
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["hr-dashboard", scope] });
        void queryClient.invalidateQueries({ queryKey: ["hr-summary", scope] });
      }, 300);
    };

    channel.listen(".hr.updated", onLiveUpdate);

    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      subscription?.unbind("pusher:subscription_succeeded", onSubscribed);
      subscription?.unbind("pusher:subscription_error", onSubscriptionError);
      echo.leave(channelName);
      setRealtimeConnected(false);
    };
  }, [queryClient, scope]);

  const data = dashboardQuery.data?.data;
  const isRefreshing = dashboardQuery.isFetching && !dashboardQuery.isLoading;

  const sourceCount = useMemo(
    () => (data ? Object.values(data.sources).reduce((sum, count) => sum + count, 0) : 0),
    [data],
  );

  if (dashboardQuery.isLoading) return <DashboardSkeleton />;

  if (dashboardQuery.isError || !data) {
    return (
      <section
        aria-labelledby="hr-analytics-error-title"
        className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-950 dark:border-red-950 dark:bg-red-950/30 dark:text-red-100"
      >
        <CircleAlert aria-hidden="true" className="size-8" />
        <h2 id="hr-analytics-error-title" className="mt-4 text-xl font-semibold">
          HR analytics could not be loaded
        </h2>
        <p className="mt-2 text-sm">
          {dashboardQuery.error instanceof Error
            ? dashboardQuery.error.message
            : "The analytics service did not return data."}
        </p>
        <Button
          type="button"
          className="mt-5"
          onClick={() => void dashboardQuery.refetch()}
        >
          <RefreshCw aria-hidden="true" />
          Retry
        </Button>
      </section>
    );
  }

  const payrollRows = data.charts.payroll_trend.map((point) => ({
    period: point.period,
    label: point.label,
    gross: point.gross,
    net: point.net,
    tax: point.tax,
  }));
  const attendanceRows = data.charts.attendance_outcomes.map((point) => ({
    date: point.date,
    label: point.label,
    present: point.present,
    exceptions: point.exceptions,
    incomplete: point.incomplete,
    absent: point.absent,
  }));
  const categoryRows = (rows: HrDashboardCategory[]) =>
    rows.map((row) => ({ category: row.label, value: row.value }));

  return (
    <section aria-labelledby="hr-analytics-title" className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-lg">
        <div className="grid gap-6 px-5 py-6 lg:grid-cols-[1fr_auto] lg:items-end lg:px-7">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
              <Activity aria-hidden="true" className="size-4" />
              Workforce command surface
            </div>
            <h2 id="hr-analytics-title" className="mt-3 text-2xl font-semibold tracking-tight">
              Live Human Resources analytics
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Verified aggregates from the HR database. Every chart includes its exact values and source count.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="hr-dashboard-timeframe" className="mb-1.5 block text-xs font-medium text-slate-300">
                Payroll timeframe
              </label>
              <Select
                value={String(timeframe)}
                onValueChange={(value) => setTimeframe(Number(value))}
              >
                <SelectTrigger id="hr-dashboard-timeframe" className="border-slate-700 bg-slate-900 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 6, 9, 12].map((months) => (
                    <SelectItem key={months} value={String(months)}>
                      Last {months} months
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800 hover:text-white"
              disabled={isRefreshing}
              onClick={() => void dashboardQuery.refetch()}
            >
              <RefreshCw aria-hidden="true" className={isRefreshing ? "animate-spin" : ""} />
              Refresh data
            </Button>
          </div>
        </div>
        <div className="grid border-t border-slate-800 bg-slate-900/70 sm:grid-cols-3">
          <div className="border-b border-slate-800 px-5 py-3 sm:border-b-0 sm:border-r">
            <p className="text-xs text-slate-400">Data snapshot</p>
            <p className="mt-1 font-mono text-sm tabular-nums">{formatRefreshTime(data.generated_at)}</p>
          </div>
          <div className="border-b border-slate-800 px-5 py-3 sm:border-b-0 sm:border-r">
            <p className="text-xs text-slate-400">Source records read</p>
            <p className="mt-1 font-mono text-sm tabular-nums">{formatNumber(sourceCount)}</p>
          </div>
          <div
            id={statusId}
            role="status"
            aria-live="polite"
            className="px-5 py-3"
          >
            <p className="flex items-center gap-2 text-xs text-slate-400">
              <Radio aria-hidden="true" className={realtimeConnected ? "text-emerald-400" : "text-amber-300"} />
              {realtimeConnected ? "Realtime connected" : "15-second live polling fallback"}
            </p>
            <p className="mt-1 font-mono text-sm tabular-nums">
              {lastLiveUpdate ? `Event received ${formatRefreshTime(lastLiveUpdate)}` : "No new event yet"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active workforce"
          value={formatNumber(data.metrics.active_employees)}
          detail={`${formatNumber(data.metrics.assigned_employees)} assigned · ${formatNumber(data.metrics.unassigned_employees)} unassigned`}
          icon={<UsersRound />}
          tone="blue"
        />
        <MetricCard
          label="Latest net payroll"
          value={formatMoney(data.metrics.monthly_net_payroll)}
          detail={data.metrics.payroll_period_label
            ? `${data.metrics.payroll_period_label} · ${formatNumber(data.metrics.payroll_records)} payslips`
            : "No payslips recorded"}
          icon={<WalletCards />}
          tone="green"
        />
        <MetricCard
          label="Recruitment demand"
          value={formatNumber(data.metrics.published_vacancies)}
          detail={`${formatNumber(data.metrics.active_applicants)} active applicants · ${formatNumber(data.metrics.open_positions)} position gaps`}
          icon={<BriefcaseBusiness />}
          tone="amber"
        />
        <MetricCard
          label="Items requiring attention"
          value={formatNumber(
            data.metrics.pending_leave_requests +
            data.metrics.contracts_expiring_soon +
            data.metrics.written_terms_missing,
          )}
          detail={`${formatNumber(data.metrics.pending_leave_requests)} leave · ${formatNumber(data.metrics.contracts_expiring_soon)} contracts · ${formatNumber(data.metrics.written_terms_missing)} terms`}
          icon={<CircleAlert />}
          tone="red"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <ChartPanel
          id="hr-payroll-trend"
          title="Payroll movement"
          description={`Actual gross, net, and tax totals for the last ${data.timeframe_months} calendar months.`}
          rows={payrollRows}
          className="xl:col-span-2"
          summary={
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left">
                <caption className="sr-only">Exact payroll totals by month</caption>
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="pb-2 font-medium">Period</th>
                    <th scope="col" className="pb-2 text-right font-medium">Gross</th>
                    <th scope="col" className="pb-2 text-right font-medium">Net</th>
                    <th scope="col" className="pb-2 text-right font-medium">Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {data.charts.payroll_trend.map((point) => (
                    <tr key={point.period} className="border-t border-slate-100 dark:border-slate-900">
                      <th scope="row" className="py-2 font-medium">{point.label}</th>
                      <td className="py-2 text-right font-mono tabular-nums">{formatMoney(point.gross)}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{formatMoney(point.net)}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{formatMoney(point.tax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.charts.payroll_trend} margin={{ left: 8, right: 8, top: 12 }}>
              <defs>
                <linearGradient id="payrollGross" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(value) => `${Math.round(value / 1_000)}k`} tick={{ fontSize: 11 }} width={48} />
              <RechartsTooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(Number(value))} />
              <Legend />
              <Area
                type="monotone"
                dataKey="gross"
                name="Gross"
                stroke="#1d4ed8"
                strokeWidth={3}
                fill="url(#payrollGross)"
                isAnimationActive={!reducedMotion}
              />
              <Area
                type="monotone"
                dataKey="net"
                name="Net"
                stroke="#047857"
                strokeWidth={3}
                strokeDasharray="8 4"
                fill="transparent"
                isAnimationActive={!reducedMotion}
              />
              <Area
                type="monotone"
                dataKey="tax"
                name="Tax"
                stroke="#b45309"
                strokeWidth={2}
                strokeDasharray="2 4"
                fill="transparent"
                isAnimationActive={!reducedMotion}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          id="hr-payroll-breakdown"
          title="Latest payroll composition"
          description={data.metrics.payroll_period_label
            ? `Recorded components for ${data.metrics.payroll_period_label}.`
            : "No payroll period is recorded yet."}
          rows={categoryRows(data.charts.payroll_breakdown)}
          summary={<CategorySummary data={data.charts.payroll_breakdown} valueFormatter={formatMoney} />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.charts.payroll_breakdown}
                dataKey="value"
                nameKey="label"
                innerRadius={55}
                outerRadius={96}
                paddingAngle={2}
                isAnimationActive={!reducedMotion}
              >
                {data.charts.payroll_breakdown.map((item, index) => (
                  <Cell key={item.key} fill={CHART_COLOURS[index % CHART_COLOURS.length]} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(Number(value))} />
              <Legend iconType="line" />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          id="hr-unit-headcount"
          title="Headcount by unit"
          description="Active, probation, and on-leave employees grouped by their current primary assignment."
          rows={categoryRows(data.charts.headcount_by_unit)}
          summary={<CategorySummary data={data.charts.headcount_by_unit} />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.headcount_by_unit} layout="vertical" margin={{ left: 18, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis dataKey="label" type="category" width={105} tick={{ fontSize: 11 }} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" name="Employees" fill="#1d4ed8" radius={[0, 6, 6, 0]} isAnimationActive={!reducedMotion} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          id="hr-recruitment-pipeline"
          title="Recruitment pipeline"
          description="Applicants grouped by their current recorded stage, including rejected and hired outcomes."
          rows={categoryRows(data.charts.recruitment_pipeline)}
          summary={<CategorySummary data={data.charts.recruitment_pipeline} />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.recruitment_pipeline} margin={{ left: 4, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" angle={-25} textAnchor="end" height={72} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" name="Applicants" fill="#b45309" radius={[6, 6, 0, 0]} isAnimationActive={!reducedMotion} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          id="hr-attendance-outcomes"
          title="Recorded attendance outcomes"
          description="Seven-day trend from attendance records only; unrecorded schedules are not assumed absent."
          rows={attendanceRows}
          className="xl:col-span-2"
          summary={
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left">
                <caption className="sr-only">Exact recorded attendance outcomes by date</caption>
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="pb-2 font-medium">Date</th>
                    <th scope="col" className="pb-2 text-right font-medium">Present</th>
                    <th scope="col" className="pb-2 text-right font-medium">Exception</th>
                    <th scope="col" className="pb-2 text-right font-medium">Incomplete</th>
                    <th scope="col" className="pb-2 text-right font-medium">Absent</th>
                  </tr>
                </thead>
                <tbody>
                  {data.charts.attendance_outcomes.map((point: HrDashboardAttendancePoint) => (
                    <tr key={point.date} className="border-t border-slate-100 dark:border-slate-900">
                      <th scope="row" className="py-2 font-medium">{point.date}</th>
                      <td className="py-2 text-right font-mono tabular-nums">{point.present}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{point.exceptions}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{point.incomplete}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{point.absent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.charts.attendance_outcomes} margin={{ left: 4, right: 12, top: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line type="monotone" dataKey="present" name="Present" stroke="#047857" strokeWidth={3} dot={{ r: 4 }} isAnimationActive={!reducedMotion} />
              <Line type="monotone" dataKey="exceptions" name="Exception" stroke="#b45309" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 4 }} isAnimationActive={!reducedMotion} />
              <Line type="monotone" dataKey="incomplete" name="Incomplete" stroke="#7c3aed" strokeWidth={2} strokeDasharray="2 4" dot={{ r: 4 }} isAnimationActive={!reducedMotion} />
              <Line type="monotone" dataKey="absent" name="Absent" stroke="#b91c1c" strokeWidth={2} strokeDasharray="10 3 2 3" dot={{ r: 4 }} isAnimationActive={!reducedMotion} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          id="hr-leave-statuses"
          title="Leave request status"
          description="All recorded leave requests grouped by their current decision status."
          rows={categoryRows(data.charts.leave_statuses)}
          summary={<CategorySummary data={data.charts.leave_statuses} />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.charts.leave_statuses}
                dataKey="value"
                nameKey="label"
                innerRadius={52}
                outerRadius={95}
                isAnimationActive={!reducedMotion}
              >
                {data.charts.leave_statuses.map((item, index) => (
                  <Cell key={item.key} fill={CHART_COLOURS[(index + 1) % CHART_COLOURS.length]} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Legend iconType="line" />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          id="hr-employment-status"
          title="Employment status"
          description="Every employee record grouped by its current employment status."
          rows={categoryRows(data.charts.employment_status)}
          summary={<CategorySummary data={data.charts.employment_status} />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.charts.employment_status}
                dataKey="value"
                nameKey="label"
                outerRadius={98}
                label={({ value }) => value}
                isAnimationActive={!reducedMotion}
              >
                {data.charts.employment_status.map((item, index) => (
                  <Cell key={item.key} fill={CHART_COLOURS[index % CHART_COLOURS.length]} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Legend iconType="line" />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          id="hr-contract-types"
          title="Contract mix"
          description="Every employee record grouped by the contract type stored in HR."
          rows={categoryRows(data.charts.contract_types)}
          summary={<CategorySummary data={data.charts.contract_types} />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.contract_types} margin={{ left: 4, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" angle={-20} textAnchor="end" height={60} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" name="Employees" fill="#0369a1" radius={[6, 6, 0, 0]} isAnimationActive={!reducedMotion} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <article
          aria-labelledby="hr-today-title"
          className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center gap-3">
            <CalendarClock aria-hidden="true" className="size-5 text-amber-700 dark:text-amber-300" />
            <h3 id="hr-today-title" className="font-semibold text-slate-950 dark:text-white">
              Today at a glance
            </h3>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            {[
              ["Attendance records", data.metrics.attendance_today.recorded],
              ["Present", data.metrics.attendance_today.present],
              ["Attendance exceptions", data.metrics.attendance_today.exceptions],
              ["Late arrivals", data.metrics.attendance_today.late],
              ["Pending leave requests", data.metrics.pending_leave_requests],
              ["Employees on probation", data.metrics.on_probation],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between gap-4 border-b border-slate-200 pb-3 last:border-0 dark:border-slate-800">
                <dt className="text-slate-600 dark:text-slate-300">{label}</dt>
                <dd className="font-mono font-semibold tabular-nums">{formatNumber(Number(value))}</dd>
              </div>
            ))}
          </dl>
        </article>
      </div>

      <section aria-labelledby="hr-quick-actions-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h3 id="hr-quick-actions-title" className="text-lg font-semibold text-slate-950 dark:text-white">
              Continue working
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Open the source module behind these analytics.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/dashboard/human-resources/employees", label: "Employees", icon: UserCheck },
            { href: "/dashboard/human-resources/organization", label: "Organization", icon: Building2 },
            { href: "/dashboard/payroll", label: "Payroll", icon: WalletCards },
            { href: "/dashboard/human-resources/expenses", label: "Expenses", icon: ReceiptText },
          ].map((item) => (
            <Button key={item.href} asChild variant="outline" className="h-auto justify-between px-4 py-4">
              <Link href={item.href}>
                <span className="flex items-center gap-3">
                  <item.icon aria-hidden="true" className="text-slate-600 dark:text-slate-300" />
                  {item.label}
                </span>
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ))}
        </div>
      </section>
    </section>
  );
}
