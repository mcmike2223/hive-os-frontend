"use client";

import * as React from "react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Tag as TagIcon, Trash2 } from "lucide-react";
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
  createInventoryTag,
  deleteInventoryTag,
  fetchInventoryTags,
  updateInventoryTag,
} from "@/modules/inventory/api";
import type { Tag as InventoryTag } from "@/modules/inventory/types";

type TableQueryState = {
  page: number;
  pageSize: number;
  search: string;
  sortCol: string;
  sortDir: "asc" | "desc";
};

type TagForm = {
  id?: number;
  name: string;
  is_active: boolean;
};

const DEFAULT_QUERY: TableQueryState = {
  page: 1,
  pageSize: 10,
  search: "",
  sortCol: "created_at",
  sortDir: "desc",
};

const DEFAULT_FORM: TagForm = {
  name: "",
  is_active: true,
};

export default function InventoryTagsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState<TableQueryState>(DEFAULT_QUERY);
  const [selectedRowIds, setSelectedRowIds] = React.useState<RowSelectionState>({});
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<TagForm>(DEFAULT_FORM);

  const tagsQuery = useQuery({
    queryKey: ["inventory", "tags", tableQuery],
    queryFn: () =>
      fetchInventoryTags({
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
        is_active: form.is_active,
      };

      if (form.id) {
        return updateInventoryTag(form.id, payload);
      }

      return createInventoryTag(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "tags"] });
      toast.success(form.id ? t("inventory.common.saved", "Tag updated.") : t("inventory.common.saved", "Tag created."));
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? t("inventory.common.failed", "Failed to save tag."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInventoryTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "tags"] });
      toast.success(t("inventory.common.deleted", "Tag deleted."));
      setSelectedRowIds({});
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? t("inventory.common.failed", "Failed to delete tag."));
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

  const openEdit = React.useCallback((tag: InventoryTag) => {
    setForm({
      id: tag.id,
      name: tag.name,
      is_active: tag.is_active,
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
    return `/inventory/tags/export?${params.toString()}`;
  }, [tableQuery.search, tableQuery.sortCol, tableQuery.sortDir]);

  const handleSave = React.useCallback(() => {
    if (!form.name.trim()) {
      toast.error(t("inventory.tags.name_required", "Tag name is required."));
      return;
    }

    saveMutation.mutate();
  }, [form.name, saveMutation, t]);

  const columns = React.useMemo<ColumnDef<InventoryTag>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("inventory.tags.col_name", "Tag"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <TagIcon className="h-4 w-4 text-primary" />
            <div>
              <p className="font-semibold">{row.original.name}</p>
              <p className="font-mono text-xs text-muted-foreground">#{row.original.slug}</p>
            </div>
          </div>
        ),
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
          const tag = row.original;
          return (
            <div className="flex justify-start gap-2">
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEdit(tag)}>
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
                    <AlertDialogTitle>{t("inventory.tags.delete_confirm_title", "Delete Tag?")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("inventory.tags.delete_confirm_desc", "This will permanently delete the tag. Products using this tag will no longer be associated with it.")} <strong>{tag.name}</strong>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">{t("inventory.common.cancel", "Cancel")}</AlertDialogCancel>
                    <AlertDialogAction 
                      className="rounded-xl bg-destructive hover:bg-destructive/90"
                      onClick={() => deleteMutation.mutate(tag.id)}
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
          <h1 className="text-3xl font-black tracking-tight">{t("inventory.tags.title", "Product Tags")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("inventory.tags.subtitle", "Tag catalog and assignment metadata managed with the shared DataTable.")}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t("inventory.tags.add_btn", "Add Tag")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={tagsQuery.data?.data ?? []}
        totalEntries={tagsQuery.data?.total ?? 0}
        loading={tagsQuery.isLoading || tagsQuery.isFetching}
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
          queryClient.invalidateQueries({ queryKey: ["inventory", "tags"] });
        }}
        onResetFilters={() => {
          applyTableQuery(DEFAULT_QUERY);
          clearSelection();
        }}
        searchPlaceholder={t("inventory.tags.search_placeholder", "Search tags...")}
        resourceName="tags"
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
                {form.id ? t("inventory.tags.edit_title", "Edit Tag") : t("inventory.tags.create_title", "Create Tag")}
              </DialogTitle>
              <DialogDescription>
                {t("inventory.tags.modal_desc", "Keep product labels organized for search, segmentation, and reporting.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="tag-name">{t("inventory.common.name", "Name")}</Label>
              <Input
                id="tag-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Premium"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="tag-active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked === true }))}
              />
              <Label htmlFor="tag-active" className="cursor-pointer">
                {t("inventory.tags.active_label", "Active tag")}
              </Label>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={closeModal}>
              {t("inventory.common.cancel", "Cancel")}
            </Button>
            <Button className="rounded-full" disabled={saveMutation.isPending} onClick={handleSave}>
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {form.id ? t("inventory.common.save_changes", "Save Changes") : t("inventory.common.create", "Create Tag")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

