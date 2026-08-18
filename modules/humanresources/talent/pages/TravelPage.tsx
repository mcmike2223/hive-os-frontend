"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
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
import { Textarea } from "@/components/ui/textarea";
import { talentApi } from "@/modules/humanresources/talent/api";
import type { TravelRequest, TravelStatus } from "@/modules/humanresources/talent/types";
import { EmptyPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { ColumnChart, RankedBarChart } from "@/modules/shared/charts/charts";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/**
 * Mirrors TravelRequest::TRANSITIONS on the server. The backend is still the
 * authority — this only decides which buttons are worth offering, so a user is
 * not invited to click something that will be refused.
 */
const TRANSITIONS: Record<string, TravelStatus[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["approved", "rejected", "draft", "cancelled"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  rejected: ["draft"],
  completed: [],
  cancelled: [],
};

const STATUS_TONE: Record<string, string> = {
  draft: "outline",
  submitted: "secondary",
  approved: "default",
  in_progress: "default",
  completed: "default",
  rejected: "destructive",
  cancelled: "outline",
};

const EXPENSE_CATEGORIES = [
  "transport",
  "accommodation",
  "meals",
  "per_diem",
  "visa",
  "other",
] as const;

type TravelForm = {
  id?: number;
  employee_id: string;
  purpose: string;
  destination: string;
  country: string;
  trip_type: string;
  departure_date: string;
  return_date: string;
  transport_mode: string;
  estimated_cost: string;
  advance_amount: string;
  itinerary: string;
};

const DEFAULT_TRAVEL: TravelForm = {
  employee_id: "",
  purpose: "",
  destination: "",
  country: "",
  trip_type: "domestic",
  departure_date: "",
  return_date: "",
  transport_mode: "",
  estimated_cost: "0",
  advance_amount: "0",
  itinerary: "",
};

export default function TravelPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState<TravelForm>(DEFAULT_TRAVEL);
  const [detailId, setDetailId] = React.useState<number | null>(null);
  const [expense, setExpense] = React.useState({
    category: "transport",
    amount: "",
    incurred_on: new Date().toISOString().slice(0, 10),
    receipt_reference: "",
  });

  const listQuery = useQuery({
    queryKey: ["hr-talent", "travel", tableQuery],
    queryFn: () =>
      talentApi
        .listTravel({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
        })
        .then((res) => res.data),
  });

  const summaryQuery = useQuery({
    queryKey: ["hr-talent", "travel", "summary"],
    queryFn: () => talentApi.travelSummary().then((res) => res.data),
  });

  const detailQuery = useQuery({
    queryKey: ["hr-talent", "travel", "detail", detailId],
    queryFn: () => talentApi.getTravel(detailId!).then((res) => res.data),
    enabled: detailId !== null,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["hr-talent"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        employee_id: Number(form.employee_id),
        purpose: form.purpose,
        destination: form.destination,
        country: form.country || null,
        trip_type: form.trip_type,
        departure_date: form.departure_date,
        return_date: form.return_date || null,
        transport_mode: form.transport_mode || null,
        estimated_cost: Number(form.estimated_cost || 0),
        advance_amount: Number(form.advance_amount || 0),
        itinerary: form.itinerary || null,
      };

      return form.id ? talentApi.updateTravel(form.id, payload) : talentApi.createTravel(payload);
    },
    onSuccess: () => {
      toast.success(t("hr_talent.travel.saved", "Travel request saved."));
      invalidate();
      setFormOpen(false);
      setForm(DEFAULT_TRAVEL);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("hr_talent.travel.save_failed", "Could not save the request."))),
  });

  const transition = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      talentApi.transitionTravel(id, status),
    onSuccess: () => {
      toast.success(t("hr_talent.travel.moved", "Travel request updated."));
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("hr_talent.travel.move_failed", "That transition was refused."))),
  });

  const addExpense = useMutation({
    mutationFn: () =>
      talentApi.addTravelExpense(detailId!, {
        category: expense.category,
        amount: Number(expense.amount || 0),
        incurred_on: expense.incurred_on,
        receipt_reference: expense.receipt_reference || null,
      }),
    onSuccess: () => {
      toast.success(t("hr_talent.travel.expense_added", "Expense added."));
      invalidate();
      setExpense({ ...expense, amount: "", receipt_reference: "" });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("hr_talent.travel.expense_failed", "Could not add the expense."))),
  });

  const decideExpense = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      talentApi.decideTravelExpense(id, { status }),
    onSuccess: () => {
      toast.success(t("hr_talent.travel.expense_decided", "Expense updated."));
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("hr_talent.travel.expense_decide_failed", "Could not update it."))),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const summary = summaryQuery.data?.data;
  const detail: TravelRequest | undefined = detailQuery.data?.data;

  const columns = React.useMemo<ColumnDef<TravelRequest>[]>(
    () => [
      {
        id: "request",
        header: t("hr_talent.travel.number", "Request"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-mono text-xs font-bold">{row.original.request_number}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.employee?.primary_name ?? `#${row.original.employee_id}`}
            </p>
          </div>
        ),
      },
      {
        id: "trip",
        header: t("hr_talent.travel.trip", "Trip"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-medium">{row.original.destination}</p>
            <p className="text-[11px] text-muted-foreground">{row.original.purpose}</p>
          </div>
        ),
      },
      {
        accessorKey: "departure_date",
        header: t("hr_talent.travel.dates", "Dates"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {String(row.original.departure_date).slice(0, 10)}
            {row.original.return_date ? ` → ${String(row.original.return_date).slice(0, 10)}` : ""}
          </span>
        ),
      },
      {
        id: "money",
        header: t("hr_talent.travel.cost", "Estimate / Actual"),
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs tabular-nums">
            <p>{money(row.original.estimated_cost)}</p>
            <p className="text-muted-foreground">{money(row.original.actual_cost)}</p>
          </div>
        ),
      },
      {
        id: "settlement",
        header: t("hr_talent.travel.settlement", "Settlement"),
        cell: ({ row }) => {
          const due = n(row.original.settlement_due);
          if (due === 0) return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <span
              className={`text-xs font-semibold tabular-nums ${
                due > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {due > 0
                ? t("hr_talent.travel.owed_to_traveller", "Owe {amount}").replace("{amount}", money(due))
                : t("hr_talent.travel.owed_by_traveller", "Return {amount}").replace(
                    "{amount}",
                    money(Math.abs(due)),
                  )}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("hr_talent.common.status", "Status"),
        cell: ({ row }) => (
          <Badge variant={(STATUS_TONE[row.original.status] ?? "outline") as any} className="text-[11px] capitalize">
            {row.original.status.replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const next = TRANSITIONS[row.original.status] ?? [];
          return (
            <div className="flex flex-wrap justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => setDetailId(row.original.id)}>
                {t("hr_talent.common.open", "Open")}
              </Button>
              {next.slice(0, 2).map((status) => (
                <Button
                  key={status}
                  variant="outline"
                  size="sm"
                  className="text-[11px] capitalize"
                  disabled={transition.isPending}
                  onClick={() => transition.mutate({ id: row.original.id, status })}
                >
                  {status.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
          );
        },
      },
    ],
    [t, transition],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("hr_talent.travel.title", "Travel and Per Diem")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "hr_talent.travel.subtitle",
              "Trip requests, advances, and the settlement that closes them out.",
            )}
          </p>
        </div>
        <Button
          className="rounded-full px-5"
          onClick={() => {
            setForm(DEFAULT_TRAVEL);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("hr_talent.travel.request", "New Request")}
        </Button>
      </div>

      {summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label={t("hr_talent.travel.trips", "Trips")}
              value={n(summary.trips).toLocaleString()}
              meta={t("hr_talent.travel.trips_meta", "{waiting} awaiting approval, {moving} under way")
                .replace("{waiting}", String(n(summary.awaiting_approval)))
                .replace("{moving}", String(n(summary.in_progress)))}
              alert={n(summary.awaiting_approval) > 0}
            />
            <StatTile
              label={t("hr_talent.travel.estimated_total", "Estimated")}
              value={money(summary.estimated_cost)}
            />
            <StatTile
              label={t("hr_talent.travel.actual_total", "Actual")}
              value={money(summary.actual_cost)}
              meta={t("hr_talent.travel.variance_meta", "{pct}% against estimate").replace(
                "{pct}",
                n(summary.variance_percent) > 0
                  ? `+${n(summary.variance_percent).toFixed(1)}`
                  : n(summary.variance_percent).toFixed(1),
              )}
              alert={n(summary.variance_percent) > 10}
            />
            <StatTile
              label={t("hr_talent.travel.advance_outstanding", "Advance outstanding")}
              value={money(summary.advance_outstanding)}
              meta={t("hr_talent.travel.advance_meta", "Paid out and not yet accounted for")}
              alert={n(summary.advance_outstanding) > 0}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ColumnChart
              title={t("hr_talent.travel.by_status", "Requests by status")}
              description={t(
                "hr_talent.travel.by_status_desc",
                "Where trips are sitting in the approval and settlement flow.",
              )}
              rows={(summary.by_status ?? []).map((row: any) => ({
                key: row.status,
                label: row.label,
                value: n(row.count),
              }))}
              valueLabel={t("hr_talent.travel.requests", "Requests")}
              emptyLabel={t("hr_talent.travel.no_requests", "No travel requested yet.")}
            />
            <RankedBarChart
              title={t("hr_talent.travel.top_destinations", "Top destinations")}
              description={t(
                "hr_talent.travel.top_destinations_desc",
                "Where the travel budget is actually going.",
              )}
              rows={(summary.by_destination ?? []).map((row: any) => ({
                key: row.destination,
                label: row.destination,
                value: n(row.trips),
                meta: money(row.cost),
              }))}
              valueLabel={t("hr_talent.travel.trips", "Trips")}
              emptyLabel={t("hr_talent.travel.no_destinations", "No trips recorded yet.")}
            />
          </div>
        </>
      ) : null}

      <DataTable
        columns={columns}
        data={(listQuery.data?.data ?? []) as TravelRequest[]}
        totalEntries={listQuery.data?.meta?.total ?? 0}
        loading={listQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("hr_talent.travel.search", "Search by number, destination or purpose...")}
        resourceName="hr-travel"
      />

      {/* Request form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {form.id
                  ? t("hr_talent.travel.edit", "Edit Travel Request")
                  : t("hr_talent.travel.request", "New Travel Request")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "hr_talent.travel.form_desc",
                  "The advance is what the business pays out up front; the settlement at the end is the difference against what was actually spent.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="travel-employee">{t("hr_talent.common.employee_id", "Employee ID")}</Label>
              <Input
                id="travel-employee"
                type="number"
                value={form.employee_id}
                onChange={(event) => setForm({ ...form, employee_id: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="travel-type">{t("hr_talent.travel.type", "Trip type")}</Label>
              <select
                id="travel-type"
                value={form.trip_type}
                onChange={(event) => setForm({ ...form, trip_type: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                <option value="domestic">{t("hr_talent.travel.domestic", "Domestic")}</option>
                <option value="international">{t("hr_talent.travel.international", "International")}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="travel-destination">{t("hr_talent.travel.destination", "Destination")}</Label>
              <Input
                id="travel-destination"
                value={form.destination}
                onChange={(event) => setForm({ ...form, destination: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="travel-country">{t("hr_talent.travel.country", "Country")}</Label>
              <Input
                id="travel-country"
                value={form.country}
                onChange={(event) => setForm({ ...form, country: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="travel-purpose">{t("hr_talent.travel.purpose", "Purpose")}</Label>
              <Input
                id="travel-purpose"
                value={form.purpose}
                onChange={(event) => setForm({ ...form, purpose: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="travel-depart">{t("hr_talent.travel.departs", "Departs")}</Label>
              <Input
                id="travel-depart"
                type="date"
                value={form.departure_date}
                onChange={(event) => setForm({ ...form, departure_date: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="travel-return">{t("hr_talent.travel.returns", "Returns")}</Label>
              <Input
                id="travel-return"
                type="date"
                min={form.departure_date || undefined}
                value={form.return_date}
                onChange={(event) => setForm({ ...form, return_date: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="travel-estimate">{t("hr_talent.travel.estimated", "Estimated cost")}</Label>
              <Input
                id="travel-estimate"
                type="number"
                min={0}
                value={form.estimated_cost}
                onChange={(event) => setForm({ ...form, estimated_cost: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="travel-advance">{t("hr_talent.travel.advance", "Advance")}</Label>
              <Input
                id="travel-advance"
                type="number"
                min={0}
                value={form.advance_amount}
                onChange={(event) => setForm({ ...form, advance_amount: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="travel-itinerary">{t("hr_talent.travel.itinerary", "Itinerary")}</Label>
              <Textarea
                id="travel-itinerary"
                rows={3}
                value={form.itinerary}
                onChange={(event) => setForm({ ...form, itinerary: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              {t("hr_talent.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={
                save.isPending ||
                !form.employee_id ||
                !form.purpose.trim() ||
                !form.destination.trim() ||
                !form.departure_date
              }
            >
              {t("hr_talent.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail + expenses */}
      <Dialog open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail ? detail.request_number : t("hr_talent.travel.trip", "Trip")}
              </DialogTitle>
              <DialogDescription>
                {detail
                  ? `${detail.destination} — ${detail.purpose}`
                  : t("hr_talent.common.loading", "Loading...")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
            {detail ? (
              <>
                <div className="grid gap-3 sm:grid-cols-4">
                  <StatTile
                    label={t("hr_talent.travel.estimated", "Estimated")}
                    value={money(detail.estimated_cost)}
                  />
                  <StatTile label={t("hr_talent.travel.advance", "Advance")} value={money(detail.advance_amount)} />
                  <StatTile label={t("hr_talent.travel.actual_total", "Actual")} value={money(detail.actual_cost)} />
                  <StatTile
                    label={t("hr_talent.travel.settlement", "Settlement")}
                    value={money(Math.abs(n(detail.settlement_due)))}
                    meta={
                      n(detail.settlement_due) > 0
                        ? t("hr_talent.travel.company_owes", "Company owes traveller")
                        : n(detail.settlement_due) < 0
                          ? t("hr_talent.travel.traveller_owes", "Traveller returns advance")
                          : t("hr_talent.travel.square", "Square")
                    }
                    alert={n(detail.settlement_due) < 0}
                  />
                </div>

                <Panel title={t("hr_talent.travel.expenses", "Expenses")}>
                  {(detail.expenses ?? []).length === 0 ? (
                    <EmptyPanel label={t("hr_talent.travel.no_expenses", "No expenses claimed yet.")} />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[30rem] text-sm">
                        <thead>
                          <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="pb-2 font-semibold">{t("hr_talent.common.category", "Category")}</th>
                            <th className="pb-2 font-semibold">{t("hr_talent.travel.incurred", "Incurred")}</th>
                            <th className="pb-2 text-right font-semibold">
                              {t("hr_talent.travel.amount", "Amount")}
                            </th>
                            <th className="pb-2 font-semibold">{t("hr_talent.common.status", "Status")}</th>
                            <th className="pb-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {detail.expenses!.map((row) => (
                            <tr key={row.id} className="border-b border-border/40 last:border-0">
                              <td className="py-2 capitalize">{row.category.replace(/_/g, " ")}</td>
                              <td className="py-2 text-xs tabular-nums">{row.incurred_on ?? "—"}</td>
                              <td className="py-2 text-right tabular-nums">{money(row.amount)}</td>
                              <td className="py-2">
                                <Badge variant="outline" className="text-[11px] capitalize">
                                  {row.status.replace(/_/g, " ")}
                                </Badge>
                              </td>
                              <td className="py-2 text-right">
                                {row.status === "submitted" ? (
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-[11px]"
                                      onClick={() => decideExpense.mutate({ id: row.id, status: "approved" })}
                                    >
                                      {t("hr_talent.common.approve", "Approve")}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-[11px] text-destructive"
                                      onClick={() => decideExpense.mutate({ id: row.id, status: "rejected" })}
                                    >
                                      {t("hr_talent.common.reject", "Reject")}
                                    </Button>
                                  </div>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border/40 pt-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="expense-category">{t("hr_talent.common.category", "Category")}</Label>
                      <select
                        id="expense-category"
                        value={expense.category}
                        onChange={(event) => setExpense({ ...expense, category: event.target.value })}
                        className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm capitalize"
                      >
                        {EXPENSE_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="expense-amount">{t("hr_talent.travel.amount", "Amount")}</Label>
                      <Input
                        id="expense-amount"
                        type="number"
                        min={0}
                        value={expense.amount}
                        onChange={(event) => setExpense({ ...expense, amount: event.target.value })}
                        className="h-9 w-32"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="expense-date">{t("hr_talent.travel.incurred", "Incurred")}</Label>
                      <Input
                        id="expense-date"
                        type="date"
                        value={expense.incurred_on}
                        onChange={(event) => setExpense({ ...expense, incurred_on: event.target.value })}
                        className="h-9 w-40"
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="h-9"
                      disabled={addExpense.isPending || !expense.amount}
                      onClick={() => addExpense.mutate()}
                    >
                      {t("hr_talent.travel.add_expense", "Add")}
                    </Button>
                  </div>
                </Panel>
              </>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setDetailId(null)}>
              {t("hr_talent.common.close", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
