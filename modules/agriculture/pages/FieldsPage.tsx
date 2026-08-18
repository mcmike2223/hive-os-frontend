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
import { agricultureApi } from "@/modules/agriculture/api";
import type {
  AgricultureCrop,
  AgricultureField,
  AgricultureSeason,
} from "@/modules/agriculture/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function FieldsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [fieldOpen, setFieldOpen] = React.useState(false);
  const [cropOpen, setCropOpen] = React.useState(false);
  const [seasonOpen, setSeasonOpen] = React.useState(false);

  const [fieldForm, setFieldForm] = React.useState({
    code: "",
    name: "",
    area_hectares: "",
    soil_type: "",
    irrigation: "rainfed",
    location: "",
  });

  const [cropForm, setCropForm] = React.useState({
    code: "",
    name: "",
    variety: "",
    category: "",
    growth_days: "120",
    expected_yield_per_hectare: "",
    unit: "kg",
  });

  const [seasonForm, setSeasonForm] = React.useState({
    code: "",
    name: "",
    starts_on: today(),
    ends_on: "",
    status: "planned",
  });

  const fieldsQuery = useQuery({
    queryKey: ["agriculture", "fields"],
    queryFn: () => agricultureApi.listFields({ limit: 50 }).then((res) => res.data),
  });

  const cropsQuery = useQuery({
    queryKey: ["agriculture", "crops"],
    queryFn: () => agricultureApi.listCrops({ limit: 50 }).then((res) => res.data),
  });

  const seasonsQuery = useQuery({
    queryKey: ["agriculture", "seasons"],
    queryFn: () => agricultureApi.listSeasons({ limit: 25 }).then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["agriculture", "overview-fields"],
    queryFn: () => agricultureApi.overview().then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["agriculture"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const createField = useMutation({
    mutationFn: () =>
      agricultureApi.createField({
        code: fieldForm.code,
        name: fieldForm.name,
        area_hectares: Number(fieldForm.area_hectares),
        soil_type: fieldForm.soil_type || null,
        irrigation: fieldForm.irrigation || null,
        location: fieldForm.location || null,
        is_active: true,
      }),
    onSuccess: () => {
      toast.success(t("agriculture.fields.saved", "Field added."));
      invalidate();
      setFieldOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("agriculture.fields.save_failed", "Could not add it."))),
  });

  const createCrop = useMutation({
    mutationFn: () =>
      agricultureApi.createCrop({
        code: cropForm.code,
        name: cropForm.name,
        variety: cropForm.variety || null,
        category: cropForm.category || null,
        growth_days: Number(cropForm.growth_days || 120),
        expected_yield_per_hectare: Number(cropForm.expected_yield_per_hectare || 0),
        unit: cropForm.unit,
        is_active: true,
      }),
    onSuccess: () => {
      toast.success(t("agriculture.crops.saved", "Crop added."));
      invalidate();
      setCropOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("agriculture.crops.save_failed", "Could not add it."))),
  });

  const createSeason = useMutation({
    mutationFn: () =>
      agricultureApi.createSeason({
        code: seasonForm.code,
        name: seasonForm.name,
        starts_on: seasonForm.starts_on,
        ends_on: seasonForm.ends_on,
        status: seasonForm.status,
      }),
    onSuccess: () => {
      toast.success(t("agriculture.seasons.saved", "Season added."));
      invalidate();
      setSeasonOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("agriculture.seasons.save_failed", "Could not add it."))),
  });

  const fields = (fieldsQuery.data?.data ?? []) as AgricultureField[];
  const crops = (cropsQuery.data?.data ?? []) as AgricultureCrop[];
  const seasons = (seasonsQuery.data?.data ?? []) as AgricultureSeason[];
  const land = overviewQuery.data?.data?.land;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("agriculture.fields.title", "Fields and Crops")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "agriculture.fields.subtitle",
              "The land and what you grow on it. A field area is the denominator for every yield figure it ever produces, and a crop expectation is what those yields are judged against.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full px-5" onClick={() => setSeasonOpen(true)}>
            {t("agriculture.seasons.add", "New Season")}
          </Button>
          <Button variant="outline" className="rounded-full px-5" onClick={() => setCropOpen(true)}>
            {t("agriculture.crops.add", "New Crop")}
          </Button>
          <Button className="rounded-full px-5" onClick={() => setFieldOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("agriculture.fields.add", "New Field")}
          </Button>
        </div>
      </div>

      {land ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t("agriculture.fields.total", "Total land")}
            value={`${n(land.total_hectares).toLocaleString()} ha`}
            meta={t("agriculture.fields.count_meta", "across {n} fields").replace(
              "{n}",
              String(n(land.fields)),
            )}
          />
          <StatTile
            label={t("agriculture.fields.planted", "Under crop")}
            value={`${n(land.planted_hectares).toLocaleString()} ha`}
          />
          <StatTile
            label={t("agriculture.fields.idle", "Idle")}
            value={`${n(land.idle_hectares).toLocaleString()} ha`}
            meta={`${n(land.utilisation_percent).toFixed(0)}% ${t("agriculture.fields.in_use", "in use")}`}
          />
          <StatTile
            label={t("agriculture.fields.over_planted", "Over-planted")}
            value={n(land.over_planted).toLocaleString()}
            meta={t("agriculture.fields.over_meta", "areas to check")}
            alert={n(land.over_planted) > 0}
          />
        </div>
      ) : null}

      <Panel
        title={t("agriculture.fields.register", "Fields")}
        description={t(
          "agriculture.fields.register_desc",
          "Utilisation counts land under a live crop only — harvested ground is free again.",
        )}
      >
        {fieldsQuery.isLoading ? (
          <LoadingPanel label={t("agriculture.common.loading", "Loading fields...")} />
        ) : fields.length === 0 ? (
          <EmptyPanel label={t("agriculture.fields.none", "No fields registered.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.plantings.field", "Field")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.fields.area", "Area")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.fields.under_crop", "Under crop")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.fields.soil", "Soil")}</th>
                  <th className="pb-2 pr-6 font-semibold">{t("agriculture.fields.irrigation", "Irrigation")}</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="block font-medium">{field.name}</span>
                      <span className="block text-[11px] text-muted-foreground">{field.code}</span>
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {n(field.area_hectares).toLocaleString()} ha
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {n(field.planted_hectares).toLocaleString()} ha
                      <span
                        className={`block text-[11px] ${
                          field.is_over_planted
                            ? "font-semibold text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {field.is_over_planted
                          ? t("agriculture.fields.over_word", "more than the field has")
                          : `${n(field.utilisation_percent).toFixed(0)}%`}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs">{field.soil_type ?? "—"}</td>
                    <td className="py-2 pr-6">
                      <Badge variant="outline" className="text-[11px] capitalize">
                        {field.irrigation ?? "—"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title={t("agriculture.crops.register", "Crops")}
        description={t(
          "agriculture.crops.register_desc",
          "Growth days set when a planting becomes due; the expected yield is what its actual yield is scored against.",
        )}
      >
        {cropsQuery.isLoading ? (
          <LoadingPanel label={t("agriculture.common.loading", "Loading crops...")} />
        ) : crops.length === 0 ? (
          <EmptyPanel label={t("agriculture.crops.none", "No crops registered.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.plantings.crop", "Crop")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.crops.category", "Category")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.crops.growth", "Growth")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.crops.expected", "Expected yield")}</th>
                  <th className="pb-2 pr-6 text-right font-semibold">
                    {t("agriculture.crops.plantings", "Plantings")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {crops.map((crop) => (
                  <tr key={crop.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="block font-medium">{crop.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {crop.variety ?? crop.code}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs">{crop.category ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {t("agriculture.crops.days", "{n} days").replace("{n}", String(crop.growth_days))}
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {n(crop.expected_yield_per_hectare).toLocaleString()} {crop.unit}/ha
                    </td>
                    <td className="py-2 pr-6 text-right text-xs tabular-nums">
                      {n(crop.plantings_count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {seasons.length > 0 ? (
        <Panel title={t("agriculture.seasons.title", "Seasons")}>
          <div className="space-y-1.5">
            {seasons.map((season) => (
              <div
                key={season.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{season.name}</span>
                  <span className="block text-[11px] tabular-nums text-muted-foreground">
                    {String(season.starts_on).slice(0, 10)} → {String(season.ends_on).slice(0, 10)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <Badge variant="outline" className="text-[11px] capitalize">
                    {season.status}
                  </Badge>
                  <span className="block text-[11px] tabular-nums text-muted-foreground">
                    {t("agriculture.crops.plantings", "Plantings")}: {n(season.plantings_count)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {/* New field */}
      <Dialog open={fieldOpen} onOpenChange={setFieldOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("agriculture.fields.add", "New Field")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "agriculture.fields.add_desc",
                  "Get the area right: it is the denominator for every yield figure this land will ever produce.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nf-code">{t("agriculture.common.code", "Code")}</Label>
              <Input
                id="nf-code"
                value={fieldForm.code}
                onChange={(event) => setFieldForm({ ...fieldForm, code: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nf-name">{t("agriculture.common.name", "Name")}</Label>
              <Input
                id="nf-name"
                value={fieldForm.name}
                onChange={(event) => setFieldForm({ ...fieldForm, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nf-area">{t("agriculture.plantings.area_ha", "Area (hectares)")}</Label>
              <Input
                id="nf-area"
                type="number"
                min={0}
                step="0.01"
                value={fieldForm.area_hectares}
                onChange={(event) =>
                  setFieldForm({ ...fieldForm, area_hectares: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nf-irrigation">{t("agriculture.fields.irrigation", "Irrigation")}</Label>
              <select
                id="nf-irrigation"
                value={fieldForm.irrigation}
                onChange={(event) => setFieldForm({ ...fieldForm, irrigation: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {["rainfed", "drip", "furrow", "sprinkler", "pivot"].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nf-soil">{t("agriculture.fields.soil", "Soil")}</Label>
              <Input
                id="nf-soil"
                value={fieldForm.soil_type}
                onChange={(event) => setFieldForm({ ...fieldForm, soil_type: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nf-location">{t("agriculture.fields.location", "Location")}</Label>
              <Input
                id="nf-location"
                value={fieldForm.location}
                onChange={(event) => setFieldForm({ ...fieldForm, location: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setFieldOpen(false)}>
              {t("agriculture.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => createField.mutate()}
              disabled={
                createField.isPending ||
                !fieldForm.code.trim() ||
                !fieldForm.name.trim() ||
                !fieldForm.area_hectares
              }
            >
              {t("agriculture.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New crop */}
      <Dialog open={cropOpen} onOpenChange={setCropOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("agriculture.crops.add", "New Crop")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "agriculture.crops.add_desc",
                  "Growth days decide when a planting falls due. The expected yield is copied nowhere — it is read live, so revising it changes how future crops are judged but never rewrites a planting already in the ground.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nc-code">{t("agriculture.common.code", "Code")}</Label>
              <Input
                id="nc-code"
                value={cropForm.code}
                onChange={(event) => setCropForm({ ...cropForm, code: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-name">{t("agriculture.common.name", "Name")}</Label>
              <Input
                id="nc-name"
                value={cropForm.name}
                onChange={(event) => setCropForm({ ...cropForm, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-variety">{t("agriculture.crops.variety", "Variety")}</Label>
              <Input
                id="nc-variety"
                value={cropForm.variety}
                onChange={(event) => setCropForm({ ...cropForm, variety: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-category">{t("agriculture.crops.category", "Category")}</Label>
              <Input
                id="nc-category"
                value={cropForm.category}
                onChange={(event) => setCropForm({ ...cropForm, category: event.target.value })}
                placeholder={t("agriculture.crops.category_hint", "Cereal, vegetable, pulse")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-days">{t("agriculture.crops.growth_days", "Growth days")}</Label>
              <Input
                id="nc-days"
                type="number"
                min={1}
                value={cropForm.growth_days}
                onChange={(event) => setCropForm({ ...cropForm, growth_days: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-expected">
                {t("agriculture.crops.expected_ha", "Expected yield per hectare")}
              </Label>
              <Input
                id="nc-expected"
                type="number"
                min={0}
                value={cropForm.expected_yield_per_hectare}
                onChange={(event) =>
                  setCropForm({ ...cropForm, expected_yield_per_hectare: event.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setCropOpen(false)}>
              {t("agriculture.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => createCrop.mutate()}
              disabled={createCrop.isPending || !cropForm.code.trim() || !cropForm.name.trim()}
            >
              {t("agriculture.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New season */}
      <Dialog open={seasonOpen} onOpenChange={setSeasonOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("agriculture.seasons.add", "New Season")}
              </DialogTitle>
              <DialogDescription>
                {t("agriculture.seasons.add_desc", "Groups plantings so a year can be compared to the last.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ns-code">{t("agriculture.common.code", "Code")}</Label>
              <Input
                id="ns-code"
                value={seasonForm.code}
                onChange={(event) => setSeasonForm({ ...seasonForm, code: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-name">{t("agriculture.common.name", "Name")}</Label>
              <Input
                id="ns-name"
                value={seasonForm.name}
                onChange={(event) => setSeasonForm({ ...seasonForm, name: event.target.value })}
                placeholder="Meher 2026"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-start">{t("agriculture.seasons.starts", "Starts")}</Label>
              <Input
                id="ns-start"
                type="date"
                value={seasonForm.starts_on}
                onChange={(event) => setSeasonForm({ ...seasonForm, starts_on: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-end">{t("agriculture.seasons.ends", "Ends")}</Label>
              <Input
                id="ns-end"
                type="date"
                min={seasonForm.starts_on}
                value={seasonForm.ends_on}
                onChange={(event) => setSeasonForm({ ...seasonForm, ends_on: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setSeasonOpen(false)}>
              {t("agriculture.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => createSeason.mutate()}
              disabled={
                createSeason.isPending ||
                !seasonForm.code.trim() ||
                !seasonForm.name.trim() ||
                !seasonForm.ends_on
              }
            >
              {t("agriculture.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
