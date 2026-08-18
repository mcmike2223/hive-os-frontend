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
  Priority,
  RequestStatus,
  ServiceAsset,
  ServiceRequest,
} from "@/modules/service/types";
import { EmptyPanel, LoadingPanel, Panel } from "@/modules/shared/charts/primitives";

const PRIORITIES: Priority[] = ["low", "normal", "high", "critical"];
const CHANNELS = ["phone", "email", "portal", "field"] as const;

/**
 * The transitions the API will actually accept, mirrored here so the buttons
 * offered are the ones that work. The server is still the authority — it
 * refuses anything else with a 422 that surfaces as a toast.
 */
const NEXT_STATUSES: Record<RequestStatus, RequestStatus[]> = {
  new: ["acknowledged", "in_progress", "cancelled"],
  acknowledged: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["resolved", "on_hold", "cancelled"],
  on_hold: ["in_progress", "cancelled"],
  resolved: ["in_progress"],
  closed: [],
  cancelled: [],
};

const STATUS_TONE: Record<RequestStatus, string> = {
  new: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  acknowledged: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  in_progress: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  on_hold: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  resolved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

const PRIORITY_TONE: Record<Priority, string> = {
  critical: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  normal: "bg-muted text-muted-foreground",
  low: "bg-muted text-muted-foreground",
};

const whenever = (value: string | null) => (value ? String(value).replace("T", " ").slice(0, 16) : "—");

/**
 * Paused time is stored in minutes, but a two-day wait on a customer reads as
 * "2880m", which nobody parses at a glance. Anything over an hour is shown in
 * hours instead.
 */
const heldFor = (minutes: number) =>
  minutes < 60 ? `${minutes}m` : `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}h`;

export default function ServiceRequestsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [priority, setPriority] = React.useState("");
  const [openOnly, setOpenOnly] = React.useState(false);
  const [breachedOnly, setBreachedOnly] = React.useState(false);
  const [logOpen, setLogOpen] = React.useState(false);
  const [closing, setClosing] = React.useState<ServiceRequest | null>(null);
  const [rating, setRating] = React.useState("5");

  const [form, setForm] = React.useState({
    asset_id: "",
    subject: "",
    description: "",
    priority: "normal",
    channel: "phone",
    customer_name: "",
  });

  const requestsQuery = useQuery({
    queryKey: ["service", "requests", search, status, priority, openOnly, breachedOnly],
    queryFn: () =>
      serviceApi
        .listRequests({
          limit: 25,
          ...(search ? { search } : {}),
          ...(status ? { status } : {}),
          ...(priority ? { priority } : {}),
          ...(openOnly ? { open_only: 1 } : {}),
          ...(breachedOnly ? { breached_only: 1 } : {}),
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const assetsQuery = useQuery({
    queryKey: ["service", "asset-options"],
    queryFn: () => serviceApi.listAssets({ limit: 100 }).then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["service"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const logRequest = useMutation({
    mutationFn: () =>
      serviceApi.createRequest({
        ...(form.asset_id ? { asset_id: Number(form.asset_id) } : {}),
        subject: form.subject,
        description: form.description || null,
        priority: form.priority,
        channel: form.channel,
        ...(form.customer_name ? { customer_name: form.customer_name } : {}),
      }),
    onSuccess: (response: any) => {
      toast.success(
        response?.data?.message ?? t("service.requests.logged", "Request logged."),
      );
      invalidate();
      setLogOpen(false);
      setForm({
        asset_id: "",
        subject: "",
        description: "",
        priority: "normal",
        channel: "phone",
        customer_name: "",
      });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.requests.log_failed", "Could not log it."))),
  });

  const transition = useMutation({
    mutationFn: ({ id, next }: { id: number; next: RequestStatus }) =>
      serviceApi.transitionRequest(id, next),
    onSuccess: () => {
      toast.success(t("service.requests.moved", "Request updated."));
      invalidate();
    },
    // The API refuses illegal moves and says why — surface its words, not ours.
    onError: (error: any) =>
      toast.error(errorText(error, t("service.requests.move_failed", "Could not move it."))),
  });

  const close = useMutation({
    mutationFn: () => serviceApi.closeRequest(closing!.id, Number(rating)),
    onSuccess: () => {
      toast.success(t("service.requests.closed", "Request closed."));
      invalidate();
      setClosing(null);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.requests.close_failed", "Could not close it."))),
  });

  const requests = (requestsQuery.data?.data ?? []) as ServiceRequest[];
  const assets = (assetsQuery.data?.data ?? []) as ServiceAsset[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("service.requests.title", "Service Requests")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "service.requests.subtitle",
              "Every fault against its contract clock. Deadlines are set once at intake and do not move when a contract is renegotiated later.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setLogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("service.requests.log", "Log Request")}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label htmlFor="sr-search" className="text-xs">
            {t("service.common.search", "Search")}
          </Label>
          <Input
            id="sr-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("service.requests.search_hint", "Number, subject or customer")}
            className="h-9 w-56"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sr-status" className="text-xs">
            {t("service.common.status", "Status")}
          </Label>
          <select
            id="sr-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm capitalize"
          >
            <option value="">{t("service.common.any", "Any")}</option>
            {(Object.keys(NEXT_STATUSES) as RequestStatus[]).map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="sr-priority" className="text-xs">
            {t("service.common.priority", "Priority")}
          </Label>
          <select
            id="sr-priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm capitalize"
          >
            <option value="">{t("service.common.any", "Any")}</option>
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(event) => setOpenOnly(event.target.checked)}
            className="h-4 w-4"
          />
          {t("service.requests.open_only", "Open only")}
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            checked={breachedOnly}
            onChange={(event) => setBreachedOnly(event.target.checked)}
            className="h-4 w-4"
          />
          {t("service.requests.breached_only", "Breached only")}
        </label>
      </div>

      <Panel
        title={t("service.requests.queue", "Queue")}
        description={t(
          "service.requests.queue_desc",
          "Newest first. A breach flag reflects the frozen deadline net of any time the request sat waiting on the customer.",
        )}
      >
        {requestsQuery.isLoading ? (
          <LoadingPanel label={t("service.common.loading", "Loading requests...")} />
        ) : requests.length === 0 ? (
          <EmptyPanel label={t("service.requests.none", "No requests match those filters.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("service.requests.number", "Request")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.requests.asset", "Asset")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.common.priority", "Priority")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.common.status", "Status")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.requests.due", "Resolution due")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.requests.sla", "SLA")}</th>
                  <th className="pb-2 pr-6 text-right font-semibold">
                    {t("service.common.actions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((row) => {
                  const nextStates = NEXT_STATUSES[row.status] ?? [];
                  const breached = row.response_breached || row.resolution_breached;

                  return (
                    <tr key={row.id} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-3">
                        <span className="block font-medium">{row.subject}</span>
                        <span className="block text-[11px] tabular-nums text-muted-foreground">
                          {row.request_number}
                          {row.customer_name ? ` · ${row.customer_name}` : ""}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {row.asset?.name ?? (row.asset_id ? `#${row.asset_id}` : "—")}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge
                          variant="outline"
                          className={`border-transparent text-[10px] font-black uppercase tracking-widest ${PRIORITY_TONE[row.priority]}`}
                        >
                          {row.priority}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge
                          variant="outline"
                          className={`border-transparent text-[10px] font-black uppercase tracking-widest ${STATUS_TONE[row.status]}`}
                        >
                          {row.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-xs tabular-nums">
                        {/* No contract means no promise, so no deadline was invented. */}
                        {row.resolution_due_at
                          ? whenever(row.resolution_due_at)
                          : t("service.requests.no_contract", "no contract")}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {breached ? (
                          <span className="font-semibold text-destructive">
                            {row.response_breached && row.resolution_breached
                              ? t("service.requests.both_late", "Both late")
                              : row.response_breached
                                ? t("service.requests.response_late", "Response late")
                                : t("service.requests.resolution_late", "Resolution late")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {t("service.requests.on_track", "On track")}
                          </span>
                        )}
                        {row.paused_minutes > 0 ? (
                          <span className="block text-[11px] text-muted-foreground">
                            {t("service.requests.paused", "{n} on hold").replace(
                              "{n}",
                              heldFor(row.paused_minutes),
                            )}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-6 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {nextStates.map((next) => (
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
                          {row.status === "resolved" ? (
                            <Button
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => {
                                setClosing(row);
                                setRating("5");
                              }}
                            >
                              {t("service.requests.close", "Close")}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Log a fault */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("service.requests.log", "Log Request")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "service.requests.log_desc",
                  "Naming the asset pulls its contract in, and the response and resolution deadlines are computed from that contract's cover — working hours only, unless it is a 24/7 agreement.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="l-asset">{t("service.requests.asset", "Asset")}</Label>
              <select
                id="l-asset"
                value={form.asset_id}
                onChange={(event) => setForm({ ...form, asset_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("service.requests.no_asset", "Not against a known asset")}</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} — {asset.customer_name ?? asset.asset_tag}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="l-subject">{t("service.requests.subject", "Subject")}</Label>
              <Input
                id="l-subject"
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
                placeholder={t("service.requests.subject_hint", "Filler head 6 dripping")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="l-priority">{t("service.common.priority", "Priority")}</Label>
              <select
                id="l-priority"
                value={form.priority}
                onChange={(event) => setForm({ ...form, priority: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="l-channel">{t("service.requests.channel", "Reported via")}</Label>
              <select
                id="l-channel"
                value={form.channel}
                onChange={(event) => setForm({ ...form, channel: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {CHANNELS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="l-customer">
                {t("service.requests.customer_optional", "Customer (if no asset chosen)")}
              </Label>
              <Input
                id="l-customer"
                value={form.customer_name}
                onChange={(event) => setForm({ ...form, customer_name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="l-desc">{t("service.requests.description", "What is happening")}</Label>
              <Input
                id="l-desc"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setLogOpen(false)}>
              {t("service.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => logRequest.mutate()}
              disabled={logRequest.isPending || !form.subject.trim()}
            >
              {t("service.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close with a satisfaction rating */}
      <Dialog open={closing !== null} onOpenChange={(open) => !open && setClosing(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("service.requests.close_title", "Close Request")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "service.requests.close_desc",
                  "The rating the customer gives feeds the satisfaction figure on the dashboard, so it is captured here rather than guessed later.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="c-rating">
                {t("service.requests.rating", "Satisfaction (1–5)")}
              </Label>
              <select
                id="c-rating"
                value={rating}
                onChange={(event) => setRating(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setClosing(null)}>
              {t("service.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => close.mutate()} disabled={close.isPending}>
              {t("service.requests.close", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
