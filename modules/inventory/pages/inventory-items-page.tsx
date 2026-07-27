"use client";

import * as React from "react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, 
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import {
  fetchInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  adjustInventoryItemStock,
  fetchInventoryCategories,
} from "@/modules/inventory/api";
import type { InventoryItem, PaginatedResponse } from "@/modules/inventory/types";
import { WorkflowTrigger } from "@/modules/workflow/components/workflow-trigger";
import { notifyBulkDeleteOutcomes, notifyMutationOutcome } from "@/modules/workflow/utils/mutation-outcome";

type TableQueryState = {
  page: number;
  pageSize: number;
  search: string;
  sortCol: string;
  sortDir: "asc" | "desc";
};

type InventoryItemForm = {
  id?: number;
  sku: string;
  name: string;
  unit: string;
  category_id?: number | null;
  current_stock: string;
  reorder_level: string;
  cost_price: string;
  selling_price: string;
  is_active: boolean;
};

type StockAdjustmentForm = {
  direction: "in" | "out";
  quantity: string;
  notes?: string;
};

const DEFAULT_QUERY: TableQueryState = {
  page: 1,
  pageSize: 10,
  search: "",
  sortCol: "name",
  sortDir: "asc",
};

const DEFAULT_FORM: InventoryItemForm = {
  sku: "",
  name: "",
  unit: "unit",
  category_id: null,
  current_stock: "0",
  reorder_level: "0",
  cost_price: "0",
  selling_price: "0",
  is_active: true,
};

const DEFAULT_STOCK_FORM: StockAdjustmentForm = {
  direction: "in",
  quantity: "",
  notes: "",
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? fallback;
  }

  return fallback;
};

export default function InventoryItemsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tableQuery, setTableQuery] = React.useState<TableQueryState>(DEFAULT_QUERY);
  const [selectedRowIds, setSelectedRowIds] = React.useState<RowSelectionState>({});
  const [open, setOpen] = React.useState(false);
  const [stockDialogOpen, setStockDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<InventoryItemForm>(DEFAULT_FORM);
  const [stockForm, setStockForm] = React.useState<StockAdjustmentForm>(DEFAULT_STOCK_FORM);
  const [selectedItem, setSelectedItem] = React.useState<InventoryItem | null>(null);

  const itemsQuery = useQuery({
    queryKey: ["inventory", "items", tableQuery],
    queryFn: () =>
      fetchInventoryItems({
        search: tableQuery.search || undefined,
        page: tableQuery.page,
        per_page: tableQuery.pageSize,
        sort_col: tableQuery.sortCol,
        sort_dir: tableQuery.sortDir,
      }),
  });

  const categoriesQuery = useQuery({
    queryKey: ["inventory", "categories"],
    queryFn: () => fetchInventoryCategories(),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        sku: form.sku.trim() || undefined,
        name: form.name.trim(),
        unit: form.unit.trim() || "unit",
        category_id: form.category_id || undefined,
        current_stock: parseFloat(form.current_stock) || 0,
        reorder_level: parseFloat(form.reorder_level) || 0,
        cost_price: parseFloat(form.cost_price) || 0,
        selling_price: parseFloat(form.selling_price) || 0,
        is_active: form.is_active,
      };

      if (form.id) {
        return updateInventoryItem(form.id, payload);
      }

      return createInventoryItem(payload);
    },
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: form.id
          ? t("inventory.common.saved", "Inventory item updated.")
          : t("inventory.common.saved", "Inventory item created."),
        submittedMessage: t("workflow.submitted_for_approval", "Submitted for approval."),
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["inventory", "items"] });
      setSelectedRowIds({});
      closeModal();
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, t("inventory.common.failed", "Failed to save inventory item.")));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInventoryItem,
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: t("inventory.common.deleted", "Inventory item deleted."),
        submittedMessage: t("workflow.submitted_for_approval", "Submitted for approval."),
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["inventory", "items"] });
      setSelectedRowIds({});
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, t("inventory.common.failed", "Failed to delete inventory item.")));
    },
  });

  const stockAdjustmentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem) return;
      return adjustInventoryItemStock(selectedItem.id, {
        direction: stockForm.direction,
        quantity: parseFloat(stockForm.quantity) || 0,
        notes: stockForm.notes || undefined,
      });
    },
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: "Stock adjusted successfully",
        submittedMessage: "Stock adjustment submitted for approval",
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["inventory", "items"] });
      setStockDialogOpen(false);
      setStockForm(DEFAULT_STOCK_FORM);
      setSelectedItem(null);
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, "Failed to adjust stock"));
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

  const openEdit = React.useCallback((item: InventoryItem) => {
    setForm({
      id: item.id,
      sku: item.sku,
      name: item.name,
      unit: item.unit,
      category_id: (item as any).category_id || null,
      current_stock: item.current_stock,
      reorder_level: item.reorder_level,
      cost_price: (item as any).cost_price || "0",
      selling_price: item.selling_price,
      is_active: item.is_active,
    });
    setOpen(true);
  }, []);

  const openStockAdjustment = React.useCallback((item: InventoryItem) => {
    setSelectedItem(item);
    setStockForm(DEFAULT_STOCK_FORM);
    setStockDialogOpen(true);
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
    return `/inventory/items/export?${params.toString()}`;
  }, [tableQuery.search, tableQuery.sortCol, tableQuery.sortDir]);

  const columns = React.useMemo<ColumnDef<InventoryItem>[]>(
    () => [
      {
        accessorKey: "sku",
        header: t("inventory.common.sku", "SKU"),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.sku}</span>
        ),
      },
      {
        accessorKey: "name",
        header: t("inventory.common.name", "Name"),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div>
              <p className="font-semibold">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.unit}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "current_stock",
        header: t("inventory.common.stock", "Stock"),
        cell: ({ row }) => {
          const item = row.original;
          const stock = parseFloat(item.current_stock);
          const reorder = parseFloat(item.reorder_level);
          const isLow = stock <= reorder;
          return (
            <Badge variant={isLow ? "destructive" : "default"}>
              {item.current_stock}
            </Badge>
          );
        },
      },
      {
        accessorKey: "reorder_level",
        header: t("inventory.common.reorder_level", "Reorder Level"),
        cell: ({ row }) => row.original.reorder_level,
      },
      {
        accessorKey: "selling_price",
        header: t("inventory.common.price", "Price"),
        cell: ({ row }) => `ETB ${Number(row.original.selling_price).toLocaleString()}`,
      },
      {
        accessorKey: "is_active",
        header: t("inventory.common.status", "Status"),
        cell: ({ row }) => (
          <Badge variant={row.original.is_active ? "default" : "secondary"}>
            {row.original.is_active ? t("inventory.common.active", "active") : t("inventory.common.inactive", "inactive")}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: t("inventory.common.actions", "Actions"),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex justify-start gap-2">
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEdit(item)}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                {t("inventory.common.edit", "Edit")}
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => openStockAdjustment(item)}>
                <Package className="mr-1 h-3.5 w-3.5" />
                {t("inventory.common.adjust_stock", "Adjust Stock")}
              </Button>
              <WorkflowTrigger
                type="Modules\\Inventory\\Models\\InventoryItem"
                id={item.id}
                name={item.name}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ["inventory", "items"] })}
                showStatusBadge={false}
              />
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
                    <AlertDialogTitle>{t("inventory.items.delete_confirm_title", "Delete Inventory Item?")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("inventory.items.delete_confirm_desc", "This will permanently delete the inventory item. This action cannot be undone.")} <strong>{item.name}</strong>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">{t("inventory.common.cancel", "Cancel")}</AlertDialogCancel>
                    <AlertDialogAction 
                      className="rounded-xl bg-destructive hover:bg-destructive/90"
                      onClick={() => deleteMutation.mutate(item.id)}
                    >
                      {t("inventory.common.confirm", "Confirm Delete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        },
      },
    ],
    [deleteMutation, openEdit, openStockAdjustment, queryClient, t]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("inventory.items.title", "Inventory Items")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("inventory.items.subtitle", "Manage inventory items with stock tracking and reorder levels.")}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t("inventory.items.add_btn", "Add Item")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={(itemsQuery.data as PaginatedResponse<InventoryItem>)?.data ?? []}
        totalEntries={(itemsQuery.data as PaginatedResponse<InventoryItem>)?.total ?? 0}
        loading={itemsQuery.isLoading || itemsQuery.isFetching}
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
            savedMessage: (count) => `${count} ${t("inventory.items.bulk_deleted_msg", "item(s) deleted.")}`,
            submittedMessage: t("workflow.submitted_for_approval", "Submitted for approval."),
            queryClient,
          });
          clearSelection();
        }}
        onQueryChange={handleTableQueryChange}
        onRefresh={() => {
          clearSelection();
          queryClient.invalidateQueries({ queryKey: ["inventory", "items"] });
        }}
        onResetFilters={() => {
          applyTableQuery(DEFAULT_QUERY);
          clearSelection();
        }}
        searchPlaceholder={t("inventory.items.search_placeholder", "Search items...")}
        resourceName="inventory items"
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
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {form.id ? t("inventory.items.edit_title", "Edit Inventory Item") : t("inventory.items.create_title", "Create Inventory Item")}
              </DialogTitle>
              <DialogDescription>
                {t("inventory.items.modal_desc", "Capture complete inventory item master data.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="item-sku">{t("inventory.common.sku", "SKU")}</Label>
                <Input
                  id="item-sku"
                  value={form.sku}
                  onChange={(event) => setForm((prev) => ({ ...prev, sku: event.target.value }))}
                  placeholder="SKU-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-unit">{t("inventory.common.unit", "Unit")}</Label>
                <Input
                  id="item-unit"
                  value={form.unit}
                  onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))}
                  placeholder="unit"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-category">{t("inventory.common.category", "Category")}</Label>
                <Select value={form.category_id?.toString()} onValueChange={(val) => setForm((prev) => ({ ...prev, category_id: val ? parseInt(val) : null }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("inventory.common.select_category", "Select category")} />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriesQuery.data?.data?.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-current-stock">{t("inventory.common.current_stock", "Current Stock")}</Label>
                <Input
                  id="item-current-stock"
                  type="number"
                  step="0.001"
                  value={form.current_stock}
                  onChange={(event) => setForm((prev) => ({ ...prev, current_stock: event.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-reorder-level">{t("inventory.common.reorder_level", "Reorder Level")}</Label>
                <Input
                  id="item-reorder-level"
                  type="number"
                  step="0.001"
                  value={form.reorder_level}
                  onChange={(event) => setForm((prev) => ({ ...prev, reorder_level: event.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-cost-price">{t("inventory.common.cost_price", "Cost Price")}</Label>
                <Input
                  id="item-cost-price"
                  type="number"
                  step="0.01"
                  value={form.cost_price}
                  onChange={(event) => setForm((prev) => ({ ...prev, cost_price: event.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-selling-price">{t("inventory.common.selling_price", "Selling Price")}</Label>
                <Input
                  id="item-selling-price"
                  type="number"
                  step="0.01"
                  value={form.selling_price}
                  onChange={(event) => setForm((prev) => ({ ...prev, selling_price: event.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-name">{t("inventory.common.name", "Item Name")}</Label>
              <Input
                id="item-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Product name"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="item-active"
                checked={form.is_active}
                onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="item-active" className="cursor-pointer">
                {t("inventory.items.active_label", "Active item")}
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
                  toast.error(t("inventory.items.name_required", "Item name is required."));
                  return;
                }
                saveMutation.mutate();
              }}
            >
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {form.id ? t("inventory.common.save", "Save Item") : t("inventory.common.create", "Create Item")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("inventory.items.stock_adjustment_title", "Adjust Stock")}
              </DialogTitle>
              <DialogDescription>
                {selectedItem?.name} - Current: {selectedItem?.current_stock}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="stock-direction">{t("inventory.common.direction", "Direction")}</Label>
              <Select value={stockForm.direction} onValueChange={(val: "in" | "out") => setStockForm((prev) => ({ ...prev, direction: val }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Stock In</SelectItem>
                  <SelectItem value="out">Stock Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock-quantity">{t("inventory.common.quantity", "Quantity")}</Label>
              <Input
                id="stock-quantity"
                type="number"
                step="0.001"
                value={stockForm.quantity}
                onChange={(event) => setStockForm((prev) => ({ ...prev, quantity: event.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock-notes">{t("inventory.common.notes", "Notes")}</Label>
              <Input
                id="stock-notes"
                value={stockForm.notes}
                onChange={(event) => setStockForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Optional notes..."
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setStockDialogOpen(false)}>
              {t("inventory.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={stockAdjustmentMutation.isPending}
              onClick={() => {
                if (!stockForm.quantity || parseFloat(stockForm.quantity) <= 0) {
                  toast.error(t("inventory.items.quantity_required", "Quantity is required."));
                  return;
                }
                stockAdjustmentMutation.mutate();
              }}
            >
              {stockAdjustmentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("inventory.items.adjust_stock", "Adjust Stock")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
