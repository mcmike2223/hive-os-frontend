"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardCopy,
  ExternalLink,
  FileSearch,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import { productionApi } from "@/modules/production/api";
import type { BatchTrace, ProductionOrder } from "@/modules/production/types";
import { OrderStatusBadge, QaStatusBadge, TreatmentStatusBadge } from "@/modules/production/components/status-badges";
import {
  ProductionError,
  ProductionLoading,
  ProductionMetricCard,
  ProductionShell,
} from "@/modules/production/components/production-shell";
import { useDebouncedValue } from "../utils";

type TraceSectionId =
  | "materials"
  | "runs"
  | "treatment"
  | "sanitation"
  | "release"
  | "stock";

type TraceSummary = {
  yieldPercent: number;
  runCount: number;
  totalDowntimeMinutes: number;
  treatmentCount: number;
  breachCount: number;
  sanitationCount: number;
  releaseCount: number;
  stockMovementCount: number;
  stockQuantity: number;
  materialVarianceCount: number;
};

function computeTraceSummary(trace: BatchTrace): TraceSummary {
  const breachCount = trace.water_treatment.filter(
    (log) => log.status === "breach" || (log.breaches && log.breaches.length > 0),
  ).length;

  const materialVarianceCount = trace.materials.filter((material) => material.variance_quantity !== 0).length;

  const totalDowntimeMinutes = trace.runs.reduce((sum, run) => sum + Number(run.downtime_minutes ?? 0), 0);

  const stockQuantity = trace.stock_movements.reduce((sum, movement) => sum + Number(movement.quantity ?? 0), 0);

  return {
    yieldPercent: Number(trace.order.yield_percent ?? 0),
    runCount: trace.runs.length,
    totalDowntimeMinutes,
    treatmentCount: trace.water_treatment.length,
    breachCount,
    sanitationCount: trace.sanitation.length,
    releaseCount: trace.release_tests.length,
    stockMovementCount: trace.stock_movements.length,
    stockQuantity,
    materialVarianceCount,
  };
}

function varianceTone(variance: number): string {
  if (variance === 0) return "";
  if (variance > 0) return "text-amber-600 dark:text-amber-400";
  return "text-sky-600 dark:text-sky-400";
}

function yieldTone(yieldPercent: number): string {
  if (yieldPercent >= 98) return "text-emerald-600 dark:text-emerald-400";
  if (yieldPercent >= 95) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    (error as { response?: { status?: number } }).response?.status === 404
  );
}

const SECTION_IDS: TraceSectionId[] = [
  "materials",
  "runs",
  "treatment",
  "sanitation",
  "release",
  "stock",
];

export default function BatchTraceabilityPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();

  const canView = hasAnyPermission([
    "view_production_traceability",
    "view_production",
    "manage_production",
  ]);

  const initialBatch = searchParams.get("batch") ?? "";
  const [input, setInput] = React.useState(initialBatch);
  const [batchNumber, setBatchNumber] = React.useState(initialBatch);
  const [orderSearch, setOrderSearch] = React.useState("");
  const debouncedOrderSearch = useDebouncedValue(orderSearch);

  const traceQuery = useQuery({
    queryKey: ["production", "trace", batchNumber],
    queryFn: () => productionApi.traceBatch(batchNumber).then((res) => res.data),
    enabled: batchNumber.length > 0 && canView,
    retry: false,
  });

  const ordersQuery = useQuery({
    queryKey: ["production", "orders", "trace-picker", debouncedOrderSearch],
    queryFn: () =>
      productionApi
        .listOrders({ limit: 50, search: debouncedOrderSearch || undefined })
        .then((res) => res.data),
    enabled: canView,
  });

  const trace: BatchTrace | undefined = traceQuery.data?.data;
  const summary = trace ? computeTraceSummary(trace) : null;
  const orders: ProductionOrder[] = ordersQuery.data?.data ?? [];
  const notFound = traceQuery.isError && isNotFoundError(traceQuery.error);

  const syncUrl = React.useCallback(
    (batch: string) => {
      const params = new URLSearchParams();
      if (batch.trim()) params.set("batch", batch.trim());
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  React.useEffect(() => {
    const fromUrl = searchParams.get("batch") ?? "";
    if (fromUrl && fromUrl !== batchNumber) {
      setInput(fromUrl);
      setBatchNumber(fromUrl);
    }
  }, [searchParams, batchNumber]);

  const runTrace = (value: string) => {
    const trimmed = value.trim();
    setBatchNumber(trimmed);
    syncUrl(trimmed);
  };

  const copyTraceLink = async () => {
    if (!batchNumber) return;
    const url = `${window.location.origin}${pathname}?batch=${encodeURIComponent(batchNumber)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("production.trace.link_copied", "Trace link copied to clipboard."));
    } catch {
      toast.error(t("production.trace.link_copy_failed", "Could not copy the link."));
    }
  };

  const sectionLabel = (id: TraceSectionId): string => {
    switch (id) {
      case "materials":
        return t("production.trace.materials", "Upstream materials");
      case "runs":
        return t("production.trace.runs", "Shifts that ran it");
      case "treatment":
        return t("production.trace.treatment", "Treated water at the time");
      case "sanitation":
        return t("production.trace.sanitation", "Equipment sanitation");
      case "release":
        return t("production.trace.release_tests", "Release tests");
      case "stock":
        return t("production.trace.stock", "Where the stock went");
    }
  };

  if (!canView) {
    return (
      <ProductionShell
        title={t("production.trace.title", "Batch traceability")}
        description={t(
          "production.trace.subtitle",
          "Enter the lot code printed on the bottle to see everything that touched it.",
        )}
      >
        <ProductionError
          error={{
            response: {
              data: {
                message: t("production.common.no_permission", "You do not have permission to view this page."),
              },
            },
          }}
        />
      </ProductionShell>
    );
  }

  return (
    <ProductionShell
      title={t("production.trace.title", "Batch traceability")}
      description={t(
        "production.trace.subtitle",
        "The recall answer — upstream supplier lots, the shift that ran it, treatment readings, sanitation, release tests, and where the stock went.",
      )}
      actions={
        <div className="flex flex-wrap gap-2">
          {batchNumber ? (
            <Button type="button" variant="outline" onClick={copyTraceLink}>
              <ClipboardCopy className="mr-2 h-4 w-4" />
              {t("production.trace.copy_link", "Copy trace link")}
            </Button>
          ) : null}
          {batchNumber ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => traceQuery.refetch()}
              disabled={traceQuery.isFetching}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${traceQuery.isFetching ? "animate-spin" : ""}`} />
              {t("production.common.refresh", "Refresh")}
            </Button>
          ) : null}
        </div>
      }
    >
      <form
        className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          runTrace(input);
        }}
      >
        <div className="min-w-[14rem] flex-1 space-y-1">
          <Label htmlFor="trace-batch" className="text-xs">
            {t("production.trace.lot_code", "Lot code")}
          </Label>
          <Input
            id="trace-batch"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="L126224-01"
            className="font-mono"
          />
        </div>
        <div className="min-w-[14rem] flex-1 space-y-1">
          <Label className="text-xs">{t("production.trace.pick_order", "Or pick a work order")}</Label>
          <Input
            value={orderSearch}
            onChange={(event) => setOrderSearch(event.target.value)}
            placeholder={t("production.trace.search_order", "Search order or lot code...")}
            className="mb-1"
          />
          <Select
            value=""
            onValueChange={(value) => {
              const order = orders.find((candidate) => String(candidate.id) === value);
              if (!order?.batch_number) return;
              setInput(order.batch_number);
              runTrace(order.batch_number);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("production.trace.select_order", "Select a batch to trace")} />
            </SelectTrigger>
            <SelectContent>
              {orders
                .filter((order) => order.batch_number)
                .map((order) => (
                  <SelectItem key={order.id} value={String(order.id)}>
                    <span className="font-mono">{order.batch_number}</span>
                    <span className="text-muted-foreground"> · {order.order_number}</span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={!input.trim()}>
          <Search className="mr-2 h-4 w-4" />
          {t("production.trace.search", "Trace batch")}
        </Button>
      </form>

      {traceQuery.isFetching && !trace ? (
        <ProductionLoading cards={4} />
      ) : traceQuery.isError && !notFound ? (
        <ProductionError error={traceQuery.error} />
      ) : notFound ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <AlertTriangle className="mx-auto h-5 w-5 text-amber-500" />
          <p className="mt-2 text-sm font-semibold">
            {t("production.trace.not_found", "No production batch matches that lot code.")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("production.trace.not_found_hint", "Check the code printed on the bottle label and try again.")}
          </p>
        </div>
      ) : !trace ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <FileSearch className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">
            {t("production.trace.prompt", "Enter a lot code above to pull its full genealogy.")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "production.trace.prompt_hint",
              "You can also search by work order number — the picker fills in the batch automatically.",
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {summary ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ProductionMetricCard
                title={t("production.orders.yield", "Yield")}
                value={<span className={yieldTone(summary.yieldPercent)}>{summary.yieldPercent.toFixed(1)}%</span>}
                description={`${trace.order.produced_quantity.toLocaleString()} ${t("production.trace.produced", "produced")} · ${trace.order.rejected_quantity.toLocaleString()} ${t("production.trace.rejected", "rejected")}`}
              />
              <ProductionMetricCard
                title={t("production.trace.runs", "Shift runs")}
                value={summary.runCount.toLocaleString()}
                description={`${summary.totalDowntimeMinutes.toLocaleString()} ${t("production.trace.min_down", "min downtime total")}`}
              />
              <ProductionMetricCard
                title={t("production.trace.treatment", "Treatment readings")}
                value={summary.treatmentCount.toLocaleString()}
                description={
                  summary.breachCount > 0
                    ? `${summary.breachCount} ${t("production.trace.breaches", "spec breach(es)")}`
                    : t("production.trace.no_breaches", "No spec breaches recorded")
                }
              />
              <ProductionMetricCard
                title={t("production.trace.stock", "Stock movements")}
                value={summary.stockMovementCount.toLocaleString()}
                description={`${summary.stockQuantity.toLocaleString()} ${t("production.trace.units_moved", "units moved")}`}
              />
            </div>
          ) : null}

          <section className="rounded-2xl border bg-card p-5">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-2xl font-black tracking-tight">{trace.batch_number}</p>
                <p className="text-sm text-muted-foreground">
                  <Link
                    href={`/dashboard/production/orders?order_id=${trace.order.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {trace.order.order_number}
                  </Link>
                  {" · "}
                  {trace.product.name ?? `#${trace.product.id}`}
                  {trace.product.sku ? ` (${trace.product.sku})` : ""}
                  {trace.line ? ` · ${trace.line.name}` : ""}
                </p>
                {trace.bom ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("production.trace.bom", "BOM")}: {trace.bom.code} v{trace.bom.version} ·{" "}
                    {trace.bom.pack_size_ml.toLocaleString()} ml
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <OrderStatusBadge status={trace.order.status} />
                <QaStatusBadge status={trace.order.qa_status} />
              </div>
            </header>

            <dl className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <Fact label={t("production.trace.planned", "Planned")} value={trace.order.planned_quantity.toLocaleString()} />
              <Fact label={t("production.trace.produced", "Produced")} value={trace.order.produced_quantity.toLocaleString()} />
              <Fact label={t("production.trace.rejected", "Rejected")} value={trace.order.rejected_quantity.toLocaleString()} />
              <Fact
                label={t("production.orders.yield", "Yield")}
                value={<span className={yieldTone(trace.order.yield_percent)}>{trace.order.yield_percent}%</span>}
              />
              <Fact label={t("production.trace.made_on", "Made on")} value={trace.order.manufactured_on ?? "—"} />
              <Fact label={t("production.trace.expires", "Expires")} value={trace.order.expires_on ?? "—"} />
            </dl>

            {trace.order.qa_notes || trace.order.qa_decided_at ? (
              <div className="mt-3 rounded-xl bg-muted/40 p-3 text-xs">
                {trace.order.qa_decided_at ? (
                  <p className="text-muted-foreground">
                    {t("production.trace.qa_decided", "QA decision")}:{" "}
                    {new Date(trace.order.qa_decided_at).toLocaleString()}
                    {trace.order.qa_decided_by ? ` · ${trace.order.qa_decided_by}` : ""}
                  </p>
                ) : null}
                {trace.order.qa_notes ? (
                  <p className="mt-1">
                    <span className="font-semibold">{t("production.trace.qa_note", "QA note")}:</span>{" "}
                    {trace.order.qa_notes}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/production/orders?order_id=${trace.order.id}`}>
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  {t("production.trace.view_order", "Work order")}
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/production/runs?order_id=${trace.order.id}`}>
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  {t("production.trace.view_runs", "Shift runs")}
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/production/quality?order_id=${trace.order.id}`}>
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  {t("production.trace.view_quality", "Water & CIP")}
                </Link>
              </Button>
            </div>
          </section>

          <nav
            aria-label={t("production.trace.sections", "Trace sections")}
            className="sticky top-0 z-10 flex flex-wrap gap-2 rounded-xl border bg-card/95 p-2 backdrop-blur"
          >
            {SECTION_IDS.map((id) => (
              <a
                key={id}
                href={`#trace-${id}`}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {sectionLabel(id)}
              </a>
            ))}
          </nav>

          <TraceSection
            id="materials"
            title={sectionLabel("materials")}
            description={t(
              "production.trace.materials_desc",
              "The supplier lot of each component. A cap or preform defect traces back through these.",
            )}
            empty={trace.materials.length === 0}
            emptyLabel={t("production.trace.no_materials", "No material issues recorded against this batch.")}
            badge={
              summary && summary.materialVarianceCount > 0 ? (
                <Badge variant="secondary" className="text-[10px] font-bold">
                  {summary.materialVarianceCount} {t("production.trace.variance", "variance")}
                </Badge>
              ) : null
            }
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">{t("production.trace.component", "Component")}</th>
                  <th className="py-2 pr-3 font-semibold">{t("production.orders.supplier_lot", "Supplier lot")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("production.trace.planned", "Planned")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("production.trace.actual", "Actual")}</th>
                  <th className="py-2 text-right font-semibold">{t("production.trace.variance", "Variance")}</th>
                </tr>
              </thead>
              <tbody>
                {trace.materials.map((material) => (
                  <tr key={material.component_product_id} className="border-b border-border/30">
                    <td className="py-2 pr-3">
                      <p className="font-medium">{material.component_name ?? `#${material.component_product_id}`}</p>
                      <p className="text-[11px] text-muted-foreground">{material.component_type}</p>
                      {material.consumed_at ? (
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(material.consumed_at).toLocaleString()}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{material.supplier_batch_number ?? "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {material.planned_quantity.toLocaleString()} {material.uom}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {material.actual_quantity.toLocaleString()} {material.uom}
                    </td>
                    <td className={`py-2 text-right tabular-nums font-semibold ${varianceTone(material.variance_quantity)}`}>
                      {material.variance_quantity > 0 ? "+" : ""}
                      {material.variance_quantity.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TraceSection>

          <TraceSection
            id="runs"
            title={sectionLabel("runs")}
            description={t("production.trace.runs_desc", "Output, defects, and every stoppage during the batch.")}
            empty={trace.runs.length === 0}
            emptyLabel={t("production.trace.no_runs", "No shift runs recorded against this batch.")}
          >
            <div className="space-y-3">
              {trace.runs.map((run) => (
                <div key={run.id} className="rounded-xl border border-border/40 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-bold">
                      {new Date(run.started_at).toLocaleString()}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {t("production.runs.shift", "shift")} {run.shift}
                        {run.supervisor ? ` · ${run.supervisor}` : ""}
                      </span>
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm tabular-nums">
                        <span className="font-bold">{run.good_units.toLocaleString()}</span>{" "}
                        <span className="text-muted-foreground">{t("production.trace.good", "good")}</span> ·{" "}
                        <span className="font-bold">{run.reject_units.toLocaleString()}</span>{" "}
                        <span className="text-muted-foreground">{t("production.trace.rejected", "reject")}</span> ·{" "}
                        <span className="font-bold">{run.downtime_minutes.toLocaleString()}</span>{" "}
                        <span className="text-muted-foreground">{t("production.trace.min_down", "min down")}</span>
                      </p>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                        <Link href={`/dashboard/production/runs?run_id=${run.id}`}>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {run.ended_at ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {t("production.trace.ended", "Ended")}: {new Date(run.ended_at).toLocaleString()}
                    </p>
                  ) : (
                    <Badge variant="outline" className="mt-1 border-amber-500/40 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      {t("production.runs.open_shift", "Open shift")}
                    </Badge>
                  )}

                  {run.downtime_events.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {run.downtime_events.map((event, index) => (
                        <Badge key={`${event.reason_code}-${index}`} variant="secondary" className="text-[10px] font-bold">
                          {event.label} · {event.duration_minutes} min
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  {run.reject_breakdown && Object.keys(run.reject_breakdown).length > 0 ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {Object.entries(run.reject_breakdown)
                        .map(([code, count]) => `${code.replace(/_/g, " ")}: ${count}`)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </TraceSection>

          <TraceSection
            id="treatment"
            title={sectionLabel("treatment")}
            description={t("production.trace.treatment_desc", "In-process readings taken while this batch was filling.")}
            empty={trace.water_treatment.length === 0}
            emptyLabel={t("production.trace.no_treatment", "No treatment readings linked to this batch.")}
            badge={
              summary && summary.breachCount > 0 ? (
                <Badge variant="destructive" className="text-[10px] font-bold">
                  {summary.breachCount} {t("production.trace.breach", "breach")}
                </Badge>
              ) : null
            }
          >
            <div className="space-y-2">
              {trace.water_treatment.map((log, index) => (
                <div key={index} className="rounded-xl border border-border/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{new Date(log.logged_at).toLocaleString()}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {log.source_type}
                        {log.source_reference ? ` · ${log.source_reference}` : ""}
                        {log.logged_by ? ` · ${log.logged_by}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
                      <span>pH {log.treated_ph ?? "—"}</span>
                      <span>TDS {log.treated_tds_ppm ?? "—"} ppm</span>
                      <span>O₃ {log.ozone_residual_ppm ?? "—"} ppm</span>
                      <span>UV {log.uv_intensity_mw_cm2 ?? "—"}</span>
                      <TreatmentStatusBadge status={log.status} />
                    </div>
                  </div>
                  {log.breaches && log.breaches.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-rose-600 dark:text-rose-400">
                      {log.breaches.map((breach, breachIndex) => (
                        <li key={breachIndex}>
                          <span className="font-semibold">{breach.label}</span>: {breach.value} {breach.unit}
                          {breach.direction === "below_minimum" && breach.min !== null
                            ? ` (min ${breach.min})`
                            : breach.max !== null
                              ? ` (max ${breach.max})`
                              : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {log.corrective_action ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      <span className="font-semibold">{t("production.trace.corrective_action", "Corrective action")}:</span>{" "}
                      {log.corrective_action}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </TraceSection>

          <TraceSection
            id="sanitation"
            title={sectionLabel("sanitation")}
            description={t("production.trace.sanitation_desc", "CIP performed before or during the batch.")}
            empty={trace.sanitation.length === 0}
            emptyLabel={t("production.trace.no_sanitation", "No sanitation records linked to this batch.")}
          >
            <div className="space-y-2">
              {trace.sanitation.map((log, index) => (
                <div key={index} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 p-3">
                  <div>
                    <p className="text-sm font-semibold capitalize">{log.cip_type.replace(/_/g, " ")}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(log.started_at).toLocaleString()}
                      {log.ended_at ? ` → ${new Date(log.ended_at).toLocaleString()}` : ""}
                      {log.performed_by ? ` · ${log.performed_by}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span>{log.chemical ?? "—"}</span>
                    <span>{log.concentration_percent ? `${log.concentration_percent}%` : "—"}</span>
                    <span>{log.temperature_c ? `${log.temperature_c} °C` : "—"}</span>
                    <span>{log.contact_minutes ? `${log.contact_minutes} min` : "—"}</span>
                    <Badge variant="secondary" className="text-[10px] font-bold uppercase">
                      {log.final_rinse_result}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </TraceSection>

          <TraceSection
            id="release"
            title={sectionLabel("release")}
            description={t(
              "production.trace.release_desc",
              "Finished-product results recorded against this lot in the inventory QA workspace.",
            )}
            empty={trace.release_tests.length === 0}
            emptyLabel={t("production.trace.no_release", "No release tests recorded against this lot code.")}
          >
            <div className="space-y-2">
              {trace.release_tests.map((test, index) => (
                <div key={index} className="rounded-xl border border-border/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold capitalize">{test.result ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {test.tested_at ? new Date(test.tested_at).toLocaleString() : "—"}
                        {test.tested_by ? ` · ${test.tested_by}` : ""}
                      </p>
                    </div>
                  </div>
                  {test.notes ? <p className="mt-2 text-xs text-muted-foreground">{test.notes}</p> : null}
                </div>
              ))}
            </div>
          </TraceSection>

          <TraceSection
            id="stock"
            title={sectionLabel("stock")}
            description={t("production.trace.stock_desc", "Warehouse movements carrying this lot code.")}
            empty={trace.stock_movements.length === 0}
            emptyLabel={t("production.trace.no_stock", "No warehouse movements carry this lot code yet.")}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">{t("production.common.type", "Type")}</th>
                  <th className="py-2 pr-3 font-semibold">{t("production.trace.from", "From")}</th>
                  <th className="py-2 pr-3 font-semibold">{t("production.trace.to", "To")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("production.common.quantity", "Quantity")}</th>
                  <th className="py-2 text-right font-semibold">{t("production.common.date", "Date")}</th>
                </tr>
              </thead>
              <tbody>
                {trace.stock_movements.map((movement) => (
                  <tr key={movement.id} className="border-b border-border/30">
                    <td className="py-2 pr-3 font-medium capitalize">{movement.type}</td>
                    <td className="py-2 pr-3 text-xs">{movement.from_location ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs">{movement.to_location ?? "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{movement.quantity.toLocaleString()}</td>
                    <td className="py-2 text-right text-xs">{new Date(movement.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TraceSection>
        </div>
      )}
    </ProductionShell>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="text-sm font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function TraceSection({
  id,
  title,
  description,
  empty,
  emptyLabel,
  badge,
  children,
}: {
  id: TraceSectionId;
  title: string;
  description: string;
  empty: boolean;
  emptyLabel: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={`trace-${id}`} className="scroll-mt-24 rounded-2xl border bg-card p-5">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black tracking-tight">{title}</h2>
            {badge}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </header>
      {empty ? (
        <p className="py-4 text-center text-sm italic text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </section>
  );
}
