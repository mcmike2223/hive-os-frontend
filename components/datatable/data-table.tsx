"use client";

import * as React from "react";
import { useTranslation } from "@/store/use-translation";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Copy,
  Download,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  Column,
  ColumnDef,
  RowSelectionState,
  SortingState,
  VisibilityState,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import api from "@/lib/api";
import { getBackendStorageUrl, getPublicServeUrl } from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* -------------------- Types -------------------- */
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData, TValue> {
    exportable?: boolean;
    printable?: boolean;
    exportValue?: (row: TData, index: number) => unknown;
    align?: "left" | "center" | "right";
  }
}

export interface CompanySettingsInfo {
  name?: string;
  [key: string]: unknown;
}

export interface BrandingSettingsInfo {
  logo?: string;
  app_title?: string;
  footer_text?: string;
  document_header_color?: string;
  company_tax_id?: string;
  pdf_logo?: string;
  [key: string]: unknown;
}

export type DataTableQuery = {
  page: number;
  pageSize?: number;
  search: string;
  sortCol?: string | null;
  sortDir?: "asc" | "desc" | null;
};

export type DataTableSelectionPayload<TData> = {
  selectedRowIds: RowSelectionState;
  selectedRowsOnPage: TData[];
  selectedCountOnPage: number;
};

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  totalEntries: number;
  loading: boolean;
  pageIndex?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onQueryChange: (q: DataTableQuery) => void;
  title?: string;
  description?: string;
  caption?: string;
  emptyMessage?: React.ReactNode;
  searchPlaceholder?: string;
  serverSearchDebounceMs?: number;
  className?: string;
  enableRowSelection?: boolean;
  getRowId?: (originalRow: TData, index: number) => string;
  selectedRowIds?: RowSelectionState;
  onSelectionChange?: (payload: DataTableSelectionPayload<TData>) => void;
  onDeleteRows?: (rows: TData[]) => Promise<void> | void;
  onRefresh?: () => void;
  onResetFilters?: () => void;
  exportEndpoint?: string;
  resourceName?: string;
  syncWithUrl?: boolean;
  onCopy?: () => void;
  onPrint?: () => void;
  onExport?: (format: string) => void;
  companySettings?: CompanySettingsInfo;
  brandingSettings?: BrandingSettingsInfo;
  canCopy?: boolean;
  canExport?: boolean;
  canPrint?: boolean;
  canRefresh?: boolean;
  renderSubComponent?: (props: { row: TData }) => React.ReactNode;
}

/* -------------------- Helper Functions -------------------- */
function useDebouncedValue<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function getPaginationRange(currentPage: number, totalPages: number) {
  const delta = 2;
  const range: number[] = [];
  const rangeWithDots: (number | string)[] = [];
  let l: number | undefined;

  range.push(1);
  if (totalPages <= 1) return range;

  for (let i = currentPage - delta; i <= currentPage + delta; i++) {
    if (i < totalPages && i > 1) range.push(i);
  }
  range.push(totalPages);

  for (const i of range) {
    if (l) {
      if (i - l === 2) rangeWithDots.push(l + 1);
      else if (i - l !== 1) rangeWithDots.push("...");
    }
    rangeWithDots.push(i);
    l = i;
  }
  return rangeWithDots;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Delay revocation to ensure browsers have time to initiate the download
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

async function getExportErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null) {
    const maybeResponse = (error as { response?: { data?: unknown } }).response;
    let responseData = maybeResponse?.data;

    // If the response is a Blob (common in exports), try to read it as text/JSON
    if (responseData instanceof Blob) {
      try {
        const text = await responseData.text();
        responseData = JSON.parse(text);
      } catch {
        // Not JSON, keep as is
      }
    }

    const apiPayload = responseData as
      { message?: unknown; error?: unknown } | undefined;

    if (typeof apiPayload?.message === "string" && apiPayload.message.trim()) {
      return apiPayload.message;
    }

    if (typeof apiPayload?.error === "string" && apiPayload.error.trim()) {
      return apiPayload.error;
    }

    if (typeof responseData === "string" && responseData.trim()) {
      return responseData;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

type ExportBrandingPayload = {
  app_title?: string;
  footer_text?: string;
  document_header_color?: string;
  company_tax_id?: string;
  logo_url?: string | null;
};

function normalizeExportHexColor(value: unknown, fallback = "#1E293B") {
  const candidate = String(value ?? "")
    .trim()
    .toUpperCase();
  return /^#(?:[0-9A-F]{3}|[0-9A-F]{6})$/.test(candidate)
    ? candidate
    : fallback;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildExportBranding(
  backendBranding: BrandingSettingsInfo | null | undefined,
  backendLogoUrl?: string | null,
  brandingSettings?: BrandingSettingsInfo,
  companySettings?: CompanySettingsInfo,
): ExportBrandingPayload {
  const merged = {
    ...(brandingSettings ?? {}),
    ...(backendBranding ?? {}),
  };

  const fallbackLogo =
    backendLogoUrl ||
    merged.logo_url ||
    (typeof merged.pdf_logo === "string"
      ? getPublicServeUrl(merged.pdf_logo) || getBackendStorageUrl(merged.pdf_logo)
      : null) ||
    (typeof merged.logo === "string"
      ? getPublicServeUrl(merged.logo) || getBackendStorageUrl(merged.logo)
      : null);

  return {
    app_title: String(merged.app_title || companySettings?.name || "HIVE.OS"),
    footer_text: String(
      merged.footer_text || companySettings?.name || "Powered by HIVE.OS",
    ),
    document_header_color: normalizeExportHexColor(
      merged.document_header_color,
    ),
    company_tax_id: merged.company_tax_id
      ? String(merged.company_tax_id)
      : undefined,
    logo_url: typeof fallbackLogo === "string" ? fallbackLogo : null,
  };
}

// 🚀 UPDATED: Professional ERP Print Template matching Blade PDFs
function printSimpleTable(
  dataRows: Record<string, unknown>[],
  title = "System Report",
  printWindow?: Window | null,
  branding: ExportBrandingPayload = {},
) {
  if (!dataRows || dataRows.length === 0)
    throw new Error("No data available to print.");

  const headerColor = normalizeExportHexColor(branding.document_header_color);
  const logoUrl = branding.logo_url ? escapeHtml(branding.logo_url) : null;
  const appTitle = escapeHtml(branding.app_title || "HIVE.OS");
  const footerText = escapeHtml(branding.footer_text || appTitle);
  const taxId = branding.company_tax_id
    ? escapeHtml(branding.company_tax_id)
    : "";
  const safeTitle = escapeHtml(title);

  // Filter out system keys that shouldn't be printed
  const keys = Object.keys(dataRows[0]).filter(
    (key) =>
      !["id", "uuid", "user_id", "serial", "tenant_id", "logo_url"].includes(
        key,
      ),
  );

  const headers =
    `<th width="6%">SEQ</th>` +
    keys
      .map((k) => `<th>${escapeHtml(k.replace(/_/g, " ").toUpperCase())}</th>`)
      .join("");

  // Create rows with zero-padded Sequence numbers (0001, 0002, etc.)
  const rows = dataRows
    .map(
      (row, i) =>
        `<tr>
      <td class="seq">${String(i + 1).padStart(4, "0")}</td>
      ${keys.map((k) => `<td>${escapeHtml(row[k] ?? "")}</td>`).join("")}
    </tr>`,
    )
    .join("");

  const targetWindow = printWindow || window.open("", "_blank");
  if (targetWindow) {
    targetWindow.document.open();
    targetWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${safeTitle}</title>
        <style>
          /* 🚀 FORCE browsers to print background colors (crucial for the dark header) */
          @media print {
            @page { margin: 15mm; size: landscape; }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }

          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 10px;
            color: #334155;
            margin: 0;
            padding: 0;
          }

          /* ----------------------------------------------------
             HEADER
          ---------------------------------------------------- */
          .header-table {
            width: 100%;
            border-collapse: collapse;
            border-bottom: 2px solid ${headerColor};
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .logo-td { width: 160px; vertical-align: middle; }
          .logo { max-height: 40px; width: auto; display: block; }

          .title-td { vertical-align: middle; text-align: left; }
          .title-td h2 {
            font-size: 16px; font-weight: bold; color: ${headerColor};
            text-transform: uppercase; letter-spacing: 1px; margin: 0 0 3px 0;
          }
          .title-td p {
            font-size: 9px; color: #64748b; margin: 0;
            text-transform: uppercase; letter-spacing: 0.5px;
          }

          .meta-td {
            text-align: right; vertical-align: middle;
            font-size: 8px; color: #475569; line-height: 1.5;
          }
          .meta-td strong { color: #1e293b; }
          .meta-td strong.brand { color: ${headerColor}; }

          /* ----------------------------------------------------
             DATA TABLE
          ---------------------------------------------------- */
          .data-table {
            width: 100%;
            border-collapse: collapse;
            background-color: #ffffff;
            table-layout: auto;
          }
          .data-table th {
            background-color: ${headerColor} !important;
            color: #ffffff !important;
            font-size: 9px; font-weight: bold; text-transform: uppercase;
            letter-spacing: 0.5px; padding: 10px 8px; text-align: left;
            border: 1px solid ${headerColor};
          }
          .data-table td {
            padding: 8px 8px; border-bottom: 1px solid #e2e8f0;
            vertical-align: top; word-wrap: break-word; line-height: 1.4;
          }

          /* Zebra Striping */
          .data-table tbody tr:nth-child(even) td { background-color: #f8fafc !important; }

          .seq { color: #94a3b8; font-weight: bold; }

          /* ----------------------------------------------------
             FOOTER
          ---------------------------------------------------- */
          .footer-table {
            width: 100%; margin-top: 30px; border-top: 1px solid #e2e8f0;
            padding-top: 10px; font-size: 8px; color: #94a3b8; text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td class="logo-td">
              ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="Logo" />` : ""}
            </td>
            <td class="title-td">
              <h2>${safeTitle}</h2>
              <p>Enterprise Management - Browser Print Extract</p>
            </td>
            <td class="meta-td">
              <div><strong class="brand">Date Generated:</strong> ${escapeHtml(new Date().toLocaleString())}</div>
              <div><strong class="brand">Total Records:</strong> ${dataRows.length}</div>
              ${taxId ? `<div><strong class="brand">Tax ID:</strong> ${taxId}</div>` : ""}
              <div><strong class="brand">Generated By:</strong> ${appTitle} Web Client</div>
            </td>
          </tr>
        </table>

        <table class="data-table">
          <thead><tr>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table>

        <table class="footer-table">
          <tr>
            <td style="text-align: left; width: 33%;">${footerText}</td>
            <td style="text-align: center; width: 34%;">${taxId ? `Tax ID: ${taxId}` : "Strictly Confidential"}</td>
            <td style="text-align: right; width: 33%;">Printed via Secure Web Client</td>
          </tr>
        </table>

      <script>
        const triggerPrint = () => {
            setTimeout(() => { window.print(); window.close(); }, 350);
        };

        const img = document.querySelector('img.logo');
        if (img) {
            if (img.complete) {
                triggerPrint();
            } else {
                img.onload = triggerPrint;
                img.onerror = triggerPrint; // Print anyway if image fails
            }
        } else {
            window.onload = triggerPrint;
        }
      </script>
      </body>
      </html>
    `);
    targetWindow.document.close();
  }
}

/* -------------------- Column Header Component -------------------- */
export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
}) {
  const { t } = useTranslation();
  if (!column.getCanSort()) return <div className={className}>{title}</div>;
  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent"
          >
            <span>{title}</span>
            {column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4 text-primary" />
            ) : column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4 text-primary" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <ArrowUp className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />{" "}
            {t("global.ascending", "Ascending")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <ArrowDown className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />{" "}
            {t("global.descending", "Descending")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
            <EyeOff className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />{" "}
            {t("global.hide", "Hide")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* -------------------- MAIN COMPONENT -------------------- */
function DataTableInner<TData, TValue>({
  columns,
  data = [],
  totalEntries = 0,
  loading = false,
  pageIndex = 1,
  pageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  onQueryChange,
  title,
  description,
  caption,
  emptyMessage,
  searchPlaceholder,

  serverSearchDebounceMs = 400,
  className,
  enableRowSelection = false,
  getRowId,
  selectedRowIds,
  onSelectionChange,
  onDeleteRows,
  onRefresh,
  onResetFilters,
  exportEndpoint,
  resourceName = "records",
  syncWithUrl = true,
  onCopy,
  onPrint,
  onExport,
  companySettings,
  brandingSettings,
  canCopy,
  canExport,
  canPrint,
  canRefresh,
  renderSubComponent,
}: DataTableProps<TData, TValue>) {
  const { t, locale } = useTranslation();
  const effectiveSearchPlaceholder = searchPlaceholder || t("global.search", "Search...");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchInputId = React.useId();
  const pageSizeInputId = React.useId();

  const getParam = <T,>(key: string, fallback: T): T | string =>
    !syncWithUrl ? fallback : searchParams.get(key) || fallback;

  const effectivePageIndex = syncWithUrl
    ? Number(getParam("page", pageIndex)) || 1
    : Number(pageIndex) || 1;
  const effectivePageSize = syncWithUrl
    ? Number(getParam("limit", pageSize)) || 10
    : Number(pageSize) || 10;

  const [busy, setBusy] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState(getParam("search", ""));
  const [sorting, setSorting] = React.useState<SortingState>(
    getParam("sortCol", null)
      ? [
          {
            id: getParam("sortCol", ""),
            desc: getParam("sortDir", "") === "desc",
          },
        ]
      : [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [expanded, setExpanded] = React.useState<ExpandedState>({});

  const effectiveRowSelection = selectedRowIds ?? rowSelection;
  const debouncedSearch = useDebouncedValue(
    searchValue,
    serverSearchDebounceMs,
  );

  const pageCount = Math.max(
    1,
    Math.ceil((totalEntries || 0) / effectivePageSize),
  );
  const pageIndex0 = Math.max(0, effectivePageIndex - 1);
  const selectedCount = Object.keys(effectiveRowSelection).length;
  const hasSelection = enableRowSelection && selectedCount > 0;
  const hasExportEndpoint = Boolean(exportEndpoint);
  const allowCopy = canCopy ?? hasExportEndpoint;
  const allowExport = canExport ?? hasExportEndpoint;
  const allowPrint = canPrint ?? hasExportEndpoint;
  const allowRefresh = canRefresh ?? Boolean(onRefresh);
  const showToolbarActions =
    !hasSelection &&
    hasExportEndpoint &&
    (allowCopy || allowExport || allowPrint);
  const showSelectionCopy = hasSelection && allowCopy;
  const showSelectionExport = hasSelection && allowExport;
  const showSelectionPrint = hasSelection && allowPrint;
  const showSelectionDelete = hasSelection && Boolean(onDeleteRows);
  const showSelectionToolbar =
    showSelectionCopy ||
    showSelectionExport ||
    showSelectionPrint ||
    showSelectionDelete;

  const updateUrl = React.useCallback(
    (updates: Record<string, string | number | null | undefined>) => {
      if (!syncWithUrl) return;
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) =>
        v == null || v === "" ? params.delete(k) : params.set(k, String(v)),
      );
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams, syncWithUrl],
  );

  const prevQueryRef = React.useRef<string>("");

  React.useEffect(() => {
    const nextQuery: DataTableQuery = {
      page: effectivePageIndex,
      pageSize: effectivePageSize,
      search: debouncedSearch,
      sortCol: sorting[0]?.id,
      sortDir: sorting.length ? (sorting[0]?.desc ? "desc" : "asc") : null,
    };

    const queryStr = JSON.stringify(nextQuery);
    if (prevQueryRef.current !== queryStr) {
      prevQueryRef.current = queryStr;
      onQueryChange(nextQuery);
    }
  }, [
    effectivePageIndex,
    effectivePageSize,
    debouncedSearch,
    sorting,
    onQueryChange,
  ]);

  React.useEffect(() => {
    if (syncWithUrl && getParam("search", "") !== debouncedSearch)
      updateUrl({ search: debouncedSearch, page: 1 });
  }, [debouncedSearch, updateUrl, syncWithUrl]);

  const selectionColumn = React.useMemo<ColumnDef<TData, TValue>>(
    () => ({
      id: "select",
      enableSorting: false,
      enableHiding: false,
      size: 40,
      header: ({ table }) => (
        <div className="flex justify-center px-2">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex justify-center px-2">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select row"
          />
        </div>
      ),
    }),
    [],
  );

  const mergedColumns = React.useMemo(
    () => (enableRowSelection ? [selectionColumn, ...columns] : columns),
    [columns, enableRowSelection, selectionColumn],
  );

  const table = useReactTable({
    data,
    columns: mergedColumns,
    state: {
      sorting,
      columnVisibility,
      expanded,
      rowSelection: enableRowSelection ? effectiveRowSelection : {},
      pagination: { pageIndex: pageIndex0, pageSize: effectivePageSize },
    },
    onSortingChange: (updater) => {
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      setSorting(newSorting);
      if (syncWithUrl)
        updateUrl({
          sortCol: newSorting[0]?.id,
          sortDir: newSorting[0]?.desc ? "desc" : "asc",
          page: 1,
        });
    },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater(effectiveRowSelection)
          : updater;
      if (!selectedRowIds) setRowSelection(next);
      const rows = table
        .getRowModel()
        .rows.filter((r) => !!next[r.id])
        .map((r) => r.original);
      onSelectionChange?.({
        selectedRowIds: next,
        selectedRowsOnPage: rows,
        selectedCountOnPage: rows.length,
      });
    },
    getRowId:
      getRowId ??
      ((row: TData, i) => {
        const record = row as { id?: string | number };
        return record.id != null ? String(record.id) : String(i);
      }),
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onExpandedChange: setExpanded,
    getRowCanExpand: () => true,
    manualPagination: true,
    manualSorting: true,
    pageCount,
  });

  const handleResetAndReload = () => {
    setSearchValue("");
    setSorting([]);
    setRowSelection({});
    if (syncWithUrl)
      updateUrl({ search: "", page: 1, sortCol: null, sortDir: null });
    if (onResetFilters) onResetFilters();
    onQueryChange({ page: 1, search: "", sortCol: null, sortDir: null });
    onRefresh?.();
    toast.success("Table data reloaded & filters cleared.");
  };

  const handleExportAPI = (type: string, fromSelection = false) => {
    if (busy) return;
    if (type === "copy" && !allowCopy) return;
    if (type === "print" && !allowPrint) return;
    if (["csv", "xlsx", "pdf", "excel"].includes(type) && !allowExport) return;

    if (!exportEndpoint) {
      toast.error("Export endpoint is not configured.");
      return;
    }

    if (type === "copy" && onCopy) onCopy();
    else if (type === "print" && onPrint) onPrint();
    else if (onExport) onExport(type);

    const targetCount = fromSelection ? selectedCount : totalEntries;
    const isFile = ["csv", "xlsx", "pdf"].includes(type);

    let printWin: Window | null = null;
    if (type === "print") {
      printWin = window.open("", "_blank");
      if (!printWin) {
        toast.error(
          "Popup blocked! Please allow popups for this site to print.",
        );
        return;
      }
      printWin.document.write(`
        <html style="background:#f9fafb;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
          <body><h2 style="color:#6b7280;animation:pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;">Fetching data for print...</h2></body>
        </html>
      `);
    }

    setBusy(true);

    const exportPromise = (async () => {
      const params: Record<string, string> = { type };
      if (fromSelection && selectedCount > 0)
        params.ids = Object.keys(effectiveRowSelection).join(",");

      const res = await api.get(exportEndpoint, {
        params,
        responseType: isFile ? "blob" : "json",
      });

      if (isFile) {
        downloadBlob(new Blob([res.data]), `hive_export_${Date.now()}.${type}`);
        return `Successfully downloaded ${targetCount} ${resourceName} as ${type.toUpperCase()}.`;
      } else {
        // Parse the new JSON format containing the logo_url
        const rows = Array.isArray(res.data) ? res.data : res.data?.data || [];
        const branding = buildExportBranding(
          res.data?.branding,
          res.data?.logo_url || null,
          brandingSettings,
          companySettings,
        );

        if (rows.length === 0) {
          if (printWin) printWin.close();
          throw new Error("No data found matching current filters.");
        }

        if (type === "copy") {
          const keys = Object.keys(rows[0]).filter(
            (k) =>
              ![
                "id",
                "uuid",
                "user_id",
                "serial",
                "tenant_id",
                "logo_url",
              ].includes(k),
          );
          const headerString = [
            "#",
            ...keys.map((k) => k.replace(/_/g, " ").toUpperCase()),
          ].join("\t");
          const dataStrings = rows.map(
            (r: Record<string, unknown>, i: number) =>
              [i + 1, ...keys.map((k) => r[k])].join("\t"),
          );

          const prefixLines = [
            branding.app_title || "HIVE.OS",
            title || "System Report",
            branding.company_tax_id
              ? `Tax ID: ${branding.company_tax_id}`
              : null,
            `Generated: ${new Date().toLocaleString()}`,
            "",
          ].filter(Boolean);

          await navigator.clipboard.writeText(
            [...prefixLines, headerString, ...dataStrings].join("\n"),
          );
          return `Copied ${rows.length} ${resourceName} to your clipboard!`;
        } else if (type === "print") {
          printSimpleTable(rows, title || "System Report", printWin, branding);
          return `Print document generated with ${rows.length} ${resourceName}.`;
        }
      }
    })();

    toast.promise(exportPromise, {
      loading: `Processing ${targetCount} ${resourceName}...`,
      success: (successMessage) => {
        if (fromSelection && ["copy", "print"].includes(type))
          setRowSelection({});
        return successMessage as string;
      },
      error: async (err) => {
        if (printWin && !printWin.closed) printWin.close();
        return await getExportErrorMessage(
          err,
          `Failed to complete ${type.toUpperCase()} action.`,
        );
      },
    });

    void exportPromise.finally(() => setBusy(false));
  };

  return (
    <div className={cn("w-full space-y-4", className)}>
      <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-4 p-4 sm:items-center justify-between border-b border-border/50">
          <div
            id="tour-datatable-search"
            className="relative w-full sm:w-[280px]"
          >
            <label htmlFor={searchInputId} className="sr-only">
              Search {resourceName}
            </label>
            <Search
              aria-hidden="true"
              className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"
            />
            <Input
              id={searchInputId}
              placeholder={effectiveSearchPlaceholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="h-11 pl-9 pr-12 bg-background/50 rounded-lg"
            />
            <div className="absolute right-2 top-2.5 flex items-center gap-1">
              {(loading || searchValue !== debouncedSearch) && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {searchValue && (
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => {
                    setSearchValue("");
                    if (syncWithUrl) updateUrl({ search: "", page: 1 });
                  }}
                  aria-label={`Clear ${resourceName} search`}
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {showToolbarActions && (
              <>
                {allowCopy && (
                  <Button
                    id="tour-datatable-copy"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 rounded-lg"
                    onClick={() => handleExportAPI("copy")}
                    disabled={loading || busy}
                    aria-label={`Copy ${resourceName}`}
                  >
                    <Copy aria-hidden="true" className="h-4 w-4" />
                  </Button>
                )}

                {allowExport && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        id="tour-datatable-export"
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 rounded-lg"
                        disabled={loading || busy}
                        aria-label={`Export ${resourceName}`}
                      >
                        <Download aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="rounded-xl shadow-xl border-border/50 bg-background/95 backdrop-blur-md z-[100000]"
                    >
                      <DropdownMenuItem
                        className="cursor-pointer font-medium"
                        onClick={() => handleExportAPI("csv")}
                      >
                        <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />{" "}
                        {t("global.export_csv", "Export to CSV")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer font-medium"
                        onClick={() => handleExportAPI("xlsx")}
                      >
                        <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />{" "}
                        {t("global.export_excel", "Export to Excel")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer font-medium"
                        onClick={() => handleExportAPI("pdf")}
                      >
                        <FileText className="mr-2 h-4 w-4 text-red-600" />{" "}
                        {t("global.export_pdf", "Export to PDF")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {allowPrint && (
                  <Button
                    id="tour-datatable-print"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 rounded-lg"
                    onClick={() => handleExportAPI("print")}
                    disabled={loading || busy}
                    aria-label={`Print ${resourceName}`}
                  >
                    <Printer aria-hidden="true" className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}

            {allowRefresh && (
              <Button
                id="tour-datatable-refresh"
                variant="outline"
                size="icon"
                className="h-11 w-11 border-dashed rounded-lg"
                onClick={handleResetAndReload}
                disabled={loading || busy}
                aria-label={`Refresh ${resourceName}`}
              >
                <RotateCcw
                  aria-hidden="true"
                  className={cn("h-4 w-4", (loading || busy) && "animate-spin")}
                />
              </Button>
            )}
          </div>
        </div>

        <div className="relative overflow-x-auto min-h-[300px]">
          {loading && data.length > 0 && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/30 backdrop-blur-[1px] transition-all">
              <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
            </div>
          )}

          <Table>
            <TableCaption className="sr-only">
              {caption ?? description ?? `${title ?? resourceName} data table.`}
            </TableCaption>
            <TableHeader className="bg-muted/30">
              {table.getHeaderGroups().map((hg) => (
                <TableRow
                  key={hg.id}
                  className="border-border/50 hover:bg-transparent"
                >
                  {hg.headers.map((h) => (
                    <TableHead
                      key={h.id}
                      scope="col"
                      aria-sort={
                        h.column.getIsSorted() === "asc"
                          ? "ascending"
                          : h.column.getIsSorted() === "desc"
                            ? "descending"
                            : h.column.getCanSort()
                              ? "none"
                              : undefined
                      }
                      className={cn(
                        "h-11 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider",
                        h.column.columnDef.meta?.align === "center" &&
                          "text-center",
                        h.column.columnDef.meta?.align === "right" &&
                          "text-right",
                      )}
                    >
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2 rounded-sm text-left outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary",
                            h.column.columnDef.meta?.align === "center" &&
                              "justify-center",
                            h.column.columnDef.meta?.align === "right" &&
                              "justify-end",
                          )}
                          onClick={h.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            h.column.columnDef.header,
                            h.getContext(),
                          )}
                          {{
                            asc: (
                              <ArrowUp
                                aria-hidden="true"
                                className="h-3 w-3 text-primary"
                              />
                            ),
                            desc: (
                              <ArrowDown
                                aria-hidden="true"
                                className="h-3 w-3 text-primary"
                              />
                            ),
                          }[h.column.getIsSorted() as string] ?? (
                            <ChevronsUpDown
                              aria-hidden="true"
                              className="h-3 w-3 opacity-50"
                            />
                          )}
                        </button>
                      ) : (
                        <div
                          className={cn(
                            "flex items-center gap-2",
                            h.column.columnDef.meta?.align === "center" &&
                              "justify-center",
                            h.column.columnDef.meta?.align === "right" &&
                              "justify-end",
                          )}
                        >
                          {flexRender(
                            h.column.columnDef.header,
                            h.getContext(),
                          )}
                        </div>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading && data.length === 0 ? (
                Array.from({ length: effectivePageSize }).map((_, idx) => (
                  <TableRow
                    key={`skel-${idx}`}
                    className="border-b border-border/40"
                  >
                    {mergedColumns.map((col, cIdx) => (
                      <TableCell
                        key={`skel-${idx}-${cIdx}`}
                        className="px-4 py-4"
                      >
                        <div
                          className={cn(
                            "h-4 bg-muted rounded animate-pulse",
                            cIdx === 0 ? "w-6" : cIdx === 1 ? "w-32" : "w-24",
                          )}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <React.Fragment key={row.id}>
                    <TableRow
                      className={cn(
                        "border-b border-border/40 hover:bg-muted/20 transition-colors group",
                        row.getIsSelected() && "bg-primary/5",
                      )}
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "px-4 py-3 align-middle",
                            cell.column.columnDef.meta?.align === "center" &&
                              "text-center",
                            cell.column.columnDef.meta?.align === "right" &&
                              "text-right",
                          )}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    {row.getIsExpanded() && renderSubComponent && (
                      <TableRow>
                        <TableCell
                          colSpan={row.getVisibleCells().length}
                          className="p-0 border-b border-border/40 bg-muted/10"
                        >
                          {renderSubComponent({ row: row.original })}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={mergedColumns.length}
                    className="h-40 text-center text-muted-foreground font-medium"
                  >
                    {emptyMessage ?? t("global.no_records_found", "No records found matching your filters.")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border/50 bg-muted/10">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {t("global.showing_entries", "Showing :from to :to of :total entries", {
                from: String(totalEntries > 0 ? (effectivePageIndex - 1) * effectivePageSize + 1 : 0),
                to: String(Math.min(effectivePageIndex * effectivePageSize, totalEntries)),
                total: String(totalEntries),
              })}
            </span>
            <label htmlFor={pageSizeInputId} className="sr-only">
              Rows per page
            </label>
            <select
              id={pageSizeInputId}
              className="h-11 rounded-lg border border-input bg-background px-3 text-xs font-medium cursor-pointer focus:ring-primary hidden sm:block"
              value={effectivePageSize}
              onChange={(e) => {
                if (syncWithUrl) updateUrl({ limit: e.target.value, page: 1 });
                else
                  onQueryChange({
                    pageSize: Number(e.target.value),
                    page: 1,
                    search: debouncedSearch,
                  });
              }}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n} {t("global.rows", "Rows")}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-center sm:justify-end gap-1.5">
            <Button
              variant="outline"
              className="min-h-11 px-3 text-xs font-medium rounded-lg"
              onClick={() =>
                syncWithUrl
                  ? updateUrl({ page: effectivePageIndex - 1 })
                  : onQueryChange({
                      page: effectivePageIndex - 1,
                      pageSize: effectivePageSize,
                      search: debouncedSearch,
                      sortCol: sorting[0]?.id ?? null,
                      sortDir: sorting[0]
                        ? sorting[0].desc
                          ? "desc"
                          : "asc"
                        : null,
                    })
              }
              disabled={effectivePageIndex <= 1 || loading || busy}
            >
              {t("global.previous", "Previous")}
            </Button>

            <div className="flex items-center gap-1 hidden sm:flex">
              {getPaginationRange(effectivePageIndex, pageCount).map(
                (pageNumber, idx) => {
                  if (pageNumber === "...")
                    return (
                      <div
                        key={`dots-${idx}`}
                        className="h-9 w-9 flex items-center justify-center text-sm text-muted-foreground select-none"
                      >
                        ...
                      </div>
                    );
                  const isCurrent = pageNumber === effectivePageIndex;
                  return (
                    <Button
                      key={pageNumber}
                      variant={isCurrent ? "default" : "outline"}
                      className={cn(
                        "h-11 w-11 p-0 text-sm font-medium transition-all rounded-lg",
                        isCurrent
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() =>
                        syncWithUrl
                          ? updateUrl({ page: Number(pageNumber) })
                          : onQueryChange({
                              page: Number(pageNumber),
                              pageSize: effectivePageSize,
                              search: debouncedSearch,
                              sortCol: sorting[0]?.id ?? null,
                              sortDir: sorting[0]
                                ? sorting[0].desc
                                  ? "desc"
                                  : "asc"
                                : null,
                            })
                      }
                      disabled={loading || busy}
                    >
                      {pageNumber}
                    </Button>
                  );
                },
              )}
            </div>

            <Button
              variant="outline"
              className="min-h-11 px-3 text-xs font-medium rounded-lg"
              onClick={() =>
                syncWithUrl
                  ? updateUrl({ page: effectivePageIndex + 1 })
                  : onQueryChange({
                      page: effectivePageIndex + 1,
                      pageSize: effectivePageSize,
                      search: debouncedSearch,
                      sortCol: sorting[0]?.id ?? null,
                      sortDir: sorting[0]
                        ? sorting[0].desc
                          ? "desc"
                          : "asc"
                        : null,
                    })
              }
              disabled={effectivePageIndex >= pageCount || loading || busy}
            >
              {t("global.next", "Next")}
            </Button>
          </div>
        </div>
      </div>

      {showSelectionToolbar && (
        <div className="fixed bottom-8 left-1/2 z-[100] -translate-x-1/2 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2 sm:gap-3 rounded-full border border-border/50 bg-background/90 backdrop-blur-xl p-2 px-4 sm:px-5 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
            <span className="flex items-center justify-center h-6 min-w-[1.5rem] rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {selectedCount}
            </span>
            <span className="text-sm font-medium text-foreground hidden sm:inline-block">
              {t("global.selected", "Selected")}
            </span>
            {(showSelectionCopy ||
              showSelectionExport ||
              showSelectionPrint ||
              showSelectionDelete) && (
              <Separator
                orientation="vertical"
                className="h-5 mx-1 border-border"
              />
            )}

            {showSelectionCopy && (
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-muted-foreground hover:text-foreground"
                onClick={() => handleExportAPI("copy", true)}
                aria-label="Copy selected rows"
              >
                <Copy aria-hidden="true" className="h-4 w-4" />
              </Button>
            )}

            {showSelectionExport && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 text-muted-foreground hover:text-foreground"
                    aria-label="Export selected rows"
                  >
                    <Download aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="center"
                  side="top"
                  sideOffset={10}
                  className="rounded-xl shadow-xl border-border/50 bg-background/95 backdrop-blur-md mb-2"
                >
                  <DropdownMenuItem
                    className="cursor-pointer font-medium"
                    onClick={() => handleExportAPI("csv", true)}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />{" "}
                    Export to CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer font-medium"
                    onClick={() => handleExportAPI("xlsx", true)}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />{" "}
                    Export to Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer font-medium"
                    onClick={() => handleExportAPI("pdf", true)}
                  >
                    <FileText className="mr-2 h-4 w-4 text-red-600" /> Export to
                    PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {showSelectionPrint && (
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-muted-foreground hover:text-foreground"
                onClick={() => handleExportAPI("print", true)}
                aria-label="Print selected rows"
              >
                <Printer aria-hidden="true" className="h-4 w-4" />
              </Button>
            )}

            {showSelectionDelete && (
              <>
                <Separator
                  orientation="vertical"
                  className="h-5 mx-1 border-border"
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-red-500 hover:bg-red-500/10 hover:text-red-600 font-bold"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />{" "}
                      <span className="hidden sm:inline-block">Purge</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Purge Selected Records?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently
                        delete the selected entries from our servers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        className="rounded-xl bg-red-600 hover:bg-red-700"
                        onClick={async () => {
                          const deleteRows = onDeleteRows;
                          if (!deleteRows) return;
                          await deleteRows(
                            table
                              .getSelectedRowModel()
                              .rows.map((r) => r.original as TData),
                          );
                          setRowSelection({});
                        }}
                      >
                        Confirm Purge
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full ml-1 bg-muted/50 text-muted-foreground hover:text-foreground"
              onClick={() => setRowSelection({})}
              aria-label="Clear selected rows"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export const DataTable = React.memo(DataTableInner) as typeof DataTableInner;
