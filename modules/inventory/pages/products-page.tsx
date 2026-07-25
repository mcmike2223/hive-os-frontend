"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Box, ClipboardCheck, Copy, DollarSign, ExternalLink, Eye, FileText, Info, Layers, Loader2, MapPin, Maximize2, Package, Pencil, Plus, QrCode, Settings2, ShieldCheck, Trash2, TrendingUp, Truck, XIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/store/use-translation";
import { useTenantModuleAccess } from "@/hooks/use-tenant-module-access";
import { useBusinessType } from "@/hooks/use-business-type";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";

import {
  bulkUpdateInventoryProductsStatus,
  deleteInventoryProduct,
  fetchInventoryProduct,
  fetchInventoryProducts,
} from "@/modules/inventory/api";
import { ProductFormModal } from "@/modules/inventory/pages/components/product-form-modal";
import type { ProductRecord } from "@/modules/inventory/types";
import { ProductQaBatchDialog } from "@/modules/inventory/pages/components/product-qa-batch-dialog";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Model3DViewer } from "@/components/ui/model-3d-viewer";
import { getBackendStorageUrl } from "@/lib/runtime-context";
import { openSecureAssetInNewTab, SecureAssetImage } from "@/components/ui/secure-asset-image";
import { getInventoryAssetPreviewUrl } from "@/modules/inventory/lib/product-assets";
import { WorkflowTrigger } from "@/modules/workflow/components/workflow-trigger";
import { notifyBulkDeleteOutcomes, notifyMutationOutcome } from "@/modules/workflow/utils/mutation-outcome";

type SortDirection = "asc" | "desc";
type ProductStatus = "draft" | "published" | "archived";

type TableQueryState = {
  page: number;
  pageSize: number;
  search: string;
  sortCol: string;
  sortDir: SortDirection;
};

const DEFAULT_QUERY: TableQueryState = {
  page: 1,
  pageSize: 10,
  search: "",
  sortCol: "created_at",
  sortDir: "desc",
};

const STATUS_OPTIONS: ProductStatus[] = ["draft", "published", "archived"];

const getAssetNameFromPath = (value: string | null | undefined) => {
  if (!value) return null;
  const normalized = value.split("?")[0]?.replace(/\/+$/, "") ?? value;
  const segments = normalized.split("/").filter(Boolean);
  const tail = segments.at(-1) ?? normalized;

  if (tail === "serve") {
    const filesIndex = segments.lastIndexOf("files");
    const assetId = filesIndex >= 0 ? segments[filesIndex + 1] : null;
    return assetId ? `Library asset #${assetId}` : "Library asset";
  }

  return tail;
};
const formatProductDate = (value: string | null | undefined) => {
  if (!value) return "-";
  try {
    return format(new Date(value), "MMM d, yyyy");
  } catch {
    return value.substring(0, 10);
  }
};

const formatProductMoney = (value: string | number | null | undefined, currency?: string | null) => {
  if (value === null || value === undefined || value === "") return null;

  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${value} ${currency || "USD"}`;

  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency || "USD"}`;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  return fallback;
};

export default function InventoryProductsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { hasModule } = useTenantModuleAccess();
  const { hasBusinessType } = useBusinessType();

  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [tableQuery, setTableQuery] = React.useState<TableQueryState>(DEFAULT_QUERY);
  const [selectedRowIds, setSelectedRowIds] = React.useState<RowSelectionState>({});

  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState<"create" | "edit" | "duplicate">("create");
  const [editingProductId, setEditingProductId] = React.useState<number | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = React.useState(false);
  const [detailProductId, setDetailProductId] = React.useState<number | null>(null);
  const [qaProduct, setQaProduct] = React.useState<ProductRecord | null>(null);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);

  const selectedIds = React.useMemo(
    () =>
      Object.keys(selectedRowIds)
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    [selectedRowIds]
  );

  const productsQuery = useQuery({
    queryKey: ["inventory", "products", tableQuery, statusFilter],
    queryFn: () =>
      fetchInventoryProducts({
        search: tableQuery.search || undefined,
        status: statusFilter || undefined,
        page: tableQuery.page,
        per_page: tableQuery.pageSize,
        sort_col: tableQuery.sortCol,
        sort_dir: tableQuery.sortDir,
      }),
  });

  const clearSelection = React.useCallback(() => setSelectedRowIds({}), []);

  const deleteMutation = useMutation({
    mutationFn: deleteInventoryProduct,
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: t("inventory.common.deleted", "Product deleted."),
        submittedMessage: t("workflow.submitted_for_approval", "Submitted for approval."),
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["inventory", "products"] });
      clearSelection();
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t("inventory.common.failed", "Failed to delete product.")));
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: number[]; status: ProductStatus }) =>
      bulkUpdateInventoryProductsStatus(ids, status),
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: t("inventory.common.saved", "Status updated."),
        submittedMessage: t("workflow.submitted_for_approval", "Submitted for approval."),
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["inventory", "products"] });
      clearSelection();
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t("inventory.common.failed", "Failed to update status.")));
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
    setEditingProductId(null);
    setModalMode("create");
    setModalOpen(true);
  }, []);

  const openEdit = React.useCallback((id: number) => {
    setEditingProductId(id);
    setModalMode("edit");
    setModalOpen(true);
  }, []);

  const openDuplicate = React.useCallback((id: number) => {
    setEditingProductId(id);
    setModalMode("duplicate");
    setModalOpen(true);
  }, []);

  const closeModal = React.useCallback(() => {
    setModalOpen(false);
    setEditingProductId(null);
  }, []);

  const openDetailSheet = React.useCallback((id: number) => {
    setDetailProductId(id);
    setDetailSheetOpen(true);
  }, []);

  const closeDetailSheet = React.useCallback(() => {
    setDetailSheetOpen(false);
    setDetailProductId(null);
  }, []);

  const openQaDialog = React.useCallback((product: ProductRecord) => {
    setQaProduct(product);
  }, []);

  const closeQaDialog = React.useCallback(() => {
    setQaProduct(null);
  }, []);


  const handleBulkStatus = React.useCallback(
    (status: ProductStatus) => {
      if (selectedIds.length === 0) {
        toast.error(t("inventory.common.select_at_least_one", "Select at least one product first."));
        return;
      }

      bulkStatusMutation.mutate({ ids: selectedIds, status });
    },
    [bulkStatusMutation, selectedIds, t]
  );

  const handleBulkDelete = React.useCallback(
    async (ids: number[]) => {
      if (ids.length === 0) {
        toast.error(t("inventory.common.select_at_least_one", "Select at least one product first."));
        return;
      }

      setBulkDeleting(true);
      try {
        const results = await Promise.all(ids.map((id) => deleteInventoryProduct(id)));
        notifyBulkDeleteOutcomes(results, {
          savedMessage: (count) => `${count} ${t("inventory.products.bulk_deleted_msg", "product(s) deleted.")}`,
          submittedMessage: t("workflow.submitted_for_approval", "Submitted for approval."),
          queryClient,
        });
        queryClient.invalidateQueries({ queryKey: ["inventory", "products"] });
        clearSelection();
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, t("inventory.common.failed", "Failed to delete selected products.")));
      } finally {
        setBulkDeleting(false);
      }
    },
    [clearSelection, queryClient, t]
  );

  const columns = React.useMemo<ColumnDef<ProductRecord>[]>(
    () => {
      const cols: ColumnDef<ProductRecord>[] = [
      {
        accessorKey: "image",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const imageUrl = getInventoryAssetPreviewUrl({
            path: row.original.image,
            previewUrl: row.original.image_preview_url,
          });
          return imageUrl ? (
            <button onClick={() => openDetailSheet(row.original.id)} className="cursor-pointer">
              <SecureAssetImage
                src={imageUrl}
                alt={row.original.name}
                className="h-10 w-10 rounded-lg object-cover hover:opacity-80 transition-opacity"
                loadingClassName="animate-pulse bg-muted/40"
              />
            </button>
          ) : (
            <button onClick={() => openDetailSheet(row.original.id)} className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
              <Box className="h-5 w-5 text-muted-foreground" />
            </button>
          );
        },
        meta: { align: "left" as const },
      },
      {
        accessorKey: "name",
        header: t("inventory.products.col_name", "Product"),
        cell: ({ row }) => (
          <button onClick={() => openDetailSheet(row.original.id)} className="font-bold text-primary hover:underline text-left">
            {row.original.name}
          </button>
        ),
      },
      {
        accessorKey: "sku",
        header: "SKU",
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.sku}</span>,
      },
      {
        id: "category",
        header: "Category",
        cell: ({ row }) => {
          const cat = row.original.category;
          return cat ? (
            <span className="text-sm bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
              {cat.name}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          );
        },
      },
      {
        accessorKey: "stock_code",
        header: "Stock Code",
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.stock_code || "-"}</span>,
      },
      {
        accessorKey: "quantity",
        header: "Stock Qty",
        cell: ({ row }) => <span className="font-mono font-bold">{row.original.quantity}</span>,
        meta: { align: "right" as const },
      },
      {
        accessorKey: "unit_price",
        header: "Unit Price",
        cell: ({ row }) => (
          <span className="font-mono font-bold">
            {formatProductMoney(row.original.unit_price, row.original.currency) ?? "0.00"}
          </span>
        ),
        meta: { align: "right" as const },
      },
      {
        id: "qa_status",
        header: "QA Status",
        cell: ({ row }) => {
          const status = row.original.qa_status || "pending";
          
          const configs = {
            pending: { label: "Pending", icon: Clock, className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
            qa_passed: { label: "Passed", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
            qa_failed: { label: "Failed", icon: XCircle, className: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
            no_batches: { label: "No Batch", icon: AlertTriangle, className: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
          };

          const config = configs[status as keyof typeof configs] || configs.pending;
          const Icon = config.icon;

          return (
            <Badge variant="outline" className={cn("flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 font-bold shadow-none", config.className)}>
              <Icon className="h-3 w-3" />
              {config.label}
            </Badge>
          );
        },
        meta: { align: "center" as const },
      },
      {
        accessorKey: "status",
        header: t("inventory.products.col_status", "Status"),
        cell: ({ row }) => {
          const status = row.original.status as ProductStatus;
          return (
            <Badge
              variant={status === "published" ? "default" : "outline"}
              className="capitalize"
            >
              {t(`inventory.common.${status}`, status)}
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
          const product = row.original;
          return (
            <div className="flex justify-start gap-2">
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => openDetailSheet(product.id)}>
                <Eye className="mr-1 h-3.5 w-3.5" />
                {t("inventory.common.view", "View")}
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEdit(product.id)}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                {t("inventory.common.edit", "Edit")}
              </Button>
              {hasBusinessType("water-bottling") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full border-sky-500/40 bg-sky-500/10 text-sky-600 hover:bg-sky-500/20"
                  onClick={() => openQaDialog(product)}
                >
                  <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
                  Add To QA
                </Button>
              )}
              <WorkflowTrigger
                type="Modules\\Inventory\\Models\\Product"
                id={product.id}
                name={product.name}
                status={product.workflow_status}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ["inventory", "products"] })}
                showStatusBadge={false}
              />
              {hasModule("warehouse_management") && (() => {
                const meta = (product.metadata as Record<string, any> | null | undefined) ?? {};
                const pending = meta.pending_warehouse_assignment as
                  | {
                      submission_id?: number;
                      location_id?: number;
                      shelf_id?: number;
                      location_code?: string;
                      row?: number;
                      column?: number;
                    }
                  | undefined;
                const assignment = meta.assigned_warehouse_box as
                  | {
                      location_id?: number;
                      shelf_id?: number;
                      location_code?: string;
                      row?: number;
                      column?: number;
                    }
                  | undefined;
                const isPendingApproval = !!pending?.submission_id || !!pending?.location_id;
                const isOnShelf = !isPendingApproval && (!!assignment?.location_id || !!assignment?.shelf_id);
                const shelfHref = assignment?.shelf_id
                  ? `/dashboard/warehouse/locations/boxes?highlight_parent_id=${assignment.shelf_id}`
                  : `/dashboard/warehouse/locations/shelves?add_product_id=${product.id}`;
                const addHref = `/dashboard/warehouse/locations/shelves?add_product_id=${product.id}`;
                const qaBlocked =
                  hasBusinessType("water-bottling") && product.qa_status !== "qa_passed";

                return (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex">
                        {isPendingApproval ? (
                          <span
                            className="inline-flex items-center justify-center rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-700"
                          >
                            <Clock className="mr-1 h-3.5 w-3.5" />
                            {t("inventory.products.waiting_approval", "Waiting for approval")}
                          </span>
                        ) : (
                          <Link
                            href={isOnShelf ? shelfHref : addHref}
                            className={cn(
                              "inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                              qaBlocked
                                ? "pointer-events-none border-slate-300 bg-slate-100 text-slate-400 opacity-60"
                                : isOnShelf
                                  ? "border-blue-500/50 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20"
                                  : "border-emerald-500/50 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                            )}
                            onClick={(e) => {
                              if (qaBlocked) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <MapPin className="mr-1 h-3.5 w-3.5" />
                            {isOnShelf
                              ? t("inventory.products.on_shelf", "On Shelf")
                              : t("inventory.products.add_to_shelf", "Add to Shelf")}
                          </Link>
                        )}
                      </div>
                    </TooltipTrigger>
                    {qaBlocked ? (
                      <TooltipContent className="rounded-xl border-border bg-background/95 p-3 font-medium text-foreground shadow-xl backdrop-blur-md">
                        <div className="flex items-center gap-2 text-rose-500">
                          <AlertTriangle className="h-4 w-4" />
                          <span>QA approval required before shelf placement.</span>
                        </div>
                      </TooltipContent>
                    ) : isPendingApproval ? (
                      <TooltipContent className="rounded-xl border-border bg-background/95 p-3 font-medium text-foreground shadow-xl backdrop-blur-md">
                        <span>
                          {pending?.location_code
                            ? `Pending approval for ${pending.location_code}`
                            : pending?.row && pending?.column
                              ? `Pending approval for R${pending.row}C${pending.column}`
                              : "Shelf assignment is waiting for approval"}
                        </span>
                      </TooltipContent>
                    ) : isOnShelf ? (
                      <TooltipContent className="rounded-xl border-border bg-background/95 p-3 font-medium text-foreground shadow-xl backdrop-blur-md">
                        <span>
                          {assignment?.location_code
                            ? `Stored at ${assignment.location_code}`
                            : assignment?.row && assignment?.column
                              ? `Stored at R${assignment.row}C${assignment.column}`
                              : "View shelf location"}
                        </span>
                      </TooltipContent>
                    ) : null}
                  </Tooltip>
                </TooltipProvider>
                );
              })()}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="rounded-full" disabled={deleteMutation.isPending}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    {t("inventory.common.delete", "Delete")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("inventory.common.confirm", "Delete Product?")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("inventory.products.delete_selected_desc", "This will permanently delete the selected item.")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">{t("inventory.common.cancel", "Cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      className="rounded-xl bg-destructive hover:bg-destructive/90"
                      onClick={() => deleteMutation.mutate(product.id)}
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
    ];
    if (!hasBusinessType("water-bottling")) {
      return cols.filter((col) => col.id !== "qa_status");
    }
    return cols;
  },
  [deleteMutation, openDetailSheet, openEdit, openQaDialog, queryClient, t, hasModule, hasBusinessType]
);

  const exportUrl = React.useMemo(() => {
    const params = new URLSearchParams();
    if (tableQuery.search) params.set("search", tableQuery.search);
    if (statusFilter) params.set("status", statusFilter);
    params.set("sortCol", tableQuery.sortCol);
    params.set("sortDir", tableQuery.sortDir);
    return `/inventory/products/export?${params.toString()}`;
  }, [statusFilter, tableQuery.search, tableQuery.sortCol, tableQuery.sortDir]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("inventory.products.title", "Product Catalog")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("inventory.products.subtitle", "Manage your product inventory, pricing, and stock levels.")}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t("inventory.products.add_btn", "Create Product")}
        </Button>
      </div>

      <section className="rounded-3xl border border-border/50 bg-card/50 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("inventory.common.status", "Status")}</label>
            <select
              className="h-9 w-full rounded-full border border-border/50 bg-background/50 px-3 text-xs focus:outline-none sm:w-[180px]"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                applyTableQuery({ page: 1 });
                clearSelection();
              }}
            >
              <option value="">{t("inventory.common.all_statuses", "All statuses")}</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {t(`inventory.common.${status}`, status)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              disabled={selectedIds.length === 0 || bulkStatusMutation.isPending}
              onClick={() => handleBulkStatus("draft")}
            >
              {t("inventory.products.mark_draft", "Mark Draft")}
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              disabled={selectedIds.length === 0 || bulkStatusMutation.isPending}
              onClick={() => handleBulkStatus("published")}
            >
              {t("inventory.products.mark_published", "Mark Published")}
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              disabled={selectedIds.length === 0 || bulkStatusMutation.isPending}
              onClick={() => handleBulkStatus("archived")}
            >
              {t("inventory.products.mark_archived", "Mark Archived")}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="rounded-xl shadow-lg shadow-red-500/20"
                  disabled={selectedIds.length === 0 || bulkDeleting || deleteMutation.isPending}
                >
                  {bulkDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {t("inventory.common.delete_selected", "Delete Selected")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("inventory.products.delete_selected_title", "Delete Selected Products?")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("inventory.products.delete_selected_desc", "This will permanently delete the selected products. This action cannot be undone.")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">{t("inventory.common.cancel", "Cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    className="rounded-xl bg-destructive hover:bg-destructive/90"
                    onClick={() => handleBulkDelete(selectedIds)}
                  >
                    {t("inventory.common.confirm", "Confirm Delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </section>

      <DataTable
        columns={columns}
        data={productsQuery.data?.data ?? []}
        totalEntries={productsQuery.data?.total ?? 0}
        loading={productsQuery.isLoading || productsQuery.isFetching}
        exportEndpoint={exportUrl}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        enableRowSelection
        selectedRowIds={selectedRowIds}
        onSelectionChange={(payload) => setSelectedRowIds(payload.selectedRowIds as RowSelectionState)}
        onDeleteRows={async (rows) => {
          if (rows.length === 0) return;
          await handleBulkDelete(rows.map((row) => row.id));
        }}
        onQueryChange={handleTableQueryChange}
        onRefresh={() => {
          clearSelection();
          queryClient.invalidateQueries({ queryKey: ["inventory", "products"] });
        }}
        onResetFilters={() => {
          setStatusFilter("");
          applyTableQuery(DEFAULT_QUERY);
          clearSelection();
        }}
        searchPlaceholder={t("inventory.products.search_placeholder", "Search by name, SKU, or stock code...")}
        resourceName="products"
        syncWithUrl={false}
      />

      <ProductFormModal
        open={modalOpen}
        mode={modalMode}
        productId={editingProductId}
        onClose={closeModal}
      />
      <ProductQaBatchDialog
        open={Boolean(qaProduct)}
        product={qaProduct}
        onClose={closeQaDialog}
      />

      {detailProductId && (
        <ProductDetailSheet 
          productId={detailProductId} 
          open={detailSheetOpen} 
          onClose={closeDetailSheet} 
          onEdit={(id: number) => { closeDetailSheet(); openEdit(id); }} 
          onDuplicate={(id: number) => { closeDetailSheet(); openDuplicate(id); }} 
          onAddToQa={(product: ProductRecord) => {
            closeDetailSheet();
            openQaDialog(product);
            router.prefetch("/dashboard/inventory/qa");
          }}
        />
      )}

    </div>
  );
}

function ProductDetailSheet({
  productId,
  open,
  onClose,
  onEdit,
  onDuplicate,
  onAddToQa,
}: {
  productId: number;
  open: boolean;
  onClose: () => void;
  onEdit: (id: number) => void;
  onDuplicate: (id: number) => void;
  onAddToQa: (product: ProductRecord) => void;
}) {
  const queryClient = useQueryClient();
  const { hasBusinessType } = useBusinessType();
  const { data, isLoading } = useQuery({
    queryKey: ["inventory", "products", "detail", productId],
    queryFn: () => fetchInventoryProduct(productId),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });

  const product = data?.product;
  const imageUrl = getInventoryAssetPreviewUrl({
    path: product?.image,
    previewUrl: product?.image_preview_url,
  });
  const modelUrl = getInventoryAssetPreviewUrl({
    path: product?.model_3d_path,
    previewUrl: product?.model_3d_preview_url,
  });
  const barcodeUrl = getBackendStorageUrl(product?.barcode_path);
  const countryLabel = data?.country_name || product?.country_of_origin || "-";
  const currencyCode = product?.currency || "USD";
  const modelLabel = getAssetNameFromPath(product?.model_3d_path) || "No 3D model linked";
  const attributeRows = Array.isArray(product?.attributes)
    ? product.attributes.filter((attr) => attr.key || attr.value)
    : Object.entries((product?.attributes ?? {}) as Record<string, unknown>).map(([key, value]) => ({
        key,
        value: String(value ?? ""),
      }));
  const nutritionRows = Array.isArray(product?.nutritional_info)
    ? product.nutritional_info.filter((info) => info.key || info.value)
    : Object.entries((product?.nutritional_info ?? {}) as Record<string, unknown>).map(([key, value]) => ({
        key,
        value: String(value ?? ""),
      }));

  const handleOpenAsset = async (assetUrl: string | null, failureMessage: string) => {
    if (!assetUrl) return;

    try {
      await openSecureAssetInNewTab(assetUrl);
    } catch {
      toast.error(failureMessage);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[95vh] w-[95vw] max-w-[1700px] sm:max-w-[95vw] lg:max-w-[1700px] overflow-y-auto rounded-[3.5rem] border border-white/10 bg-[#060608]/95 backdrop-blur-3xl p-0 shadow-[0_0_120px_rgba(0,0,0,0.9)] transition-all duration-700 ease-in-out !outline-none"
      >
        <DialogClose
          className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 z-30 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
        >
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogClose>
        <DialogHeader className="sticky top-0 z-20 border-b border-white/5 bg-zinc-950/40 backdrop-blur-2xl px-10 py-8">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-6">
              <div className="relative group">
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-primary/40 to-primary/10 blur-xl transition duration-500 group-hover:blur-2xl" />
                {imageUrl ? (
                  <SecureAssetImage
                    src={imageUrl}
                    alt={product?.name ?? "Product"}
                    className="relative h-24 w-24 rounded-[1.5rem] object-cover shadow-2xl border-2 border-white/10 group-hover:scale-110 transition-transform duration-500"
                    loadingClassName="animate-pulse bg-muted/40"
                  />
                ) : (
                  <div className="relative h-24 w-24 rounded-[1.5rem] bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center shadow-2xl border-2 border-white/10">
                    <Package className="h-12 w-12 text-primary animate-pulse" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
              <div className="text-4xl font-black tracking-tight text-white drop-shadow-md">{product?.name ?? "Product Details"}</div>
                <div className="flex items-center gap-3">
                  {product?.sku && (
                    <Badge variant="outline" className="font-mono text-xs tracking-wider border-primary/30 bg-primary/5 px-2 py-0.5">
                      {product.sku}
                    </Badge>
                  )}
                  <Badge variant={product?.status === "published" ? "default" : "secondary"} className="capitalize font-bold px-3">
                    {product?.status}
                  </Badge>
                </div>
            </div>
          </DialogTitle>
            <div className="flex items-center gap-3">
              {product ? (
                <>
                  {hasBusinessType("water-bottling") && (
                    <Button
                      onClick={() => onAddToQa(product)}
                      variant="outline"
                      className="rounded-2xl h-12 px-6 font-bold shadow-lg border-sky-500/30 bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 transition-all hover:scale-105 active:scale-95"
                    >
                      <ClipboardCheck className="mr-2 h-5 w-5" />
                      Add To QA
                    </Button>
                  )}
                  <WorkflowTrigger
                    type="Modules\\Inventory\\Models\\Product"
                    id={product.id}
                    name={product.name}
                    status={product.workflow_status}
                    onSuccess={() => queryClient.invalidateQueries({ queryKey: ["inventory", "products"] })}
                    showStatusBadge={false}
                  />
                </>
              ) : null}
              <Button 
                onClick={() => onDuplicate(product!.id)} 
                variant="outline"
                className="rounded-2xl h-12 px-6 font-bold shadow-lg border-white/10 hover:bg-white/5 transition-all hover:scale-105 active:scale-95"
              >
                <Copy className="mr-2 h-5 w-5" />
                Duplicate
              </Button>
              <Button 
                onClick={() => onEdit(product!.id)} 
                className="rounded-2xl h-12 px-6 font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:scale-105 active:scale-95"
              >
                <Pencil className="mr-2 h-5 w-5" />
                Refine Product
              </Button>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex min-h-[600px] items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary/40" />
              <p className="text-sm font-medium text-muted-foreground animate-pulse">Synchronizing hive data...</p>
            </div>
          </div>
        ) : product ? (
          <div className="p-12">
            <div className="grid grid-cols-12 gap-12">
              {/* Column 1: Identity & Visuals */}
              <div className="col-span-12 lg:col-span-4 space-y-8">
                {/* Visual Identity Card */}
                <div className="group relative overflow-hidden rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl transition-all hover:shadow-2xl hover:border-primary/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative p-2">
                    {imageUrl ? (
                      <div className="relative aspect-square overflow-hidden rounded-[1.8rem]">
                        <SecureAssetImage
                          src={imageUrl}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                          loadingClassName="animate-pulse bg-muted/40"
                        />
                        <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-[1.8rem]" />
                      </div>
                    ) : (
                      <div className="aspect-square rounded-[1.8rem] bg-muted/30 flex items-center justify-center">
                        <Package className="h-20 w-20 text-muted-foreground/20" />
                      </div>
                    )}
                  </div>
                  <div className="p-6 pt-2">
                    <div className="flex items-center justify-between mb-4">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">Registry Name</p>
                        <p className="text-lg font-black text-white truncate max-w-[220px]">{getAssetNameFromPath(product.image) || "Default Registry"}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {product.country_of_origin && (
                          <div className="flex flex-col items-end">
                             <p className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/40">Origin</p>
                             <Badge variant="outline" className="rounded-lg text-[10px] border-white/10">{countryLabel}</Badge>
                          </div>
                        )}
                        {imageUrl && (
                          <Button 
                            variant="secondary" 
                            size="icon" 
                            className="rounded-xl h-10 w-10 shadow-sm"
                            onClick={() => handleOpenAsset(imageUrl, "Failed to open image")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-4 pt-2">
                      <div className="flex justify-between items-center p-3 rounded-2xl bg-white/5 border border-white/5">
                        <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Stock Code</span>
                        <span className="text-xs font-mono font-bold text-white">{product.stock_code || "N/A"}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-2xl bg-white/5 border border-white/5">
                        <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">UOM / Unit</span>
                        <span className="text-xs font-bold text-white">{product.uom || "PCS"} / {product.unit || "unit"}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* About & Description Card */}
                {product.description && (
                  <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl p-6 relative overflow-hidden group hover:border-primary/20 transition-all">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <FileText className="h-4 w-4" />
                      </div>
                      <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">Description</h3>
                    </div>
                    <p className="text-sm text-muted-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {product.description}
                    </p>
                  </div>
                )}
                <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl p-6 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
                      <Info className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">Catalog Record</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailField label="Currency" value={currencyCode} />
                    <DetailField label="Country" value={countryLabel} />
                    <DetailField label="Category" value={product.category?.name || "Uncategorized"} />
                    <DetailField label="Variant Mode" value={product.parent_product_id ? "Variant" : "Standalone"} />
                    <DetailField label="Parent Product" value={product.parent?.name || "-"} />
                    <DetailField label="Units Per Package" value={String(product.units_per_package || 1)} />
                    <DetailField label="Status" value={product.status} />
                  </div>
                </div>
                {/* 3D Visualizer Card */}
                <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl overflow-hidden group hover:border-primary/20 transition-all">
                  <div className="p-6 pb-2">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                        <Maximize2 className="h-4 w-4" />
                      </div>
                      <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">3D Topology</h3>
                    </div>
                  </div>
                  <div className="px-2 pb-2">
                    <Model3DViewer
                      src={modelUrl}
                      alt={modelLabel}
                      className="rounded-[1.5rem] border-0 overflow-hidden"
                      viewerClassName="aspect-square lg:aspect-auto lg:h-[300px]"
                      emptyTitle="No Spatial Data"
                      emptyDescription="Upload a GLB/GLTF model to enable 3D inspection."
                    />
                  </div>
                </div>
                {/* Barcode & Taxonomy */}
                <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl p-6 space-y-6">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
                        <QrCode className="h-4 w-4" />
                      </div>
                      <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">Identification</h3>
                    </div>
                    {barcodeUrl ? (
                      <div className="bg-white p-4 rounded-2xl shadow-inner mb-3">
                        <SecureAssetImage
                          src={barcodeUrl}
                          alt="Barcode"
                          className="h-16 w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="h-20 rounded-2xl border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground mb-3">
                        No barcode generated
                      </div>
                    )}
                    <p className="font-mono text-center text-xs tracking-[0.3em] font-bold text-muted-foreground">{product.barcode || "UNDEFINED"}</p>
                  </div>
                </div>
              </div>

              {/* Column 2: Performance & Logistics */}
              <div className="col-span-12 lg:col-span-4 space-y-8">
                {/* Financial Summary Card */}
                <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl p-6 relative overflow-hidden group hover:border-emerald-500/20 transition-all">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                    <TrendingUp className="h-24 w-24 text-emerald-500" />
                  </div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 shadow-inner">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/80">Financials</h3>
                  </div>
                  
                  <div className="space-y-8">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Base Price</p>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                          {formatProductMoney(product.unit_price, currencyCode) ?? "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Tax Rate</p>
                        <p className="text-xl font-bold text-white/80">
                          {product.tax_rate}%
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Cost Basis</p>
                        <p className="text-xl font-bold text-muted-foreground/80">
                          {formatProductMoney(product.cost_of_good, currencyCode) ?? "--"}
                        </p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Sale Price</p>
                        <p className="text-xl font-bold text-orange-500">
                          {formatProductMoney(product.sale_price, currencyCode) ?? "N/A"}
                        </p>
                      </div>
                    </div>

                    {product.unit_price && product.cost_of_good && parseFloat(product.unit_price) > 0 && (
                      <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between group-hover:bg-primary/10 transition-colors">
                        <div className="flex items-center gap-3">
                           <div className="p-2 rounded-xl bg-primary/20 text-primary">
                             <TrendingUp className="h-4 w-4" />
                           </div>
                           <span className="text-xs font-bold uppercase tracking-widest text-primary/80">Estimated Margin</span>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-primary">
                            {((parseFloat(product.unit_price) - parseFloat(product.cost_of_good)) / parseFloat(product.unit_price) * 100).toFixed(1)}%
                          </p>
                          <p className="text-[9px] font-bold text-primary/40 uppercase tracking-tighter">Gross Profitability</p>
                        </div>
                      </div>
                    )}

                    <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
                      <div className="space-y-1">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Stock Level</p>
                         <div className="flex items-baseline gap-2">
                            <span className={cn(
                              "text-xl font-black",
                              product.track_inventory && parseFloat(product.quantity || "0") <= (product.reorder_point || 0) 
                                ? "text-red-500 animate-pulse" 
                                : "text-white"
                            )}>
                              {product.quantity || 0}
                            </span>
                            <span className="text-[10px] font-bold text-muted-foreground/40">{product.unit || "unit"}</span>
                            {product.track_inventory && parseFloat(product.quantity || "0") <= (product.reorder_point || 0) && (
                              <Badge variant="destructive" className="ml-2 h-4 text-[8px] px-1 rounded-sm animate-bounce uppercase">Low Stock</Badge>
                            )}
                         </div>
                      </div>
                      <div className="space-y-1 text-center">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Reorder</p>
                         <p className="text-sm font-bold text-white">{product.reorder_point || 0}</p>
                      </div>
                      <div className="space-y-1 text-right">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Package</p>
                         <p className="text-sm font-bold text-white">{product.units_per_package || 1} / {product.uom || "PCS"}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                        <div className="flex items-center gap-3">
                           <div className={cn("h-2 w-2 rounded-full", product.track_inventory ? "bg-emerald-500" : "bg-slate-500")} />
                           <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Track Inventory</span>
                           <Badge variant="outline" className="text-[9px] h-5 border-white/5">{product.track_inventory ? "YES" : "NO"}</Badge>
                        </div>
                        <div className="flex items-center gap-3 justify-end">
                           <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Backorders</span>
                           <Badge variant="outline" className={cn("text-[9px] h-5", product.allow_backorders ? "text-emerald-500 border-emerald-500/20" : "text-slate-500 border-slate-500/20")}>
                             {product.allow_backorders ? "ALLOWED" : "DENIED"}
                           </Badge>
                        </div>
                    </div>
                  </div>
                </div>
                {/* Logistics & Dimensions */}
                <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl p-6 space-y-8">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-500 shadow-inner">
                      <Truck className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/80">Logistics</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Weight</p>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                        <span className="text-sm font-bold">{product.weight || "--"} <span className="text-[10px] text-muted-foreground/40">{product.weight_unit || "kg"}</span></span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Lead Time</p>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                        <span className="text-sm font-bold">{product.lead_time_days || "--"} <span className="text-[10px] text-muted-foreground/40">days</span></span>
                      </div>
                    </div>
                    {product.hs_code && (
                      <div className="space-y-1.5 col-span-2 pt-2 border-t border-border/50">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">HS Code</p>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          <span className="text-sm font-bold font-mono tracking-widest">{product.hs_code}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl bg-muted/30 p-4 space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Spatial Dimensions</p>
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground font-medium mb-1">Length</p>
                        <p className="text-sm font-black">{product.length || "0"}</p>
                      </div>
                      <div className="h-8 w-px bg-border/50" />
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground font-medium mb-1">Width</p>
                        <p className="text-sm font-black">{product.width || "0"}</p>
                      </div>
                      <div className="h-8 w-px bg-border/50" />
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground font-medium mb-1">Height</p>
                        <p className="text-sm font-black">{product.height || "0"}</p>
                      </div>
                      <div className="ml-2 px-2 py-1 rounded bg-background text-[10px] font-bold text-muted-foreground/60">
                        {product.dimension_unit || "mm"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Column 3: Variants & System Metadata */}
              <div className="col-span-12 lg:col-span-4 space-y-8">
                {/* Variants & Attributes */}
                <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl p-6 flex flex-col min-h-[300px]">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 shadow-inner">
                        <Layers className="h-5 w-5" />
                      </div>
                      <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/80">Composition</h3>
                    </div>
                    <Badge variant="outline" className="rounded-lg font-bold text-[10px]">
                      {product.variants?.length || 0} Variants
                    </Badge>
                  </div>

                  <div className="flex-1 space-y-4">
                    {product.variants && product.variants.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2">
                        {product.variants.slice(0, 4).map((variant) => (
                          <div key={variant.id} className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-border/50 hover:bg-muted/40 transition-colors group cursor-default">
                            <span className="text-xs font-bold truncate max-w-[140px]">{variant.name || variant.sku}</span>
                            <span className="text-[10px] font-mono bg-background px-2 py-1 rounded-lg group-hover:text-primary transition-colors">{variant.sku || "--"}</span>
                          </div>
                        ))}
                        {product.variants.length > 4 && (
                          <Button variant="ghost" className="w-full text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary mt-2">
                            + {product.variants.length - 4} more variants
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-[1.5rem] p-6 text-center">
                        <Info className="h-8 w-8 text-muted-foreground/20 mb-2" />
                        <p className="text-xs font-bold text-muted-foreground/40 uppercase tracking-tighter">Unified SKU System</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Technical Specifications & JSON Data */}
                {(attributeRows.length > 0 || nutritionRows.length > 0) && (
                  <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl p-6 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500 shadow-inner">
                        <Settings2 className="h-5 w-5" />
                      </div>
                      <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/80">Specifications</h3>
                    </div>

                    <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {attributeRows.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Extended Attributes</p>
                          <div className="grid grid-cols-1 gap-2">
                            {attributeRows.map((attr, idx) => (
                              <div key={`${attr.key}-${idx}`} className="flex justify-between items-center p-2 rounded-xl bg-white/5 border border-white/5">
                                <span className="text-[10px] font-medium text-muted-foreground uppercase">{attr.key.replace(/_/g, " ")}</span>
                                <span className="text-xs font-bold text-white">{String(attr.value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {nutritionRows.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500/60">Nutritional Profile</p>
                          <div className="grid grid-cols-2 gap-2">
                            {nutritionRows.map((attr, idx) => (
                              <div key={`${attr.key}-${idx}`} className="flex flex-col p-2 rounded-xl bg-white/5 border border-white/5">
                                <span className="text-[9px] font-medium text-muted-foreground uppercase">{attr.key}</span>
                                <span className="text-xs font-black text-white">{String(attr.value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* System Metadata */}
                <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl p-6 space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 rounded-2xl bg-slate-500/10 text-slate-500 shadow-inner">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/80">Audit Trail</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 h-2 w-2 rounded-full bg-primary/40 ring-4 ring-primary/5" />
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Provisioned</p>
                        <p className="text-xs font-bold" suppressHydrationWarning>{formatProductDate(product.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="mt-1 h-2 w-2 rounded-full bg-emerald-400/40 ring-4 ring-emerald-400/5" />
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Last Synchronization</p>
                        <p className="text-xs font-bold" suppressHydrationWarning>{formatProductDate(product.updated_at)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-border/50 flex flex-col gap-4">
                    {product.tags && product.tags.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Tags</p>
                        <div className="flex flex-wrap gap-2">
                          {product.tags.map((tag) => (
                             <Badge key={tag.id} variant="secondary" className="rounded-md font-medium text-[10px] border border-border/50">{tag.name}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="rounded-lg text-[9px] font-bold bg-slate-500/5 text-slate-500 hover:bg-slate-500/10 transition-colors">
                        ID: {product.id.toString().slice(0, 8)}
                      </Badge>
                      {product.parent_product_id && (
                        <Badge variant="secondary" className="rounded-lg text-[9px] font-bold bg-indigo-500/5 text-indigo-500 hover:bg-indigo-500/10 transition-colors">
                          VARIANT OF: {product.parent?.name || product.parent_product_id}
                        </Badge>
                      )}
                    {product.category && (
                      <Badge variant="secondary" className="rounded-lg text-[9px] font-bold bg-blue-500/5 text-blue-500 hover:bg-blue-500/10 transition-colors">
                        PATH: {product.category.name}
                      </Badge>
                    )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[400px] flex-col items-center justify-center p-12 text-center">
            <div className="rounded-full bg-destructive/5 p-6 mb-4">
              <Package className="h-12 w-12 text-destructive/20" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Entity Not Found</h3>
            <p className="text-muted-foreground max-w-[280px]">The requested product registry could not be located in the current hive context.</p>
            <Button variant="outline" className="mt-6 rounded-xl" onClick={onClose}>Return to Inventory</Button>
          </div>
        ) }
      </DialogContent>
    </Dialog>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-muted/20 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}
