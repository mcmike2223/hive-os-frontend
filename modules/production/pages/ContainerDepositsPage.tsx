"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Recycle,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import { crmApi } from "@/modules/crm/api";
import type { CrmContact } from "@/modules/crm/types";
import { productionApi } from "@/modules/production/api";
import type {
  ContainerBalance,
  ContainerFleetSummary,
  ContainerMovement,
  ContainerType,
  ProductionOrder,
} from "@/modules/production/types";
import {
  BusyLabel,
  ProductionError,
  ProductionLoading,
  ProductionMetricCard,
  ProductionShell,
} from "@/modules/production/components/production-shell";
import { errorText, useDebouncedValue } from "../utils";

const MOVEMENT_TYPES = ["issue", "return", "scrap", "adjustment"] as const;
const CONDITIONS = ["good", "damaged", "contaminated"] as const;

type MovementType = (typeof MOVEMENT_TYPES)[number];
type ContainerTab = "balances" | "movements" | "types";

type MovementForm = {
  container_type_id: string;
  customer_contact_id: string;
  production_order_id: string;
  movement_type: MovementType;
  quantity: string;
  deposit_per_unit: string;
  deposit_forfeited: boolean;
  condition: string;
  reference: string;
  notes: string;
};

type TypeForm = {
  id?: number;
  name: string;
  code: string;
  capacity_litres: string;
  deposit_amount: string;
  expected_trips: string;
  notes: string;
};

function emptyMovementForm(): MovementForm {
  return {
    container_type_id: "",
    customer_contact_id: "",
    production_order_id: "",
    movement_type: "issue",
    quantity: "",
    deposit_per_unit: "",
    deposit_forfeited: false,
    condition: "",
    reference: "",
    notes: "",
  };
}

const DEFAULT_TYPE_FORM: TypeForm = {
  name: "",
  code: "",
  capacity_litres: "20",
  deposit_amount: "",
  expected_trips: "40",
  notes: "",
};

function movementPayloadFromForm(form: MovementForm): Record<string, unknown> {
  return {
    container_type_id: Number(form.container_type_id),
    customer_contact_id: form.customer_contact_id ? Number(form.customer_contact_id) : undefined,
    production_order_id: form.production_order_id ? Number(form.production_order_id) : undefined,
    movement_type: form.movement_type,
    quantity: Number(form.quantity),
    deposit_per_unit: form.deposit_per_unit ? Number(form.deposit_per_unit) : undefined,
    deposit_forfeited: form.deposit_forfeited,
    condition: form.condition || undefined,
    reference: form.reference || undefined,
    notes: form.notes || undefined,
  };
}

function typePayloadFromForm(form: TypeForm): Record<string, unknown> {
  return {
    name: form.name.trim(),
    code: form.code.trim(),
    capacity_litres: Number(form.capacity_litres || 0),
    deposit_amount: Number(form.deposit_amount || 0),
    expected_trips: form.expected_trips ? Number(form.expected_trips) : undefined,
    notes: form.notes || undefined,
  };
}

function returnRateTone(rate: number): string {
  if (rate >= 90) return "text-emerald-600 dark:text-emerald-400";
  if (rate >= 80) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function hasActiveBalanceFilters(opts: {
  search: string;
  typeId: string;
  customerId: string;
  outstandingOnly: boolean;
}): boolean {
  return Boolean(opts.search.trim() || opts.typeId || opts.customerId || !opts.outstandingOnly);
}

function hasActiveMovementFilters(opts: {
  search: string;
  typeId: string;
  customerId: string;
  movementType: string;
  condition: string;
  from: string;
  to: string;
}): boolean {
  return Boolean(
    opts.search.trim() ||
      opts.typeId ||
      opts.customerId ||
      opts.movementType ||
      opts.condition ||
      opts.from ||
      opts.to,
  );
}

function contactLabel(contact: { id: number; name?: string | null; code?: string | null }): string {
  if (contact.code && contact.name) return `${contact.code} — ${contact.name}`;
  return contact.name || contact.code || `#${contact.id}`;
}

const PAGE_SIZE = 25;

type TableQueryState = {
  page: number;
  pageSize: number;
  search: string;
};

const DEFAULT_QUERY: TableQueryState = {
  page: 1,
  pageSize: PAGE_SIZE,
  search: "",
};

type CustomerStatement = {
  customer_contact_id: number;
  containers_out: number;
  deposit_held: number;
  balances: Array<{
    container_type_id: number;
    name?: string;
    containers_out: number;
    deposit_held: number;
    return_rate_percent?: number;
  }>;
  movements: Array<{
    id: number;
    movement_type: string;
    container_type?: string;
    quantity: number;
    deposit_amount: number;
    deposit_forfeited: boolean;
    condition?: string | null;
    reference?: string | null;
    occurred_at: string;
    notes?: string | null;
  }>;
};

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

export default function ContainerDepositsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { hasAnyPermission } = usePermissions();

  const canView = hasAnyPermission([
    "view_container_deposits",
    "view_production",
    "manage_production",
    "manage_container_deposits",
  ]);
  const canRecordMovement = hasAnyPermission([
    "record_container_movements",
    "manage_container_deposits",
    "manage_production",
  ]);
  const canManageTypes = hasAnyPermission(["manage_container_deposits", "manage_production"]);

  const [tab, setTab] = React.useState<ContainerTab>(
    (searchParams.get("tab") as ContainerTab) || "balances",
  );
  const [tableQuery, setTableQuery] = React.useState<TableQueryState>({
    page: Number(searchParams.get("page") || DEFAULT_QUERY.page),
    pageSize: Number(searchParams.get("limit") || DEFAULT_QUERY.pageSize),
    search: searchParams.get("search") ?? DEFAULT_QUERY.search,
  });

  const [typeFilter, setTypeFilter] = React.useState(searchParams.get("type_id") ?? "");
  const [customerFilter, setCustomerFilter] = React.useState(searchParams.get("customer_id") ?? "");
  const [outstandingOnly, setOutstandingOnly] = React.useState(searchParams.get("outstanding_only") !== "0");
  const [movementTypeFilter, setMovementTypeFilter] = React.useState(searchParams.get("movement_type") ?? "");
  const [conditionFilter, setConditionFilter] = React.useState(searchParams.get("condition") ?? "");
  const [fromDate, setFromDate] = React.useState(searchParams.get("from") ?? "");
  const [toDate, setToDate] = React.useState(searchParams.get("to") ?? "");

  const [movementOpen, setMovementOpen] = React.useState(searchParams.get("add") === "1");
  const [movementForm, setMovementForm] = React.useState<MovementForm>(emptyMovementForm());
  const [typeOpen, setTypeOpen] = React.useState(searchParams.get("add_type") === "1");
  const [typeForm, setTypeForm] = React.useState<TypeForm>(DEFAULT_TYPE_FORM);
  const [inspectMovement, setInspectMovement] = React.useState<ContainerMovement | null>(null);
  const [statementCustomerId, setStatementCustomerId] = React.useState<number | null>(
    searchParams.get("statement") ? Number(searchParams.get("statement")) : null,
  );
  const [deleteType, setDeleteType] = React.useState<ContainerType | null>(null);
  const [contactSearch, setContactSearch] = React.useState("");
  const [orderSearch, setOrderSearch] = React.useState("");
  const debouncedContactSearch = useDebouncedValue(contactSearch);
  const debouncedOrderSearch = useDebouncedValue(orderSearch);

  const summaryQuery = useQuery({
    queryKey: ["production", "containers", "summary"],
    queryFn: () => productionApi.containerSummary().then((res) => res.data),
  });

  const typesQuery = useQuery({
    queryKey: ["production", "containers", "types"],
    queryFn: () => productionApi.listContainerTypes({ limit: 100 }).then((res) => res.data),
  });

  const contactsQuery = useQuery({
    queryKey: ["crm", "contacts", "container-picker", debouncedContactSearch, tab],
    queryFn: async () =>
      unwrapList<CrmContact>(
        (await crmApi.listContacts({ limit: 250, search: debouncedContactSearch || undefined })).data,
      ),
    enabled: movementOpen || tab === "balances" || tab === "movements",
  });

  const ordersQuery = useQuery({
    queryKey: ["production", "orders", "container-picker", debouncedOrderSearch],
    queryFn: () =>
      productionApi
        .listOrders({ limit: 50, open_only: true, search: debouncedOrderSearch || undefined })
        .then((res) => res.data),
    enabled: movementOpen,
  });

  const movementIdParam = searchParams.get("movement_id");

  const balancesQuery = useQuery({
    queryKey: [
      "production",
      "containers",
      "balances",
      tableQuery,
      typeFilter,
      customerFilter,
      outstandingOnly,
    ],
    queryFn: () =>
      productionApi
        .listContainerBalances({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
          container_type_id: typeFilter ? Number(typeFilter) : undefined,
          customer_contact_id: customerFilter ? Number(customerFilter) : undefined,
          outstanding_only: outstandingOnly ? 1 : undefined,
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
    enabled: tab === "balances",
  });

  const movementsQuery = useQuery({
    queryKey: [
      "production",
      "containers",
      "movements",
      tableQuery,
      typeFilter,
      customerFilter,
      movementTypeFilter,
      conditionFilter,
      fromDate,
      toDate,
      movementIdParam,
    ],
    queryFn: () =>
      productionApi
        .listContainerMovements({
          page: movementIdParam ? 1 : tableQuery.page,
          limit: movementIdParam ? 1 : tableQuery.pageSize,
          search: tableQuery.search || undefined,
          container_type_id: typeFilter ? Number(typeFilter) : undefined,
          customer_contact_id: customerFilter ? Number(customerFilter) : undefined,
          movement_type: movementTypeFilter || undefined,
          condition: conditionFilter || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
          movement_id: movementIdParam ? Number(movementIdParam) : undefined,
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
    enabled: tab === "movements" || Boolean(movementIdParam),
  });

  const statementQuery = useQuery({
    queryKey: ["production", "containers", "statement", statementCustomerId],
    queryFn: () =>
      productionApi.customerStatement(statementCustomerId!).then((res) => res.data.data as CustomerStatement),
    enabled: statementCustomerId !== null,
  });

  const summary: ContainerFleetSummary | undefined = summaryQuery.data?.data;
  const types: ContainerType[] = typesQuery.data?.data ?? [];
  const contacts: CrmContact[] = contactsQuery.data ?? [];
  const orders: ProductionOrder[] = ordersQuery.data?.data ?? [];

  const contactNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const contact of contacts) {
      map.set(contact.id, contactLabel(contact));
    }
    return map;
  }, [contacts]);

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["production", "containers"] });
    queryClient.invalidateQueries({ queryKey: ["production", "overview"] });
  }, [queryClient]);

  const syncUrl = React.useCallback(() => {
    const params = new URLSearchParams();
    if (tab !== "balances") params.set("tab", tab);
    if (tableQuery.search.trim()) params.set("search", tableQuery.search.trim());
    if (typeFilter) params.set("type_id", typeFilter);
    if (customerFilter) params.set("customer_id", customerFilter);
    if (!outstandingOnly) params.set("outstanding_only", "0");
    if (movementTypeFilter) params.set("movement_type", movementTypeFilter);
    if (conditionFilter) params.set("condition", conditionFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (statementCustomerId) params.set("statement", String(statementCustomerId));
    if (inspectMovement) params.set("movement_id", String(inspectMovement.id));
    if (movementOpen) params.set("add", "1");
    if (typeOpen) params.set("add_type", "1");
    if (tableQuery.page > 1) params.set("page", String(tableQuery.page));
    if (tableQuery.pageSize !== DEFAULT_QUERY.pageSize) params.set("limit", String(tableQuery.pageSize));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    customerFilter,
    fromDate,
    movementOpen,
    movementTypeFilter,
    conditionFilter,
    outstandingOnly,
    pathname,
    router,
    inspectMovement,
    statementCustomerId,
    tab,
    tableQuery,
    toDate,
    typeFilter,
    typeOpen,
  ]);

  React.useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  React.useEffect(() => {
    if (!movementIdParam) return;
    if (tab !== "movements") setTab("movements");
    const id = Number(movementIdParam);
    const found = (movementsQuery.data?.data ?? []).find((movement) => movement.id === id);
    if (found) setInspectMovement(found as ContainerMovement);
  }, [movementIdParam, movementsQuery.data, tab]);

  React.useEffect(() => {
    setTableQuery((current) => ({ ...current, page: 1 }));
  }, [
    tab,
    typeFilter,
    customerFilter,
    outstandingOnly,
    movementTypeFilter,
    conditionFilter,
    fromDate,
    toDate,
    tableQuery.search,
  ]);

  const movementMutation = useMutation({
    mutationFn: () => productionApi.createContainerMovement(movementPayloadFromForm(movementForm)),
    onSuccess: () => {
      toast.success(t("production.containers.movement_saved", "Container movement recorded."));
      invalidate();
      setMovementOpen(false);
      setMovementForm(emptyMovementForm());
    },
    onError: (error) => {
      toast.error(
        errorText(error, t("production.containers.movement_failed", "Could not record the movement.")),
      );
    },
  });

  const typeMutation = useMutation({
    mutationFn: () => {
      const payload = typePayloadFromForm(typeForm);
      return typeForm.id
        ? productionApi.updateContainerType(typeForm.id, payload)
        : productionApi.createContainerType(payload);
    },
    onSuccess: () => {
      toast.success(t("production.containers.type_saved", "Container type saved."));
      invalidate();
      setTypeOpen(false);
      setTypeForm(DEFAULT_TYPE_FORM);
    },
    onError: (error) => {
      toast.error(errorText(error, t("production.containers.type_failed", "Could not save the type.")));
    },
  });

  const deleteTypeMutation = useMutation({
    mutationFn: () => productionApi.deleteContainerType(deleteType!.id),
    onSuccess: (response) => {
      toast.success(
        response?.data?.message || t("production.containers.type_deleted", "Container type removed."),
      );
      invalidate();
      setDeleteType(null);
    },
    onError: (error) => {
      toast.error(errorText(error, t("production.containers.type_delete_failed", "Could not remove it.")));
    },
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || DEFAULT_QUERY.pageSize),
      search: String(query.search ?? ""),
    });
  }, []);

  const openMovementForCustomer = (customerId: number, movementType: MovementType = "return") => {
    setMovementForm({
      ...emptyMovementForm(),
      customer_contact_id: String(customerId),
      movement_type: movementType,
    });
    setMovementOpen(true);
  };

  const balanceColumns = React.useMemo<ColumnDef<ContainerBalance>[]>(
    () => [
      {
        id: "customer",
        header: t("production.containers.col_customer", "Customer"),
        cell: ({ row }) => {
          const id = row.original.customer_contact_id;
          if (!id) {
            return <span className="font-medium">{t("production.containers.walk_in", "Walk-in")}</span>;
          }
          return (
            <button
              type="button"
              className="font-medium text-left hover:underline"
              onClick={() => setStatementCustomerId(id)}
            >
              {contactNameById.get(id) ?? `#${id}`}
            </button>
          );
        },
      },
      {
        id: "type",
        header: t("production.containers.col_type", "Container"),
        cell: ({ row }) => <span className="text-sm">{row.original.container_type?.name ?? "—"}</span>,
      },
      {
        accessorKey: "containers_out",
        header: t("production.containers.col_out", "Held"),
        cell: ({ row }) => (
          <span className="font-bold tabular-nums">{Number(row.original.containers_out).toLocaleString()}</span>
        ),
      },
      {
        accessorKey: "deposit_held",
        header: t("production.containers.col_deposit", "Deposit held"),
        cell: ({ row }) => (
          <span className="tabular-nums">ETB {Number(row.original.deposit_held).toLocaleString()}</span>
        ),
      },
      {
        accessorKey: "return_rate_percent",
        header: t("production.containers.col_return_rate", "Return rate"),
        cell: ({ row }) => {
          const rate = Number(row.original.return_rate_percent ?? 0);
          return <span className={`font-semibold tabular-nums ${returnRateTone(rate)}`}>{rate.toFixed(1)}%</span>;
        },
      },
      {
        id: "actions",
        header: t("production.common.actions", "Actions"),
        cell: ({ row }) => {
          const customerId = row.original.customer_contact_id;
          if (!customerId) return null;
          return (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setStatementCustomerId(customerId)}
              >
                <FileText className="h-3 w-3" />
              </Button>
              {canRecordMovement ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => openMovementForCustomer(customerId, "return")}
                >
                  {t("production.containers.record_return", "Return")}
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [canRecordMovement, contactNameById, t],
  );

  const movementColumns = React.useMemo<ColumnDef<ContainerMovement>[]>(
    () => [
      {
        accessorKey: "movement_type",
        header: t("production.common.type", "Type"),
        cell: ({ row }) => {
          const type = row.original.movement_type;
          const classes =
            type === "issue"
              ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
              : type === "return"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : type === "scrap"
                  ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                  : "bg-muted text-muted-foreground";
          return (
            <Badge variant="outline" className={`border-transparent text-[11px] font-black uppercase tracking-widest ${classes}`}>
              {type}
            </Badge>
          );
        },
      },
      {
        id: "customer",
        header: t("production.containers.col_customer", "Customer"),
        cell: ({ row }) => {
          const id = row.original.customer_contact_id;
          return (
            <span className="text-sm">
              {id ? contactNameById.get(id) ?? `#${id}` : t("production.containers.walk_in", "Walk-in")}
            </span>
          );
        },
      },
      {
        id: "container",
        header: t("production.containers.col_type", "Container"),
        cell: ({ row }) => <span className="text-sm">{row.original.container_type?.name ?? "—"}</span>,
      },
      {
        accessorKey: "quantity",
        header: t("production.common.quantity", "Qty"),
        cell: ({ row }) => (
          <span className="font-bold tabular-nums">{Number(row.original.quantity).toLocaleString()}</span>
        ),
      },
      {
        accessorKey: "deposit_amount",
        header: t("production.containers.col_deposit_effect", "Deposit"),
        cell: ({ row }) => {
          const amount = Number(row.original.deposit_amount);
          return (
            <span className="flex items-center gap-1 tabular-nums">
              {amount > 0 ? (
                <ArrowUpRight className="h-3 w-3 text-sky-500" aria-hidden />
              ) : amount < 0 ? (
                <ArrowDownLeft className="h-3 w-3 text-emerald-500" aria-hidden />
              ) : null}
              ETB {Math.abs(amount).toLocaleString()}
              {row.original.deposit_forfeited ? (
                <Badge variant="secondary" className="ml-1 text-[10px] font-bold">
                  {t("production.containers.forfeited", "forfeited")}
                </Badge>
              ) : null}
            </span>
          );
        },
      },
      {
        accessorKey: "occurred_at",
        header: t("production.common.date", "Date"),
        cell: ({ row }) => (
          <span className="text-xs">{new Date(row.original.occurred_at).toLocaleString()}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" className="h-8" onClick={() => setInspectMovement(row.original)}>
            <Eye className="h-3 w-3" />
          </Button>
        ),
      },
    ],
    [contactNameById, t],
  );

  const balanceFiltersActive = hasActiveBalanceFilters({
    search: tableQuery.search,
    typeId: typeFilter,
    customerId: customerFilter,
    outstandingOnly,
  });

  const movementFiltersActive = hasActiveMovementFilters({
    search: tableQuery.search,
    typeId: typeFilter,
    customerId: customerFilter,
    movementType: movementTypeFilter,
    condition: conditionFilter,
    from: fromDate,
    to: toDate,
  });

  const refetching =
    tab === "balances"
      ? balancesQuery.isFetching && !balancesQuery.isLoading
      : movementsQuery.isFetching && !movementsQuery.isLoading;

  const clearBalanceFilters = () => {
    setTypeFilter("");
    setCustomerFilter("");
    setOutstandingOnly(true);
    setTableQuery((current) => ({ ...current, search: "", page: 1 }));
  };

  const clearMovementFilters = () => {
    setTypeFilter("");
    setCustomerFilter("");
    setMovementTypeFilter("");
    setConditionFilter("");
    setFromDate("");
    setToDate("");
    setTableQuery((current) => ({ ...current, search: "", page: 1 }));
  };

  if (!canView) {
    return (
      <ProductionShell
        title={t("production.containers.title", "Returnable containers")}
        description={t("production.containers.subtitle", "Jar fleet and refundable deposits.")}
      >
        <ProductionError
          error={{ response: { data: { message: t("production.common.no_permission", "You do not have permission to view this page.") } } }}
        />
      </ProductionShell>
    );
  }

  return (
    <ProductionShell
      title={t("production.containers.title", "Returnable containers")}
      description={t(
        "production.containers.subtitle",
        "The jar fleet and the refundable deposits riding on it — how many are out, and how much of that money the plant owes back.",
      )}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              summaryQuery.refetch();
              typesQuery.refetch();
              if (tab === "balances") balancesQuery.refetch();
              else if (tab === "movements") movementsQuery.refetch();
            }}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refetching ? "animate-spin" : ""}`} />
            {t("production.common.refresh", "Refresh")}
          </Button>
          {canManageTypes ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTypeForm(DEFAULT_TYPE_FORM);
                setTypeOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("production.containers.add_type", "Container type")}
            </Button>
          ) : null}
          {canRecordMovement ? (
            <Button
              type="button"
              onClick={() => {
                setMovementForm(emptyMovementForm());
                setMovementOpen(true);
              }}
            >
              <Recycle className="mr-2 h-4 w-4" />
              {t("production.containers.record_movement", "Record movement")}
            </Button>
          ) : null}
        </div>
      }
    >
      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ProductionMetricCard
            title={t("production.containers.total_out", "Containers in circulation")}
            value={summary.total_containers_out.toLocaleString()}
            description={t("production.containers.across_types", "across {n} container type(s)").replace(
              "{n}",
              String(summary.by_type?.length ?? 0),
            )}
          />
          <ProductionMetricCard
            title={t("production.containers.total_deposit", "Refundable deposit held")}
            value={`ETB ${summary.total_deposit_held.toLocaleString()}`}
            description={t("production.containers.liability_hint", "A liability, not revenue")}
          />
          {(summary.by_type ?? []).slice(0, 2).map((type) => (
            <Link
              key={type.container_type_id}
              href={`/dashboard/production/containers?type_id=${type.container_type_id}`}
              className="block"
            >
              <ProductionMetricCard
                title={type.name}
                value={type.containers_out.toLocaleString()}
                description={`${type.return_rate_percent.toFixed(1)}% ${t("production.containers.returned", "returned")} · ETB ${type.deposit_held.toLocaleString()} ${t("production.containers.held", "held")}`}
              />
            </Link>
          ))}
        </div>
      ) : summaryQuery.isLoading ? (
        <ProductionLoading />
      ) : null}

      <div className="flex gap-2 border-b border-border/60">
        {(["balances", "movements", "types"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === value
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            aria-current={tab === value ? "page" : undefined}
          >
            {value === "balances"
              ? t("production.containers.tab_balances", "Customer holdings")
              : value === "movements"
                ? t("production.containers.tab_movements", "Movement ledger")
                : t("production.containers.tab_types", "Container types")}
          </button>
        ))}
      </div>

      {tab === "balances" ? (
        <>
          <FilterBar filtersActive={balanceFiltersActive} onClear={clearBalanceFilters}>
            <FilterSelect
              label={t("production.containers.col_type", "Container")}
              value={typeFilter || "all"}
              onChange={(value) => setTypeFilter(value === "all" ? "" : value)}
              options={[
                { value: "all", label: t("production.common.all", "All") },
                ...types.map((type) => ({ value: String(type.id), label: type.name })),
              ]}
            />
            <FilterSelect
              label={t("production.containers.col_customer", "Customer")}
              value={customerFilter || "all"}
              onChange={(value) => setCustomerFilter(value === "all" ? "" : value)}
              options={[
                { value: "all", label: t("production.common.all", "All") },
                ...contacts.map((contact) => ({ value: String(contact.id), label: contactLabel(contact) })),
              ]}
            />
            <label className="flex h-9 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={outstandingOnly}
                onChange={(event) => setOutstandingOnly(event.target.checked)}
                className="rounded border"
              />
              {t("production.containers.outstanding_only", "Outstanding only")}
            </label>
          </FilterBar>
          {balancesQuery.isError ? (
            <ProductionError error={balancesQuery.error} />
          ) : (
            <DataTable
              columns={balanceColumns}
              data={(balancesQuery.data?.data ?? []) as ContainerBalance[]}
              totalEntries={balancesQuery.data?.meta?.total ?? 0}
              loading={balancesQuery.isFetching}
              pageIndex={tableQuery.page}
              pageSize={tableQuery.pageSize}
              onQueryChange={handleTableQueryChange}
              searchPlaceholder={t("production.containers.search_balances", "Search by customer ID...")}
              resourceName="container-balances"
              syncWithUrl={false}
              defaultSearch={tableQuery.search}
              onRefresh={() => balancesQuery.refetch()}
              getRowId={(row) => String(row.id)}
            />
          )}
        </>
      ) : tab === "movements" ? (
        <>
          <FilterBar filtersActive={movementFiltersActive} onClear={clearMovementFilters}>
            <FilterSelect
              label={t("production.common.type", "Movement")}
              value={movementTypeFilter || "all"}
              onChange={(value) => setMovementTypeFilter(value === "all" ? "" : value)}
              options={[
                { value: "all", label: t("production.common.all", "All") },
                ...MOVEMENT_TYPES.map((type) => ({ value: type, label: type })),
              ]}
            />
            <FilterSelect
              label={t("production.containers.col_type", "Container")}
              value={typeFilter || "all"}
              onChange={(value) => setTypeFilter(value === "all" ? "" : value)}
              options={[
                { value: "all", label: t("production.common.all", "All") },
                ...types.map((type) => ({ value: String(type.id), label: type.name })),
              ]}
            />
            <FilterSelect
              label={t("production.containers.col_customer", "Customer")}
              value={customerFilter || "all"}
              onChange={(value) => setCustomerFilter(value === "all" ? "" : value)}
              options={[
                { value: "all", label: t("production.common.all", "All") },
                ...contacts.map((contact) => ({ value: String(contact.id), label: contactLabel(contact) })),
              ]}
            />
            <FilterSelect
              label={t("production.containers.col_condition", "Condition")}
              value={conditionFilter || "all"}
              onChange={(value) => setConditionFilter(value === "all" ? "" : value)}
              options={[
                { value: "all", label: t("production.common.all", "All") },
                ...CONDITIONS.map((condition) => ({ value: condition, label: condition })),
              ]}
            />
            <DateFilter from={fromDate} to={toDate} onFromChange={setFromDate} onToChange={setToDate} />
          </FilterBar>
          {movementsQuery.isError ? (
            <ProductionError error={movementsQuery.error} />
          ) : (
            <DataTable
              columns={movementColumns}
              data={(movementsQuery.data?.data ?? []) as ContainerMovement[]}
              totalEntries={movementsQuery.data?.meta?.total ?? 0}
              loading={movementsQuery.isFetching}
              pageIndex={tableQuery.page}
              pageSize={tableQuery.pageSize}
              onQueryChange={handleTableQueryChange}
              searchPlaceholder={t("production.containers.search_movements", "Search reference, notes, or customer ID...")}
              resourceName="container-movements"
              syncWithUrl={false}
              defaultSearch={tableQuery.search}
              onRefresh={() => movementsQuery.refetch()}
              getRowId={(row) => String(row.id)}
            />
          )}
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {types.length === 0 ? (
            <p className="col-span-full rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm italic text-muted-foreground">
              {t("production.containers.no_types", "No container types defined yet.")}
            </p>
          ) : (
            types.map((type) => {
              const fleet = summary?.by_type?.find((row) => row.container_type_id === type.id);
              return (
                <article key={type.id} className="rounded-2xl border border-border/60 bg-card p-4">
                  <header className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">{type.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{type.code}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`border-transparent text-[10px] font-black uppercase tracking-widest ${
                        type.is_active
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {type.is_active
                        ? t("production.common.active", "Active")
                        : t("production.common.retired", "Retired")}
                    </Badge>
                  </header>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="uppercase tracking-widest text-muted-foreground">
                        {t("production.containers.capacity", "Capacity")}
                      </dt>
                      <dd className="font-bold tabular-nums">{Number(type.capacity_litres)} L</dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-widest text-muted-foreground">
                        {t("production.containers.deposit", "Deposit")}
                      </dt>
                      <dd className="font-bold tabular-nums">ETB {Number(type.deposit_amount).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-widest text-muted-foreground">
                        {t("production.containers.col_out", "Out")}
                      </dt>
                      <dd className="font-bold tabular-nums">{fleet?.containers_out.toLocaleString() ?? "0"}</dd>
                    </div>
                  </dl>
                  {fleet ? (
                    <p className={`mt-2 text-xs font-semibold tabular-nums ${returnRateTone(fleet.return_rate_percent)}`}>
                      {fleet.return_rate_percent.toFixed(1)}% {t("production.containers.returned", "returned")}
                    </p>
                  ) : null}
                  {canManageTypes ? (
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          setTypeForm({
                            id: type.id,
                            name: type.name,
                            code: type.code,
                            capacity_litres: String(type.capacity_litres),
                            deposit_amount: String(type.deposit_amount),
                            expected_trips: type.expected_trips ? String(type.expected_trips) : "",
                            notes: type.notes ?? "",
                          });
                          setTypeOpen(true);
                        }}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        {t("production.common.edit", "Edit")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive"
                        onClick={() => setDeleteType(type)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      )}

      <MovementDialog
        open={movementOpen}
        onOpenChange={setMovementOpen}
        form={movementForm}
        setForm={setMovementForm}
        types={types}
        contacts={contacts}
        orders={orders}
        contactSearch={contactSearch}
        setContactSearch={setContactSearch}
        orderSearch={orderSearch}
        setOrderSearch={setOrderSearch}
        busy={movementMutation.isPending}
        onSubmit={() => {
          if (!movementForm.container_type_id || !movementForm.quantity) {
            toast.error(t("production.containers.movement_required", "Container type and quantity are required."));
            return;
          }
          movementMutation.mutate();
        }}
      />

      <TypeDialog
        open={typeOpen}
        onOpenChange={setTypeOpen}
        form={typeForm}
        setForm={setTypeForm}
        busy={typeMutation.isPending}
        onSubmit={() => {
          if (!typeForm.name.trim() || !typeForm.code.trim()) {
            toast.error(t("production.containers.type_required", "Name and code are required."));
            return;
          }
          typeMutation.mutate();
        }}
      />

      <Dialog open={inspectMovement !== null} onOpenChange={(open) => !open && setInspectMovement(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>{t("production.containers.movement_detail", "Movement detail")}</DialogTitle>
            <DialogDescription>
              {inspectMovement ? new Date(inspectMovement.occurred_at).toLocaleString() : ""}
            </DialogDescription>
          </DialogHeader>
          {inspectMovement ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t("production.common.type", "Type")}</dt>
                <dd className="font-medium capitalize">{inspectMovement.movement_type}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("production.containers.col_type", "Container")}</dt>
                <dd className="font-medium">{inspectMovement.container_type?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("production.common.quantity", "Quantity")}</dt>
                <dd className="font-medium tabular-nums">{Number(inspectMovement.quantity).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("production.containers.col_deposit_effect", "Deposit")}</dt>
                <dd className="font-medium tabular-nums">
                  ETB {Number(inspectMovement.deposit_amount).toLocaleString()}
                  {inspectMovement.deposit_forfeited ? ` (${t("production.containers.forfeited", "forfeited")})` : ""}
                </dd>
              </div>
              {inspectMovement.reference ? (
                <div>
                  <dt className="text-muted-foreground">{t("production.containers.reference", "Reference")}</dt>
                  <dd className="font-medium">{inspectMovement.reference}</dd>
                </div>
              ) : null}
              {inspectMovement.production_order_id ? (
                <div className="sm:col-span-2">
                  <Link
                    href={`/dashboard/production/orders?order_id=${inspectMovement.production_order_id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {t("production.runs.view_order", "Work order")} #{inspectMovement.production_order_id}
                  </Link>
                </div>
              ) : null}
              {inspectMovement.notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">{t("production.common.notes", "Notes")}</dt>
                  <dd>{inspectMovement.notes}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={statementCustomerId !== null} onOpenChange={(open) => !open && setStatementCustomerId(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("production.containers.statement_title", "Customer deposit statement")}</DialogTitle>
            <DialogDescription>
              {statementCustomerId
                ? contactNameById.get(statementCustomerId) ?? `#${statementCustomerId}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {statementQuery.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("production.common.loading", "Loading...")}
            </div>
          ) : statementQuery.data ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <ProductionMetricCard
                  title={t("production.containers.col_out", "Held")}
                  value={statementQuery.data.containers_out.toLocaleString()}
                  description={t("production.containers.containers_held", "containers currently out")}
                />
                <ProductionMetricCard
                  title={t("production.containers.col_deposit", "Deposit held")}
                  value={`ETB ${statementQuery.data.deposit_held.toLocaleString()}`}
                  description={t("production.containers.liability_hint", "A liability, not revenue")}
                />
              </div>
              {statementQuery.data.balances.length > 0 ? (
                <div className="rounded-xl border p-3">
                  <p className="mb-2 text-sm font-semibold">{t("production.containers.by_type", "By container type")}</p>
                  <ul className="space-y-1 text-sm">
                    {statementQuery.data.balances.map((balance) => (
                      <li key={balance.container_type_id} className="flex justify-between gap-3">
                        <span>{balance.name}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {balance.containers_out.toLocaleString()} · ETB {balance.deposit_held.toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {statementQuery.data.movements.length > 0 ? (
                <div className="rounded-xl border p-3">
                  <p className="mb-2 text-sm font-semibold">
                    {t("production.containers.recent_movements", "Recent movements")}
                  </p>
                  <ul className="space-y-2 text-sm">
                    {statementQuery.data.movements.map((movement) => (
                      <li key={movement.id} className="flex justify-between gap-3 border-b border-border/40 pb-2 last:border-0">
                        <span>
                          <span className="font-medium capitalize">{movement.movement_type}</span> ·{" "}
                          {movement.container_type} × {movement.quantity}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(movement.occurred_at).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {canRecordMovement && statementCustomerId ? (
                <DialogFooter className="gap-2 sm:justify-start">
                  <Button size="sm" onClick={() => openMovementForCustomer(statementCustomerId, "issue")}>
                    {t("production.containers.issue", "Issue")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openMovementForCustomer(statementCustomerId, "return")}
                  >
                    {t("production.containers.record_return", "Return")}
                  </Button>
                </DialogFooter>
              ) : null}
            </>
          ) : (
            <ProductionError error={statementQuery.error} />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteType !== null} onOpenChange={(open) => !open && setDeleteType(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("production.containers.delete_type_title", "Remove container type?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "production.containers.delete_type_desc",
                "Types with circulation history are retired instead of deleted so deposit liability is preserved.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("production.common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTypeMutation.mutate()}
            >
              {t("production.common.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProductionShell>
  );
}

function FilterBar({
  children,
  filtersActive,
  onClear,
}: {
  children: React.ReactNode;
  filtersActive: boolean;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
      {children}
      {filtersActive ? (
        <Button type="button" variant="ghost" size="sm" className="h-9 gap-1" onClick={onClear}>
          <X className="h-3.5 w-3.5" />
          {t("production.common.clear_filters", "Clear filters")}
        </Button>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-[10rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DateFilter({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="space-y-1">
        <Label className="text-xs" htmlFor="containers-from">
          {t("production.common.from", "From")}
        </Label>
        <Input id="containers-from" type="date" className="h-9 w-[10rem]" value={from} onChange={(e) => onFromChange(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs" htmlFor="containers-to">
          {t("production.common.to", "To")}
        </Label>
        <Input id="containers-to" type="date" className="h-9 w-[10rem]" value={to} onChange={(e) => onToChange(e.target.value)} />
      </div>
    </>
  );
}

function MovementDialog({
  open,
  onOpenChange,
  form,
  setForm,
  types,
  contacts,
  orders,
  contactSearch,
  setContactSearch,
  orderSearch,
  setOrderSearch,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: MovementForm;
  setForm: React.Dispatch<React.SetStateAction<MovementForm>>;
  types: ContainerType[];
  contacts: CrmContact[];
  orders: ProductionOrder[];
  contactSearch: string;
  setContactSearch: (value: string) => void;
  orderSearch: string;
  setOrderSearch: (value: string) => void;
  busy: boolean;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();

  const handleTypeChange = (value: string) => {
    const type = types.find((candidate) => String(candidate.id) === value);
    setForm((prev) => ({
      ...prev,
      container_type_id: value,
      deposit_per_unit: type ? String(type.deposit_amount) : prev.deposit_per_unit,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-[2rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("production.containers.movement_title", "Record container movement")}</DialogTitle>
          <DialogDescription>
            {t(
              "production.containers.movement_desc",
              "Issue takes a deposit, return refunds it, and a scrapped jar keeps it when the deposit is forfeited.",
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("production.containers.container_type", "Container type")}</Label>
            <Select value={form.container_type_id} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("production.containers.select_type", "Select a container type")} />
              </SelectTrigger>
              <SelectContent>
                {types.filter((type) => type.is_active).map((type) => (
                  <SelectItem key={type.id} value={String(type.id)}>
                    {type.name} (ETB {Number(type.deposit_amount).toLocaleString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("production.common.type", "Movement")}</Label>
            <Select
              value={form.movement_type}
              onValueChange={(value: MovementType) => setForm((prev) => ({ ...prev, movement_type: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>{t("production.containers.col_customer", "Customer")}</Label>
            <Input
              value={contactSearch}
              onChange={(event) => setContactSearch(event.target.value)}
              placeholder={t("production.containers.search_customer", "Search contacts...")}
            />
            <Select
              value={form.customer_contact_id || "none"}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, customer_contact_id: value === "none" ? "" : value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("production.containers.walk_in_hint", "Leave blank for walk-in trade")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("production.containers.walk_in", "Walk-in")}</SelectItem>
                {contacts.map((contact) => (
                  <SelectItem key={contact.id} value={String(contact.id)}>
                    {contactLabel(contact)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>{t("production.runs.work_order", "Work order")}</Label>
            <Input
              value={orderSearch}
              onChange={(event) => setOrderSearch(event.target.value)}
              placeholder={t("production.runs.search_order", "Search open orders...")}
            />
            <Select
              value={form.production_order_id || "none"}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, production_order_id: value === "none" ? "" : value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("production.quality.optional_order", "Optional — link to a batch")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("production.common.none", "None")}</SelectItem>
                {orders.map((order) => (
                  <SelectItem key={order.id} value={String(order.id)}>
                    {order.order_number} — {order.batch_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="container-qty">{t("production.common.quantity", "Quantity")}</Label>
            <Input
              id="container-qty"
              type="number"
              step="1"
              value={form.quantity}
              onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))}
            />
            {form.movement_type === "adjustment" ? (
              <p className="text-[11px] text-muted-foreground">
                {t("production.containers.adjustment_hint", "Adjustments accept a negative value and never move money.")}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="container-deposit">{t("production.containers.deposit_override", "Deposit per unit")}</Label>
            <Input
              id="container-deposit"
              type="number"
              step="0.01"
              value={form.deposit_per_unit}
              onChange={(event) => setForm((prev) => ({ ...prev, deposit_per_unit: event.target.value }))}
              placeholder={t("production.containers.deposit_default", "Defaults to the container rate")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("production.containers.col_condition", "Condition")}</Label>
            <Select
              value={form.condition || "none"}
              onValueChange={(value) => setForm((prev) => ({ ...prev, condition: value === "none" ? "" : value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("production.containers.condition_hint", "On return or scrap")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {CONDITIONS.map((condition) => (
                  <SelectItem key={condition} value={condition}>
                    {condition}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="container-reference">{t("production.containers.reference", "Reference")}</Label>
            <Input
              id="container-reference"
              value={form.reference}
              onChange={(event) => setForm((prev) => ({ ...prev, reference: event.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Checkbox
                checked={form.deposit_forfeited}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, deposit_forfeited: checked === true }))
                }
              />
              {t("production.containers.forfeit", "Forfeit the deposit")}
            </label>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="container-notes">{t("production.common.notes", "Notes")}</Label>
            <Input
              id="container-notes"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("production.common.cancel", "Cancel")}
          </Button>
          <Button disabled={busy} onClick={onSubmit}>
            <BusyLabel busy={busy}>{t("production.containers.save_movement", "Record movement")}</BusyLabel>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TypeDialog({
  open,
  onOpenChange,
  form,
  setForm,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: TypeForm;
  setForm: React.Dispatch<React.SetStateAction<TypeForm>>;
  busy: boolean;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl rounded-[2rem]">
        <DialogHeader>
          <DialogTitle>
            {form.id
              ? t("production.containers.edit_type", "Edit container type")
              : t("production.containers.new_type", "New container type")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "production.containers.type_desc",
              "The deposit set here is charged by default on every issue of this container.",
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="type-name">{t("production.common.name", "Name")}</Label>
            <Input
              id="type-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type-code">{t("production.common.code", "Code")}</Label>
            <Input
              id="type-code"
              value={form.code}
              onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type-capacity">{t("production.containers.capacity_l", "Capacity (L)")}</Label>
            <Input
              id="type-capacity"
              type="number"
              step="0.1"
              value={form.capacity_litres}
              onChange={(event) => setForm((prev) => ({ ...prev, capacity_litres: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type-deposit">{t("production.containers.deposit_etb", "Deposit (ETB)")}</Label>
            <Input
              id="type-deposit"
              type="number"
              step="0.01"
              value={form.deposit_amount}
              onChange={(event) => setForm((prev) => ({ ...prev, deposit_amount: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type-trips">{t("production.containers.expected_trips", "Expected trips")}</Label>
            <Input
              id="type-trips"
              type="number"
              value={form.expected_trips}
              onChange={(event) => setForm((prev) => ({ ...prev, expected_trips: event.target.value }))}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="type-notes">{t("production.common.notes", "Notes")}</Label>
            <Input
              id="type-notes"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("production.common.cancel", "Cancel")}
          </Button>
          <Button disabled={busy} onClick={onSubmit}>
            <BusyLabel busy={busy}>{t("production.common.save", "Save")}</BusyLabel>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
