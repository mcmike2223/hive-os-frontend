"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Loader2, Plus, Recycle, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { productionApi } from "@/modules/production/api";
import type {
  ContainerBalance,
  ContainerFleetSummary,
  ContainerMovement,
  ContainerType,
} from "@/modules/production/types";

const MOVEMENT_TYPES = ["issue", "return", "scrap", "adjustment"] as const;
const CONDITIONS = ["good", "damaged", "contaminated"] as const;

type MovementForm = {
  container_type_id: string;
  customer_contact_id: string;
  movement_type: (typeof MOVEMENT_TYPES)[number];
  quantity: string;
  deposit_per_unit: string;
  deposit_forfeited: boolean;
  condition: string;
  reference: string;
  notes: string;
};

const DEFAULT_MOVEMENT: MovementForm = {
  container_type_id: "",
  customer_contact_id: "",
  movement_type: "issue",
  quantity: "",
  deposit_per_unit: "",
  deposit_forfeited: false,
  condition: "",
  reference: "",
  notes: "",
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

const DEFAULT_TYPE: TypeForm = {
  name: "",
  code: "",
  capacity_litres: "20",
  deposit_amount: "",
  expected_trips: "40",
  notes: "",
};

export default function ContainerDepositsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tab, setTab] = React.useState<"balances" | "movements" | "types">("balances");
  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [movementOpen, setMovementOpen] = React.useState(false);
  const [movementForm, setMovementForm] = React.useState<MovementForm>(DEFAULT_MOVEMENT);
  const [typeOpen, setTypeOpen] = React.useState(false);
  const [typeForm, setTypeForm] = React.useState<TypeForm>(DEFAULT_TYPE);

  const summaryQuery = useQuery({
    queryKey: ["production", "containers", "summary"],
    queryFn: () => productionApi.containerSummary().then((res) => res.data),
  });

  const typesQuery = useQuery({
    queryKey: ["production", "containers", "types"],
    queryFn: () => productionApi.listContainerTypes({ limit: 100 }).then((res) => res.data),
  });

  const balancesQuery = useQuery({
    queryKey: ["production", "containers", "balances", tableQuery],
    queryFn: () =>
      productionApi
        .listContainerBalances({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          outstanding_only: true,
        })
        .then((res) => res.data),
    enabled: tab === "balances",
  });

  const movementsQuery = useQuery({
    queryKey: ["production", "containers", "movements", tableQuery],
    queryFn: () =>
      productionApi
        .listContainerMovements({ page: tableQuery.page, limit: tableQuery.pageSize })
        .then((res) => res.data),
    enabled: tab === "movements",
  });

  const summary: ContainerFleetSummary | undefined = summaryQuery.data?.data;
  const types: ContainerType[] = typesQuery.data?.data ?? [];

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["production", "containers"] });
    queryClient.invalidateQueries({ queryKey: ["production", "overview"] });
  }, [queryClient]);

  const movementMutation = useMutation({
    mutationFn: () =>
      productionApi.createContainerMovement({
        container_type_id: Number(movementForm.container_type_id),
        customer_contact_id: movementForm.customer_contact_id
          ? Number(movementForm.customer_contact_id)
          : undefined,
        movement_type: movementForm.movement_type,
        quantity: Number(movementForm.quantity),
        deposit_per_unit: movementForm.deposit_per_unit ? Number(movementForm.deposit_per_unit) : undefined,
        deposit_forfeited: movementForm.deposit_forfeited,
        condition: movementForm.condition || undefined,
        reference: movementForm.reference || undefined,
        notes: movementForm.notes || undefined,
      }),
    onSuccess: () => {
      toast.success(t("production.containers.movement_saved", "Container movement recorded."));
      invalidate();
      setMovementOpen(false);
      setMovementForm(DEFAULT_MOVEMENT);
    },
    onError: (error: any) => {
      // The server refuses a return larger than the customer's holding; that
      // message is the useful one, so surface it verbatim.
      toast.error(
        error?.response?.data?.message ||
          t("production.containers.movement_failed", "Could not record the movement."),
      );
    },
  });

  const typeMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: typeForm.name.trim(),
        code: typeForm.code.trim(),
        capacity_litres: Number(typeForm.capacity_litres || 0),
        deposit_amount: Number(typeForm.deposit_amount || 0),
        expected_trips: typeForm.expected_trips ? Number(typeForm.expected_trips) : undefined,
        notes: typeForm.notes || undefined,
      };

      return typeForm.id
        ? productionApi.updateContainerType(typeForm.id, payload)
        : productionApi.createContainerType(payload);
    },
    onSuccess: () => {
      toast.success(t("production.containers.type_saved", "Container type saved."));
      invalidate();
      setTypeOpen(false);
      setTypeForm(DEFAULT_TYPE);
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message || t("production.containers.type_failed", "Could not save the type."),
      );
    },
  });

  const deleteTypeMutation = useMutation({
    mutationFn: (id: number) => productionApi.deleteContainerType(id),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("production.containers.type_deleted", "Container type removed."));
      invalidate();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || t("production.containers.type_delete_failed", "Could not remove it."));
    },
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const balanceColumns = React.useMemo<ColumnDef<ContainerBalance>[]>(
    () => [
      {
        id: "customer",
        header: t("production.containers.col_customer", "Customer"),
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.customer_contact_id
              ? `#${row.original.customer_contact_id}`
              : t("production.containers.walk_in", "Walk-in")}
          </span>
        ),
      },
      {
        id: "type",
        header: t("production.containers.col_type", "Container"),
        cell: ({ row }) => <span className="text-sm">{row.original.container_type?.name ?? "-"}</span>,
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
        header: t("production.containers.col_deposit", "Deposit Held"),
        cell: ({ row }) => (
          <span className="tabular-nums">ETB {Number(row.original.deposit_held).toLocaleString()}</span>
        ),
      },
      {
        accessorKey: "return_rate_percent",
        header: t("production.containers.col_return_rate", "Return Rate"),
        cell: ({ row }) => {
          const rate = row.original.return_rate_percent;
          // Below 80% the fleet is bleeding jars faster than the water margin
          // covers, so it reads as a warning rather than a neutral number.
          const tone =
            rate >= 90
              ? "text-emerald-600 dark:text-emerald-400"
              : rate >= 80
                ? "text-amber-600 dark:text-amber-400"
                : "text-rose-600 dark:text-rose-400";

          return <span className={`font-semibold tabular-nums ${tone}`}>{rate.toFixed(1)}%</span>;
        },
      },
      {
        id: "lifetime",
        header: t("production.containers.col_lifetime", "Issued / Returned / Scrapped"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-muted-foreground">
            {Number(row.original.lifetime_issued).toLocaleString()} /{" "}
            {Number(row.original.lifetime_returned).toLocaleString()} /{" "}
            {Number(row.original.lifetime_scrapped).toLocaleString()}
          </span>
        ),
      },
    ],
    [t],
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
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.customer_contact_id
              ? `#${row.original.customer_contact_id}`
              : t("production.containers.walk_in", "Walk-in")}
          </span>
        ),
      },
      {
        id: "container",
        header: t("production.containers.col_type", "Container"),
        cell: ({ row }) => <span className="text-sm">{row.original.container_type?.name ?? "-"}</span>,
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
        accessorKey: "condition",
        header: t("production.containers.col_condition", "Condition"),
        cell: ({ row }) => <span className="text-xs">{row.original.condition ?? "-"}</span>,
      },
      {
        accessorKey: "occurred_at",
        header: t("production.common.date", "Date"),
        cell: ({ row }) => (
          <span className="text-xs">{new Date(row.original.occurred_at).toLocaleString()}</span>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("production.containers.title", "Returnable Containers")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "production.containers.subtitle",
              "The jar fleet and the refundable deposits riding on it — how many are out, and how much of that money the plant owes back.",
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-full px-5"
            onClick={() => {
              setTypeForm(DEFAULT_TYPE);
              setTypeOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("production.containers.add_type", "Container Type")}
          </Button>
          <Button
            className="rounded-full px-5"
            onClick={() => {
              setMovementForm(DEFAULT_MOVEMENT);
              setMovementOpen(true);
            }}
          >
            <Recycle className="mr-2 h-4 w-4" />
            {t("production.containers.record_movement", "Record Movement")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          label={t("production.containers.total_out", "Containers in circulation")}
          value={(summary?.total_containers_out ?? 0).toLocaleString()}
          meta={t("production.containers.across_types", "across {n} container type(s)").replace(
            "{n}",
            String(summary?.by_type?.length ?? 0),
          )}
        />
        <SummaryTile
          label={t("production.containers.total_deposit", "Refundable deposit held")}
          value={`ETB ${(summary?.total_deposit_held ?? 0).toLocaleString()}`}
          meta={t("production.containers.liability_hint", "A liability, not revenue")}
        />
        {(summary?.by_type ?? []).slice(0, 2).map((type) => (
          <SummaryTile
            key={type.container_type_id}
            label={type.name}
            value={type.containers_out.toLocaleString()}
            meta={`${type.return_rate_percent.toFixed(1)}% ${t("production.containers.returned", "returned")}`}
          />
        ))}
      </div>

      <div className="flex gap-2 border-b border-border/60">
        {(["balances", "movements", "types"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value);
              setTableQuery((prev) => ({ ...prev, page: 1 }));
            }}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === value
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            aria-current={tab === value ? "page" : undefined}
          >
            {value === "balances"
              ? t("production.containers.tab_balances", "Customer Holdings")
              : value === "movements"
                ? t("production.containers.tab_movements", "Movement Ledger")
                : t("production.containers.tab_types", "Container Types")}
          </button>
        ))}
      </div>

      {tab === "balances" ? (
        <DataTable
          columns={balanceColumns}
          data={(balancesQuery.data?.data ?? []) as ContainerBalance[]}
          totalEntries={balancesQuery.data?.meta?.total ?? 0}
          loading={balancesQuery.isLoading}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          searchPlaceholder={t("production.containers.search_balances", "Search holdings...")}
          resourceName="container-balances"
        />
      ) : tab === "movements" ? (
        <DataTable
          columns={movementColumns}
          data={(movementsQuery.data?.data ?? []) as ContainerMovement[]}
          totalEntries={movementsQuery.data?.meta?.total ?? 0}
          loading={movementsQuery.isLoading}
          pageIndex={tableQuery.page}
          pageSize={tableQuery.pageSize}
          onQueryChange={handleTableQueryChange}
          searchPlaceholder={t("production.containers.search_movements", "Search movements...")}
          resourceName="container-movements"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {types.length === 0 ? (
            <p className="col-span-full rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm italic text-muted-foreground">
              {t("production.containers.no_types", "No container types defined yet.")}
            </p>
          ) : (
            types.map((type) => (
              <article key={type.id} className="rounded-2xl border border-border/60 bg-card p-4">
                <header className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{type.name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{type.code}</p>
                  </div>
                  {type.is_active ? (
                    <Badge variant="outline" className="border-transparent bg-emerald-500/15 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                      {t("production.common.active", "Active")}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-transparent bg-muted text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {t("production.common.retired", "Retired")}
                    </Badge>
                  )}
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
                      {t("production.containers.trips", "Trips")}
                    </dt>
                    <dd className="font-bold tabular-nums">{type.expected_trips ?? "-"}</dd>
                  </div>
                </dl>

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
                    {t("production.common.edit", "Edit")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive"
                    onClick={() => deleteTypeMutation.mutate(type.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {/* Record movement */}
      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("production.containers.movement_title", "Record Container Movement")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "production.containers.movement_desc",
                  "Issue takes a deposit, return refunds it, and a scrapped jar keeps it when the deposit is forfeited.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("production.containers.container_type", "Container Type")}</Label>
              <Select
                value={movementForm.container_type_id}
                onValueChange={(value) => setMovementForm((prev) => ({ ...prev, container_type_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("production.containers.select_type", "Select a container type")} />
                </SelectTrigger>
                <SelectContent>
                  {types.map((type) => (
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
                value={movementForm.movement_type}
                onValueChange={(value: MovementForm["movement_type"]) =>
                  setMovementForm((prev) => ({ ...prev, movement_type: value }))
                }
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
            <div className="space-y-2">
              <Label htmlFor="container-customer">
                {t("production.containers.customer_id", "Customer Contact ID")}
              </Label>
              <Input
                id="container-customer"
                type="number"
                value={movementForm.customer_contact_id}
                onChange={(event) =>
                  setMovementForm((prev) => ({ ...prev, customer_contact_id: event.target.value }))
                }
                placeholder={t("production.containers.walk_in_hint", "Leave blank for walk-in trade")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="container-qty">{t("production.common.quantity", "Quantity")}</Label>
              <Input
                id="container-qty"
                type="number"
                step="1"
                value={movementForm.quantity}
                onChange={(event) => setMovementForm((prev) => ({ ...prev, quantity: event.target.value }))}
                placeholder="10"
              />
              {movementForm.movement_type === "adjustment" ? (
                <p className="text-[11px] text-muted-foreground">
                  {t("production.containers.adjustment_hint", "Adjustments accept a negative value and never move money.")}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="container-deposit">
                {t("production.containers.deposit_override", "Deposit per Unit (override)")}
              </Label>
              <Input
                id="container-deposit"
                type="number"
                step="0.01"
                value={movementForm.deposit_per_unit}
                onChange={(event) =>
                  setMovementForm((prev) => ({ ...prev, deposit_per_unit: event.target.value }))
                }
                placeholder={t("production.containers.deposit_default", "Defaults to the container rate")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("production.containers.col_condition", "Condition")}</Label>
              <Select
                value={movementForm.condition}
                onValueChange={(value) => setMovementForm((prev) => ({ ...prev, condition: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("production.containers.condition_hint", "On return or scrap")} />
                </SelectTrigger>
                <SelectContent>
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
                value={movementForm.reference}
                onChange={(event) => setMovementForm((prev) => ({ ...prev, reference: event.target.value }))}
                placeholder="DEL-0142"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Checkbox
                  checked={movementForm.deposit_forfeited}
                  onCheckedChange={(checked) =>
                    setMovementForm((prev) => ({ ...prev, deposit_forfeited: checked === true }))
                  }
                />
                {t("production.containers.forfeit", "Forfeit the deposit")}
              </label>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="container-notes">{t("production.common.notes", "Notes")}</Label>
              <Input
                id="container-notes"
                value={movementForm.notes}
                onChange={(event) => setMovementForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setMovementOpen(false)}>
              {t("production.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={movementMutation.isPending}
              onClick={() => {
                if (!movementForm.container_type_id || !movementForm.quantity) {
                  toast.error(t("production.containers.movement_required", "Container type and quantity are required."));
                  return;
                }
                movementMutation.mutate();
              }}
            >
              {movementMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("production.containers.save_movement", "Record Movement")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Container type */}
      <Dialog open={typeOpen} onOpenChange={setTypeOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {typeForm.id
                  ? t("production.containers.edit_type", "Edit Container Type")
                  : t("production.containers.new_type", "New Container Type")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "production.containers.type_desc",
                  "The deposit set here is charged by default on every issue of this container.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type-name">{t("production.common.name", "Name")}</Label>
              <Input
                id="type-name"
                value={typeForm.name}
                onChange={(event) => setTypeForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="20L Returnable Jar"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type-code">{t("production.common.code", "Code")}</Label>
              <Input
                id="type-code"
                value={typeForm.code}
                onChange={(event) => setTypeForm((prev) => ({ ...prev, code: event.target.value }))}
                placeholder="JAR-20L"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type-capacity">{t("production.containers.capacity_l", "Capacity (L)")}</Label>
              <Input
                id="type-capacity"
                type="number"
                step="0.1"
                value={typeForm.capacity_litres}
                onChange={(event) => setTypeForm((prev) => ({ ...prev, capacity_litres: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type-deposit">{t("production.containers.deposit_etb", "Deposit (ETB)")}</Label>
              <Input
                id="type-deposit"
                type="number"
                step="0.01"
                value={typeForm.deposit_amount}
                onChange={(event) => setTypeForm((prev) => ({ ...prev, deposit_amount: event.target.value }))}
                placeholder="250"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type-trips">{t("production.containers.expected_trips", "Expected Trips")}</Label>
              <Input
                id="type-trips"
                type="number"
                value={typeForm.expected_trips}
                onChange={(event) => setTypeForm((prev) => ({ ...prev, expected_trips: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="type-notes">{t("production.common.notes", "Notes")}</Label>
              <Input
                id="type-notes"
                value={typeForm.notes}
                onChange={(event) => setTypeForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setTypeOpen(false)}>
              {t("production.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={typeMutation.isPending}
              onClick={() => {
                if (!typeForm.name.trim() || !typeForm.code.trim()) {
                  toast.error(t("production.containers.type_required", "Name and code are required."));
                  return;
                }
                typeMutation.mutate();
              }}
            >
              {typeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("production.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryTile({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
    </div>
  );
}
