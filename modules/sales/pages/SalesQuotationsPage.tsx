"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
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
import { salesApi } from "@/modules/sales/api";
import type { QuotationStatus, SalesCustomer, SalesQuotation } from "@/modules/sales/types";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/**
 * Mirrors SalesQuotation::TRANSITIONS on the server. The backend stays the
 * authority — this only decides which buttons are worth offering, so nobody is
 * invited to click something that will be refused.
 */
const TRANSITIONS: Record<string, QuotationStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["accepted", "declined", "expired", "draft", "cancelled"],
  accepted: ["cancelled"],
  declined: ["draft"],
  expired: ["draft"],
  converted: [],
  cancelled: [],
};

const STATUS_TONE: Record<string, string> = {
  draft: "outline",
  sent: "secondary",
  accepted: "default",
  converted: "default",
  declined: "destructive",
  expired: "destructive",
  cancelled: "outline",
};

type LineDraft = {
  product_id: string;
  quantity: string;
  unit_price: string;
  discount_percent: string;
  tax_percent: string;
};

const EMPTY_LINE: LineDraft = {
  product_id: "",
  quantity: "1",
  unit_price: "",
  discount_percent: "0",
  tax_percent: "15",
};

export default function SalesQuotationsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [open, setOpen] = React.useState(false);
  const [customerId, setCustomerId] = React.useState("");
  const [validUntil, setValidUntil] = React.useState("");
  const [lines, setLines] = React.useState<LineDraft[]>([{ ...EMPTY_LINE }]);
  const [detailId, setDetailId] = React.useState<number | null>(null);

  const listQuery = useQuery({
    queryKey: ["sales", "quotations", tableQuery],
    queryFn: () =>
      salesApi
        .listQuotations({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
        })
        .then((res) => res.data),
  });

  const customersQuery = useQuery({
    queryKey: ["sales", "customer-options"],
    queryFn: () => salesApi.listCustomers({ limit: 100, is_active: 1 }).then((res) => res.data),
  });

  const detailQuery = useQuery({
    queryKey: ["sales", "quotation", detailId],
    queryFn: () => salesApi.getQuotation(detailId!).then((res) => res.data),
    enabled: detailId !== null,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["sales"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const create = useMutation({
    mutationFn: () =>
      salesApi.createQuotation({
        customer_id: Number(customerId),
        valid_until: validUntil || undefined,
        lines: lines
          .filter((line) => line.product_id && Number(line.quantity) > 0)
          .map((line) => ({
            product_id: Number(line.product_id),
            quantity: Number(line.quantity),
            // Omitted so the price list answers; sent only when overridden.
            ...(line.unit_price ? { unit_price: Number(line.unit_price) } : {}),
            discount_percent: Number(line.discount_percent || 0),
            tax_percent: Number(line.tax_percent || 0),
          })),
      }),
    onSuccess: (response: any) => {
      toast.success(response?.data?.message ?? t("sales.quotations.created", "Quotation created."));
      invalidate();
      setOpen(false);
      setLines([{ ...EMPTY_LINE }]);
      setCustomerId("");
      setValidUntil("");
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.quotations.create_failed", "Could not create it."))),
  });

  const transition = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      salesApi.transitionQuotation(id, status),
    onSuccess: () => {
      toast.success(t("sales.quotations.moved", "Quotation updated."));
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.quotations.move_failed", "That transition was refused."))),
  });

  const convert = useMutation({
    mutationFn: (id: number) => salesApi.convertQuotation(id),
    onSuccess: (response: any) => {
      toast.success(response?.data?.message ?? t("sales.quotations.converted", "Converted to an order."));
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.quotations.convert_failed", "Could not convert it."))),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const customers = (customersQuery.data?.data ?? []) as SalesCustomer[];
  const detail: SalesQuotation | undefined = detailQuery.data?.data;

  const columns = React.useMemo<ColumnDef<SalesQuotation>[]>(
    () => [
      {
        id: "number",
        header: t("sales.quotations.number", "Quotation"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-mono text-xs font-bold">{row.original.quotation_number}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.customer?.name ?? `#${row.original.customer_id}`}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "issued_on",
        header: t("sales.quotations.issued", "Issued"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">{String(row.original.issued_on).slice(0, 10)}</span>
        ),
      },
      {
        accessorKey: "valid_until",
        header: t("sales.quotations.valid_until", "Valid until"),
        cell: ({ row }) => (
          <span
            className={`text-xs tabular-nums ${
              row.original.is_expired ? "font-semibold text-destructive" : ""
            }`}
          >
            {row.original.valid_until ? String(row.original.valid_until).slice(0, 10) : "—"}
          </span>
        ),
      },
      {
        accessorKey: "total",
        header: t("sales.common.total", "Total"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">{money(row.original.total)}</span>
        ),
      },
      {
        accessorKey: "status",
        header: t("sales.common.status", "Status"),
        cell: ({ row }) => (
          <Badge
            variant={(STATUS_TONE[row.original.status] ?? "outline") as any}
            className="text-[11px] capitalize"
          >
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
                {t("sales.common.open", "Open")}
              </Button>
              {row.original.status === "accepted" ? (
                <Button
                  size="sm"
                  className="text-[11px]"
                  disabled={convert.isPending}
                  onClick={() => convert.mutate(row.original.id)}
                >
                  {t("sales.quotations.convert", "Convert")}
                </Button>
              ) : null}
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
    [t, transition, convert],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("sales.quotations.title", "Quotations")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "sales.quotations.subtitle",
              "Offers to customers. An accepted quotation converts to an order at exactly the price quoted.",
            )}
          </p>
        </div>
        <Button
          className="rounded-full px-5"
          onClick={() => {
            setLines([{ ...EMPTY_LINE }]);
            setCustomerId("");
            setValidUntil("");
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("sales.quotations.add", "New Quotation")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={(listQuery.data?.data ?? []) as SalesQuotation[]}
        totalEntries={listQuery.data?.meta?.total ?? 0}
        loading={listQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("sales.quotations.search", "Search quotations...")}
        resourceName="sales-quotations"
      />

      {/* New quotation */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("sales.quotations.add", "New Quotation")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "sales.quotations.form_desc",
                  "Leave the unit price blank and the customer's price list decides, including quantity breaks.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="qt-customer">{t("sales.common.customer", "Customer")}</Label>
                <select
                  id="qt-customer"
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">{t("sales.common.select", "Select...")}</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qt-valid">{t("sales.quotations.valid_until", "Valid until")}</Label>
                <Input
                  id="qt-valid"
                  type="date"
                  value={validUntil}
                  onChange={(event) => setValidUntil(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("sales.common.lines", "Lines")}</Label>
              {lines.map((line, index) => (
                <div key={index} className="flex flex-wrap items-end gap-2 rounded-xl border border-border/50 p-3">
                  <div className="space-y-1">
                    <Label className="text-[11px]">{t("sales.pricing.product_id", "Product ID")}</Label>
                    <Input
                      type="number"
                      value={line.product_id}
                      onChange={(event) => {
                        const next = [...lines];
                        next[index] = { ...line, product_id: event.target.value };
                        setLines(next);
                      }}
                      className="h-9 w-28"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">{t("sales.common.quantity", "Qty")}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={line.quantity}
                      onChange={(event) => {
                        const next = [...lines];
                        next[index] = { ...line, quantity: event.target.value };
                        setLines(next);
                      }}
                      className="h-9 w-24"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">
                      {t("sales.quotations.price_optional", "Price (optional)")}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={line.unit_price}
                      onChange={(event) => {
                        const next = [...lines];
                        next[index] = { ...line, unit_price: event.target.value };
                        setLines(next);
                      }}
                      placeholder={t("sales.quotations.auto", "auto")}
                      className="h-9 w-32"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">{t("sales.common.tax", "Tax %")}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={line.tax_percent}
                      onChange={(event) => {
                        const next = [...lines];
                        next[index] = { ...line, tax_percent: event.target.value };
                        setLines(next);
                      }}
                      className="h-9 w-20"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 text-destructive"
                    disabled={lines.length === 1}
                    onClick={() => setLines(lines.filter((_, i) => i !== index))}
                    aria-label={t("sales.common.remove_line", "Remove line")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setLines([...lines, { ...EMPTY_LINE }])}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("sales.common.add_line", "Add line")}
              </Button>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("sales.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={
                create.isPending ||
                !customerId ||
                !lines.some((line) => line.product_id && Number(line.quantity) > 0)
              }
            >
              {t("sales.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Dialog open={detailId !== null} onOpenChange={(isOpen) => !isOpen && setDetailId(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {detail ? detail.quotation_number : t("sales.quotations.title", "Quotation")}
              </DialogTitle>
              <DialogDescription>
                {detail
                  ? `${detail.customer?.name ?? ""} — ${money(detail.total)}`
                  : t("sales.common.loading", "Loading...")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
            {detail ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 font-semibold">{t("sales.pricing.product", "Product")}</th>
                      <th className="pb-2 text-right font-semibold">{t("sales.common.quantity", "Qty")}</th>
                      <th className="pb-2 text-right font-semibold">
                        {t("sales.pricing.unit_price", "Unit price")}
                      </th>
                      <th className="pb-2 text-right font-semibold">{t("sales.common.tax", "Tax %")}</th>
                      <th className="pb-2 text-right font-semibold">{t("sales.common.total", "Total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.lines ?? []).map((line) => (
                      <tr key={line.id} className="border-b border-border/40 last:border-0">
                        <td className="py-2">#{line.product_id}</td>
                        <td className="py-2 text-right tabular-nums">{n(line.quantity)}</td>
                        <td className="py-2 text-right tabular-nums">{money(line.unit_price)}</td>
                        <td className="py-2 text-right tabular-nums">{n(line.tax_percent)}%</td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {money(line.line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border/60">
                      <td colSpan={4} className="py-2 text-right text-xs text-muted-foreground">
                        {t("sales.common.subtotal", "Subtotal")}
                      </td>
                      <td className="py-2 text-right tabular-nums">{money(detail.subtotal)}</td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="py-1 text-right text-xs text-muted-foreground">
                        {t("sales.common.tax_total", "Tax")}
                      </td>
                      <td className="py-1 text-right tabular-nums">{money(detail.tax_total)}</td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="py-1 text-right text-sm font-bold">
                        {t("sales.common.total", "Total")}
                      </td>
                      <td className="py-1 text-right font-black tabular-nums">{money(detail.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setDetailId(null)}>
              {t("sales.common.close", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
