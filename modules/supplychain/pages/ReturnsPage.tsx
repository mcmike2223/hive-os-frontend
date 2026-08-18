"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supplyChainApi } from "@/modules/supplychain/api";
import type { SupplyChainReturn } from "@/modules/supplychain/types";
import { ReturnStatusBadge } from "@/modules/shared/charts/primitives";

const REASONS = ["damaged", "expired", "wrong_item", "short_shelf_life", "quality_complaint", "over_supply", "other"];
const DISPOSITIONS = ["restock", "scrap", "replace", "refund", "quarantine"];
const CONDITIONS = ["good", "damaged", "expired", "contaminated"];

type LineDraft = { product_id: string; quantity: string; unit_price: string; batch_number: string; condition: string };
const EMPTY_LINE: LineDraft = { product_id: "", quantity: "", unit_price: "", batch_number: "", condition: "" };

export default function ReturnsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [inspecting, setInspecting] = React.useState<SupplyChainReturn | null>(null);
  const [disposition, setDisposition] = React.useState("restock");
  const [inspectionNotes, setInspectionNotes] = React.useState("");
  const [accepted, setAccepted] = React.useState<Record<number, string>>({});

  const [form, setForm] = React.useState({
    customer_contact_id: "",
    shipment_id: "",
    reason: "damaged",
    return_location_id: "",
    notes: "",
    items: [{ ...EMPTY_LINE }] as LineDraft[],
  });

  const returnsQuery = useQuery({
    queryKey: ["supply-chain", "returns", tableQuery, statusFilter],
    queryFn: () =>
      supplyChainApi
        .listReturns({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
        })
        .then((r) => r.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["supply-chain"] });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: () =>
      supplyChainApi.createReturn({
        customer_contact_id: form.customer_contact_id ? Number(form.customer_contact_id) : undefined,
        shipment_id: form.shipment_id ? Number(form.shipment_id) : undefined,
        reason: form.reason,
        return_location_id: form.return_location_id ? Number(form.return_location_id) : undefined,
        notes: form.notes || undefined,
        items: form.items
          .filter((l) => l.product_id && l.quantity)
          .map((l) => ({
            product_id: Number(l.product_id),
            quantity: Number(l.quantity),
            unit_price: l.unit_price ? Number(l.unit_price) : undefined,
            batch_number: l.batch_number || undefined,
            condition: l.condition || undefined,
          })),
      }),
    onSuccess: () => {
      toast.success(t("supply_chain.returns.created", "Return logged."));
      invalidate();
      setCreateOpen(false);
      setForm((f) => ({ ...f, items: [{ ...EMPTY_LINE }] }));
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || t("supply_chain.returns.create_failed", "Could not log the return.")),
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => supplyChainApi.transitionReturn(id, status),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("supply_chain.common.updated", "Updated."));
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || t("supply_chain.common.update_failed", "Could not update.")),
  });

  const inspectMutation = useMutation({
    mutationFn: () =>
      supplyChainApi.inspectReturn(inspecting!.id, {
        disposition,
        notes: inspectionNotes || undefined,
        items: (inspecting!.items ?? []).map((item) => ({
          item_id: item.id,
          accepted_quantity: Number(accepted[item.id] ?? item.quantity),
        })),
      }),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("supply_chain.returns.inspected", "Return inspected."));
      invalidate();
      setInspecting(null);
      setInspectionNotes("");
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || t("supply_chain.returns.inspect_failed", "Could not inspect it.")),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const columns = React.useMemo<ColumnDef<SupplyChainReturn>[]>(
    () => [
      {
        accessorKey: "return_number",
        header: t("supply_chain.returns.col_return", "Return"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.return_number}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.shipment?.shipment_number ?? t("supply_chain.returns.no_shipment", "No linked shipment")}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "reason",
        header: t("supply_chain.returns.reason", "Reason"),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[11px] font-semibold">
            {row.original.reason.replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: t("supply_chain.common.status", "Status"),
        cell: ({ row }) => <ReturnStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "disposition",
        header: t("supply_chain.returns.disposition", "Disposition"),
        cell: ({ row }) => <span className="text-xs capitalize">{row.original.disposition ?? "—"}</span>,
      },
      {
        accessorKey: "total_quantity",
        header: t("supply_chain.common.quantity", "Quantity"),
        cell: ({ row }) => (
          <span className="font-bold tabular-nums">{Number(row.original.total_quantity).toLocaleString()}</span>
        ),
      },
      {
        accessorKey: "credit_amount",
        header: t("supply_chain.returns.credit", "Credit"),
        cell: ({ row }) => (
          <span className="tabular-nums">ETB {Number(row.original.credit_amount).toLocaleString()}</span>
        ),
      },
      {
        id: "actions",
        header: t("supply_chain.common.actions", "Actions"),
        cell: ({ row }) => {
          const record = row.original;
          const canTransition = ["draft", "authorised", "received", "inspected"].includes(record.status);

          return (
            <div className="flex flex-wrap items-center gap-1.5">
              {canTransition ? (
                <Select value="" onValueChange={(status) => transitionMutation.mutate({ id: record.id, status })}>
                  <SelectTrigger className="h-8 w-[8rem] text-xs">
                    <SelectValue placeholder={t("supply_chain.common.move_to", "Move to...")} />
                  </SelectTrigger>
                  <SelectContent>
                    {["authorised", "received", "closed", "rejected"].map((status) => (
                      <SelectItem key={status} value={status} className="text-xs">{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => {
                  setInspecting(record);
                  setDisposition(record.disposition ?? "restock");
                  setAccepted(Object.fromEntries((record.items ?? []).map((i) => [i.id, String(i.quantity)])));
                }}
              >
                <ClipboardCheck className="h-3 w-3" />
                {t("supply_chain.returns.inspect", "Inspect")}
              </Button>
            </div>
          );
        },
      },
    ],
    [t, transitionMutation],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("supply_chain.returns.title", "Customer Returns")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "supply_chain.returns.subtitle",
              "Only a restock disposition puts goods back, and it books them into quarantine rather than straight into saleable stock.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("supply_chain.returns.add", "Log Return")}
        </Button>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">{t("supply_chain.common.status", "Status")}</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[12rem]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("supply_chain.common.all", "All")}</SelectItem>
            {["draft", "authorised", "received", "inspected", "closed", "rejected"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={(returnsQuery.data?.data ?? []) as SupplyChainReturn[]}
        totalEntries={returnsQuery.data?.meta?.total ?? 0}
        loading={returnsQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("supply_chain.returns.search", "Search returns...")}
        resourceName="customer-returns"
      />

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("supply_chain.returns.new", "Log a Return")}
              </DialogTitle>
              <DialogDescription>
                {t("supply_chain.returns.new_desc", "Set a return location if the goods may be restocked after inspection.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("supply_chain.returns.reason", "Reason")}</Label>
                <Select value={form.reason} onValueChange={(v) => setForm((f) => ({ ...f, reason: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rt-customer">{t("supply_chain.shipments.customer", "Customer contact ID")}</Label>
                <Input id="rt-customer" type="number" value={form.customer_contact_id} onChange={(e) => setForm((f) => ({ ...f, customer_contact_id: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rt-shipment">{t("supply_chain.returns.shipment", "Original shipment ID")}</Label>
                <Input id="rt-shipment" type="number" value={form.shipment_id} onChange={(e) => setForm((f) => ({ ...f, shipment_id: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rt-location">{t("supply_chain.returns.location", "Return location ID")}</Label>
                <Input id="rt-location" type="number" value={form.return_location_id} onChange={(e) => setForm((f) => ({ ...f, return_location_id: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">{t("supply_chain.returns.lines", "Returned goods")}</p>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_LINE }] }))}>
                  <Plus className="h-3 w-3" />
                  {t("supply_chain.shipments.add_line", "Add Line")}
                </Button>
              </div>

              {form.items.map((line, index) => (
                <div key={index} className="grid gap-2 rounded-xl border border-border/40 bg-background p-3 md:grid-cols-12">
                  <div className="md:col-span-3">
                    <Label className="text-[11px]">{t("supply_chain.common.product_id", "Product ID")}</Label>
                    <Input type="number" className="h-9" value={line.product_id} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((l, i) => (i === index ? { ...l, product_id: e.target.value } : l)) }))} />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[11px]">{t("supply_chain.common.quantity", "Qty")}</Label>
                    <Input type="number" className="h-9" value={line.quantity} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((l, i) => (i === index ? { ...l, quantity: e.target.value } : l)) }))} />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[11px]">{t("supply_chain.common.unit_price", "Unit price")}</Label>
                    <Input type="number" className="h-9" value={line.unit_price} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((l, i) => (i === index ? { ...l, unit_price: e.target.value } : l)) }))} />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[11px]">{t("supply_chain.common.batch", "Batch")}</Label>
                    <Input className="h-9" value={line.batch_number} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((l, i) => (i === index ? { ...l, batch_number: e.target.value } : l)) }))} />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[11px]">{t("supply_chain.returns.condition", "Condition")}</Label>
                    <Select
                      value={line.condition}
                      onValueChange={(v) => setForm((f) => ({ ...f, items: f.items.map((l, i) => (i === index ? { ...l, condition: v } : l)) }))}
                    >
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end md:col-span-1">
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setCreateOpen(false)}>
              {t("supply_chain.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={createMutation.isPending}
              onClick={() => {
                if (!form.items.some((l) => l.product_id && l.quantity)) {
                  toast.error(t("supply_chain.returns.line_required", "Add at least one returned line."));
                  return;
                }
                createMutation.mutate();
              }}
            >
              {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("supply_chain.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspect */}
      <Dialog open={inspecting !== null} onOpenChange={(open) => !open && setInspecting(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("supply_chain.returns.inspect_title", "Inspect Return")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "supply_chain.returns.inspect_desc",
                  "Restock books the accepted quantity into the return location. Scrap and quarantine never touch saleable stock.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
            <div className="space-y-2">
              <Label>{t("supply_chain.returns.disposition", "Disposition")}</Label>
              <Select value={disposition} onValueChange={setDisposition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISPOSITIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {(inspecting?.items ?? []).map((item) => (
              <div key={item.id} className="grid items-end gap-3 rounded-xl border border-border/40 p-3 md:grid-cols-3">
                <div>
                  <p className="text-sm font-semibold">{item.product?.name ?? `#${item.product_id}`}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("supply_chain.returns.returned", "Returned")} {Number(item.quantity).toLocaleString()} {item.uom}
                  </p>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor={`accept-${item.id}`} className="text-xs">
                    {t("supply_chain.returns.accepted", "Accepted quantity")}
                  </Label>
                  <Input
                    id={`accept-${item.id}`}
                    type="number"
                    className="h-9"
                    value={accepted[item.id] ?? ""}
                    onChange={(e) => setAccepted((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                </div>
              </div>
            ))}

            <div className="space-y-2">
              <Label htmlFor="inspect-notes">{t("supply_chain.returns.notes", "Inspection notes")}</Label>
              <Input id="inspect-notes" value={inspectionNotes} onChange={(e) => setInspectionNotes(e.target.value)} />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setInspecting(null)}>
              {t("supply_chain.common.cancel", "Cancel")}
            </Button>
            <Button className="rounded-full" disabled={inspectMutation.isPending} onClick={() => inspectMutation.mutate()}>
              {inspectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("supply_chain.returns.confirm_inspection", "Confirm Inspection")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
