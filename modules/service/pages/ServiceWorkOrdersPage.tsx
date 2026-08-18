"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { Badge } from "@/components/ui/badge";
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
import { serviceApi } from "@/modules/service/api";
import type {
  AvailableTechnician,
  ServiceAsset,
  ServiceRequest,
  ServiceWorkOrder,
  WorkOrderStatus,
  WorkOrderType,
} from "@/modules/service/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const TYPES: WorkOrderType[] = ["corrective", "preventive", "installation", "inspection"];

const NEXT_STATUSES: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  scheduled: ["dispatched", "cancelled"],
  dispatched: ["in_progress", "cancelled"],
  in_progress: ["cancelled"],
  completed: [],
  cancelled: [],
};

const STATUS_TONE: Record<WorkOrderStatus, string> = {
  scheduled: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  dispatched: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  in_progress: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function ServiceWorkOrdersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [status, setStatus] = React.useState("");
  const [coverage, setCoverage] = React.useState("");
  const [raiseOpen, setRaiseOpen] = React.useState(false);
  const [completing, setCompleting] = React.useState<ServiceWorkOrder | null>(null);
  const [parting, setParting] = React.useState<ServiceWorkOrder | null>(null);

  const [form, setForm] = React.useState({
    request_id: "",
    asset_id: "",
    technician_id: "",
    type: "corrective",
    scheduled_for: "",
  });

  const [completion, setCompletion] = React.useState({
    labour_hours: "1",
    resolved_the_fault: "yes",
    work_performed: "",
  });

  const [part, setPart] = React.useState({ description: "", quantity: "1", unit_cost: "0" });

  const ordersQuery = useQuery({
    queryKey: ["service", "work-orders", status, coverage],
    queryFn: () =>
      serviceApi
        .listWorkOrders({
          limit: 25,
          ...(status ? { status } : {}),
          ...(coverage ? { coverage } : {}),
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const techniciansQuery = useQuery({
    queryKey: ["service", "available-technicians"],
    queryFn: () => serviceApi.availableTechnicians().then((res) => res.data),
  });

  const assetsQuery = useQuery({
    queryKey: ["service", "asset-options"],
    queryFn: () => serviceApi.listAssets({ limit: 100 }).then((res) => res.data),
  });

  const openRequestsQuery = useQuery({
    queryKey: ["service", "open-requests"],
    queryFn: () => serviceApi.listRequests({ limit: 100, open_only: 1 }).then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["service", "overview-work"],
    queryFn: () => serviceApi.overview().then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["service"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const raise = useMutation({
    mutationFn: () =>
      serviceApi.createWorkOrder({
        ...(form.request_id ? { request_id: Number(form.request_id) } : {}),
        ...(form.asset_id ? { asset_id: Number(form.asset_id) } : {}),
        ...(form.technician_id ? { technician_id: Number(form.technician_id) } : {}),
        type: form.type,
        ...(form.scheduled_for ? { scheduled_for: form.scheduled_for } : {}),
      }),
    onSuccess: (response: any) => {
      toast.success(response?.data?.message ?? t("service.work.raised", "Work order raised."));
      invalidate();
      setRaiseOpen(false);
      setForm({ request_id: "", asset_id: "", technician_id: "", type: "corrective", scheduled_for: "" });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.work.raise_failed", "Could not raise it."))),
  });

  const transition = useMutation({
    mutationFn: ({ id, next }: { id: number; next: WorkOrderStatus }) =>
      serviceApi.transitionWorkOrder(id, next),
    onSuccess: () => {
      toast.success(t("service.work.moved", "Work order updated."));
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.work.move_failed", "Could not move it."))),
  });

  const complete = useMutation({
    mutationFn: () =>
      serviceApi.completeWorkOrder(completing!.id, {
        labour_hours: Number(completion.labour_hours || 0),
        resolved_the_fault: completion.resolved_the_fault === "yes",
        work_performed: completion.work_performed || null,
      }),
    onSuccess: () => {
      toast.success(t("service.work.completed", "Visit completed and costed."));
      invalidate();
      setCompleting(null);
      setCompletion({ labour_hours: "1", resolved_the_fault: "yes", work_performed: "" });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.work.complete_failed", "Could not complete it."))),
  });

  const addPart = useMutation({
    mutationFn: () =>
      serviceApi.addParts(parting!.id, [
        {
          description: part.description,
          quantity: Number(part.quantity || 1),
          unit_cost: Number(part.unit_cost || 0),
        },
      ]),
    onSuccess: () => {
      toast.success(t("service.work.part_added", "Part added and the job recosted."));
      invalidate();
      setParting(null);
      setPart({ description: "", quantity: "1", unit_cost: "0" });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.work.part_failed", "Could not add it."))),
  });

  const orders = (ordersQuery.data?.data ?? []) as ServiceWorkOrder[];
  const technicians = (techniciansQuery.data?.data ?? []) as AvailableTechnician[];
  const assets = (assetsQuery.data?.data ?? []) as ServiceAsset[];
  const openRequests = (openRequestsQuery.data?.data ?? []) as ServiceRequest[];
  const summary = overviewQuery.data?.data?.work;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("service.work.title", "Work Orders")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "service.work.subtitle",
              "The visits that actually fix things. Who pays is decided from warranty and contract when the job is raised, not argued about at invoicing time.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setRaiseOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("service.work.raise", "Raise Work Order")}
        </Button>
      </div>

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t("service.work.open", "Open")}
            value={n(summary.open).toLocaleString()}
            meta={t("service.work.overdue_meta", "{n} past their slot").replace(
              "{n}",
              String(n(summary.overdue)),
            )}
            alert={n(summary.overdue) > 0}
          />
          <StatTile
            label={t("service.work.first_time_fix", "First-time fix")}
            value={`${n(summary.first_time_fix_percent).toFixed(1)}%`}
            meta={t("service.work.completed_meta", "{n} completed").replace(
              "{n}",
              String(n(summary.completed)),
            )}
          />
          <StatTile
            label={t("service.overview.billable", "Billable")}
            value={money(summary.billable_cost)}
          />
          <StatTile
            label={t("service.overview.absorbed", "Absorbed")}
            value={money(summary.absorbed_cost)}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label htmlFor="wo-status" className="text-xs">
            {t("service.common.status", "Status")}
          </Label>
          <select
            id="wo-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm capitalize"
          >
            <option value="">{t("service.common.any", "Any")}</option>
            {(Object.keys(NEXT_STATUSES) as WorkOrderStatus[]).map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="wo-coverage" className="text-xs">
            {t("service.work.coverage", "Coverage")}
          </Label>
          <select
            id="wo-coverage"
            value={coverage}
            onChange={(event) => setCoverage(event.target.value)}
            className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm capitalize"
          >
            <option value="">{t("service.common.any", "Any")}</option>
            {["warranty", "contract", "chargeable"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Panel
        title={t("service.work.list", "Visits")}
        description={t(
          "service.work.list_desc",
          "Labour is costed from the technician's rate and parts from their own quantities, so a completed job always carries a real total.",
        )}
      >
        {ordersQuery.isLoading ? (
          <LoadingPanel label={t("service.common.loading", "Loading work orders...")} />
        ) : orders.length === 0 ? (
          <EmptyPanel label={t("service.work.none", "No work orders match those filters.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[62rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("service.work.number", "Work order")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.requests.asset", "Asset")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.work.technician", "Engineer")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.work.coverage", "Coverage")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.common.status", "Status")}</th>
                  <th className="pb-2 pr-3 text-right font-semibold">{t("service.common.total", "Total")}</th>
                  <th className="pb-2 pr-6 text-right font-semibold">
                    {t("service.common.actions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((row) => (
                  <tr key={row.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="block font-medium tabular-nums">{row.work_order_number}</span>
                      <span className="block text-[11px] capitalize text-muted-foreground">
                        {row.type}
                        {row.scheduled_for
                          ? ` · ${String(row.scheduled_for).replace("T", " ").slice(0, 16)}`
                          : ""}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {row.asset?.name ?? (row.asset_id ? `#${row.asset_id}` : "—")}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {row.technician?.name ?? t("service.work.unassigned", "Unassigned")}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className="text-[11px] capitalize">
                        {row.coverage}
                      </Badge>
                      <span className="ml-1.5 text-[11px] text-muted-foreground">
                        {row.is_billable
                          ? t("service.work.billable", "billable")
                          : t("service.work.absorbed", "absorbed")}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant="outline"
                        className={`border-transparent text-[10px] font-black uppercase tracking-widest ${STATUS_TONE[row.status]}`}
                      >
                        {row.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      <span className="block font-semibold">{money(row.total_cost)}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {t("service.work.split", "{labour} labour · {parts} parts")
                          .replace("{labour}", money(row.labour_cost))
                          .replace("{parts}", money(row.parts_cost))}
                      </span>
                    </td>
                    <td className="py-2 pr-6 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {(NEXT_STATUSES[row.status] ?? []).map((next) => (
                          <Button
                            key={next}
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] capitalize"
                            disabled={transition.isPending}
                            onClick={() => transition.mutate({ id: row.id, next })}
                          >
                            {next.replace(/_/g, " ")}
                          </Button>
                        ))}
                        {row.status !== "completed" && row.status !== "cancelled" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px]"
                            onClick={() => setParting(row)}
                          >
                            {t("service.work.add_part", "Add part")}
                          </Button>
                        ) : null}
                        {row.status === "in_progress" ? (
                          <Button
                            size="sm"
                            className="h-7 text-[11px]"
                            onClick={() => setCompleting(row)}
                          >
                            {t("service.work.complete", "Complete")}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Raise */}
      <Dialog open={raiseOpen} onOpenChange={setRaiseOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("service.work.raise", "Raise Work Order")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "service.work.raise_desc",
                  "Engineers are listed least loaded first. Coverage is taken from the asset — warranty before contract, because a manufacturer claim should not be billed against an agreement the customer also paid for.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="w-request">{t("service.work.against", "Against request")}</Label>
              <select
                id="w-request"
                value={form.request_id}
                onChange={(event) => setForm({ ...form, request_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("service.work.no_request", "Planned work, no fault reported")}</option>
                {openRequests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.request_number} — {request.subject}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="w-asset">{t("service.requests.asset", "Asset")}</Label>
              <select
                id="w-asset"
                value={form.asset_id}
                onChange={(event) => setForm({ ...form, asset_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("service.work.from_request", "Take it from the request")}</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} — {asset.customer_name ?? asset.asset_tag}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-tech">{t("service.work.technician", "Engineer")}</Label>
              <select
                id="w-tech"
                value={form.technician_id}
                onChange={(event) => setForm({ ...form, technician_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("service.work.unassigned", "Unassigned")}</option>
                {technicians.map((tech) => (
                  <option key={tech.technician_id} value={tech.technician_id}>
                    {tech.name} ({tech.open_jobs} open)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-type">{t("service.work.type", "Type")}</Label>
              <select
                id="w-type"
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="w-when">{t("service.work.scheduled", "Scheduled for")}</Label>
              <Input
                id="w-when"
                type="datetime-local"
                value={form.scheduled_for}
                onChange={(event) => setForm({ ...form, scheduled_for: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setRaiseOpen(false)}>
              {t("service.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => raise.mutate()}
              disabled={raise.isPending || (!form.request_id && !form.asset_id)}
            >
              {t("service.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete */}
      <Dialog open={completing !== null} onOpenChange={(open) => !open && setCompleting(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("service.work.complete_title", "Complete Visit")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "service.work.complete_desc",
                  "Whether the visit actually cleared the fault is what first-time-fix rate is built from, so answer it honestly — a return visit is the alternative.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-hours">{t("service.work.labour_hours", "Labour hours")}</Label>
              <Input
                id="c-hours"
                type="number"
                min={0}
                step="0.25"
                value={completion.labour_hours}
                onChange={(event) =>
                  setCompletion({ ...completion, labour_hours: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-fixed">{t("service.work.fixed", "Fault cleared?")}</Label>
              <select
                id="c-fixed"
                value={completion.resolved_the_fault}
                onChange={(event) =>
                  setCompletion({ ...completion, resolved_the_fault: event.target.value })
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="yes">{t("service.work.fixed_yes", "Yes, fixed")}</option>
                <option value="no">{t("service.work.fixed_no", "No, return visit needed")}</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="c-notes">{t("service.work.notes", "What was done")}</Label>
              <Input
                id="c-notes"
                value={completion.work_performed}
                onChange={(event) =>
                  setCompletion({ ...completion, work_performed: event.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setCompleting(null)}>
              {t("service.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => complete.mutate()} disabled={complete.isPending}>
              {t("service.work.complete", "Complete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add a part */}
      <Dialog open={parting !== null} onOpenChange={(open) => !open && setParting(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("service.work.add_part", "Add part")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "service.work.part_desc",
                  "The line cost is computed from quantity and unit cost here, so it can never disagree with itself and distort the job total.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-desc">{t("service.work.part_name", "Part")}</Label>
              <Input
                id="p-desc"
                value={part.description}
                onChange={(event) => setPart({ ...part, description: event.target.value })}
                placeholder={t("service.work.part_hint", "Seal kit, photo-eye sensor")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-qty">{t("service.work.quantity", "Quantity")}</Label>
              <Input
                id="p-qty"
                type="number"
                min={0}
                step="0.001"
                value={part.quantity}
                onChange={(event) => setPart({ ...part, quantity: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-cost">{t("service.work.unit_cost", "Unit cost")}</Label>
              <Input
                id="p-cost"
                type="number"
                min={0}
                value={part.unit_cost}
                onChange={(event) => setPart({ ...part, unit_cost: event.target.value })}
              />
            </div>
            <p className="sm:col-span-2 text-xs text-muted-foreground">
              {t("service.work.line_preview", "Line: {v}").replace(
                "{v}",
                money(n(part.quantity) * n(part.unit_cost)),
              )}
            </p>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setParting(null)}>
              {t("service.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => addPart.mutate()}
              disabled={addPart.isPending || !part.description.trim()}
            >
              {t("service.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
