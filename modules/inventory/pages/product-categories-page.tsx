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
  createInventoryProductCategory,
  deleteInventoryProductCategory,
  fetchInventoryProductCategories,
  updateInventoryProductCategory,
} from "@/modules/inventory/api";
import type { ProductCategory } from "@/modules/inventory/types";
import { fetchWorkflowApprovals } from "@/modules/workflow/api";
import { WorkflowTrigger } from "@/modules/workflow/components/workflow-trigger";
import type { WorkflowDecisionApproval } from "@/modules/workflow/components/workflow-decision-dialog";

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
  parent_id: string;
  is_active: boolean;
};

const DEFAULT_QUERY: TableQueryState = {
  page: 1,
  pageSize: 10,
  search: "",
  sortCol: "created_at",
  sortDir: "desc",
};

const DEFAULT_FORM: CategoryForm = {
  name: "",
  parent_id: "",
  is_active: true,
};

const PRODUCT_CATEGORY_WORKFLOW_TYPE = "Modules\\Inventory\\Models\\ProductCategory";

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? fallback;
  }

  return fallback;
};

export default function ProductCategoriesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState<TableQueryState>(DEFAULT_QUERY);
  const [selectedRowIds, setSelectedRowIds] = React.useState<RowSelectionState>({});
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<CategoryForm>(DEFAULT_FORM);

  const categoriesQuery = useQuery({
    queryKey: ["inventory", "product-categories", tableQuery],
    queryFn: () =>
      fetchInventoryProductCategories({
        search: tableQuery.search || undefined,
        page: tableQuery.page,
        per_page: tableQuery.pageSize,
        sort_col: tableQuery.sortCol,
        sort_dir: tableQuery.sortDir,
      }),
  });

  const parentOptionsQuery = useQuery({
    queryKey: ["inventory", "product-categories", "parent-options"],
    queryFn: () =>
      fetchInventoryProductCategories({
        top_level: true,
        per_page: 200,
      }),
    enabled: open,
  });

  const pendingCategoryApprovalsQuery = useQuery({
    queryKey: ["workflow", "product-category-approvals", "pending-inbox"],
    queryFn: () =>
      fetchWorkflowApprovals({
        type: "inbox",
        status: "pending",
        approvable_type: PRODUCT_CATEGORY_WORKFLOW_TYPE,
        per_page: 100,
      }),
    enabled: categoriesQuery.isSuccess,
    staleTime: 5_000,
  });

  const pendingApprovalByCategoryId = React.useMemo(() => {
    const approvals = (pendingCategoryApprovalsQuery.data?.data ?? []) as WorkflowDecisionApproval[];

    return new Map(
      approvals
        .filter((approval) => approval.approvable_id)
        .map((approval) => [Number(approval.approvable_id), approval])
    );
  }, [pendingCategoryApprovalsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        parent_id: form.parent_id ? Number(form.parent_id) : null,
        is_active: form.is_active,
      };

      if (form.id) {
        return updateInventoryProductCategory(form.id, payload);
      }

      return createInventoryProductCategory(payload);
    },
    onSuccess: () => {
      toast.success(form.id ? t("inventory.common.saved", "Category updated.") : t("inventory.common.saved", "Category created."));
      queryClient.invalidateQueries({ queryKey: ["inventory", "product-categories"] });
      queryClient.invalidateQueries({ queryKey: ["workflow", "product-category-approvals"] });
      closeModal();
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, t("inventory.common.failed", "Failed to save category.")));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInventoryProductCategory,
    onSuccess: () => {
      toast.success(t("inventory.common.deleted", "Category deleted."));
      queryClient.invalidateQueries({ queryKey: ["inventory", "product-categories"] });
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
        sortCol: String(query.sortCol || "created_at"),
        sortDir: query.sortDir === "asc" ? "asc" : "desc",
      });
    },
    [applyTableQuery]
  );

  const openCreate = React.useCallback(() => {
    setForm(DEFAULT_FORM);
    setOpen(true);
  }, []);

  const openEdit = React.useCallback((category: ProductCategory) => {
    setForm({
      id: category.id,
      name: category.name,
      parent_id: category.parent_id ? String(category.parent_id) : "",
      is_active: category.is_active,
    });
    setOpen(true);
  }, []);

  const closeModal = React.useCallback(() => {
    setOpen(false);
    setForm(DEFAULT_FORM);
  }, []);

  const clearSelection = React.useCallback(() => setSelectedRowIds({}), []);

  const exportUrl = React.useMemo(() => {
    const params = new URLSearchParams();
    if (tableQuery.search) params.set("search", tableQuery.search);
    params.set("sortCol", tableQuery.sortCol);
    params.set("sortDir", tableQuery.sortDir);
    return `/inventory/product-categories/export?${params.toString()}`;
  }, [tableQuery.search, tableQuery.sortCol, tableQuery.sortDir]);

  const handleSave = React.useCallback(() => {
    if (!form.name.trim()) {
      toast.error(t("inventory.categories.name_required", "Category name is required."));
      return;
    }
    saveMutation.mutate();
  }, [form.name, saveMutation, t]);

  const columns = React.useMemo<ColumnDef<ProductCategory>[]>(
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
        id: "parent",
        header: t("inventory.categories.col_parent", "Parent"),
        enableSorting: false,
        cell: ({ row }) => row.original.parent?.name ?? t("inventory.common.none", "None"),
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
          const category = row.original;
          return (
            <div className="flex justify-start gap-2">
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEdit(category)}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                {t("inventory.common.edit", "Edit")}
              </Button>
              <WorkflowTrigger
                type={PRODUCT_CATEGORY_WORKFLOW_TYPE}
                id={category.id}
                name={category.name}
                approval={pendingApprovalByCategoryId.get(category.id) ?? null}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ["inventory", "product-categories"] });
                  queryClient.invalidateQueries({ queryKey: ["workflow", "product-category-approvals"] });
                }}
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
                    <AlertDialogTitle>{t("inventory.categories.delete_confirm_title", "Delete Category?")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("inventory.categories.delete_confirm_desc", "This will permanently delete the category. Products in this category will become uncategorized.")} <strong>{category.name}</strong>.
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
    [deleteMutation, openEdit, pendingApprovalByCategoryId, queryClient, t]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("inventory.categories.title", "Product Categories")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("inventory.categories.subtitle", "Tenant-scoped category management with parent-child hierarchy.")}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t("inventory.categories.add_btn", "Add Category")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={categoriesQuery.data?.data ?? []}
        totalEntries={categoriesQuery.data?.total ?? 0}
        loading={categoriesQuery.isLoading || categoriesQuery.isFetching}
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
          queryClient.invalidateQueries({ queryKey: ["inventory", "product-categories"] });
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
                {t("inventory.categories.modal_desc", "Keep your product hierarchy clean for catalog and stock workflows.")}
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
              <Label htmlFor="category-parent">{t("inventory.categories.parent_label", "Parent Category")}</Label>
              <select
                id="category-parent"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.parent_id}
                onChange={(event) => setForm((prev) => ({ ...prev, parent_id: event.target.value }))}
              >
                <option value="">{t("inventory.common.none", "None")}</option>
                {(parentOptionsQuery.data?.data ?? [])
                  .filter((parent) => parent.id !== form.id)
                  .map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.name}
                    </option>
                  ))}
              </select>
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

