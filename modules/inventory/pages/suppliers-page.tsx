"use client";

import * as React from "react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Power, Trash2 } from "lucide-react";
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
  createInventorySupplier,
  deactivateInventorySupplier,
  deleteInventorySupplier,
  fetchInventorySuppliers,
  updateInventorySupplier,
} from "@/modules/inventory/api";
import type { Supplier } from "@/modules/inventory/types";
import { WorkflowTrigger } from "@/modules/workflow/components/workflow-trigger";

type TableQueryState = {
  page: number;
  pageSize: number;
  search: string;
  sortCol: string;
  sortDir: "asc" | "desc";
};

type SupplierForm = {
  id?: number;
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
  is_active: boolean;
};

const DEFAULT_QUERY: TableQueryState = {
  page: 1,
  pageSize: 10,
  search: "",
  sortCol: "name",
  sortDir: "asc",
};

const DEFAULT_FORM: SupplierForm = {
  name: "",
  code: "",
  email: "",
  phone: "",
  address: "",
  is_active: true,
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? fallback;
  }

  return fallback;
};

export default function InventorySuppliersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tableQuery, setTableQuery] = React.useState<TableQueryState>(DEFAULT_QUERY);
  const [selectedRowIds, setSelectedRowIds] = React.useState<RowSelectionState>({});
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<SupplierForm>(DEFAULT_FORM);

  const suppliersQuery = useQuery({
    queryKey: ["inventory", "suppliers", tableQuery],
    queryFn: () =>
      fetchInventorySuppliers({
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
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        is_active: form.is_active,
      };

      if (form.id) {
        return updateInventorySupplier(form.id, payload);
      }

      return createInventorySupplier(payload);
    },
    onSuccess: () => {
      toast.success(form.id ? t("inventory.common.saved", "Supplier updated.") : t("inventory.common.saved", "Supplier created."));
      queryClient.invalidateQueries({ queryKey: ["inventory", "suppliers"] });
      setSelectedRowIds({});
      closeModal();
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, t("inventory.common.failed", "Failed to save supplier.")));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInventorySupplier,
    onSuccess: () => {
      toast.success(t("inventory.common.deleted", "Supplier deleted."));
      queryClient.invalidateQueries({ queryKey: ["inventory", "suppliers"] });
      setSelectedRowIds({});
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, t("inventory.common.failed", "Failed to delete supplier.")));
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateInventorySupplier,
    onSuccess: () => {
      toast.success(t("inventory.common.saved", "Supplier deactivated."));
      queryClient.invalidateQueries({ queryKey: ["inventory", "suppliers"] });
      setSelectedRowIds({});
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, t("inventory.common.failed", "Failed to change supplier status.")));
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

  const openEdit = React.useCallback((supplier: Supplier) => {
    setForm({
      id: supplier.id,
      name: supplier.name,
      code: supplier.code ?? "",
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      address: supplier.address ?? "",
      is_active: supplier.is_active,
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
    return `/inventory/suppliers/export?${params.toString()}`;
  }, [tableQuery.search, tableQuery.sortCol, tableQuery.sortDir]);

  const columns = React.useMemo<ColumnDef<Supplier>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("inventory.suppliers.col_name", "Supplier"),
        cell: ({ row }) => {
          const supplier = row.original;
          return (
            <div>
              <p className="font-semibold">{supplier.name}</p>
              <p className="text-xs text-muted-foreground">{supplier.code || t("inventory.suppliers.no_code", "No supplier code")}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "email",
        header: t("inventory.common.email", "Email"),
        cell: ({ row }) => row.original.email || "-",
      },
      {
        accessorKey: "phone",
        header: t("inventory.common.phone", "Phone"),
        cell: ({ row }) => row.original.phone || "-",
      },
      {
        accessorKey: "products_count",
        header: t("inventory.common.products", "Products"),
        enableSorting: false,
        cell: ({ row }) => row.original.products_count ?? 0,
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
          const supplier = row.original;
          return (
            <div className="flex justify-start gap-2">
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEdit(supplier)}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                {t("inventory.common.edit", "Edit")}
              </Button>
              <WorkflowTrigger
                type="Modules\\Inventory\\Models\\Supplier"
                id={supplier.id}
                name={supplier.name}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ["inventory", "suppliers"] })}
                showStatusBadge={false}
              />
              {supplier.is_active ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={deactivateMutation.isPending}
                    >
                      <Power className="mr-1 h-3.5 w-3.5" />
                      {t("inventory.common.deactivate", "Deactivate")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("inventory.suppliers.deactivate_confirm_title", "Deactivate Supplier?")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("inventory.suppliers.deactivate_confirm_desc", "This will temporarily disable the supplier. You can reactivate them later.")} <strong>{supplier.name}</strong>.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">{t("inventory.common.cancel", "Cancel")}</AlertDialogCancel>
                      <AlertDialogAction 
                        className="rounded-xl"
                        onClick={() => deactivateMutation.mutate(supplier.id)}
                      >
                        {t("inventory.common.confirm", "Confirm Deactivation")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
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
                    <AlertDialogTitle>{t("inventory.suppliers.delete_confirm_title", "Delete Supplier?")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("inventory.suppliers.delete_confirm_desc", "This will permanently delete the supplier. This action cannot be undone.")} <strong>{supplier.name}</strong>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">{t("inventory.common.cancel", "Cancel")}</AlertDialogCancel>
                    <AlertDialogAction 
                      className="rounded-xl bg-destructive hover:bg-destructive/90"
                      onClick={() => deleteMutation.mutate(supplier.id)}
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
    [deactivateMutation, deleteMutation, openEdit, queryClient, t]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("inventory.suppliers.title", "Suppliers")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("inventory.suppliers.subtitle", "Supplier management with datatable selection, exports, and status controls.")}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t("inventory.suppliers.add_btn", "Add Supplier")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={suppliersQuery.data?.data ?? []}
        totalEntries={suppliersQuery.data?.total ?? 0}
        loading={suppliersQuery.isLoading || suppliersQuery.isFetching}
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
          queryClient.invalidateQueries({ queryKey: ["inventory", "suppliers"] });
        }}
        onResetFilters={() => {
          applyTableQuery(DEFAULT_QUERY);
          clearSelection();
        }}
        searchPlaceholder={t("inventory.suppliers.search_placeholder", "Search suppliers...")}
        resourceName="suppliers"
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
                {form.id ? t("inventory.suppliers.edit_title", "Edit Supplier") : t("inventory.suppliers.create_title", "Create Supplier")}
              </DialogTitle>
              <DialogDescription>
                {t("inventory.suppliers.modal_desc", "Capture complete supplier master data.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supplier-name">{t("inventory.suppliers.name_label", "Supplier Name")}</Label>
                <Input
                  id="supplier-name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Spinka and Sons"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-code">{t("inventory.common.code", "Code")}</Label>
                <Input
                  id="supplier-code"
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="SUP-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-email">{t("inventory.common.email", "Email")}</Label>
                <Input
                  id="supplier-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="supplier@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-phone">{t("inventory.common.phone", "Phone")}</Label>
                <Input
                  id="supplier-phone"
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="+254 ..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-address">{t("inventory.common.address", "Address")}</Label>
              <textarea
                id="supplier-address"
                className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="Supplier office or warehouse address..."
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="supplier-active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked === true }))}
              />
              <Label htmlFor="supplier-active" className="cursor-pointer">
                {t("inventory.suppliers.active_label", "Active supplier")}
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
                  toast.error(t("inventory.suppliers.name_required", "Supplier name is required."));
                  return;
                }
                saveMutation.mutate();
              }}
            >
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {form.id ? t("inventory.common.save", "Save Supplier") : t("inventory.common.create", "Create Supplier")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
