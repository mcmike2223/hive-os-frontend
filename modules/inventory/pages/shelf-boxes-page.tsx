"use client";

import * as React from "react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Link2, Pencil, Plus, Trash2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, 
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  assignInventoryShelfBox,
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

type ShelfBoxForm = {
  id?: number;
  name: string;
  code: string;
  parent_id: string;
  row: string;
  column: string;
  quantity_stored: string;
  storage_status: "available" | "occupied";
  storable_type: string;
  storable_id: string;
  notes: string;
  is_active: boolean;
};

const DEFAULT_QUERY: TableQueryState = {
  page: 1,
  pageSize: 10,
  search: "",
  sortCol: "name",
  sortDir: "asc",
};

const DEFAULT_FORM: ShelfBoxForm = {
  name: "",
  code: "",
  parent_id: "",
  row: "1",
  column: "1",
  quantity_stored: "0",
  storage_status: "available",
  storable_type: "",
  storable_id: "",
  notes: "",
  is_active: true,
};

const readPayload = (record: InventoryEntityRecord): Record<string, unknown> => {
  if (record.payload && typeof record.payload === "object") {
    return record.payload as Record<string, unknown>;
  }
  return {};
};

const readPayloadString = (
  record: InventoryEntityRecord,
  key: string,
  fallback = ""
): string => {
  const value = readPayload(record)[key];
  return value == null ? fallback : String(value);
};

const readPayloadStatus = (record: InventoryEntityRecord): "available" | "occupied" => {
  const value = readPayloadString(record, "status", "available");
  return value === "occupied" ? "occupied" : "available";
};

export default function InventoryShelfBoxesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const addProductId = searchParams.get("add_product_id");

  const [tableQuery, setTableQuery] = React.useState<TableQueryState>(DEFAULT_QUERY);
  const [selectedRowIds, setSelectedRowIds] = React.useState<RowSelectionState>({});
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<ShelfBoxForm>(DEFAULT_FORM);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [assignBox, setAssignBox] = React.useState<InventoryEntityRecord | null>(null);
  const [assignForm, setAssignForm] = React.useState({ storableType: "", storableId: "" });

  const [productAssignOpen, setProductAssignOpen] = React.useState(false);
  const [selectedShelfBoxId, setSelectedShelfBoxId] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (addProductId) {
      setProductAssignOpen(true);
    }
  }, [addProductId]);

  const assignProductToShelfMutation = useMutation({
    mutationFn: async (shelfBoxId: number) => {
      const { assignProductToShelf } = await import("@/modules/inventory/api");
      return assignProductToShelf(Number(addProductId), shelfBoxId);
    },
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: t("inventory.products.shelf_assigned", "Product assigned to shelf successfully."),
        submittedMessage: t("workflow.submitted_for_approval", "Submitted for approval."),
        queryClient,
      });
      setProductAssignOpen(false);
      queryClient.invalidateQueries({ queryKey: ["inventory", "products"] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? t("inventory.common.failed", "Failed to assign product to shelf."));
    },
  });

  const shelfBoxesQuery = useQuery({
    queryKey: ["inventory", "shelf-boxes", tableQuery],
    queryFn: () =>
      fetchInventoryEntityRecords("shelf-boxes", {
        search: tableQuery.search || undefined,
        page: tableQuery.page,
        per_page: tableQuery.pageSize,
        sort_col: tableQuery.sortCol,
        sort_dir: tableQuery.sortDir,
      }),
  });

  const allShelfBoxesQuery = useQuery({
    queryKey: ["inventory", "shelf-boxes", "all"],
    queryFn: () =>
      fetchInventoryEntityRecords("shelf-boxes", {
        per_page: 500,
      }),
    enabled: productAssignOpen,
  });

  const shelvesQuery = useQuery({
    queryKey: ["inventory", "shelves", "options"],
    queryFn: () =>
      fetchInventoryEntityRecords("shelves", {
        per_page: 250,
      }),
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        parent_id: form.parent_id ? Number(form.parent_id) : null,
        is_active: form.is_active,
        payload: {
          row: Number(form.row || "1"),
          column: Number(form.column || "1"),
          quantity_stored: Number(form.quantity_stored || "0"),
          status: form.storage_status,
          storable_type: form.storable_type.trim() || null,
          storable_id: form.storable_id ? Number(form.storable_id) : null,
          notes: form.notes.trim() || null,
        },
      };

      if (form.id) {
        return updateInventoryEntityRecord("shelf-boxes", form.id, payload);
      }

      return createInventoryEntityRecord("shelf-boxes", payload);
    },
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: form.id
          ? t("inventory.common.saved", "Shelf box updated.")
          : t("inventory.common.saved", "Shelf box created."),
        submittedMessage: t("workflow.submitted_for_approval", "Submitted for approval."),
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["inventory", "shelf-boxes"] });
      setSelectedRowIds({});
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? t("inventory.common.failed", "Failed to save shelf box."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteInventoryEntityRecord("shelf-boxes", id),
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: t("inventory.common.deleted", "Shelf box deleted."),
        submittedMessage: t("workflow.submitted_for_approval", "Submitted for approval."),
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["inventory", "shelf-boxes"] });
      setSelectedRowIds({});
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? t("inventory.common.failed", "Failed to delete shelf box."));
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, storableType, storableId }: { id: number; storableType: string; storableId: number }) =>
      assignInventoryShelfBox(id, {
        storable_type: storableType,
        storable_id: storableId,
      }),
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: t("inventory.common.saved", "Shelf box assignment updated."),
        submittedMessage: t("workflow.submitted_for_approval", "Submitted for approval."),
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["inventory", "shelf-boxes"] });
      setAssignOpen(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? t("inventory.common.failed", "Failed to assign shelf box."));
    },
  });

  const openAssign = React.useCallback((box: InventoryEntityRecord) => {
    setAssignBox(box);
    setAssignForm({
      storableType: readPayloadString(box, "storable_type", "product"),
      storableId: readPayloadString(box, "storable_id", ""),
    });
    setAssignOpen(true);
  }, []);

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

  const openEdit = React.useCallback((box: InventoryEntityRecord) => {
    setForm({
      id: box.id,
      name: box.name,
      code: box.code ?? "",
      parent_id: box.parent_id ? String(box.parent_id) : "",
      row: readPayloadString(box, "row", "1"),
      column: readPayloadString(box, "column", "1"),
      quantity_stored: readPayloadString(box, "quantity_stored", "0"),
      storage_status: readPayloadStatus(box),
      storable_type: readPayloadString(box, "storable_type", ""),
      storable_id: readPayloadString(box, "storable_id", ""),
      notes: readPayloadString(box, "notes", ""),
      is_active: box.is_active,
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
    return `/inventory/shelf-boxes/export?${params.toString()}`;
  }, [tableQuery.search, tableQuery.sortCol, tableQuery.sortDir]);

  const columns = React.useMemo<ColumnDef<InventoryEntityRecord>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("inventory.shelf_boxes.col_name", "Shelf Box"),
        cell: ({ row }) => {
          const box = row.original;
          return (
            <div>
              <p className="font-semibold">{box.name}</p>
              <p className="text-xs text-muted-foreground">{box.code || t("inventory.common.no_code", "No code")}</p>
            </div>
          );
        },
      },
      {
        id: "shelf",
        header: t("inventory.shelves.title", "Shelf"),
        enableSorting: false,
        cell: ({ row }) => row.original.parent?.name ?? t("inventory.common.none", "Unassigned"),
      },
      {
        id: "position",
        header: t("inventory.shelf_boxes.col_position", "Position"),
        enableSorting: false,
        cell: ({ row }) => `R${readPayloadString(row.original, "row", "1")} / C${readPayloadString(row.original, "column", "1")}`,
        meta: { align: "right" as const },
      },
      {
        id: "quantity_stored",
        header: t("inventory.shelf_boxes.col_stored_qty", "Stored Qty"),
        enableSorting: false,
        cell: ({ row }) => readPayloadString(row.original, "quantity_stored", "0"),
        meta: { align: "right" as const },
      },
      {
        id: "status",
        header: t("inventory.common.status", "Status"),
        enableSorting: false,
        cell: ({ row }) => {
          const status = readPayloadStatus(row.original);
          return (
            <Badge variant={status === "occupied" ? "default" : "outline"}>
              {status === "occupied" ? t("inventory.shelf_boxes.occupied", "occupied") : t("inventory.shelf_boxes.available", "available")}
            </Badge>
          );
        },
        meta: { align: "center" as const },
      },
      {
        id: "actions",
        header: t("inventory.common.actions", "Actions"),
        enableSorting: false,
        cell: ({ row }) => {
          const box = row.original;
          return (
            <div className="flex justify-start gap-2">
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEdit(box)}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                {t("inventory.common.edit", "Edit")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={assignMutation.isPending}
                onClick={() => openAssign(box)}
              >
                <Link2 className="mr-1 h-3.5 w-3.5" />
                {t("inventory.shelf_boxes.assign", "Assign")}
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
                    <AlertDialogTitle>{t("inventory.shelf_boxes.delete_confirm_title", "Delete Shelf Box?")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("inventory.shelf_boxes.delete_confirm_desc", "This will permanently delete the box and its status.")} <strong>{box.name}</strong>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">{t("inventory.common.cancel", "Cancel")}</AlertDialogCancel>
                    <AlertDialogAction 
                      className="rounded-xl bg-destructive hover:bg-destructive/90"
                      onClick={() => deleteMutation.mutate(box.id)}
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
    [assignMutation, deleteMutation, openEdit, t]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("inventory.shelf_boxes.title", "Shelf Boxes")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("inventory.shelf_boxes.subtitle", "Box-level storage coordinates and assignment controls.")}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t("inventory.shelf_boxes.add_btn", "Add Shelf Box")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={shelfBoxesQuery.data?.data ?? []}
        totalEntries={shelfBoxesQuery.data?.total ?? 0}
        loading={shelfBoxesQuery.isLoading || shelfBoxesQuery.isFetching}
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
            savedMessage: (count) => `${count} ${t("inventory.shelf_boxes.bulk_deleted_msg", "shelf box(es) deleted.")}`,
            submittedMessage: t("workflow.submitted_for_approval", "Submitted for approval."),
            queryClient,
          });
          clearSelection();
        }}
        onQueryChange={handleTableQueryChange}
        onRefresh={() => {
          clearSelection();
          queryClient.invalidateQueries({ queryKey: ["inventory", "shelf-boxes"] });
        }}
        onResetFilters={() => {
          applyTableQuery(DEFAULT_QUERY);
          clearSelection();
        }}
        searchPlaceholder={t("inventory.shelf_boxes.search_placeholder", "Search shelf boxes by name or code...")}
        resourceName="shelf boxes"
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
                {form.id ? t("inventory.shelf_boxes.edit_title", "Edit Shelf Box") : t("inventory.shelf_boxes.create_title", "Create Shelf Box")}
              </DialogTitle>
              <DialogDescription>
                {t("inventory.shelf_boxes.modal_desc", "Define shelf box coordinates.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="box-name">{t("inventory.shelf_boxes.name_label", "Box Name")}</Label>
                <Input id="box-name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Box A-01" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="box-code">{t("inventory.common.code", "Code")}</Label>
                <Input id="box-code" value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="BX-A01" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="box-shelf">{t("inventory.shelves.title", "Shelf")}</Label>
                <Select value={form.parent_id || "__none__"} onValueChange={(value) => setForm((prev) => ({ ...prev, parent_id: value === "__none__" ? "" : value }))}>
                  <SelectTrigger id="box-shelf"><SelectValue placeholder={t("inventory.shelves.select_placeholder", "Select shelf")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("inventory.shelves.no_shelf", "No shelf linked")}</SelectItem>
                    {(shelvesQuery.data?.data ?? []).map((shelf) => (
                      <SelectItem key={shelf.id} value={String(shelf.id)}>{shelf.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="box-row">{t("inventory.shelf_boxes.row_label", "Row")}</Label>
                <Input id="box-row" type="number" min="1" value={form.row} onChange={(event) => setForm((prev) => ({ ...prev, row: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="box-column">{t("inventory.shelf_boxes.column_label", "Column")}</Label>
                <Input id="box-column" type="number" min="1" value={form.column} onChange={(event) => setForm((prev) => ({ ...prev, column: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="box-qty">{t("inventory.shelf_boxes.quantity_label", "Quantity Stored")}</Label>
                <Input id="box-qty" type="number" min="0" value={form.quantity_stored} onChange={(event) => setForm((prev) => ({ ...prev, quantity_stored: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="box-status">{t("inventory.shelf_boxes.status_label", "Storage Status")}</Label>
                <Select value={form.storage_status} onValueChange={(value) => setForm((prev) => ({ ...prev, storage_status: value as "available" | "occupied" }))}>
                  <SelectTrigger id="box-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">{t("inventory.shelf_boxes.available", "available")}</SelectItem>
                    <SelectItem value="occupied">{t("inventory.shelf_boxes.occupied", "occupied")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="box-storable-type">{t("inventory.shelf_boxes.storable_type", "Storable Type")}</Label>
                <Input id="box-storable-type" value={form.storable_type} onChange={(event) => setForm((prev) => ({ ...prev, storable_type: event.target.value }))} placeholder="goods / product" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="box-storable-id">{t("inventory.shelf_boxes.storable_id", "Storable ID")}</Label>
                <Input id="box-storable-id" type="number" min="1" value={form.storable_id} onChange={(event) => setForm((prev) => ({ ...prev, storable_id: event.target.value }))} placeholder="123" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="box-notes">{t("inventory.common.notes", "Notes")}</Label>
                <Textarea id="box-notes" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} className="min-h-[84px]" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="box-active" checked={form.is_active} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked === true }))} />
              <Label htmlFor="box-active" className="cursor-pointer">{t("inventory.shelf_boxes.active_label", "Shelf box is active")}</Label>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={closeModal}>{t("inventory.common.cancel", "Cancel")}</Button>
            <Button
              className="rounded-full"
              disabled={saveMutation.isPending}
              onClick={() => {
                if (!form.name.trim()) {
                  toast.error(t("inventory.shelf_boxes.name_required", "Shelf box name is required."));
                  return;
                }
                saveMutation.mutate();
              }}
            >
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {form.id ? t("inventory.common.save", "Save Shelf Box") : t("inventory.common.create", "Create Shelf Box")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("inventory.shelf_boxes.assign_title", "Assign Storage")}
              </DialogTitle>
              <DialogDescription>
                {t("inventory.shelf_boxes.assign_desc", "Directly map a product or stock unit to this physical box.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="storable-type">{t("inventory.shelf_boxes.storable_type", "Storable Type")}</Label>
              <Select 
                value={assignForm.storableType} 
                onValueChange={(val) => setAssignForm(prev => ({ ...prev, storableType: val }))}
              >
                <SelectTrigger id="storable-type" className="bg-background">
                  <SelectValue placeholder={t("inventory.shelf_boxes.type_placeholder", "Select type...")} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="product">{t("inventory.common.product", "Product")}</SelectItem>
                  <SelectItem value="goods">{t("inventory.common.goods", "Goods")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="storable-id">{t("inventory.shelf_boxes.storable_id", "Storable ID")}</Label>
              <Input
                id="storable-id"
                type="number"
                value={assignForm.storableId}
                onChange={(e) => setAssignForm(prev => ({ ...prev, storableId: e.target.value }))}
                placeholder="e.g. 15"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4 sm:justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => setAssignOpen(false)}>
              {t("inventory.common.cancel", "Cancel")}
            </Button>
            <Button 
              className="rounded-full" 
              disabled={assignMutation.isPending}
              onClick={() => {
                const storableId = Number(assignForm.storableId);
                if (!Number.isFinite(storableId) || storableId <= 0) {
                  toast.error(t("inventory.shelf_boxes.id_required", "A valid storable ID is required."));
                  return;
                }
                if (!assignBox) return;
                assignMutation.mutate({ 
                  id: assignBox.id, 
                  storableType: assignForm.storableType, 
                  storableId 
                });
              }}
            >
              {assignMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("inventory.shelf_boxes.complete_assignment", "Complete Assignment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {productAssignOpen && (
        <Dialog open={productAssignOpen} onOpenChange={(open) => !open && setProductAssignOpen(false)}>
          <DialogContent className="rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle>{t("inventory.products.add_to_shelf", "Add Product to Shelf")}</DialogTitle>
              <DialogDescription>
                {t("inventory.products.select_shelf_box_desc", "Select a shelf box to store this product.")}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <Label>{t("inventory.shelf_boxes.shelf_box", "Shelf Box")}</Label>
              <select
                value={selectedShelfBoxId ?? ""}
                onChange={(e) => setSelectedShelfBoxId(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-muted/30 border border-border/50 h-12 rounded-xl text-sm px-4 focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
              >
                <option value="">{t("inventory.products.select_shelf_box", "Select a shelf box...")}</option>
                {allShelfBoxesQuery.data?.data?.map((box) => (
                  <option key={box.id} value={box.id}>
                    {box.name}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setProductAssignOpen(false)}>
                {t("inventory.common.cancel", "Cancel")}
              </Button>
              <Button
                className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950"
                disabled={!selectedShelfBoxId || assignProductToShelfMutation.isPending}
                onClick={() => selectedShelfBoxId && assignProductToShelfMutation.mutate(selectedShelfBoxId)}
              >
                {assignProductToShelfMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
                {t("inventory.products.assign_to_shelf", "Assign to Shelf")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

