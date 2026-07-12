"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus } from "lucide-react";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchInventoryDocuments, createInventoryDocument } from "@/modules/inventory/api";
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
  created_at: string;
};

export default function InventoryDocumentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tableQuery, setTableQuery] = React.useState<TableQueryState>(DEFAULT_QUERY);
  const [modalOpen, setModalOpen] = React.useState(false);

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
          <Badge variant="outline" className="uppercase text-[10px] tracking-widest font-black">
            {row.original.type}
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
              variant={status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary"}
              className="rounded-full px-3 py-0.5"
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
          return (
            <div className="flex items-center gap-2">
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
    [queryClient, t]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("inventory.docs.title", "Inventory Documents")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("inventory.docs.subtitle", "Track and approve stock adjustments, transfers, and records.")}
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
        searchPlaceholder={t("inventory.docs.search_placeholder", "Search by document number or title...")}
        resourceName="documents"
      />

      <InventoryDocumentFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
