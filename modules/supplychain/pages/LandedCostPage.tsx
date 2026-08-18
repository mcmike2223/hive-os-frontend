"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Loader2, Plus, Trash2 } from "lucide-react";
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
import type { LandedCost } from "@/modules/supplychain/types";
import { Panel } from "@/modules/shared/charts/primitives";

const OVERHEADS = [
  ["freight_cost", "Freight"],
  ["insurance_cost", "Insurance"],
  ["customs_duty", "Customs duty"],
  ["excise_tax", "Excise"],
  ["port_handling_cost", "Port handling"],
  ["inland_transport_cost", "Inland transport"],
  ["bank_charges", "Bank / LC charges"],
  ["other_costs", "Other"],
] as const;

type LineDraft = { product_id: string; quantity: string; unit_price_foreign: string; weight_kg: string };
const EMPTY_LINE: LineDraft = { product_id: "", quantity: "", unit_price_foreign: "", weight_kg: "" };

/** Overhead keys are held as strings so the inputs stay controlled while empty. */
type OverheadKey = (typeof OVERHEADS)[number][0];

type CostForm = Record<OverheadKey, string> & {
  reference: string;
  currency: string;
  exchange_rate: string;
  allocation_basis: string;
  purchase_order_id: string;
  declaration_number: string;
  items: LineDraft[];
};

export default function LandedCostPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [createOpen, setCreateOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<LandedCost | null>(null);

  const [form, setForm] = React.useState<CostForm>({
    reference: "",
    currency: "USD",
    exchange_rate: "",
    allocation_basis: "value",
    purchase_order_id: "",
    declaration_number: "",
    freight_cost: "0",
    insurance_cost: "0",
    customs_duty: "0",
    excise_tax: "0",
    port_handling_cost: "0",
    inland_transport_cost: "0",
    bank_charges: "0",
    other_costs: "0",
    items: [{ ...EMPTY_LINE }],
  });

  const costsQuery = useQuery({
    queryKey: ["supply-chain", "landed-costs", tableQuery],
    queryFn: () =>
      supplyChainApi
        .listLandedCosts({ page: tableQuery.page, limit: tableQuery.pageSize, search: tableQuery.search || undefined })
        .then((r) => r.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["supply-chain"] });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: () =>
      supplyChainApi.createLandedCost({
        reference: form.reference,
        currency: form.currency,
        exchange_rate: Number(form.exchange_rate || 1),
        allocation_basis: form.allocation_basis,
        purchase_order_id: form.purchase_order_id ? Number(form.purchase_order_id) : undefined,
        declaration_number: form.declaration_number || undefined,
        ...Object.fromEntries(OVERHEADS.map(([key]) => [key, Number(form[key] || 0)])),
        lines: form.items
          .filter((l) => l.product_id && l.quantity)
          .map((l) => ({
            product_id: Number(l.product_id),
            quantity: Number(l.quantity),
            unit_price_foreign: Number(l.unit_price_foreign || 0),
            weight_kg: l.weight_kg ? Number(l.weight_kg) : undefined,
          })),
      }),
    onSuccess: () => {
      toast.success(t("supply_chain.landed.created", "Consignment created."));
      invalidate();
      setCreateOpen(false);
      setForm((f) => ({ ...f, items: [{ ...EMPTY_LINE }] }));
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || t("supply_chain.landed.create_failed", "Could not create it.")),
  });

  const allocateMutation = useMutation({
    mutationFn: (id: number) => supplyChainApi.allocateLandedCost(id),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("supply_chain.landed.allocated", "Landed cost allocated."));
      setDetail((response?.data?.data as LandedCost) ?? null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || t("supply_chain.landed.allocate_failed", "Could not allocate.")),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const columns = React.useMemo<ColumnDef<LandedCost>[]>(
    () => [
      {
        accessorKey: "reference",
        header: t("supply_chain.landed.col_reference", "Consignment"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.reference}</p>
            <p className="text-[11px] text-muted-foreground">{row.original.declaration_number ?? "—"}</p>
          </div>
        ),
      },
      {
        id: "fx",
        header: t("supply_chain.landed.fx", "Currency / rate"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.currency} @ {Number(row.original.exchange_rate).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "goods_value_base",
        header: t("supply_chain.landed.goods", "Goods (ETB)"),
        cell: ({ row }) => (
          <span className="tabular-nums">{Number(row.original.goods_value_base).toLocaleString()}</span>
        ),
      },
      {
        accessorKey: "overhead_total",
        header: t("supply_chain.landed.overheads", "Overheads"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="tabular-nums">{row.original.overhead_total.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground">+{row.original.overhead_percent.toFixed(1)}%</p>
          </div>
        ),
      },
      {
        accessorKey: "total_landed_cost",
        header: t("supply_chain.landed.total", "Landed total"),
        cell: ({ row }) => (
          <span className="font-bold tabular-nums">{Number(row.original.total_landed_cost).toLocaleString()}</span>
        ),
      },
      {
        accessorKey: "status",
        header: t("supply_chain.common.status", "Status"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={`border-transparent text-[11px] font-black uppercase tracking-widest ${
              row.original.status === "allocated"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : row.original.status === "posted"
                  ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: t("supply_chain.common.actions", "Actions"),
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={allocateMutation.isPending}
              onClick={() => allocateMutation.mutate(row.original.id)}
            >
              <Calculator className="h-3 w-3" />
              {t("supply_chain.landed.allocate", "Allocate")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() =>
                supplyChainApi.getLandedCost(row.original.id).then((r) => setDetail(r.data?.data ?? null))
              }
            >
              {t("supply_chain.landed.view", "Lines")}
            </Button>
          </div>
        ),
      },
    ],
    [allocateMutation, t],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("supply_chain.landed.title", "Landed Cost")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "supply_chain.landed.subtitle",
              "What an imported consignment truly cost once freight, duty, port charges and bank fees are spread across the lines at the settlement rate.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("supply_chain.landed.add", "New Consignment")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={(costsQuery.data?.data ?? []) as LandedCost[]}
        totalEntries={costsQuery.data?.meta?.total ?? 0}
        loading={costsQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("supply_chain.landed.search", "Search consignments...")}
        resourceName="landed-costs"
      />

      {detail ? (
        <Panel
          title={t("supply_chain.landed.lines_title", "Landed cost by line — {ref}").replace("{ref}", detail.reference)}
          description={t("supply_chain.landed.lines_desc", "The unit cost the business should actually value this stock at.")}
          action={
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setDetail(null)}>
              {t("supply_chain.common.close", "Close")}
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">{t("supply_chain.common.product", "Product")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("supply_chain.common.quantity", "Qty")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("supply_chain.landed.invoice_value", "Invoice (ETB)")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("supply_chain.landed.overheads", "Overheads")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("supply_chain.landed.uplift", "Uplift")}</th>
                  <th className="py-2 text-right font-semibold">{t("supply_chain.landed.unit_cost", "Landed unit cost")}</th>
                </tr>
              </thead>
              <tbody>
                {(detail.lines ?? []).map((line) => (
                  <tr key={line.id} className="border-b border-border/30">
                    <td className="py-2 pr-3 font-medium">{line.product?.name ?? `#${line.product_id}`}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{Number(line.quantity).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{Number(line.line_value_base).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{Number(line.allocated_overhead).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                      +{line.uplift_percent.toFixed(1)}%
                    </td>
                    <td className="py-2 text-right font-bold tabular-nums">{Number(line.landed_unit_cost).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("supply_chain.landed.new", "New Import Consignment")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "supply_chain.landed.new_desc",
                  "Use the rate the bank actually settled at, not the invoice-day rate — that difference is real money on an LC.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="lc-ref">{t("supply_chain.landed.reference", "Reference")}</Label>
                <Input id="lc-ref" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="LC-2026-014" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lc-currency">{t("supply_chain.landed.currency", "Currency")}</Label>
                <Input id="lc-currency" maxLength={3} value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lc-rate">{t("supply_chain.landed.rate", "Settlement rate")}</Label>
                <Input id="lc-rate" type="number" step="0.0001" value={form.exchange_rate} onChange={(e) => setForm((f) => ({ ...f, exchange_rate: e.target.value }))} placeholder="57.0000" />
              </div>
              <div className="space-y-2">
                <Label>{t("supply_chain.landed.basis", "Allocation basis")}</Label>
                <Select value={form.allocation_basis} onValueChange={(v) => setForm((f) => ({ ...f, allocation_basis: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["value", "quantity", "weight"].map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lc-po">{t("supply_chain.landed.po", "Purchase order ID")}</Label>
                <Input id="lc-po" type="number" value={form.purchase_order_id} onChange={(e) => setForm((f) => ({ ...f, purchase_order_id: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lc-decl">{t("supply_chain.landed.declaration", "Declaration number")}</Label>
                <Input id="lc-decl" value={form.declaration_number} onChange={(e) => setForm((f) => ({ ...f, declaration_number: e.target.value }))} />
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4 md:grid-cols-4">
              {OVERHEADS.map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`lc-${key}`} className="text-xs">{label} (ETB)</Label>
                  <Input id={`lc-${key}`} type="number" className="h-9" value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
            </div>

            <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">{t("supply_chain.landed.lines", "Consignment lines")}</p>
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
                  <div className="md:col-span-3">
                    <Label className="text-[11px]">{t("supply_chain.common.quantity", "Quantity")}</Label>
                    <Input type="number" className="h-9" value={line.quantity} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((l, i) => (i === index ? { ...l, quantity: e.target.value } : l)) }))} />
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-[11px]">{t("supply_chain.landed.unit_price_foreign", "Unit price (FX)")}</Label>
                    <Input type="number" step="0.0001" className="h-9" value={line.unit_price_foreign} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((l, i) => (i === index ? { ...l, unit_price_foreign: e.target.value } : l)) }))} />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[11px]">{t("supply_chain.landed.weight", "Weight (kg)")}</Label>
                    <Input type="number" className="h-9" value={line.weight_kg} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((l, i) => (i === index ? { ...l, weight_kg: e.target.value } : l)) }))} />
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
                if (!form.reference || !form.exchange_rate) {
                  toast.error(t("supply_chain.landed.required", "Reference and settlement rate are required."));
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
    </div>
  );
}
