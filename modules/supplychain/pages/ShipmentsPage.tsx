"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PackageCheck, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supplyChainApi } from "@/modules/supplychain/api";
import type { DeliveryRoute, Shipment } from "@/modules/supplychain/types";
import { ShipmentStatusBadge } from "@/modules/shared/charts/primitives";

/** Mirrors the server state machine so an impossible move is never offered. */
const NEXT: Record<string, string[]> = {
  draft: ["planned", "cancelled"],
  planned: ["loaded", "draft", "cancelled"],
  loaded: ["in_transit", "planned", "cancelled"],
  in_transit: [],
  partially_delivered: [],
  delivered: [],
  failed: ["planned", "cancelled"],
  cancelled: [],
};

const FAILURE_REASONS = ["customer_absent", "refused", "access_blocked", "vehicle_breakdown", "other"];

type LineDraft = { product_id: string; quantity: string; unit_price: string; batch_number: string };

const EMPTY_LINE: LineDraft = { product_id: "", quantity: "", unit_price: "", batch_number: "" };

export default function ShipmentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [delivering, setDelivering] = React.useState<Shipment | null>(null);
  const [deliveredLines, setDeliveredLines] = React.useState<Record<number, string>>({});
  const [proof, setProof] = React.useState({ received_by_name: "", proof_reference: "", failure_reason: "" });

  const [form, setForm] = React.useState({
    customer_contact_id: "",
    route_id: "",
    origin_warehouse_id: "",
    origin_location_id: "",
    destination_name: "",
    destination_address: "",
    destination_phone: "",
    vehicle: "",
    planned_dispatch_at: "",
    items: [{ ...EMPTY_LINE }] as LineDraft[],
  });

  const shipmentsQuery = useQuery({
    queryKey: ["supply-chain", "shipments", tableQuery, statusFilter],
    queryFn: () =>
      supplyChainApi
        .listShipments({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
        })
        .then((r) => r.data),
  });

  const routesQuery = useQuery({
    queryKey: ["supply-chain", "routes", "select"],
    queryFn: () => supplyChainApi.listRoutes({ limit: 100, is_active: true }).then((r) => r.data),
  });

  const routes: DeliveryRoute[] = routesQuery.data?.data ?? [];

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["supply-chain"] });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: () =>
      supplyChainApi.createShipment({
        customer_contact_id: form.customer_contact_id ? Number(form.customer_contact_id) : undefined,
        route_id: form.route_id ? Number(form.route_id) : undefined,
        origin_warehouse_id: form.origin_warehouse_id ? Number(form.origin_warehouse_id) : undefined,
        origin_location_id: form.origin_location_id ? Number(form.origin_location_id) : undefined,
        destination_name: form.destination_name || undefined,
        destination_address: form.destination_address || undefined,
        destination_phone: form.destination_phone || undefined,
        vehicle: form.vehicle || undefined,
        planned_dispatch_at: form.planned_dispatch_at || undefined,
        items: form.items
          .filter((line) => line.product_id && line.quantity)
          .map((line) => ({
            product_id: Number(line.product_id),
            quantity: Number(line.quantity),
            unit_price: line.unit_price ? Number(line.unit_price) : undefined,
            batch_number: line.batch_number || undefined,
          })),
      }),
    onSuccess: (response) => {
      const shipment = response?.data?.data as Shipment | undefined;
      toast.success(
        shipment
          ? t("supply_chain.shipments.created", "Shipment {number} created.").replace("{number}", shipment.shipment_number)
          : t("supply_chain.shipments.created_generic", "Shipment created."),
      );
      invalidate();
      setCreateOpen(false);
      setForm((f) => ({ ...f, items: [{ ...EMPTY_LINE }] }));
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || t("supply_chain.shipments.create_failed", "Could not create the shipment.")),
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => supplyChainApi.transitionShipment(id, status),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("supply_chain.common.updated", "Updated."));
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || t("supply_chain.common.update_failed", "Could not update.")),
  });

  const deliverMutation = useMutation({
    mutationFn: () =>
      supplyChainApi.recordDelivery(delivering!.id, {
        items: (delivering!.items ?? []).map((item) => ({
          item_id: item.id,
          delivered_quantity: Number(deliveredLines[item.id] ?? item.quantity),
        })),
        received_by_name: proof.received_by_name || undefined,
        proof_reference: proof.proof_reference || undefined,
        failure_reason: proof.failure_reason || undefined,
      }),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("supply_chain.shipments.delivered", "Delivery recorded."));
      invalidate();
      setDelivering(null);
      setProof({ received_by_name: "", proof_reference: "", failure_reason: "" });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || t("supply_chain.shipments.deliver_failed", "Could not record the delivery.")),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const columns = React.useMemo<ColumnDef<Shipment>[]>(
    () => [
      {
        accessorKey: "shipment_number",
        header: t("supply_chain.shipments.col_shipment", "Shipment"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.shipment_number}</p>
            <p className="text-[11px] text-muted-foreground">{row.original.destination_name ?? "—"}</p>
          </div>
        ),
      },
      {
        id: "route",
        header: t("supply_chain.common.route", "Route"),
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs">
            <p>{row.original.route?.name ?? "—"}</p>
            <p className="text-muted-foreground">{row.original.vehicle ?? "—"}</p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: t("supply_chain.common.status", "Status"),
        cell: ({ row }) => <ShipmentStatusBadge status={row.original.status} />,
      },
      {
        id: "fill",
        header: t("supply_chain.shipments.col_fill", "Loaded / Delivered"),
        cell: ({ row }) => {
          const items = row.original.items ?? [];
          const loaded = items.reduce((sum, i) => sum + Number(i.quantity), 0);
          const delivered = items.reduce((sum, i) => sum + Number(i.delivered_quantity), 0);
          return (
            <div className="space-y-0.5 tabular-nums">
              <p className="text-sm">{loaded.toLocaleString()} → {delivered.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">{row.original.fill_rate_percent.toFixed(1)}% fill</p>
            </div>
          );
        },
      },
      {
        id: "dates",
        header: t("supply_chain.shipments.col_dates", "Planned / Delivered"),
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs">
            <p>{row.original.planned_dispatch_at ? new Date(row.original.planned_dispatch_at).toLocaleDateString() : "—"}</p>
            <p className="text-muted-foreground">
              {row.original.delivered_at ? new Date(row.original.delivered_at).toLocaleDateString() : "—"}
            </p>
          </div>
        ),
      },
      {
        id: "actions",
        header: t("supply_chain.common.actions", "Actions"),
        cell: ({ row }) => {
          const shipment = row.original;
          const next = NEXT[shipment.status] ?? [];
          const canDeliver = ["in_transit", "partially_delivered"].includes(shipment.status);

          return (
            <div className="flex flex-wrap items-center gap-1.5">
              {next.length > 0 ? (
                <Select value="" onValueChange={(status) => transitionMutation.mutate({ id: shipment.id, status })}>
                  <SelectTrigger className="h-8 w-[8.5rem] text-xs">
                    <SelectValue placeholder={t("supply_chain.common.move_to", "Move to...")} />
                  </SelectTrigger>
                  <SelectContent>
                    {next.map((status) => (
                      <SelectItem key={status} value={status} className="text-xs">
                        {status.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              {canDeliver ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => {
                    setDelivering(shipment);
                    setDeliveredLines(
                      Object.fromEntries((shipment.items ?? []).map((i) => [i.id, String(i.quantity)])),
                    );
                  }}
                >
                  <PackageCheck className="h-3 w-3" />
                  {t("supply_chain.shipments.deliver", "Deliver")}
                </Button>
              ) : null}
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
          <h1 className="text-3xl font-black tracking-tight">{t("supply_chain.shipments.title", "Shipments")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "supply_chain.shipments.subtitle",
              "Stock leaves the books at despatch. Anything the customer does not take comes back onto the store count automatically.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("supply_chain.shipments.add", "New Shipment")}
        </Button>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">{t("supply_chain.common.status", "Status")}</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[12rem]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("supply_chain.common.all", "All")}</SelectItem>
            {Object.keys(NEXT).map((status) => (
              <SelectItem key={status} value={status}>{status.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={(shipmentsQuery.data?.data ?? []) as Shipment[]}
        totalEntries={shipmentsQuery.data?.meta?.total ?? 0}
        loading={shipmentsQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("supply_chain.shipments.search", "Search by number or destination...")}
        resourceName="shipments"
      />

      {/* Create shipment */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("supply_chain.shipments.new", "New Shipment")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "supply_chain.shipments.new_desc",
                  "Set the origin location to have the stock issue posted automatically when the load leaves.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="sh-customer">{t("supply_chain.shipments.customer", "Customer contact ID")}</Label>
                <Input id="sh-customer" type="number" value={form.customer_contact_id} onChange={(e) => setForm((f) => ({ ...f, customer_contact_id: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("supply_chain.common.route", "Route")}</Label>
                <Select value={form.route_id} onValueChange={(v) => setForm((f) => ({ ...f, route_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("supply_chain.shipments.select_route", "Select a round")} /></SelectTrigger>
                  <SelectContent>
                    {routes.map((route) => (
                      <SelectItem key={route.id} value={String(route.id)}>{route.code} — {route.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sh-vehicle">{t("supply_chain.shipments.vehicle", "Vehicle")}</Label>
                <Input id="sh-vehicle" value={form.vehicle} onChange={(e) => setForm((f) => ({ ...f, vehicle: e.target.value }))} placeholder="AA-3-12345" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sh-warehouse">{t("supply_chain.common.warehouse_id", "Origin warehouse ID")}</Label>
                <Input id="sh-warehouse" type="number" value={form.origin_warehouse_id} onChange={(e) => setForm((f) => ({ ...f, origin_warehouse_id: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sh-location">{t("supply_chain.shipments.origin_location", "Origin location ID")}</Label>
                <Input id="sh-location" type="number" value={form.origin_location_id} onChange={(e) => setForm((f) => ({ ...f, origin_location_id: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sh-planned">{t("supply_chain.shipments.planned", "Planned despatch")}</Label>
                <Input id="sh-planned" type="datetime-local" value={form.planned_dispatch_at} onChange={(e) => setForm((f) => ({ ...f, planned_dispatch_at: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sh-dest">{t("supply_chain.shipments.destination", "Destination")}</Label>
                <Input id="sh-dest" value={form.destination_name} onChange={(e) => setForm((f) => ({ ...f, destination_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sh-phone">{t("supply_chain.shipments.phone", "Phone")}</Label>
                <Input id="sh-phone" value={form.destination_phone} onChange={(e) => setForm((f) => ({ ...f, destination_phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sh-address">{t("supply_chain.shipments.address", "Address")}</Label>
                <Input id="sh-address" value={form.destination_address} onChange={(e) => setForm((f) => ({ ...f, destination_address: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">{t("supply_chain.shipments.lines", "Load")}</p>
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
                  <div className="md:col-span-2">
                    <Label className="text-[11px]">{t("supply_chain.common.unit_price", "Unit price")}</Label>
                    <Input type="number" className="h-9" value={line.unit_price} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((l, i) => (i === index ? { ...l, unit_price: e.target.value } : l)) }))} />
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-[11px]">{t("supply_chain.common.batch", "Batch / lot")}</Label>
                    <Input className="h-9" value={line.batch_number} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((l, i) => (i === index ? { ...l, batch_number: e.target.value } : l)) }))} />
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
                  toast.error(t("supply_chain.shipments.line_required", "Add at least one line to the load."));
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

      {/* Record delivery */}
      <Dialog open={delivering !== null} onOpenChange={(open) => !open && setDelivering(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("supply_chain.shipments.record_delivery", "Record Delivery")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "supply_chain.shipments.record_desc",
                  "Enter what the customer actually took. Anything left on the truck is returned to stock automatically.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
            {(delivering?.items ?? []).map((item) => (
              <div key={item.id} className="grid items-end gap-3 rounded-xl border border-border/40 p-3 md:grid-cols-3">
                <div>
                  <p className="text-sm font-semibold">{item.product?.name ?? `#${item.product_id}`}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("supply_chain.shipments.loaded", "Loaded")} {Number(item.quantity).toLocaleString()} {item.uom}
                    {item.batch_number ? ` · ${item.batch_number}` : ""}
                  </p>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor={`deliver-${item.id}`} className="text-xs">
                    {t("supply_chain.shipments.delivered_qty", "Delivered quantity")}
                  </Label>
                  <Input
                    id={`deliver-${item.id}`}
                    type="number"
                    className="h-9"
                    max={Number(item.quantity)}
                    value={deliveredLines[item.id] ?? ""}
                    onChange={(e) => setDeliveredLines((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                </div>
              </div>
            ))}

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="pod-name">{t("supply_chain.shipments.received_by", "Received by")}</Label>
                <Input id="pod-name" value={proof.received_by_name} onChange={(e) => setProof((p) => ({ ...p, received_by_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pod-ref">{t("supply_chain.shipments.proof", "Proof reference")}</Label>
                <Input id="pod-ref" value={proof.proof_reference} onChange={(e) => setProof((p) => ({ ...p, proof_reference: e.target.value }))} placeholder="pod/2026-08-15/001.jpg" />
              </div>
              <div className="space-y-2">
                <Label>{t("supply_chain.shipments.failure_reason", "Failure reason")}</Label>
                <Select value={proof.failure_reason} onValueChange={(v) => setProof((p) => ({ ...p, failure_reason: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("supply_chain.shipments.if_failed", "If nothing was taken")} /></SelectTrigger>
                  <SelectContent>
                    {FAILURE_REASONS.map((reason) => (
                      <SelectItem key={reason} value={reason}>{reason.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setDelivering(null)}>
              {t("supply_chain.common.cancel", "Cancel")}
            </Button>
            <Button className="rounded-full" disabled={deliverMutation.isPending} onClick={() => deliverMutation.mutate()}>
              {deliverMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("supply_chain.shipments.confirm_delivery", "Confirm Delivery")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
