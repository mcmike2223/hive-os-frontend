"use client";

import * as React from "react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  fetchInventoryCategories,
  createInventoryCategory,
  deleteInventoryCategory,
  updateInventoryCategory,
} from "@/modules/inventory/api";

type TableQueryState = {
  page: number;
  pageSize: number;
  search: string;
  sortCol: string;
  sortDir: "asc" | "desc";
};

type CategoryForm = {
  id?: number;
  name: string;
  description: string;
  is_active: boolean;
};

type InventoryCategory = {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  items_count?: number;
  created_at: string;
  updated_at: string;
};

const DEFAULT_QUERY: TableQueryState = {
  page: 1,
  pageSize: 10,
  search: "",
  sortCol: "name",
  sortDir: "asc",
};

const DEFAULT_FORM: CategoryForm = {
  name: "",
  description: "",
  is_active: true,
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? fallback;
  }

  return fallback;
};

export default function InventoryCategoriesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState<TableQueryState>(DEFAULT_QUERY);
  const [selectedRowIds, setSelectedRowIds] = React.useState<RowSelectionState>({});
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<CategoryForm>(DEFAULT_FORM);

  const categoriesQuery = useQuery({
    queryKey: ["inventory", "categories", tableQuery],
    queryFn: () =>
      fetchInventoryCategories({
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
        description: form.description.trim() || null,
        is_active: form.is_active,
      };

      if (form.id) {
        return updateInventoryCategory(form.id, payload);
      }

      return createInventoryCategory(payload);
    },
    onSuccess: (data) => {
      toast.success(form.id 
        ? t("inventory.common.saved", "Category updated.")
        : t("inventory.common.saved", "Category created.")
      );
      queryClient.invalidateQueries({ queryKey: ["inventory", "categories"] });
      closeModal();
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, t("inventory.common.failed", "Failed to save category.")));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInventoryCategory,
    onSuccess: () => {
      toast.success(t("inventory.common.deleted", "Category deleted."));
      queryClient.invalidateQueries({ queryKey: ["inventory", "categories"] });
      setSelectedRowIds({});
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, t("inventory.common.failed", "Failed to delete category.")));
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
        sortDir: query.sortDir === "asc" ? "asc" : "desc",
      });
    },
    [applyTableQuery]
  );

  const openCreate = React.useCallback(() => {
    setForm(DEFAULT_FORM);
    setOpen(true);
  }, []);

  const openEdit = React.useCallback((category: InventoryCategory) => {
    setForm({
      id: category.id,
      name: category.name,
      description: category.description || "",
      is_active: category.is_active,
    });
    setOpen(true);
  }, []);

  const closeModal = React.useCallback(() => {
    setOpen(false);
    setForm(DEFAULT_FORM);
  }, []);

  const clearSelection = React.useCallback(() => setSelectedRowIds({}), []);

  const handleSave = React.useCallback(() => {
    if (!form.name.trim()) {
      toast.error(t("inventory.categories.name_required", "Category name is required."));
      return;
    }
    saveMutation.mutate();
  }, [form.name, saveMutation, t]);

  const columns = React.useMemo<ColumnDef<InventoryCategory>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("inventory.common.category", "Category"),
        cell: ({ row }) => (
          <div>
            <p className="font-semibold">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">ID {row.original.id}</p>
          </div>
        ),
      },
      {
        accessorKey: "description",
        header: t("inventory.common.description", "Description"),
        enableSorting: false,
        cell: ({ row }) => row.original.description || t("inventory.common.none", "None"),
      },
      {
        accessorKey: "items_count",
        header: t("inventory.common.items", "Items"),
        enableSorting: false,
        cell: ({ row }) => row.original.items_count ?? 0,
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
          const category = row.original;
          return (
            <div className="flex justify-start gap-2">
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEdit(category)}>
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
                    <AlertDialogTitle>{t("inventory.categories.delete_confirm_title", "Delete Category?")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("inventory.categories.delete_confirm_desc", "This will permanently delete the category. Items in this category will become uncategorized.")} <strong>{category.name}</strong>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">{t("inventory.common.cancel", "Cancel")}</AlertDialogCancel>
                    <AlertDialogAction 
                      className="rounded-xl bg-destructive hover:bg-destructive/90"
                      onClick={() => deleteMutation.mutate(category.id)}
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
          <h1 className="text-3xl font-black tracking-tight">{t("inventory.categories.title", "Inventory Categories")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("inventory.categories.subtitle", "Simple categories for organizing inventory items.")}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t("inventory.categories.add_btn", "Add Category")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={categoriesQuery.data ?? []}
        totalEntries={categoriesQuery.data?.length ?? 0}
        loading={categoriesQuery.isLoading || categoriesQuery.isFetching}
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
          queryClient.invalidateQueries({ queryKey: ["inventory", "categories"] });
        }}
        onResetFilters={() => {
          applyTableQuery(DEFAULT_QUERY);
          clearSelection();
        }}
        searchPlaceholder={t("inventory.categories.search_placeholder", "Search category...")}
        resourceName="categories"
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
                {form.id ? t("inventory.categories.edit_title", "Edit Category") : t("inventory.categories.create_title", "Create Category")}
              </DialogTitle>
              <DialogDescription>
                {t("inventory.categories.modal_desc", "Organize your inventory items into simple categories.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="category-name">{t("inventory.common.name", "Name")}</Label>
              <Input
                id="category-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Beverages"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-description">{t("inventory.common.description", "Description")}</Label>
              <Input
                id="category-description"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Optional description"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="category-active"
                checked={form.is_active}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, is_active: checked === true }))
                }
              />
              <Label htmlFor="category-active" className="cursor-pointer">
                {t("inventory.categories.active_label", "Active category")}
              </Label>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4 sm:justify-end">
            <Button variant="outline" className="rounded-full" onClick={closeModal}>
              {t("inventory.common.cancel", "Cancel")}
            </Button>
            <Button className="rounded-full" disabled={saveMutation.isPending} onClick={handleSave}>
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {form.id ? t("inventory.common.save_changes", "Save Changes") : t("inventory.common.create", "Create Category")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
