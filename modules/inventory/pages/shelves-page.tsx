"use client";

import * as React from "react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, CheckCircle2, ChevronRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import {
  createInventoryEntityRecord,
  deleteInventoryEntityRecord,
  fetchInventoryEntityRecords,
  fetchInventoryProduct,
  updateInventoryEntityRecord,
} from "@/modules/inventory/api";
import type { InventoryEntityRecord } from "@/modules/inventory/types";
import { notifyMutationOutcome } from "@/modules/workflow/utils/mutation-outcome";

type TableQueryState = {
  page: number;
  pageSize: number;
  search: string;
  sortCol: string;
  sortDir: "asc" | "desc";
  warehouse_id?: string;
};

type ShelfForm = {
  id?: number;
  name: string;
  code: string;
  parent_id: string;
  rows: string;
  columns: string;
  capacity: string;
  description: string;
  is_active: boolean;
  image: File | null;
  imagePreview: string;
};

const DEFAULT_QUERY: TableQueryState = {
  page: 1,
  pageSize: 10,
  search: "",
  sortCol: "name",
  sortDir: "asc",
};

const DEFAULT_FORM: ShelfForm = {
  name: "",
  code: "",
  parent_id: "",
  rows: "1",
  columns: "1",
  capacity: "1",
  description: "",
  is_active: true,
  image: null,
  imagePreview: "",
};

const readPayloadString = (record: InventoryEntityRecord, key: string, fallback = ""): string => {
  let payload = record.payload;
  
  // Handle case where payload might be a JSON string (rare but possible with some DB setups)
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return fallback;
    }
  }

  if (!payload || typeof payload !== "object") return fallback;
  
  const value = (payload as Record<string, unknown>)[key];
  return value == null ? fallback : String(value);
};

const calculateTotalBoxes = (record: InventoryEntityRecord): number => {
  const rows = Number(readPayloadString(record, "rows", "0"));
  const cols = Number(readPayloadString(record, "columns", "0"));
  return rows * cols;
};

export default function InventoryShelvesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const addProductId = searchParams.get("add_product_id");

  const [tableQuery, setTableQuery] = React.useState<TableQueryState>({
    ...DEFAULT_QUERY,
    warehouse_id: searchParams.get("warehouse_id") || undefined,
  });
  const [selectedRowIds, setSelectedRowIds] = React.useState<RowSelectionState>({});
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<ShelfForm>(DEFAULT_FORM);

  const prodQuery = useQuery({
    queryKey: ["inventory", "products", "detail", addProductId],
    queryFn: () => (addProductId ? fetchInventoryProduct(Number(addProductId)) : null),
    enabled: !!addProductId,
  });

  const shelvesQuery = useQuery({
    queryKey: ["inventory", "shelves", tableQuery],
    queryFn: () =>
      fetchInventoryEntityRecords("shelves", {
        search: tableQuery.search || undefined,
        page: tableQuery.page,
        per_page: tableQuery.pageSize,
        sort_col: tableQuery.sortCol,
        sort_dir: tableQuery.sortDir,
        parent_id: tableQuery.warehouse_id || undefined,
      }),
  });

  const warehousesQuery = useQuery({
    queryKey: ["inventory", "warehouses", "options"],
    queryFn: () =>
      fetchInventoryEntityRecords("warehouses", {
        per_page: 200,
      }),
    enabled: open || !!addProductId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const isMultipart = form.image instanceof File;

      const payload = isMultipart
        ? (() => {
            const formData = new FormData();
            formData.append("name", form.name.trim());
            if (form.code) formData.append("code", form.code.trim());
            if (form.parent_id) formData.append("parent_id", form.parent_id);
            formData.append("is_active", String(form.is_active));
            formData.append("payload", JSON.stringify({
              rows: Number(form.rows || "1"),
              columns: Number(form.columns || "1"),
              capacity: Number(form.capacity || "1"),
              description: form.description.trim() || null,
            }));
            if (form.image) formData.append("image", form.image);
            return formData;
          })()
        : {
            name: form.name.trim(),
            code: form.code.trim() || null,
            parent_id: form.parent_id ? Number(form.parent_id) : null,
            is_active: form.is_active,
            payload: {
              rows: Number(form.rows || "1"),
              columns: Number(form.columns || "1"),
              capacity: Number(form.capacity || "1"),
              description: form.description.trim() || null,
            },
          };

      if (form.id) {
        return updateInventoryEntityRecord("shelves", form.id, payload);
      }

      return createInventoryEntityRecord("shelves", payload);
    },
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: form.id
          ? t("inventory.common.saved", "Shelf updated.")
          : t("inventory.common.saved", "Shelf created."),
        submittedMessage: t("workflow.submitted_for_approval", "Submitted for approval."),
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["inventory", "shelves"] });
      setSelectedRowIds({});
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? t("inventory.common.failed", "Failed to save shelf."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteInventoryEntityRecord("shelves", id),
    onSuccess: () => {
      toast.success(t("inventory.common.deleted", "Shelf deleted."));
      queryClient.invalidateQueries({ queryKey: ["inventory", "shelves"] });
      setSelectedRowIds({});
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? t("inventory.common.failed", "Failed to delete shelf."));
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
    setForm({
      ...DEFAULT_FORM,
      parent_id: tableQuery.warehouse_id || "",
    });
    setOpen(true);
  }, [tableQuery.warehouse_id]);

  const openEdit = React.useCallback((shelf: InventoryEntityRecord) => {
    setForm({
      id: shelf.id,
      name: shelf.name,
      code: shelf.code ?? "",
      parent_id: shelf.parent_id ? String(shelf.parent_id) : "",
      rows: readPayloadString(shelf, "rows", "1"),
      columns: readPayloadString(shelf, "columns", "1"),
      capacity: readPayloadString(shelf, "capacity", "1"),
      description: readPayloadString(shelf, "description", ""),
      is_active: shelf.is_active,
      image: null,
      imagePreview: (shelf.image as string) || ((shelf.payload?.image as string) || ""),
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
    return `/inventory/shelves/export?${params.toString()}`;
  }, [tableQuery.search, tableQuery.sortCol, tableQuery.sortDir]);

  const columns = React.useMemo<ColumnDef<InventoryEntityRecord>[]>(
    () => [
      {
        accessorKey: "image",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const imageUrl = (row.original.image as string) || (row.original.payload?.image as string);
          return imageUrl ? (
            <img src={imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <Box className="h-5 w-5 text-muted-foreground" />
            </div>
          );
        },
        meta: { align: "left" as const },
      },
      {
        accessorKey: "name",
        header: t("inventory.shelves.col_name", "Shelf"),
        cell: ({ row }) => {
          const shelf = row.original;
          return (
            <div>
              <p className="font-semibold">{shelf.name}</p>
              <p className="text-xs text-muted-foreground">{shelf.code || t("inventory.common.no_code", "No code")}</p>
            </div>
          );
        },
      },
      {
        id: "dimensions",
        header: t("inventory.shelves.col_dimensions", "Dimensions"),
        enableSorting: false,
        cell: ({ row }) => {
          const r = readPayloadString(row.original, "rows", "0");
          const c = readPayloadString(row.original, "columns", "0");
          return `${r} Ã— ${c}`;
        },
        meta: { align: "right" as const },
      },
      {
        id: "capacity_per_box",
        header: t("inventory.shelves.col_capacity_per_box", "Capacity/Box"),
        enableSorting: false,
        cell: ({ row }) => readPayloadString(row.original, "capacity", "0"),
        meta: { align: "right" as const },
      },
      {
        id: "total_boxes",
        header: t("inventory.shelves.col_total_boxes", "Total Boxes"),
        enableSorting: false,
        cell: ({ row }) => {
          const total = calculateTotalBoxes(row.original);
          return (
            <span className="font-semibold text-primary">
              {total > 0 ? total : "â€”"}
            </span>
          );
        },
        meta: { align: "right" as const },
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
        meta: { align: "center" as const },
      },
      {
        id: "actions",
        header: t("inventory.common.actions", "Actions"),
        enableSorting: false,
        cell: ({ row }) => {
          const shelf = row.original;
          return (
            <div className="flex justify-start gap-2">
              {addProductId ? (
                <Button
                  size="sm"
                  className="rounded-full bg-blue-600 px-4 font-bold text-white hover:bg-blue-700"
                  onClick={() =>
                    router.push(`/dashboard/inventory/locations/shelves/${shelf.id}/boxes?add_product_id=${addProductId}`)
                  }
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  {t("inventory.shelves.assign_here", "Assign Here")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/20 border-indigo-500/20 dark:text-indigo-400 dark:hover:bg-indigo-500/30"
                  onClick={() => router.push(`/dashboard/inventory/locations/shelves/${shelf.id}/boxes`)}
                >
                  <Box className="mr-1 h-3.5 w-3.5" />
                  {t("inventory.shelves.manage_boxes", "Manage Boxes")}
                </Button>
              )}
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEdit(shelf)}>
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
                    <AlertDialogTitle>{t("inventory.shelves.delete_confirm_title", "Delete Shelf?")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("inventory.shelves.delete_confirm_desc", "This will permanently delete the shelf. Boxes and items on this shelf will be affected.")} <strong>{shelf.name}</strong>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">{t("inventory.common.cancel", "Cancel")}</AlertDialogCancel>
                    <AlertDialogAction 
                      className="rounded-xl bg-destructive hover:bg-destructive/90"
                      onClick={() => deleteMutation.mutate(shelf.id)}
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
    [deleteMutation, openEdit, addProductId, router, t]
  );

  return (
    <div className="space-y-6">
      {addProductId && (
        <div className="flex items-center justify-between rounded-3xl border border-border bg-muted/50 p-4 mb-6 transition-all animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-foreground">{t("inventory.shelves.guided_mode", "Guided Assignment Mode")}</p>
              <p className="text-xs font-medium text-muted-foreground">
                {t("inventory.shelves.pick_shelf", "Pick a shelf to store")} <span className="font-bold underline text-primary">{prodQuery.data?.product.name ?? "Loading..."}</span>
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="rounded-full font-bold" 
            onClick={() => router.push("/dashboard/inventory/catalog/products")}
          >
            {t("inventory.shelves.cancel_assignment", "Cancel Assignment")}
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("inventory.shelves.title", "Shelves")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("inventory.shelves.subtitle", "Shelf definitions linked to warehouses, with capacity metadata and datatable exports.")}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t("inventory.shelves.add_btn", "Add Shelf")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={shelvesQuery.data?.data ?? []}
        totalEntries={shelvesQuery.data?.total ?? 0}
        loading={shelvesQuery.isLoading || shelvesQuery.isFetching}
        exportEndpoint={exportUrl}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        enableRowSelection
        selectedRowIds={selectedRowIds}
        onSelectionChange={(payload) => setSelectedRowIds(payload.selectedRowIds as RowSelectionState)}
        onDeleteRows={async (rows) => {
          if (rows.length === 0) return;
          await Promise.all(rows.map((row) => deleteMutation.mutateAsync(row.id)));
          clearSelection();
        }}
        onQueryChange={handleTableQueryChange}
        onRefresh={() => {
          clearSelection();
          queryClient.invalidateQueries({ queryKey: ["inventory", "shelves"] });
        }}
        onResetFilters={() => {
          applyTableQuery(DEFAULT_QUERY);
          clearSelection();
        }}
        searchPlaceholder={t("inventory.shelves.search_placeholder", "Search shelves by name or code...")}
        resourceName="shelves"
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
                {form.id ? t("inventory.shelves.edit_title", "Edit Shelf") : t("inventory.shelves.create_title", "Create Shelf")}
              </DialogTitle>
              <DialogDescription>
                {t("inventory.shelves.modal_desc", "Define shelf dimensions and assign them to warehouses.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shelf-name">{t("inventory.shelves.name_label", "Shelf Name")}</Label>
                <Input
                  id="shelf-name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Shelf A"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shelf-code">{t("inventory.shelves.code_label", "Shelf Code")}</Label>
                <Input
                  id="shelf-code"
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="SH-A-01"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="shelf-warehouse">{t("inventory.shelves.warehouse_label", "Warehouse")}</Label>
                <Select
                  value={form.parent_id || "__none__"}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, parent_id: value === "__none__" ? "" : value }))
                  }
                >
                  <SelectTrigger id="shelf-warehouse">
                    <SelectValue placeholder={t("inventory.shelves.select_placeholder", "Select warehouse")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("inventory.shelves.no_warehouse", "No warehouse linked")}</SelectItem>
                    {(warehousesQuery.data?.data ?? []).map((warehouse) => (
                      <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{t("inventory.shelves.image_label", "Shelf Image")}</Label>
                  <div className="flex items-center gap-4">
                    {(form.imagePreview || form.image) && (
                      <div className="relative h-20 w-20 overflow-hidden rounded-xl border">
                        <img
                          src={form.imagePreview || URL.createObjectURL(form.image!)}
                          alt="Shelf preview"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <label className="flex h-20 w-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-primary transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setForm((prev) => ({
                              ...prev,
                              image: file,
                              imagePreview: URL.createObjectURL(file),
                            }));
                          }
                        }}
                      />
                      <div className="text-center">
                        <Box className="mx-auto h-6 w-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Click to upload</span>
                      </div>
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                <Label htmlFor="shelf-rows">{t("inventory.shelves.rows_label", "Rows")}</Label>
                <Input
                  id="shelf-rows"
                  type="number"
                  min="1"
                  value={form.rows}
                  onChange={(event) => setForm((prev) => ({ ...prev, rows: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shelf-columns">{t("inventory.shelves.cols_label", "Columns")}</Label>
                <Input
                  id="shelf-columns"
                  type="number"
                  min="1"
                  value={form.columns}
                  onChange={(event) => setForm((prev) => ({ ...prev, columns: event.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="shelf-capacity">{t("inventory.shelves.capacity_label", "Capacity")}</Label>
                <Input
                  id="shelf-capacity"
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={(event) => setForm((prev) => ({ ...prev, capacity: event.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="shelf-description">{t("inventory.common.description", "Description")}</Label>
                <Textarea
                  id="shelf-description"
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Shelf notes..."
                  className="min-h-[84px]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="shelf-active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked === true }))}
              />
              <Label htmlFor="shelf-active" className="cursor-pointer">
                {t("inventory.shelves.active_label", "Shelf is active")}
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
                  toast.error(t("inventory.shelves.name_required", "Shelf name is required."));
                  return;
                }
                saveMutation.mutate();
              }}
            >
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {form.id ? t("inventory.common.save", "Save Shelf") : t("inventory.common.create", "Create Shelf")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
