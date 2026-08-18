"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

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
import { serviceApi } from "@/modules/service/api";
import type { ContractTier, ServiceAsset, ServiceContract } from "@/modules/service/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const TIERS: ContractTier[] = ["bronze", "standard", "gold", "platinum"];

const COVERAGE_TONE: Record<string, string> = {
  warranty: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  contract: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  chargeable: "bg-muted text-muted-foreground",
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const today = () => new Date().toISOString().slice(0, 10);

export default function ServiceAssetsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [assetOpen, setAssetOpen] = React.useState(false);
  const [contractOpen, setContractOpen] = React.useState(false);

  const [assetForm, setAssetForm] = React.useState({
    asset_tag: "",
    name: "",
    category: "",
    manufacturer: "",
    serial_number: "",
    contract_id: "",
    customer_name: "",
    site: "",
    warranty_expires_on: "",
    purchase_value: "0",
  });

  const [contractForm, setContractForm] = React.useState({
    contract_number: "",
    name: "",
    customer_name: "",
    tier: "standard",
    response_hours: "4",
    resolution_hours: "24",
    is_24_7: "no",
    business_day_starts_at: "8",
    business_day_ends_at: "17",
    starts_on: today(),
    ends_on: "",
    value: "0",
  });

  const assetsQuery = useQuery({
    queryKey: ["service", "assets", search],
    queryFn: () =>
      serviceApi.listAssets({ limit: 25, ...(search ? { search } : {}) }).then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const contractsQuery = useQuery({
    queryKey: ["service", "contracts"],
    queryFn: () => serviceApi.listContracts({ limit: 50 }).then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["service", "overview-assets"],
    queryFn: () => serviceApi.overview().then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["service"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const saveAsset = useMutation({
    mutationFn: () =>
      serviceApi.createAsset({
        asset_tag: assetForm.asset_tag,
        name: assetForm.name,
        category: assetForm.category || null,
        manufacturer: assetForm.manufacturer || null,
        serial_number: assetForm.serial_number || null,
        ...(assetForm.contract_id ? { contract_id: Number(assetForm.contract_id) } : {}),
        customer_name: assetForm.customer_name || null,
        site: assetForm.site || null,
        ...(assetForm.warranty_expires_on
          ? { warranty_expires_on: assetForm.warranty_expires_on }
          : {}),
        purchase_value: Number(assetForm.purchase_value || 0),
      }),
    onSuccess: () => {
      toast.success(t("service.assets.saved", "Asset registered."));
      invalidate();
      setAssetOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.assets.save_failed", "Could not save it."))),
  });

  const saveContract = useMutation({
    mutationFn: () =>
      serviceApi.createContract({
        contract_number: contractForm.contract_number,
        name: contractForm.name,
        customer_name: contractForm.customer_name,
        tier: contractForm.tier,
        response_hours: Number(contractForm.response_hours || 0),
        resolution_hours: Number(contractForm.resolution_hours || 0),
        is_24_7: contractForm.is_24_7 === "yes",
        business_day_starts_at: Number(contractForm.business_day_starts_at || 8),
        business_day_ends_at: Number(contractForm.business_day_ends_at || 17),
        starts_on: contractForm.starts_on,
        ...(contractForm.ends_on ? { ends_on: contractForm.ends_on } : {}),
        value: Number(contractForm.value || 0),
      }),
    onSuccess: () => {
      toast.success(t("service.contracts.saved", "Contract created."));
      invalidate();
      setContractOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("service.contracts.save_failed", "Could not save it."))),
  });

  const assets = (assetsQuery.data?.data ?? []) as ServiceAsset[];
  const contracts = (contractsQuery.data?.data ?? []) as ServiceContract[];
  const assetSummary = overviewQuery.data?.data?.assets;
  const contractSummary = overviewQuery.data?.data?.contracts;

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
          <Button
            variant="outline"
            className="rounded-full px-5"
            onClick={() => setContractOpen(true)}
          >
            {t("service.contracts.add", "New Contract")}
          </Button>
          <Button className="rounded-full px-5" onClick={() => setAssetOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("service.assets.add", "Register Asset")}
          </Button>
        </div>
      </div>

      {assetSummary && contractSummary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t("service.assets.total", "Assets")}
            value={n(assetSummary.total).toLocaleString()}
            meta={t("service.assets.faulty_meta", "{n} faulty").replace(
              "{n}",
              String(n(assetSummary.faulty)),
            )}
            alert={n(assetSummary.faulty) > 0}
          />
          <StatTile
            label={t("service.overview.warranty", "Warranty ending")}
            value={n(assetSummary.warranty_expiring).toLocaleString()}
            meta={t("service.overview.warranty_meta", "{n} still under warranty").replace(
              "{n}",
              String(n(assetSummary.under_warranty)),
            )}
            alert={n(assetSummary.warranty_expiring) > 0}
          />
          <StatTile
            label={t("service.overview.contracts_in_force", "Contracts in force")}
            value={n(contractSummary.in_force).toLocaleString()}
            meta={t("service.overview.contract_value_meta", "{v} on the books").replace(
              "{v}",
              money(contractSummary.annual_value),
            )}
          />
          <StatTile
            label={t("service.overview.renewals", "Renewals due")}
            value={n(contractSummary.expiring_soon).toLocaleString()}
            meta={t("service.overview.renewals_meta", "expiring within 60 days")}
            alert={n(contractSummary.expiring_soon) > 0}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label htmlFor="as-search" className="text-xs">
            {t("service.common.search", "Search")}
          </Label>
          <Input
            id="as-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("service.assets.search_hint", "Tag, name, serial or customer")}
            className="h-9 w-64"
          />
        </div>
      </div>

      <Panel
        title={t("service.assets.register", "Equipment register")}
        description={t(
          "service.assets.register_desc",
          "Coverage is worked out per asset: warranty first, then contract, then chargeable.",
        )}
      >
        {assetsQuery.isLoading ? (
          <LoadingPanel label={t("service.common.loading", "Loading assets...")} />
        ) : assets.length === 0 ? (
          <EmptyPanel label={t("service.assets.none", "No assets on the register.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("service.assets.asset", "Asset")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.assets.customer", "Customer")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.assets.contract", "Contract")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.work.coverage", "Coverage")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.common.status", "Status")}</th>
                  <th className="pb-2 pr-6 text-right font-semibold">
                    {t("service.assets.faults", "Faults")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="block font-medium">{asset.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {asset.asset_tag}
                        {asset.site ? ` · ${asset.site}` : ""}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs">{asset.customer_name ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs">
                      {asset.contract ? (
                        <>
                          <span className="block capitalize">{asset.contract.tier}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {asset.contract.is_24_7
                              ? t("service.contracts.always", "24/7")
                              : t("service.contracts.hours", "{a}:00–{b}:00")
                                  .replace("{a}", String(asset.contract.business_day_starts_at))
                                  .replace("{b}", String(asset.contract.business_day_ends_at))}
                            {" · "}
                            {t("service.contracts.promise", "{r}h / {f}h")
                              .replace("{r}", String(asset.contract.response_hours))
                              .replace("{f}", String(asset.contract.resolution_hours))}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          {t("service.assets.no_contract", "None")}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant="outline"
                        className={`border-transparent text-[10px] font-black uppercase tracking-widest ${
                          COVERAGE_TONE[asset.coverage ?? "chargeable"]
                        }`}
                      >
                        {asset.coverage ?? "chargeable"}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`text-xs font-semibold capitalize ${
                          asset.status === "faulty" ? "text-destructive" : "text-muted-foreground"
                        }`}
                      >
                        {asset.status}
                      </span>
                    </td>
                    <td className="py-2 pr-6 text-right tabular-nums">{asset.requests_count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title={t("service.contracts.title", "Support contracts")}
        description={t(
          "service.contracts.desc",
          "The response and resolution hours here are what every deadline in the module is computed from.",
        )}
      >
        {contractsQuery.isLoading ? (
          <LoadingPanel label={t("service.common.loading", "Loading contracts...")} />
        ) : contracts.length === 0 ? (
          <EmptyPanel label={t("service.contracts.none", "No contracts on file.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("service.contracts.contract", "Contract")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.assets.customer", "Customer")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.contracts.tier", "Tier")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.contracts.cover", "Cover")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("service.contracts.expiry", "Expiry")}</th>
                  <th className="pb-2 pr-6 text-right font-semibold">{t("service.contracts.value", "Value")}</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <tr key={contract.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="block font-medium">{contract.name}</span>
                      <span className="block text-[11px] tabular-nums text-muted-foreground">
                        {contract.contract_number} ·{" "}
                        {t("service.contracts.assets_count", "{n} assets").replace(
                          "{n}",
                          String(contract.assets_count ?? 0),
                        )}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs">{contract.customer_name}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className="text-[11px] capitalize">
                        {contract.tier}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {contract.is_24_7
                        ? t("service.contracts.always", "24/7")
                        : t("service.contracts.hours", "{a}:00–{b}:00")
                            .replace("{a}", String(contract.business_day_starts_at))
                            .replace("{b}", String(contract.business_day_ends_at))}
                      <span className="block text-[11px] text-muted-foreground">
                        {t("service.contracts.promise_long", "{r}h respond · {f}h resolve")
                          .replace("{r}", String(contract.response_hours))
                          .replace("{f}", String(contract.resolution_hours))}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {contract.ends_on ? (
                        <>
                          {contract.ends_on}
                          <span
                            className={`block text-[11px] font-semibold ${
                              contract.is_in_force === false
                                ? "text-destructive"
                                : "text-muted-foreground"
                            }`}
                          >
                            {contract.is_in_force === false
                              ? t("service.contracts.lapsed", "Lapsed")
                              : t("service.contracts.days_left", "{n} days left").replace(
                                  "{n}",
                                  String(contract.days_to_expiry ?? 0),
                                )}
                          </span>
                        </>
                      ) : (
                        t("service.contracts.open_ended", "Open ended")
                      )}
                    </td>
                    <td className="py-2 pr-6 text-right tabular-nums">{money(contract.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Asset */}
      <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("service.assets.add", "Register Asset")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "service.assets.add_desc",
                  "Attaching a contract is what gives faults on this equipment a deadline. Warranty is checked first when deciding who pays.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="a-tag">{t("service.assets.tag", "Asset tag")}</Label>
              <Input
                id="a-tag"
                value={assetForm.asset_tag}
                onChange={(event) => setAssetForm({ ...assetForm, asset_tag: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-name">{t("service.common.name", "Name")}</Label>
              <Input
                id="a-name"
                value={assetForm.name}
                onChange={(event) => setAssetForm({ ...assetForm, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-category">{t("service.assets.category", "Category")}</Label>
              <Input
                id="a-category"
                value={assetForm.category}
                onChange={(event) => setAssetForm({ ...assetForm, category: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-maker">{t("service.assets.manufacturer", "Manufacturer")}</Label>
              <Input
                id="a-maker"
                value={assetForm.manufacturer}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, manufacturer: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-serial">{t("service.assets.serial", "Serial number")}</Label>
              <Input
                id="a-serial"
                value={assetForm.serial_number}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, serial_number: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-contract">{t("service.assets.contract", "Contract")}</Label>
              <select
                id="a-contract"
                value={assetForm.contract_id}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, contract_id: event.target.value })
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("service.assets.no_contract", "None")}</option>
                {contracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {contract.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-customer">{t("service.assets.customer", "Customer")}</Label>
              <Input
                id="a-customer"
                value={assetForm.customer_name}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, customer_name: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-site">{t("service.assets.site", "Site")}</Label>
              <Input
                id="a-site"
                value={assetForm.site}
                onChange={(event) => setAssetForm({ ...assetForm, site: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-warranty">
                {t("service.assets.warranty_expiry", "Warranty expires")}
              </Label>
              <Input
                id="a-warranty"
                type="date"
                value={assetForm.warranty_expires_on}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, warranty_expires_on: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-value">{t("service.assets.value", "Purchase value")}</Label>
              <Input
                id="a-value"
                type="number"
                min={0}
                value={assetForm.purchase_value}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, purchase_value: event.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setAssetOpen(false)}>
              {t("service.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveAsset.mutate()}
              disabled={saveAsset.isPending || !assetForm.asset_tag.trim() || !assetForm.name.trim()}
            >
              {t("service.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract */}
      <Dialog open={contractOpen} onOpenChange={setContractOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("service.contracts.add", "New Contract")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "service.contracts.add_desc",
                  "Under anything but 24/7 cover the clock only runs during the business day, so four hours reported at 16:00 lands the next working morning rather than at 20:00.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="k-number">{t("service.contracts.number", "Contract number")}</Label>
              <Input
                id="k-number"
                value={contractForm.contract_number}
                onChange={(event) =>
                  setContractForm({ ...contractForm, contract_number: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-name">{t("service.common.name", "Name")}</Label>
              <Input
                id="k-name"
                value={contractForm.name}
                onChange={(event) => setContractForm({ ...contractForm, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-customer">{t("service.assets.customer", "Customer")}</Label>
              <Input
                id="k-customer"
                value={contractForm.customer_name}
                onChange={(event) =>
                  setContractForm({ ...contractForm, customer_name: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-tier">{t("service.contracts.tier", "Tier")}</Label>
              <select
                id="k-tier"
                value={contractForm.tier}
                onChange={(event) => setContractForm({ ...contractForm, tier: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {TIERS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-response">{t("service.contracts.response", "Respond within (h)")}</Label>
              <Input
                id="k-response"
                type="number"
                min={0}
                value={contractForm.response_hours}
                onChange={(event) =>
                  setContractForm({ ...contractForm, response_hours: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-resolution">
                {t("service.contracts.resolution", "Resolve within (h)")}
              </Label>
              <Input
                id="k-resolution"
                type="number"
                min={0}
                value={contractForm.resolution_hours}
                onChange={(event) =>
                  setContractForm({ ...contractForm, resolution_hours: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-247">{t("service.contracts.cover", "Cover")}</Label>
              <select
                id="k-247"
                value={contractForm.is_24_7}
                onChange={(event) =>
                  setContractForm({ ...contractForm, is_24_7: event.target.value })
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="no">{t("service.contracts.business_hours", "Business hours")}</option>
                <option value="yes">{t("service.contracts.always", "24/7")}</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="k-start">{t("service.contracts.day_from", "Day from")}</Label>
                <Input
                  id="k-start"
                  type="number"
                  min={0}
                  max={23}
                  value={contractForm.business_day_starts_at}
                  disabled={contractForm.is_24_7 === "yes"}
                  onChange={(event) =>
                    setContractForm({ ...contractForm, business_day_starts_at: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="k-end">{t("service.contracts.day_to", "Day to")}</Label>
                <Input
                  id="k-end"
                  type="number"
                  min={1}
                  max={24}
                  value={contractForm.business_day_ends_at}
                  disabled={contractForm.is_24_7 === "yes"}
                  onChange={(event) =>
                    setContractForm({ ...contractForm, business_day_ends_at: event.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-from">{t("service.contracts.starts", "Starts")}</Label>
              <Input
                id="k-from"
                type="date"
                value={contractForm.starts_on}
                onChange={(event) =>
                  setContractForm({ ...contractForm, starts_on: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-to">{t("service.contracts.ends", "Ends")}</Label>
              <Input
                id="k-to"
                type="date"
                min={contractForm.starts_on}
                value={contractForm.ends_on}
                onChange={(event) =>
                  setContractForm({ ...contractForm, ends_on: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="k-value">{t("service.contracts.value", "Value")}</Label>
              <Input
                id="k-value"
                type="number"
                min={0}
                value={contractForm.value}
                onChange={(event) => setContractForm({ ...contractForm, value: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setContractOpen(false)}>
              {t("service.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveContract.mutate()}
              disabled={
                saveContract.isPending ||
                !contractForm.contract_number.trim() ||
                !contractForm.name.trim() ||
                !contractForm.customer_name.trim()
              }
            >
              {t("service.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
