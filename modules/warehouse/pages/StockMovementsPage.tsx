"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Plus, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { warehouseApi } from "@/modules/warehouse/api";
import { WorkflowTrigger } from "@/modules/workflow/components/workflow-trigger";
import { notifyMutationOutcome } from "@/modules/workflow/utils/mutation-outcome";

type TableQueryState = {
  page: number;
  pageSize: number;
  search: string;
  sortCol: string;
  sortDir: "asc" | "desc";
};

const DEFAULT_QUERY: TableQueryState = {
  page: 1,
  pageSize: 10,
  search: "",
  sortCol: "created_at",
  sortDir: "desc",
};

type StockMovementRow = {
  id: number;
  type: string;
  quantity: number | string;
  batch_number?: string | null;
  created_at: string;
  from_location?: { name?: string | null } | null;
  to_location?: { name?: string | null } | null;
};

type MovementForm = {
  product_id: number;
  from_location_id?: number | null;
  to_location_id: number;
  type: "transfer" | "adjustment" | "receipt" | "issue";
  quantity: string;
  unit_cost?: string;
  batch_number?: string;
  serial_number?: string;
  expiry_date?: string;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
};

const DEFAULT_MOVEMENT_FORM: MovementForm = {
  product_id: 0,
  from_location_id: null,
  to_location_id: 0,
  type: "transfer",
  quantity: "",
  unit_cost: "",
  batch_number: "",
  serial_number: "",
  expiry_date: "",
  reference_type: "",
  reference_id: "",
  notes: "",
};

export default function StockMovementsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tableQuery, setTableQuery] = React.useState<TableQueryState>(DEFAULT_QUERY);
  const [movementDialogOpen, setMovementDialogOpen] = React.useState(false);
  const [movementForm, setMovementForm] = React.useState<MovementForm>(DEFAULT_MOVEMENT_FORM);

  const movementsQuery = useQuery({
    queryKey: ["warehouse", "movements", tableQuery],
    queryFn: () =>
      warehouseApi.listMovements({
        search: tableQuery.search || undefined,
        page: tableQuery.page,
        limit: tableQuery.pageSize,
        sort_col: tableQuery.sortCol,
        sort_dir: tableQuery.sortDir,
      }).then(res => res.data),
  });

  const applyTableQuery = React.useCallback((nextPartial: Partial<TableQueryState>) => {
    setTableQuery((prev) => ({ ...prev, ...nextPartial }));
  }, []);

  const handleTableQueryChange = React.useCallback(
    (query: DataTableQuery) => {
      applyTableQuery({
        page: Number(query.page || 1),
        pageSize: Number(query.pageSize || 10),
        search: String(query.search ?? ""),
        sortCol: String(query.sortCol || "created_at"),
        sortDir: query.sortDir === "asc" ? "asc" : "desc",
      });
    },
    [applyTableQuery]
  );

  const createMovementMutation = useMutation({
    mutationFn: warehouseApi.createMovement,
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: "Stock movement created successfully",
        submittedMessage: "Stock movement submitted for approval",
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["warehouse", "movements"] });
      setMovementDialogOpen(false);
      setMovementForm(DEFAULT_MOVEMENT_FORM);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to create stock movement");
    },
  });

  const openCreateMovement = React.useCallback(() => {
    setMovementForm(DEFAULT_MOVEMENT_FORM);
    setMovementDialogOpen(true);
  }, []);

  const columns = React.useMemo<ColumnDef<StockMovementRow>[]>(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        cell: ({ row }) => <span className="font-mono text-xs">#{row.original.id}</span>,
      },
      {
        accessorKey: "type",
        header: t("inventory.common.type", "Type"),
        cell: ({ row }) => (
          <Badge variant="outline" className="uppercase text-[10px] tracking-widest font-black">
            {row.original.type}
          </Badge>
        ),
      },
      {
        id: "movement",
        header: t("inventory.movements.col_movement", "Movement"),
        cell: ({ row }) => {
          const move = row.original;
          return (
            <div className="flex items-center gap-2">
              <span className="font-medium text-xs">{move.from_location?.name || "EXTERNAL"}</span>
              <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium text-xs">{move.to_location?.name || "EXTERNAL"}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "quantity",
        header: t("inventory.common.quantity", "Qty"),
        cell: ({ row }) => <span className="font-bold">{row.original.quantity}</span>,
      },
      {
        accessorKey: "batch_number",
        header: t("inventory.common.batch", "Batch"),
        cell: ({ row }) => <span className="text-xs">{row.original.batch_number || "-"}</span>,
      },
      {
        accessorKey: "created_at",
        header: t("inventory.common.date", "Date"),
        cell: ({ row }) => new Date(row.original.created_at).toLocaleString(),
      },
      {
        id: "actions",
        header: t("inventory.common.actions", "Actions"),
        cell: ({ row }) => {
          const move = row.original;
          return (
            <div className="flex items-center gap-2">
              <WorkflowTrigger
                type="Modules\\Warehouse\\Models\\StockMovement"
                id={Number(move.id)}
                name={`Movement #${move.id} (${move.type})`}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ["warehouse", "movements"] })}
                showStatusBadge={false}
              />
            </div>
          );
        },
      },
    ],
    [queryClient, t]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("inventory.movements.title", "Stock Movements")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("inventory.movements.subtitle", "Internal transfers, adjustments, and movement logs.")}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={openCreateMovement}>
          <Plus className="mr-2 h-4 w-4" />
          {t("inventory.movements.add_btn", "Add Movement")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={(movementsQuery.data?.data ?? []) as StockMovementRow[]}
        totalEntries={movementsQuery.data?.meta?.total ?? 0}
        loading={movementsQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("inventory.movements.search_placeholder", "Search by batch or notes...")}
        resourceName="movements"
      />

      <Dialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("inventory.movements.create_title", "Create Stock Movement")}
              </DialogTitle>
              <DialogDescription>
                {t("inventory.movements.create_desc", "Record a stock movement between warehouse locations.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="movement-type">{t("inventory.common.type", "Type")}</Label>
                <Select value={movementForm.type} onValueChange={(val: "transfer" | "adjustment" | "receipt" | "issue") => setMovementForm((prev) => ({ ...prev, type: val }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="adjustment">Adjustment</SelectItem>
                    <SelectItem value="receipt">Receipt</SelectItem>
                    <SelectItem value="issue">Issue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="movement-quantity">{t("inventory.common.quantity", "Quantity")}</Label>
                <Input
                  id="movement-quantity"
                  type="number"
                  step="0.001"
                  value={movementForm.quantity}
                  onChange={(event) => setMovementForm((prev) => ({ ...prev, quantity: event.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="movement-product">{t("inventory.common.product_id", "Product ID")}</Label>
                <Input
                  id="movement-product"
                  type="number"
                  value={movementForm.product_id || ""}
                  onChange={(event) => setMovementForm((prev) => ({ ...prev, product_id: parseInt(event.target.value) || 0 }))}
                  placeholder="Product ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="movement-to-location">{t("inventory.common.to_location", "To Location")}</Label>
                <Input
                  id="movement-to-location"
                  type="number"
                  value={movementForm.to_location_id || ""}
                  onChange={(event) => setMovementForm((prev) => ({ ...prev, to_location_id: parseInt(event.target.value) || 0 }))}
                  placeholder="Location ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="movement-from-location">{t("inventory.common.from_location", "From Location")}</Label>
                <Input
                  id="movement-from-location"
                  type="number"
                  value={movementForm.from_location_id || ""}
                  onChange={(event) => setMovementForm((prev) => ({ ...prev, from_location_id: parseInt(event.target.value) || null }))}
                  placeholder="Location ID (optional)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="movement-unit-cost">{t("inventory.common.unit_cost", "Unit Cost")}</Label>
                <Input
                  id="movement-unit-cost"
                  type="number"
                  step="0.01"
                  value={movementForm.unit_cost}
                  onChange={(event) => setMovementForm((prev) => ({ ...prev, unit_cost: event.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="movement-batch">{t("inventory.common.batch", "Batch Number")}</Label>
                <Input
                  id="movement-batch"
                  value={movementForm.batch_number}
                  onChange={(event) => setMovementForm((prev) => ({ ...prev, batch_number: event.target.value }))}
                  placeholder="BATCH-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="movement-serial">{t("inventory.common.serial", "Serial Number")}</Label>
                <Input
                  id="movement-serial"
                  value={movementForm.serial_number}
                  onChange={(event) => setMovementForm((prev) => ({ ...prev, serial_number: event.target.value }))}
                  placeholder="SN-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="movement-expiry">{t("inventory.common.expiry", "Expiry Date")}</Label>
                <Input
                  id="movement-expiry"
                  type="date"
                  value={movementForm.expiry_date}
                  onChange={(event) => setMovementForm((prev) => ({ ...prev, expiry_date: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="movement-notes">{t("inventory.common.notes", "Notes")}</Label>
              <Input
                id="movement-notes"
                value={movementForm.notes}
                onChange={(event) => setMovementForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Optional notes..."
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setMovementDialogOpen(false)}>
              {t("inventory.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={createMovementMutation.isPending}
              onClick={() => {
                if (!movementForm.product_id || !movementForm.to_location_id || !movementForm.quantity) {
                  toast.error(t("inventory.movements.required_fields", "Product, To Location, and Quantity are required."));
                  return;
                }
                createMovementMutation.mutate(movementForm);
              }}
            >
              {createMovementMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("inventory.movements.create", "Create Movement")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
