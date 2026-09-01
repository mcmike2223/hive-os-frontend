"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Pencil, Plus, RefreshCw, Ticket } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { serviceApi } from "@/modules/service/api";
import type {
  AssetStatus,
  ContractTier,
  Coverage,
  ServiceAsset,
  ServiceContract,
  ServiceMaintenancePlan,
  ServiceRequest,
} from "@/modules/service/types";
import { EmptyPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const TIERS: ContractTier[] = ["bronze", "standard", "gold", "platinum"];
const ASSET_STATUSES: AssetStatus[] = ["operational", "faulty", "decommissioned"];
const CONTRACT_STATUSES = ["active", "suspended", "expired", "cancelled"] as const;

const COVERAGE_TONE: Record<Coverage, string> = {
  warranty: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  contract: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  chargeable: "bg-muted text-muted-foreground",
};

const today = () => new Date().toISOString().slice(0, 10);

const DEFAULT_ASSET = {
  asset_tag: "",
  name: "",
  category: "",
  manufacturer: "",
  model: "",
  serial_number: "",
  contract_id: "",
  customer_name: "",
  site: "",
  installed_on: "",
  warranty_expires_on: "",
  purchase_value: "0",
  status: "operational" as AssetStatus,
  notes: "",
};

const DEFAULT_CONTRACT = {
  contract_number: "",
  name: "",
  customer_name: "",
  tier: "standard" as ContractTier,
  response_hours: "4",
  resolution_hours: "24",
  is_24_7: "no",
  business_day_starts_at: "8",
  business_day_ends_at: "17",
  starts_on: today(),
  ends_on: "",
  value: "0",
  included_visits: "",
  status: "active",
  notes: "",
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function assetToForm(asset: ServiceAsset) {
  return {
    asset_tag: asset.asset_tag,
    name: asset.name,
    category: asset.category ?? "",
    manufacturer: asset.manufacturer ?? "",
    model: asset.model ?? "",
    serial_number: asset.serial_number ?? "",
    contract_id: asset.contract_id ? String(asset.contract_id) : "",
    customer_name: asset.customer_name ?? "",
    site: asset.site ?? "",
    installed_on: asset.installed_on ? String(asset.installed_on).slice(0, 10) : "",
    warranty_expires_on: asset.warranty_expires_on
      ? String(asset.warranty_expires_on).slice(0, 10)
      : "",
    purchase_value: String(n(asset.purchase_value)),
    status: asset.status,
    notes: asset.notes ?? "",
  };
}

function contractToForm(contract: ServiceContract) {
  return {
    contract_number: contract.contract_number,
    name: contract.name,
    customer_name: contract.customer_name,
    tier: contract.tier,
    response_hours: String(contract.response_hours),
    resolution_hours: String(contract.resolution_hours),
    is_24_7: contract.is_24_7 ? "yes" : "no",
    business_day_starts_at: String(contract.business_day_starts_at),
    business_day_ends_at: String(contract.business_day_ends_at),
    starts_on: contract.starts_on ? String(contract.starts_on).slice(0, 10) : today(),
    ends_on: contract.ends_on ? String(contract.ends_on).slice(0, 10) : "",
    value: String(n(contract.value)),
    included_visits:
      contract.included_visits === null || contract.included_visits === undefined
        ? ""
        : String(contract.included_visits),
    status: contract.status,
    notes: contract.notes ?? "",
  };
}

function buildAssetPayload(values: typeof DEFAULT_ASSET) {
  return {
    asset_tag: values.asset_tag.trim(),
    name: values.name.trim(),
    category: values.category || null,
    manufacturer: values.manufacturer || null,
    model: values.model || null,
    serial_number: values.serial_number || null,
    ...(values.contract_id ? { contract_id: Number(values.contract_id) } : { contract_id: null }),
    customer_name: values.customer_name || null,
    site: values.site || null,
    installed_on: values.installed_on || null,
    warranty_expires_on: values.warranty_expires_on || null,
    purchase_value: Number(values.purchase_value || 0),
    status: values.status,
    notes: values.notes || null,
  };
}

function buildContractPayload(values: typeof DEFAULT_CONTRACT) {
  return {
    contract_number: values.contract_number.trim(),
    name: values.name.trim(),
    customer_name: values.customer_name.trim(),
    tier: values.tier,
    response_hours: Number(values.response_hours || 0),
    resolution_hours: Number(values.resolution_hours || 0),
    is_24_7: values.is_24_7 === "yes",
    business_day_starts_at: Number(values.business_day_starts_at || 8),
    business_day_ends_at: Number(values.business_day_ends_at || 17),
    starts_on: values.starts_on,
    ends_on: values.ends_on || null,
    value: Number(values.value || 0),
    included_visits: values.included_visits ? Number(values.included_visits) : null,
    status: values.status,
    notes: values.notes || null,
  };
}

export default function ServiceAssetsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();
  const canManageAssets = hasAnyPermission(["manage_service_assets", "manage_service"]);
  const canManageContracts = hasAnyPermission(["manage_service_contracts", "manage_service"]);

  const initialContractId = searchParams.get("contract_id") ?? "";

  const [assetTableQuery, setAssetTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [assetStatusFilter, setAssetStatusFilter] = React.useState("all");
  const [assetContractFilter, setAssetContractFilter] = React.useState(
    initialContractId || "all",
  );
  const [warrantyExpiring, setWarrantyExpiring] = React.useState(false);

  const [contractTableQuery, setContractTableQuery] = React.useState({
    page: 1,
    pageSize: 10,
    search: "",
  });
  const [contractTierFilter, setContractTierFilter] = React.useState("all");
  const [inForceOnly, setInForceOnly] = React.useState(false);

  const [assetFormOpen, setAssetFormOpen] = React.useState(false);
  const [assetFormId, setAssetFormId] = React.useState<number | undefined>();
  const [assetForm, setAssetForm] = React.useState({ ...DEFAULT_ASSET });

  const [contractFormOpen, setContractFormOpen] = React.useState(false);
  const [contractFormId, setContractFormId] = React.useState<number | undefined>();
  const [contractForm, setContractForm] = React.useState({ ...DEFAULT_CONTRACT });

  const [assetDetailId, setAssetDetailId] = React.useState<number | null>(null);
  const [contractDetailId, setContractDetailId] = React.useState<number | null>(null);

  const assetsQuery = useQuery({
    queryKey: [
      "service",
      "assets",
      assetTableQuery,
      assetStatusFilter,
      assetContractFilter,
      warrantyExpiring,
    ],
    queryFn: () =>
      serviceApi
        .listAssets({
          page: assetTableQuery.page,
          limit: assetTableQuery.pageSize,
          search: assetTableQuery.search || undefined,
          status: assetStatusFilter !== "all" ? assetStatusFilter : undefined,
          contract_id: assetContractFilter !== "all" ? Number(assetContractFilter) : undefined,
          ...(warrantyExpiring ? { warranty_expiring: 1 } : {}),
        })
        .then((res) => res.data),
  });

  const contractsQuery = useQuery({
    queryKey: ["service", "contracts", contractTableQuery, contractTierFilter, inForceOnly],
    queryFn: () =>
      serviceApi
        .listContracts({
          page: contractTableQuery.page,
          limit: contractTableQuery.pageSize,
          search: contractTableQuery.search || undefined,
          tier: contractTierFilter !== "all" ? contractTierFilter : undefined,
          ...(inForceOnly ? { in_force_only: 1 } : {}),
        })
        .then((res) => res.data),
  });

  const contractOptionsQuery = useQuery({
    queryKey: ["service", "contract-options"],
    queryFn: () => serviceApi.listContracts({ limit: 200 }).then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["service", "overview-assets"],
    queryFn: () => serviceApi.overview().then((res) => res.data),
  });

  const assetDetailQuery = useQuery({
    queryKey: ["service", "asset", assetDetailId],
    queryFn: () => serviceApi.getAsset(assetDetailId!).then((res) => res.data),
    enabled: assetDetailId !== null,
  });

  const contractDetailQuery = useQuery({
    queryKey: ["service", "contract", contractDetailId],
    queryFn: () => serviceApi.getContract(contractDetailId!).then((res) => res.data),
    enabled: contractDetailId !== null,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["service"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const saveAsset = useMutation({
    mutationFn: () =>
      assetFormId
        ? serviceApi.updateAsset(assetFormId, buildAssetPayload(assetForm))
        : serviceApi.createAsset(buildAssetPayload(assetForm)),
    onSuccess: () => {
      toast.success(t("service.assets.saved", "Asset registered."));
      invalidate();
      setAssetFormOpen(false);
      setAssetFormId(undefined);
      setAssetForm({ ...DEFAULT_ASSET });
      if (assetDetailId === assetFormId) setAssetDetailId(null);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.assets.save_failed", "Could not save it."))),
  });

  const saveContract = useMutation({
    mutationFn: () =>
      contractFormId
        ? serviceApi.updateContract(contractFormId, buildContractPayload(contractForm))
        : serviceApi.createContract(buildContractPayload(contractForm)),
    onSuccess: () => {
      toast.success(t("service.contracts.saved", "Contract saved."));
      invalidate();
      setContractFormOpen(false);
      setContractFormId(undefined);
      setContractForm({ ...DEFAULT_CONTRACT, starts_on: today() });
      if (contractDetailId === contractFormId) setContractDetailId(null);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.contracts.save_failed", "Could not save it."))),
  });

  const assets = (assetsQuery.data?.data ?? []) as ServiceAsset[];
  const contracts = (contractsQuery.data?.data ?? []) as ServiceContract[];
  const contractOptions = (contractOptionsQuery.data?.data ?? []) as ServiceContract[];
  const assetSummary = overviewQuery.data?.data?.assets;
  const contractSummary = overviewQuery.data?.data?.contracts;
  const assetDetail = (assetDetailQuery.data?.data ?? null) as ServiceAsset | null;
  const contractDetail = (contractDetailQuery.data?.data ?? null) as
    | (ServiceContract & { assets?: ServiceAsset[] })
    | null;

  const openAssetCreate = () => {
    setAssetFormId(undefined);
    setAssetForm({
      ...DEFAULT_ASSET,
      contract_id: assetContractFilter !== "all" ? assetContractFilter : "",
    });
    setAssetFormOpen(true);
  };

  const openAssetEdit = (asset: ServiceAsset) => {
    setAssetFormId(asset.id);
    setAssetForm(assetToForm(asset));
    setAssetFormOpen(true);
  };

  const openContractCreate = () => {
    setContractFormId(undefined);
    setContractForm({ ...DEFAULT_CONTRACT, starts_on: today() });
    setContractFormOpen(true);
  };

  const openContractEdit = (contract: ServiceContract) => {
    setContractFormId(contract.id);
    setContractForm(contractToForm(contract));
    setContractFormOpen(true);
  };

  const assetColumns = React.useMemo<ColumnDef<ServiceAsset>[]>(
    () => [
      {
        id: "asset",
        header: t("service.assets.asset", "Asset"),
        cell: ({ row }) => (
          <button type="button" className="space-y-0.5 text-left" onClick={() => setAssetDetailId(row.original.id)}>
            <p className="font-bold hover:underline">{row.original.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.asset_tag}
              {row.original.site ? ` · ${row.original.site}` : ""}
            </p>
          </button>
        ),
      },
      {
        accessorKey: "customer_name",
        header: t("service.assets.customer", "Customer"),
        cell: ({ row }) => <span className="text-xs">{row.original.customer_name ?? "—"}</span>,
      },
      {
        id: "contract",
        header: t("service.assets.contract", "Contract"),
        cell: ({ row }) =>
          row.original.contract ? (
            <button
              type="button"
              className="text-left text-xs hover:underline"
              onClick={() => setContractDetailId(row.original.contract!.id)}
            >
              <span className="block capitalize">{row.original.contract.tier}</span>
              <span className="text-[11px] text-muted-foreground">{row.original.contract.name}</span>
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">{t("service.assets.no_contract", "None")}</span>
          ),
      },
      {
        id: "coverage",
        header: t("service.work.coverage", "Coverage"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={`border-transparent text-[10px] font-black uppercase tracking-widest ${
              COVERAGE_TONE[row.original.coverage ?? "chargeable"]
            }`}
          >
            {row.original.coverage ?? "chargeable"}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: t("service.common.status", "Status"),
        cell: ({ row }) => (
          <span
            className={`text-xs font-semibold capitalize ${
              row.original.status === "faulty" ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {row.original.status}
          </span>
        ),
      },
      {
        id: "faults",
        header: t("service.assets.faults", "Faults"),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.requests_count ?? 0}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setAssetDetailId(row.original.id)}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {canManageAssets ? (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openAssetEdit(row.original)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [canManageAssets, t],
  );

  const contractColumns = React.useMemo<ColumnDef<ServiceContract>[]>(
    () => [
      {
        id: "contract",
        header: t("service.contracts.contract", "Contract"),
        cell: ({ row }) => (
          <button
            type="button"
            className="space-y-0.5 text-left"
            onClick={() => setContractDetailId(row.original.id)}
          >
            <p className="font-bold hover:underline">{row.original.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{row.original.contract_number}</p>
          </button>
        ),
      },
      {
        accessorKey: "customer_name",
        header: t("service.assets.customer", "Customer"),
        cell: ({ row }) => <span className="text-xs">{row.original.customer_name}</span>,
      },
      {
        accessorKey: "tier",
        header: t("service.contracts.tier", "Tier"),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[11px] capitalize">
            {row.original.tier}
          </Badge>
        ),
      },
      {
        id: "sla",
        header: t("service.contracts.cover", "Cover"),
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.is_24_7
              ? t("service.contracts.always", "24/7")
              : t("service.contracts.hours", "{a}:00–{b}:00")
                  .replace("{a}", String(row.original.business_day_starts_at))
                  .replace("{b}", String(row.original.business_day_ends_at))}
            <span className="block text-[11px] text-muted-foreground">
              {t("service.contracts.promise_long", "{r}h respond · {f}h resolve")
                .replace("{r}", String(row.original.response_hours))
                .replace("{f}", String(row.original.resolution_hours))}
            </span>
          </span>
        ),
      },
      {
        id: "expiry",
        header: t("service.contracts.expiry", "Expiry"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.ends_on ? (
              <>
                {String(row.original.ends_on).slice(0, 10)}
                <span
                  className={`block text-[11px] font-semibold ${
                    row.original.is_in_force === false ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {row.original.is_in_force === false
                    ? t("service.contracts.lapsed", "Lapsed")
                    : t("service.contracts.days_left", "{n} days left").replace(
                        "{n}",
                        String(row.original.days_to_expiry ?? 0),
                      )}
                </span>
              </>
            ) : (
              t("service.contracts.open_ended", "Open ended")
            )}
          </span>
        ),
      },
      {
        id: "value",
        header: t("service.contracts.value", "Value"),
        cell: ({ row }) => <span className="tabular-nums">{money(row.original.value)}</span>,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setContractDetailId(row.original.id)}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {canManageContracts ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => openContractEdit(row.original)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [canManageContracts, t],
  );

  const renderAssetForm = () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="a-tag">{t("service.assets.tag", "Asset tag")}</Label>
        <Input
          id="a-tag"
          value={assetForm.asset_tag}
          onChange={(e) => setAssetForm({ ...assetForm, asset_tag: e.target.value })}
          disabled={Boolean(assetFormId)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="a-name">{t("service.common.name", "Name")}</Label>
        <Input id="a-name" value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="a-category">{t("service.assets.category", "Category")}</Label>
        <Input id="a-category" value={assetForm.category} onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="a-maker">{t("service.assets.manufacturer", "Manufacturer")}</Label>
        <Input id="a-maker" value={assetForm.manufacturer} onChange={(e) => setAssetForm({ ...assetForm, manufacturer: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="a-model">{t("service.assets.model", "Model")}</Label>
        <Input id="a-model" value={assetForm.model} onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="a-serial">{t("service.assets.serial", "Serial number")}</Label>
        <Input id="a-serial" value={assetForm.serial_number} onChange={(e) => setAssetForm({ ...assetForm, serial_number: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("service.assets.contract", "Contract")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select
            value={assetForm.contract_id || "none"}
            onValueChange={(v) => setAssetForm({ ...assetForm, contract_id: v === "none" ? "" : v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("service.assets.no_contract", "None")}</SelectItem>
              {contractOptions.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{t("service.common.status", "Status")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select value={assetForm.status} onValueChange={(v) => setAssetForm({ ...assetForm, status: v as AssetStatus })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ASSET_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="a-customer">{t("service.assets.customer", "Customer")}</Label>
        <Input id="a-customer" value={assetForm.customer_name} onChange={(e) => setAssetForm({ ...assetForm, customer_name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="a-site">{t("service.assets.site", "Site")}</Label>
        <Input id="a-site" value={assetForm.site} onChange={(e) => setAssetForm({ ...assetForm, site: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="a-installed">{t("service.assets.installed", "Installed on")}</Label>
        <Input id="a-installed" type="date" value={assetForm.installed_on} onChange={(e) => setAssetForm({ ...assetForm, installed_on: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="a-warranty">{t("service.assets.warranty_expiry", "Warranty expires")}</Label>
        <Input id="a-warranty" type="date" value={assetForm.warranty_expires_on} onChange={(e) => setAssetForm({ ...assetForm, warranty_expires_on: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="a-value">{t("service.assets.value", "Purchase value")}</Label>
        <Input id="a-value" type="number" min={0} value={assetForm.purchase_value} onChange={(e) => setAssetForm({ ...assetForm, purchase_value: e.target.value })} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="a-notes">{t("service.common.notes", "Notes")}</Label>
        <Textarea id="a-notes" rows={3} value={assetForm.notes} onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })} />
      </div>
    </div>
  );

  const renderContractForm = () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="k-number">{t("service.contracts.number", "Contract number")}</Label>
        <Input
          id="k-number"
          value={contractForm.contract_number}
          onChange={(e) => setContractForm({ ...contractForm, contract_number: e.target.value })}
          disabled={Boolean(contractFormId)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="k-name">{t("service.common.name", "Name")}</Label>
        <Input id="k-name" value={contractForm.name} onChange={(e) => setContractForm({ ...contractForm, name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="k-customer">{t("service.assets.customer", "Customer")}</Label>
        <Input id="k-customer" value={contractForm.customer_name} onChange={(e) => setContractForm({ ...contractForm, customer_name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("service.contracts.tier", "Tier")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select value={contractForm.tier} onValueChange={(v) => setContractForm({ ...contractForm, tier: v as ContractTier })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIERS.map((tier) => (
                <SelectItem key={tier} value={tier} className="capitalize">{tier}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="k-response">{t("service.contracts.response", "Respond within (h)")}</Label>
        <Input id="k-response" type="number" min={0} value={contractForm.response_hours} onChange={(e) => setContractForm({ ...contractForm, response_hours: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="k-resolution">{t("service.contracts.resolution", "Resolve within (h)")}</Label>
        <Input id="k-resolution" type="number" min={0} value={contractForm.resolution_hours} onChange={(e) => setContractForm({ ...contractForm, resolution_hours: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("service.contracts.cover", "Cover")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select value={contractForm.is_24_7} onValueChange={(v) => setContractForm({ ...contractForm, is_24_7: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="no">{t("service.contracts.business_hours", "Business hours")}</SelectItem>
              <SelectItem value="yes">{t("service.contracts.always", "24/7")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{t("service.common.status", "Status")}</Label>
        <div onPointerDownCapture={(e: React.PointerEvent) => e.stopPropagation()}>
          <Select value={contractForm.status} onValueChange={(v) => setContractForm({ ...contractForm, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONTRACT_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="k-start">{t("service.contracts.day_from", "Day from")}</Label>
        <Input id="k-start" type="number" min={0} max={23} disabled={contractForm.is_24_7 === "yes"} value={contractForm.business_day_starts_at} onChange={(e) => setContractForm({ ...contractForm, business_day_starts_at: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="k-end">{t("service.contracts.day_to", "Day to")}</Label>
        <Input id="k-end" type="number" min={1} max={24} disabled={contractForm.is_24_7 === "yes"} value={contractForm.business_day_ends_at} onChange={(e) => setContractForm({ ...contractForm, business_day_ends_at: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="k-from">{t("service.contracts.starts", "Starts")}</Label>
        <Input id="k-from" type="date" value={contractForm.starts_on} onChange={(e) => setContractForm({ ...contractForm, starts_on: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="k-to">{t("service.contracts.ends", "Ends")}</Label>
        <Input id="k-to" type="date" min={contractForm.starts_on} value={contractForm.ends_on} onChange={(e) => setContractForm({ ...contractForm, ends_on: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="k-value">{t("service.contracts.value", "Value")}</Label>
        <Input id="k-value" type="number" min={0} value={contractForm.value} onChange={(e) => setContractForm({ ...contractForm, value: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="k-visits">{t("service.contracts.included_visits", "Included visits")}</Label>
        <Input id="k-visits" type="number" min={0} placeholder={t("service.contracts.unlimited", "Unlimited")} value={contractForm.included_visits} onChange={(e) => setContractForm({ ...contractForm, included_visits: e.target.value })} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="k-notes">{t("service.common.notes", "Notes")}</Label>
        <Textarea id="k-notes" rows={3} value={contractForm.notes} onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("service.assets.title", "Assets and Contracts")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "service.assets.subtitle",
              "The equipment you look after and the promises attached to it. An expired contract stays on record for history but stops lending its SLA to new faults.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageContracts ? (
            <Button variant="outline" className="rounded-full px-5" onClick={openContractCreate}>
              {t("service.contracts.add", "New Contract")}
            </Button>
          ) : null}
          {canManageAssets ? (
            <Button className="rounded-full px-5" onClick={openAssetCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t("service.assets.add", "Register Asset")}
            </Button>
          ) : null}
        </div>
      </div>

      {overviewQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/50" />
          ))}
        </div>
      ) : assetSummary && contractSummary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t("service.assets.total", "Assets")}
            value={n(assetSummary.total).toLocaleString()}
            meta={t("service.assets.faulty_meta", "{n} faulty").replace("{n}", String(n(assetSummary.faulty)))}
            alert={n(assetSummary.faulty) > 0}
          />
          <StatTile
            label={t("service.overview.warranty", "Warranty ending")}
            value={n(assetSummary.warranty_expiring).toLocaleString()}
            meta={t("service.overview.warranty_meta", "{n} still under warranty").replace("{n}", String(n(assetSummary.under_warranty)))}
            alert={n(assetSummary.warranty_expiring) > 0}
          />
          <StatTile
            label={t("service.overview.contracts_in_force", "Contracts in force")}
            value={n(contractSummary.in_force).toLocaleString()}
            meta={t("service.overview.contract_value_meta", "{v} on the books").replace("{v}", money(contractSummary.annual_value))}
          />
          <StatTile
            label={t("service.overview.renewals", "Renewals due")}
            value={n(contractSummary.expiring_soon).toLocaleString()}
            meta={t("service.overview.renewals_meta", "expiring within 60 days")}
            alert={n(contractSummary.expiring_soon) > 0}
          />
        </div>
      ) : overviewQuery.isError ? (
        <EmptyPanel label={t("service.assets.summary_failed", "Could not load summary metrics.")} />
      ) : null}

      {assetContractFilter !== "all" ? (
        <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
          <span>{t("service.assets.filtered_contract", "Filtered to contract")} #{assetContractFilter}</span>
          <Button variant="ghost" size="sm" className="h-7" onClick={() => setAssetContractFilter("all")}>
            {t("service.common.clear", "Clear")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">{t("service.common.status", "Status")}</Label>
          <Select value={assetStatusFilter} onValueChange={setAssetStatusFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("service.common.any", "Any")}</SelectItem>
              {ASSET_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("service.assets.contract", "Contract")}</Label>
          <Select value={assetContractFilter} onValueChange={setAssetContractFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("service.common.any", "Any")}</SelectItem>
              {contractOptions.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch id="warranty-exp" checked={warrantyExpiring} onCheckedChange={setWarrantyExpiring} />
          <Label htmlFor="warranty-exp" className="text-sm">
            {t("service.assets.warranty_expiring", "Warranty expiring (60d)")}
          </Label>
        </div>
      </div>

      {assetsQuery.isError ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">{t("service.assets.load_failed", "Could not load assets.")}</p>
          <Button variant="outline" size="sm" onClick={() => assetsQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("service.common.retry", "Retry")}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={assetColumns}
          data={assets}
          totalEntries={assetsQuery.data?.meta?.total ?? 0}
          loading={assetsQuery.isLoading}
          pageIndex={assetTableQuery.page}
          pageSize={assetTableQuery.pageSize}
          onQueryChange={(q: DataTableQuery) =>
            setAssetTableQuery({
              page: Number(q.page || 1),
              pageSize: Number(q.pageSize || 10),
              search: String(q.search ?? ""),
            })
          }
          searchPlaceholder={t("service.assets.search_hint", "Tag, name, serial or customer")}
          resourceName="service-assets"
        />
      )}

      <Panel title={t("service.contracts.title", "Support contracts")} description={t("service.contracts.desc", "The response and resolution hours here are what every deadline in the module is computed from.")}>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("service.contracts.tier", "Tier")}</Label>
            <Select value={contractTierFilter} onValueChange={setContractTierFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("service.common.any", "Any")}</SelectItem>
                {TIERS.map((tier) => (
                  <SelectItem key={tier} value={tier} className="capitalize">{tier}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-1">
            <Switch id="in-force" checked={inForceOnly} onCheckedChange={setInForceOnly} />
            <Label htmlFor="in-force" className="text-sm">{t("service.contracts.in_force", "In force only")}</Label>
          </div>
        </div>
        {contractsQuery.isError ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">{t("service.contracts.load_failed", "Could not load contracts.")}</p>
            <Button variant="outline" size="sm" onClick={() => contractsQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("service.common.retry", "Retry")}
            </Button>
          </div>
        ) : (
          <DataTable
            columns={contractColumns}
            data={contracts}
            totalEntries={contractsQuery.data?.meta?.total ?? 0}
            loading={contractsQuery.isLoading}
            pageIndex={contractTableQuery.page}
            pageSize={contractTableQuery.pageSize}
            onQueryChange={(q: DataTableQuery) =>
              setContractTableQuery({
                page: Number(q.page || 1),
                pageSize: Number(q.pageSize || 10),
                search: String(q.search ?? ""),
              })
            }
            searchPlaceholder={t("service.contracts.search_hint", "Number, name or customer")}
            resourceName="service-contracts"
          />
        )}
      </Panel>

      {/* Asset form */}
      <Dialog open={assetFormOpen} onOpenChange={setAssetFormOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {assetFormId ? t("service.assets.edit", "Edit Asset") : t("service.assets.add", "Register Asset")}
              </DialogTitle>
              <DialogDescription>
                {t("service.assets.add_desc", "Attaching a contract is what gives faults on this equipment a deadline. Warranty is checked first when deciding who pays.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">{renderAssetForm()}</div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setAssetFormOpen(false)}>{t("service.common.cancel", "Cancel")}</Button>
            <Button onClick={() => saveAsset.mutate()} disabled={saveAsset.isPending || !assetForm.asset_tag.trim() || !assetForm.name.trim()}>
              {saveAsset.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("service.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract form */}
      <Dialog open={contractFormOpen} onOpenChange={setContractFormOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {contractFormId ? t("service.contracts.edit", "Edit Contract") : t("service.contracts.add", "New Contract")}
              </DialogTitle>
              <DialogDescription>
                {t("service.contracts.add_desc", "Under anything but 24/7 cover the clock only runs during the business day, so four hours reported at 16:00 lands the next working morning rather than at 20:00.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">{renderContractForm()}</div>
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setContractFormOpen(false)}>{t("service.common.cancel", "Cancel")}</Button>
            <Button
              onClick={() => saveContract.mutate()}
              disabled={saveContract.isPending || !contractForm.contract_number.trim() || !contractForm.name.trim() || !contractForm.customer_name.trim()}
            >
              {saveContract.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("service.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Asset detail */}
      <Dialog open={assetDetailId !== null} onOpenChange={(open) => !open && setAssetDetailId(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">{assetDetail?.name ?? t("service.assets.asset", "Asset")}</DialogTitle>
              <DialogDescription className="font-mono">{assetDetail?.asset_tag}</DialogDescription>
            </DialogHeader>
          </div>
          {assetDetailQuery.isLoading ? (
            <div className="flex justify-center px-6 py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : assetDetail ? (
            <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-5 text-sm">
              <div className="flex flex-wrap gap-2">
                {canManageAssets ? (
                  <Button size="sm" variant="outline" onClick={() => openAssetEdit(assetDetail)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    {t("service.common.edit", "Edit")}
                  </Button>
                ) : null}
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/dashboard/service/requests?asset_id=${assetDetail.id}`}>
                    <Ticket className="mr-2 h-3.5 w-3.5" />
                    {t("service.assets.view_faults", "View faults")}
                  </Link>
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={`border-transparent text-[10px] font-black uppercase tracking-widest ${COVERAGE_TONE[assetDetail.coverage ?? "chargeable"]}`}>
                  {assetDetail.coverage ?? "chargeable"}
                </Badge>
                <Badge variant="secondary" className="text-[10px] capitalize">{assetDetail.status}</Badge>
                {assetDetail.under_warranty ? (
                  <Badge variant="outline" className="text-[10px]">{t("service.assets.under_warranty", "Under warranty")}</Badge>
                ) : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div><span className="text-muted-foreground">{t("service.assets.customer", "Customer")}: </span>{assetDetail.customer_name ?? "—"}</div>
                <div><span className="text-muted-foreground">{t("service.assets.site", "Site")}: </span>{assetDetail.site ?? "—"}</div>
                <div><span className="text-muted-foreground">{t("service.assets.manufacturer", "Manufacturer")}: </span>{assetDetail.manufacturer ?? "—"}</div>
                <div><span className="text-muted-foreground">{t("service.assets.model", "Model")}: </span>{assetDetail.model ?? "—"}</div>
                <div><span className="text-muted-foreground">{t("service.assets.serial", "Serial")}: </span>{assetDetail.serial_number ?? "—"}</div>
                <div><span className="text-muted-foreground">{t("service.assets.value", "Purchase value")}: </span>{money(assetDetail.purchase_value)}</div>
                {assetDetail.contract ? (
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">{t("service.assets.contract", "Contract")}: </span>
                    <button type="button" className="font-medium hover:underline" onClick={() => setContractDetailId(assetDetail.contract!.id)}>
                      {assetDetail.contract.name}
                    </button>
                  </div>
                ) : null}
              </div>
              {assetDetail.notes ? <p className="text-muted-foreground">{assetDetail.notes}</p> : null}
              {(assetDetail.requests ?? []).length > 0 ? (
                <Panel title={t("service.assets.recent_faults", "Recent faults")}>
                  <ul className="space-y-1.5">
                    {(assetDetail.requests as ServiceRequest[]).map((req) => (
                      <li key={req.id}>
                        <Link href={`/dashboard/service/requests?id=${req.id}`} className="text-xs hover:underline">
                          {req.request_number} — {req.subject}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}
              {(assetDetail.plans ?? []).length > 0 ? (
                <Panel title={t("service.plans.title", "Preventive plans")}>
                  <ul className="space-y-1.5">
                    {(assetDetail.plans as ServiceMaintenancePlan[]).map((plan) => (
                      <li key={plan.id} className="text-xs">
                        <Link href={`/dashboard/service/plans?asset_id=${assetDetail.id}`} className="hover:underline">{plan.name}</Link>
                        {plan.next_due_on ? (
                          <span className="text-muted-foreground"> · {String(plan.next_due_on).slice(0, 10)}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}
            </div>
          ) : assetDetailQuery.isError ? (
            <div className="space-y-3 px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">{t("service.assets.detail_failed", "Could not load this asset.")}</p>
              <Button variant="outline" size="sm" onClick={() => assetDetailQuery.refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("service.common.retry", "Retry")}
              </Button>
            </div>
          ) : null}
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setAssetDetailId(null)}>{t("service.common.close", "Close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract detail */}
      <Dialog open={contractDetailId !== null} onOpenChange={(open) => !open && setContractDetailId(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">{contractDetail?.name ?? t("service.contracts.contract", "Contract")}</DialogTitle>
              <DialogDescription className="font-mono">{contractDetail?.contract_number}</DialogDescription>
            </DialogHeader>
          </div>
          {contractDetailQuery.isLoading ? (
            <div className="flex justify-center px-6 py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : contractDetail ? (
            <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-5 text-sm">
              <div className="flex flex-wrap gap-2">
                {canManageContracts ? (
                  <Button size="sm" variant="outline" onClick={() => openContractEdit(contractDetail)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    {t("service.common.edit", "Edit")}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAssetContractFilter(String(contractDetail.id));
                    setContractDetailId(null);
                  }}
                >
                  {t("service.contracts.view_assets", "View assets")}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-[10px] capitalize">{contractDetail.tier}</Badge>
                <Badge variant={contractDetail.is_in_force ? "secondary" : "destructive"} className="text-[10px] capitalize">
                  {contractDetail.is_in_force ? t("service.contracts.in_force", "In force") : t("service.contracts.lapsed", "Lapsed")}
                </Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div><span className="text-muted-foreground">{t("service.assets.customer", "Customer")}: </span>{contractDetail.customer_name}</div>
                <div><span className="text-muted-foreground">{t("service.contracts.value", "Value")}: </span>{money(contractDetail.value)}</div>
                <div>
                  <span className="text-muted-foreground">{t("service.contracts.cover", "Cover")}: </span>
                  {contractDetail.is_24_7 ? t("service.contracts.always", "24/7") : t("service.contracts.business_hours", "Business hours")}
                </div>
                <div>
                  <span className="text-muted-foreground">{t("service.contracts.promise_long", "{r}h respond · {f}h resolve")
                    .replace("{r}", String(contractDetail.response_hours))
                    .replace("{f}", String(contractDetail.resolution_hours))}</span>
                </div>
                <div><span className="text-muted-foreground">{t("service.contracts.starts", "Starts")}: </span>{String(contractDetail.starts_on).slice(0, 10)}</div>
                <div><span className="text-muted-foreground">{t("service.contracts.ends", "Ends")}: </span>{contractDetail.ends_on ? String(contractDetail.ends_on).slice(0, 10) : t("service.contracts.open_ended", "Open ended")}</div>
                {contractDetail.included_visits != null ? (
                  <div><span className="text-muted-foreground">{t("service.contracts.included_visits", "Included visits")}: </span>{contractDetail.included_visits}</div>
                ) : null}
              </div>
              {contractDetail.notes ? <p className="text-muted-foreground">{contractDetail.notes}</p> : null}
              {(contractDetail.assets ?? []).length > 0 ? (
                <Panel title={t("service.contracts.linked_assets", "Linked assets")}>
                  <ul className="space-y-1.5">
                    {contractDetail.assets!.map((asset) => (
                      <li key={asset.id}>
                        <button type="button" className="text-xs hover:underline" onClick={() => { setAssetDetailId(asset.id); setContractDetailId(null); }}>
                          {asset.name} ({asset.asset_tag})
                        </button>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}
            </div>
          ) : contractDetailQuery.isError ? (
            <div className="space-y-3 px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">{t("service.contracts.detail_failed", "Could not load this contract.")}</p>
              <Button variant="outline" size="sm" onClick={() => contractDetailQuery.refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("service.common.retry", "Retry")}
              </Button>
            </div>
          ) : null}
          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setContractDetailId(null)}>{t("service.common.close", "Close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
