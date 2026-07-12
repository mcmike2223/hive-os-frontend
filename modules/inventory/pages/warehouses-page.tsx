"use client";

import * as React from "react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, 
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  createInventoryEntityRecord,
  deleteInventoryEntityRecord,
  fetchInventoryEntityRecords,
  updateInventoryEntityRecord,
} from "@/modules/inventory/api";
import type { InventoryEntityRecord } from "@/modules/inventory/types";
import { notifyBulkDeleteOutcomes, notifyMutationOutcome } from "@/modules/workflow/utils/mutation-outcome";

type TableQueryState = {
  page: number;
  pageSize: number;
  search: string;
  sortCol: string;
  sortDir: "asc" | "desc";
};

type WarehouseForm = {
  id?: number;
  name: string;
  code: string;
  location: string;
  is_active: boolean;
};

const DEFAULT_QUERY: TableQueryState = {
  page: 1,
  pageSize: 10,
  search: "",
  sortCol: "name",
  sortDir: "asc",
};

const DEFAULT_FORM: WarehouseForm = {
  name: "",
  code: "",
  location: "",
  is_active: true,
};

const getLocation = (record: InventoryEntityRecord): string => {
  const payload = record.payload;
  if (!payload || typeof payload !== "object") return "-";
  const location = (payload as Record<string, unknown>).location;
  return typeof location === "string" && location.trim() ? location : "-";
};

export default function InventoryWarehousesPage() {
  const { t } = useTranslation();

  const queryClient = useQueryClient();
  const [tableQuery, setTableQuery] = React.useState<TableQueryState>(DEFAULT_QUERY);
  const [selectedRowIds, setSelectedRowIds] = React.useState<RowSelectionState>({});
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<WarehouseForm>(DEFAULT_FORM);

  const warehousesQuery = useQuery({
    queryKey: ["inventory", "warehouses", tableQuery],
    queryFn: () =>
      fetchInventoryEntityRecords("warehouses", {
        search: tableQuery.search || undefined,
        page: tableQuery.page,
        per_page: tableQuery.pageSize,
        sort_col: tableQuery.sortCol,
        sort_dir: tableQuery.sortDir,
      }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        is_active: form.is_active,
        payload: {
          location: form.location.trim() || null,
        },
      };

      if (form.id) {
        return updateInventoryEntityRecord("warehouses", form.id, payload);
      }

      return createInventoryEntityRecord("warehouses", payload);
    },
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: form.id
          ? t("inventory.common.saved", "Warehouse updated.")
          : t("inventory.common.saved", "Warehouse created."),
        submittedMessage: t("workflow.submitted_for_approval", "Submitted for approval."),
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["inventory", "warehouses"] });
      setSelectedRowIds({});
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? t("inventory.common.failed", "Failed to save warehouse."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteInventoryEntityRecord("warehouses", id),
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: t("inventory.common.deleted", "Warehouse deleted."),
        submittedMessage: t("workflow.submitted_for_approval", "Submitted for approval."),
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["inventory", "warehouses"] });
      setSelectedRowIds({});
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? t("inventory.common.failed", "Failed to delete warehouse."));
    },
  });

  const applyTableQuery = React.useCallback((nextPartial: Partial<TableQueryState>) => {
    setTableQuery((prev) => {
      const next = { ...prev, ...nextPartial };

      if (
        prev.page === next.page &&
        prev.pageSize === next.pageSize &&
        prev.search === next.search &&
        prev.sortCol === next.sortCol &&
        prev.sortDir === next.sortDir
      ) {
        return prev;
      }

      return next;
    });
  }, []);

  const handleTableQueryChange = React.useCallback(
    (query: DataTableQuery) => {
      applyTableQuery({
        page: Number(query.page || 1),
        pageSize: Number(query.pageSize || 10),
        search: String(query.search ?? ""),
        sortCol: String(query.sortCol || "name"),
        sortDir: query.sortDir === "desc" ? "desc" : "asc",
      });
    },
    [applyTableQuery]
  );

  const clearSelection = React.useCallback(() => setSelectedRowIds({}), []);

  const openCreate = React.useCallback(() => {
    setForm(DEFAULT_FORM);
    setOpen(true);
  }, []);

  const openEdit = React.useCallback((warehouse: InventoryEntityRecord) => {
    setForm({
      id: warehouse.id,
      name: warehouse.name,
      code: warehouse.code ?? "",
      location: getLocation(warehouse) === "-" ? "" : getLocation(warehouse),
      is_active: warehouse.is_active,
    });
    setOpen(true);
  }, []);

  const closeModal = React.useCallback(() => {
    setOpen(false);
    setForm(DEFAULT_FORM);
  }, []);

  const exportUrl = React.useMemo(() => {
    const params = new URLSearchParams();
    if (tableQuery.search) params.set("search", tableQuery.search);
    params.set("sortCol", tableQuery.sortCol);
    params.set("sortDir", tableQuery.sortDir);
    return `/inventory/warehouses/export?${params.toString()}`;
  }, [tableQuery.search, tableQuery.sortCol, tableQuery.sortDir]);

  const columns = React.useMemo<ColumnDef<InventoryEntityRecord>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("inventory.warehouses.col_name", "Warehouse"),
        cell: ({ row }) => {
          const warehouse = row.original;
          return (
            <div>
              <p className="font-semibold">{warehouse.name}</p>
              <p className="text-xs text-muted-foreground">{warehouse.code || t("inventory.common.no_code", "No code")}</p>
            </div>
          );
        },
      },
      {
        id: "location",
        header: t("inventory.warehouses.col_location", "Location"),
        enableSorting: false,
        cell: ({ row }) => getLocation(row.original),
      },
      {
        accessorKey: "is_active",
        header: t("inventory.common.status", "Status"),
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant={row.original.is_active ? "default" : "secondary"}>
            {row.original.is_active ? t("inventory.common.active", "active") : t("inventory.common.inactive", "inactive")}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: t("inventory.common.actions", "Actions"),
        enableSorting: false,
        cell: ({ row }) => {
          const warehouse = row.original;
          return (
            <div className="flex justify-start gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                onClick={() => (window.location.href = `/dashboard/inventory/locations/shelves?warehouse_id=${warehouse.id}`)}
              >
                {t("inventory.warehouses.manage_shelves", "Manage Shelves")}
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEdit(warehouse)}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                {t("inventory.common.edit", "Edit")}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-full"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    {t("inventory.common.delete", "Delete")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("inventory.warehouses.delete_confirm_title", "Delete Warehouse?")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("inventory.warehouses.delete_confirm_desc", "This will permanently delete the warehouse. All associated data will be affected.")} <strong>{warehouse.name}</strong>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">{t("inventory.common.cancel", "Cancel")}</AlertDialogCancel>
                    <AlertDialogAction 
                      className="rounded-xl bg-destructive hover:bg-destructive/90"
                      onClick={() => deleteMutation.mutate(warehouse.id)}
                    >
                      {t("inventory.common.confirm", "Confirm Delete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        },
        meta: { align: "left" as const },
      },
    ],
    [deleteMutation, openEdit, t]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("inventory.warehouses.title", "Warehouses")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("inventory.warehouses.subtitle", "Warehouse setup with location metadata and export-ready datatable workflows.")}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t("inventory.warehouses.add_btn", "Add Warehouse")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={warehousesQuery.data?.data ?? []}
        totalEntries={warehousesQuery.data?.total ?? 0}
        loading={warehousesQuery.isLoading || warehousesQuery.isFetching}
        exportEndpoint={exportUrl}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        enableRowSelection
        selectedRowIds={selectedRowIds}
        onSelectionChange={(payload) => setSelectedRowIds(payload.selectedRowIds as RowSelectionState)}
        onDeleteRows={async (rows) => {
          if (rows.length === 0) return;
          const results = await Promise.all(rows.map((row) => deleteMutation.mutateAsync(row.id)));
          notifyBulkDeleteOutcomes(results, {
            savedMessage: (count) => `${count} ${t("inventory.warehouses.bulk_deleted_msg", "warehouse(s) deleted.")}`,
            submittedMessage: t("workflow.submitted_for_approval", "Submitted for approval."),
            queryClient,
          });
          clearSelection();
        }}
        onQueryChange={handleTableQueryChange}
        onRefresh={() => {
          clearSelection();
          queryClient.invalidateQueries({ queryKey: ["inventory", "warehouses"] });
        }}
        onResetFilters={() => {
          applyTableQuery(DEFAULT_QUERY);
          clearSelection();
        }}
        searchPlaceholder={t("inventory.warehouses.search_placeholder", "Search warehouses by name or code...")}
        resourceName="warehouses"
        syncWithUrl={false}
      />

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeModal();
            return;
          }
          setOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {form.id ? t("inventory.warehouses.edit_title", "Edit Warehouse") : t("inventory.warehouses.create_title", "Create Warehouse")}
              </DialogTitle>
              <DialogDescription>
                {t("inventory.warehouses.modal_desc", "Define active storage facilities.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="warehouse-name">{t("inventory.warehouses.name_label", "Warehouse Name")}</Label>
              <Input
                id="warehouse-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Main Store"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="warehouse-code">{t("inventory.common.code", "Code")}</Label>
              <Input
                id="warehouse-code"
                value={form.code}
                onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                placeholder="WH-MAIN"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="warehouse-location">{t("inventory.warehouses.location_label", "Location")}</Label>
              <Input
                id="warehouse-location"
                value={form.location}
                onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                placeholder="Nairobi"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="warehouse-active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked === true }))}
              />
              <Label htmlFor="warehouse-active" className="cursor-pointer">
                {t("inventory.warehouses.active_label", "Warehouse is active")}
              </Label>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={closeModal}>
              {t("inventory.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={saveMutation.isPending}
              onClick={() => {
                if (!form.name.trim()) {
                  toast.error(t("inventory.warehouses.name_required", "Warehouse name is required."));
                  return;
                }
                saveMutation.mutate();
              }}
            >
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {form.id ? t("inventory.common.save", "Save Warehouse") : t("inventory.common.create", "Create Warehouse")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
