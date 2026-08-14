"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { useTranslation } from "@/store/use-translation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { productionApi } from "@/modules/production/api";
import type { BatchTrace } from "@/modules/production/types";
import { OrderStatusBadge, QaStatusBadge, TreatmentStatusBadge } from "@/modules/production/components/status-badges";

export default function BatchTraceabilityPage() {
  const { t } = useTranslation();

  const [input, setInput] = React.useState("");
  const [batchNumber, setBatchNumber] = React.useState("");

  const traceQuery = useQuery({
    queryKey: ["production", "trace", batchNumber],
    queryFn: () => productionApi.traceBatch(batchNumber).then((res) => res.data),
    enabled: batchNumber.length > 0,
    retry: false,
  });

  const trace: BatchTrace | undefined = traceQuery.data?.data;
  const notFound = traceQuery.isError && (traceQuery.error as any)?.response?.status === 404;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">
          {t("production.trace.title", "Batch Traceability")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "production.trace.subtitle",
            "Enter the lot code printed on the bottle to see everything that touched it — upstream supplier lots, the shift that ran it, treatment readings, sanitation, release tests, and where the stock went.",
          )}
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setBatchNumber(input.trim());
        }}
      >
        <div className="min-w-[16rem] flex-1 space-y-1">
          <Label htmlFor="trace-batch" className="text-xs">
            {t("production.trace.lot_code", "Lot Code")}
          </Label>
          <Input
            id="trace-batch"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="L126224-01"
            className="font-mono"
          />
        </div>
        <Button type="submit" className="rounded-full px-5" disabled={!input.trim()}>
          <Search className="mr-2 h-4 w-4" />
          {t("production.trace.search", "Trace Batch")}
        </Button>
      </form>

      {traceQuery.isFetching ? (
        <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card p-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("production.trace.loading", "Assembling the batch record...")}
        </div>
      ) : notFound ? (
        <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
          <AlertTriangle className="mx-auto h-5 w-5 text-amber-500" />
          <p className="mt-2 text-sm font-semibold">
            {t("production.trace.not_found", "No production batch matches that lot code.")}
          </p>
        </div>
      ) : !trace ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm italic text-muted-foreground">
          {t("production.trace.prompt", "Enter a lot code above to pull its full genealogy.")}
        </div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-2xl border border-border/60 bg-card p-5">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-2xl font-black tracking-tight">{trace.batch_number}</p>
                <p className="text-sm text-muted-foreground">
                  {trace.order.order_number} · {trace.product.name ?? `#${trace.product.id}`}
                  {trace.line ? ` · ${trace.line.name}` : ""}
                </p>
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
              <Fact label={t("production.orders.yield", "Yield")} value={`${trace.order.yield_percent}%`} />
              <Fact label={t("production.trace.made_on", "Made on")} value={trace.order.manufactured_on ?? "-"} />
              <Fact label={t("production.trace.expires", "Expires")} value={trace.order.expires_on ?? "-"} />
            </dl>

            {trace.order.qa_notes ? (
              <p className="mt-3 rounded-xl bg-muted/40 p-3 text-xs">
                <span className="font-semibold">{t("production.trace.qa_note", "QA note")}:</span> {trace.order.qa_notes}
                {trace.order.qa_decided_by ? ` — ${trace.order.qa_decided_by}` : ""}
              </p>
            ) : null}
          </section>

          <TraceSection
            title={t("production.trace.materials", "Upstream materials")}
            description={t(
              "production.trace.materials_desc",
              "The supplier lot of each component. A cap or preform defect traces back through these.",
            )}
            empty={trace.materials.length === 0}
            emptyLabel={t("production.trace.no_materials", "No material issues recorded against this batch.")}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">{t("production.trace.component", "Component")}</th>
                  <th className="py-2 pr-3 font-semibold">{t("production.orders.supplier_lot", "Supplier Lot")}</th>
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
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{material.supplier_batch_number ?? "-"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {material.planned_quantity.toLocaleString()} {material.uom}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {material.actual_quantity.toLocaleString()} {material.uom}
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums ${material.variance_quantity > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}
                    >
                      {material.variance_quantity > 0 ? "+" : ""}
                      {material.variance_quantity.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TraceSection>

          <TraceSection
            title={t("production.trace.runs", "Shifts that ran it")}
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
                    <p className="text-sm tabular-nums">
                      <span className="font-bold">{run.good_units.toLocaleString()}</span>{" "}
                      <span className="text-muted-foreground">good</span> ·{" "}
                      <span className="font-bold">{run.reject_units.toLocaleString()}</span>{" "}
                      <span className="text-muted-foreground">reject</span> ·{" "}
                      <span className="font-bold">{run.downtime_minutes.toLocaleString()}</span>{" "}
                      <span className="text-muted-foreground">min down</span>
                    </p>
                  </div>

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
            title={t("production.trace.treatment", "Treated water at the time")}
            description={t("production.trace.treatment_desc", "In-process readings taken while this batch was filling.")}
            empty={trace.water_treatment.length === 0}
            emptyLabel={t("production.trace.no_treatment", "No treatment readings linked to this batch.")}
          >
            <div className="space-y-2">
              {trace.water_treatment.map((log, index) => (
                <div key={index} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 p-3">
                  <div>
                    <p className="text-sm font-semibold">{new Date(log.logged_at).toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {log.source_type}
                      {log.source_reference ? ` · ${log.source_reference}` : ""}
                      {log.logged_by ? ` · ${log.logged_by}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
                    <span>pH {log.treated_ph ?? "-"}</span>
                    <span>TDS {log.treated_tds_ppm ?? "-"} ppm</span>
                    <span>O₃ {log.ozone_residual_ppm ?? "-"} ppm</span>
                    <span>UV {log.uv_intensity_mw_cm2 ?? "-"}</span>
                    <TreatmentStatusBadge status={log.status} />
                  </div>
                </div>
              ))}
            </div>
          </TraceSection>

          <TraceSection
            title={t("production.trace.sanitation", "Equipment sanitation")}
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
                      {log.performed_by ? ` · ${log.performed_by}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span>{log.chemical ?? "-"}</span>
                    <span>{log.concentration_percent ? `${log.concentration_percent}%` : "-"}</span>
                    <span>{log.temperature_c ? `${log.temperature_c} °C` : "-"}</span>
                    <span>{log.contact_minutes ? `${log.contact_minutes} min` : "-"}</span>
                    <Badge variant="secondary" className="text-[10px] font-bold uppercase">
                      {log.final_rinse_result}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </TraceSection>

          <TraceSection
            title={t("production.trace.release_tests", "Release tests")}
            description={t(
              "production.trace.release_desc",
              "Finished-product results recorded against this lot in the inventory QA workspace.",
            )}
            empty={trace.release_tests.length === 0}
            emptyLabel={t("production.trace.no_release", "No release tests recorded against this lot code.")}
          >
            <div className="space-y-2">
              {trace.release_tests.map((test, index) => (
                <div key={index} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 p-3">
                  <div>
                    <p className="text-sm font-semibold">{test.result ?? "-"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {test.tested_at ? new Date(test.tested_at).toLocaleString() : "-"}
                      {test.tested_by ? ` · ${test.tested_by}` : ""}
                    </p>
                  </div>
                  {test.notes ? <p className="text-xs text-muted-foreground">{test.notes}</p> : null}
                </div>
              ))}
            </div>
          </TraceSection>

          <TraceSection
            title={t("production.trace.stock", "Where the stock went")}
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
    </div>
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
  title,
  description,
  empty,
  emptyLabel,
  children,
}: {
  title: string;
  description: string;
  empty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5">
      <header className="mb-3">
        <h2 className="text-base font-black tracking-tight">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </header>
      {empty ? (
        <p className="py-4 text-center text-sm italic text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </section>
  );
}
