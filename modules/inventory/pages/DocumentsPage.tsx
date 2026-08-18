"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  Loader2,
  Plus,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  fetchInventoryDocument,
  fetchInventoryDocuments,
  runInventoryDocumentAction,
} from "@/modules/inventory/api";
import { WorkflowTrigger } from "@/modules/workflow/components/workflow-trigger";
import { notifyMutationOutcome } from "@/modules/workflow/utils/mutation-outcome";
import { InventoryDocumentFormModal } from "./components/inventory-document-form-modal";

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

type InventoryDocumentRow = {
  id: number;
  document_number: string;
  title?: string | null;
  type: string;
  status: string;
  notes?: string | null;
  created_at: string;
  has_pending_workflow?: boolean;
  pending_workflow_action?: string | null;
  workflow_meta?: {
    pending_workflow_action?: {
      action?: string;
      submission_id?: number;
    } | null;
  } | null;
  items?: Array<{
    id: number;
    description?: string | null;
    quantity: string | number;
    unit?: string | null;
    unit_price?: string | number | null;
    total_price?: string | number | null;
    inventory_item?: { id: number; name: string; sku: string } | null;
  }>;
};

function isWaitingForApproval(doc: InventoryDocumentRow): boolean {
  if (doc.has_pending_workflow) return true;
  return Boolean(doc.workflow_meta?.pending_workflow_action?.submission_id);
}

/** Document lifecycle actions by type + current status (from InventoryBlueprint). */
const DOCUMENT_ACTIONS: Record<
  string,
  Array<{ action: string; label: string; from: string[]; variant: "default" | "destructive" | "outline" }>
> = {
  purchase_request: [
    { action: "submit", label: "Submit", from: ["draft"], variant: "outline" },
    { action: "approve", label: "Approve", from: ["submitted", "draft"], variant: "default" },
    { action: "reject", label: "Reject", from: ["submitted", "draft"], variant: "destructive" },
  ],
  purchase_order: [
    { action: "submit", label: "Submit", from: ["draft"], variant: "outline" },
    { action: "approve", label: "Approve", from: ["submitted", "draft"], variant: "default" },
    { action: "reject", label: "Reject", from: ["submitted", "draft"], variant: "destructive" },
  ],
  goods_receiving_note: [
    { action: "approve", label: "Approve & receive stock", from: ["pending"], variant: "default" },
    { action: "reject", label: "Reject", from: ["pending"], variant: "destructive" },
  ],
  production_order: [
    { action: "release", label: "Release", from: ["planned"], variant: "outline" },
    { action: "complete", label: "Complete", from: ["released", "planned"], variant: "default" },
    { action: "cancel", label: "Cancel", from: ["planned", "released"], variant: "destructive" },
  ],
  store_voucher: [
    { action: "approve", label: "Approve (issue stock)", from: ["prepared"], variant: "default" },
    { action: "receive", label: "Mark received", from: ["approved"], variant: "outline" },
  ],
  finished_goods_transfer: [
    { action: "approve", label: "Approve", from: ["created"], variant: "default" },
    { action: "receive", label: "Receive", from: ["approved"], variant: "outline" },
  ],
  sales_order: [
    { action: "submit", label: "Submit", from: ["draft"], variant: "outline" },
    { action: "approve", label: "Approve", from: ["submitted"], variant: "default" },
    { action: "reject", label: "Reject", from: ["submitted"], variant: "destructive" },
    { action: "fulfill", label: "Fulfill", from: ["approved"], variant: "outline" },
  ],
  delivery_note: [
    { action: "approve", label: "Approve", from: ["draft"], variant: "default" },
    { action: "dispatch", label: "Dispatch", from: ["approved"], variant: "outline" },
    { action: "confirm_delivery", label: "Confirm delivery", from: ["dispatched"], variant: "outline" },
  ],
  goods_return_note: [
    { action: "approve", label: "Approve", from: ["pending"], variant: "default" },
    { action: "process", label: "Process return", from: ["approved"], variant: "outline" },
    { action: "reject", label: "Reject", from: ["pending", "approved"], variant: "destructive" },
  ],
  dispatch: [
    { action: "approve", label: "Approve", from: ["pending"], variant: "default" },
    { action: "reject", label: "Reject", from: ["pending"], variant: "destructive" },
  ],
  sales_summary: [
    { action: "accountant_review", label: "Accountant review", from: ["draft"], variant: "outline" },
    { action: "gm_approve", label: "GM approve", from: ["accountant_reviewed"], variant: "default" },
    { action: "reject", label: "Reject", from: ["draft", "accountant_reviewed"], variant: "destructive" },
  ],
  waste_voucher: [
    { action: "check", label: "Check", from: ["prepared"], variant: "outline" },
    { action: "approve", label: "Approve", from: ["checked"], variant: "default" },
    { action: "process", label: "Process", from: ["approved"], variant: "outline" },
    { action: "reject", label: "Reject", from: ["prepared", "checked", "approved"], variant: "destructive" },
  ],
};

const STATUS_HELP: Record<string, string> = {
  pending: "Waiting for document approval (this is the document status, not a workflow rule).",
  draft: "Draft — submit or approve when ready.",
  submitted: "Submitted — waiting for approval.",
  approved: "Approved — stock effects (if any) have been applied.",
  rejected: "Rejected — no stock changes.",
  prepared: "Prepared — waiting for approval.",
  planned: "Planned — release or complete when ready.",
};

function availableActions(type: string, status: string) {
  return (DOCUMENT_ACTIONS[type] ?? []).filter((entry) => entry.from.includes(status));
}

function formatTypeLabel(type: string) {
  return type.replaceAll("_", " ");
}

export default function InventoryDocumentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tableQuery, setTableQuery] = React.useState<TableQueryState>(DEFAULT_QUERY);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [confirmAction, setConfirmAction] = React.useState<{
    id: number;
    action: string;
    label: string;
  } | null>(null);

  const documentsQuery = useQuery({
    queryKey: ["inventory", "documents", tableQuery],
    queryFn: () =>
      fetchInventoryDocuments({
        search: tableQuery.search || undefined,
        page: tableQuery.page,
        per_page: tableQuery.pageSize,
        sort_col: tableQuery.sortCol,
        sort_dir: tableQuery.sortDir,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ["inventory", "documents", "detail", selectedId],
    queryFn: () => fetchInventoryDocument(selectedId!),
    enabled: selectedId != null,
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      runInventoryDocumentAction(id, action),
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: t("inventory.docs.action_success", "Document updated successfully."),
        submittedMessage: t(
          "inventory.docs.action_pending",
          "Document action submitted for approval."
        ),
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["inventory", "documents"] });
      setConfirmAction(null);
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.errors?.status?.[0] ||
          err?.response?.data?.errors?.action?.[0] ||
          t("inventory.docs.action_failed", "Could not update document.")
      );
    },
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

  const columns = React.useMemo<ColumnDef<InventoryDocumentRow>[]>(
    () => [
      {
        accessorKey: "document_number",
        header: t("inventory.docs.col_number", "Document #"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <span className="font-bold">{row.original.document_number}</span>
          </div>
        ),
      },
      {
        accessorKey: "title",
        header: t("inventory.docs.col_title", "Title"),
        cell: ({ row }) => <span className="font-medium">{row.original.title || "-"}</span>,
      },
      {
        accessorKey: "type",
        header: t("inventory.docs.col_type", "Type"),
        cell: ({ row }) => (
          <Badge variant="outline" className="uppercase text-[11px] tracking-widest font-black">
            {formatTypeLabel(row.original.type)}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: t("inventory.common.status", "Status"),
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <Badge
              variant={
                status === "approved" || status === "completed" || status === "fulfilled"
                  ? "default"
                  : status === "rejected" || status === "cancelled"
                    ? "destructive"
                    : "secondary"
              }
              className="rounded-full px-3 py-0.5 capitalize"
              title={STATUS_HELP[status]}
            >
              {status}
            </Badge>
          );
        },
      },
      {
        accessorKey: "created_at",
        header: t("inventory.common.created_at", "Date"),
        cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
      },
      {
        id: "actions",
        header: t("inventory.common.actions", "Actions"),
        cell: ({ row }) => {
          const doc = row.original;
          const waiting = isWaitingForApproval(doc);
          const actions = waiting ? [] : availableActions(doc.type, doc.status);

          return (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => setSelectedId(doc.id)}
              >
                <Eye className="mr-1 h-3.5 w-3.5" />
                {t("inventory.common.view", "View")}
              </Button>

              {waiting ? (
                <span className="inline-flex items-center rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-700">
                  <Clock className="mr-1 h-3.5 w-3.5" />
                  {t("inventory.docs.waiting_approval", "Waiting for approval")}
                </span>
              ) : (
                actions.map((entry) => (
                  <Button
                    key={entry.action}
                    size="sm"
                    variant={entry.variant}
                    className="rounded-full"
                    disabled={actionMutation.isPending}
                    onClick={() =>
                      setConfirmAction({ id: doc.id, action: entry.action, label: entry.label })
                    }
                  >
                    {entry.action === "approve" ? (
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    ) : entry.action === "reject" || entry.action === "cancel" ? (
                      <XCircle className="mr-1 h-3.5 w-3.5" />
                    ) : null}
                    {entry.label}
                  </Button>
                ))
              )}

              <WorkflowTrigger
                type="Modules\\Inventory\\Models\\InventoryDocument"
                id={Number(doc.id)}
                name={`${doc.document_number} - ${doc.title || doc.type}`}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ["inventory", "documents"] })}
                showStatusBadge={false}
              />
            </div>
          );
        },
      },
    ],
    [actionMutation.isPending, queryClient, t]
  );

  const detail = (detailQuery.data ?? null) as InventoryDocumentRow | null;
  const detailWaiting = detail ? isWaitingForApproval(detail) : false;
  const detailActions =
    detail && !detailWaiting ? availableActions(detail.type, detail.status) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("inventory.docs.title", "Inventory Documents")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "inventory.docs.subtitle",
              "Create stock documents, review line items, then approve to apply inventory changes."
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("inventory.docs.add_btn", "Create Document")}
        </Button>
      </div>

     

      <DataTable
        columns={columns}
        data={(documentsQuery.data?.data ?? []) as InventoryDocumentRow[]}
        totalEntries={documentsQuery.data?.total ?? 0}
        loading={documentsQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t(
          "inventory.docs.search_placeholder",
          "Search by document number or title..."
        )}
        resourceName="documents"
      />

      <InventoryDocumentFormModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <Sheet open={selectedId != null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl ml-4">
          <SheetHeader className="ml-4">
            <SheetTitle>
              {detail?.document_number || t("inventory.docs.detail_title", "Document details")}
            </SheetTitle>
            <SheetDescription>
              {detail
                ? `${formatTypeLabel(detail.type)} · ${detail.status}`
                : t("inventory.docs.loading", "Loading document...")}
            </SheetDescription>
          </SheetHeader>

          {detailQuery.isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : detail ? (
            <div className="mt-6 space-y-6 ml-2 mr-2">
              <div className="grid gap-3 rounded-2xl border border-border/40 bg-muted/20 p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Title</span>
                  <span className="font-medium text-right">{detail.title || "-"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium capitalize">{formatTypeLabel(detail.type)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium capitalize">{detail.status}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">
                    {new Date(detail.created_at).toLocaleString()}
                  </span>
                </div>
                {STATUS_HELP[detail.status] ? (
                  <p className="border-t border-border/30 pt-3 text-xs text-muted-foreground">
                    {STATUS_HELP[detail.status]}
                  </p>
                ) : null}
                {detail.notes ? (
                  <div className="border-t border-border/30 pt-3">
                    <p className="mb-1 text-muted-foreground">Notes</p>
                    <p className="whitespace-pre-wrap">{detail.notes}</p>
                  </div>
                ) : null}
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Line items
                </h3>
                <div className="space-y-2">
                  {(detail.items ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No line items.</p>
                  ) : (
                    (detail.items ?? []).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border/40 bg-background/60 p-3 text-sm"
                      >
                        <div className="font-semibold">
                          {item.inventory_item?.name || item.description || `Item #${item.id}`}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {item.inventory_item?.sku ? <span>SKU: {item.inventory_item.sku}</span> : null}
                          <span>
                            Qty: {item.quantity} {item.unit || ""}
                          </span>
                          {item.unit_price != null ? <span>Unit: {item.unit_price}</span> : null}
                          {item.total_price != null ? <span>Total: {item.total_price}</span> : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {detailWaiting ? (
                <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-700">
                  <Clock className="h-4 w-4" />
                  {t(
                    "inventory.docs.waiting_approval_detail",
                    "Waiting for approval — document actions are locked until this is approved or rejected."
                  )}
                </div>
              ) : detailActions.length > 0 ? (
                <div className="flex flex-wrap gap-2 border-t border-border/30 pt-4">
                  {detailActions.map((entry) => (
                    <Button
                      key={entry.action}
                      variant={entry.variant}
                      className="rounded-full"
                      disabled={actionMutation.isPending}
                      onClick={() =>
                        setConfirmAction({
                          id: detail.id,
                          action: entry.action,
                          label: entry.label,
                        })
                      }
                    >
                      {entry.label}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No further document actions for status “{detail.status}”.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">Document not found.</p>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.label ?? "Confirm action"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === "approve"
                ? "This may update inventory stock depending on the document type (for example, a Goods Receiving Note adds stock)."
                : "Are you sure you want to continue with this document action?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={actionMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              disabled={actionMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!confirmAction) return;
                actionMutation.mutate({ id: confirmAction.id, action: confirmAction.action });
              }}
            >
              {actionMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
