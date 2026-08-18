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
  ActivityType,
  AgricultureCrop,
  AgricultureField,
  AgriculturePlanting,
  AgricultureSeason,
  PlantingStatus,
} from "@/modules/agriculture/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const ACTIVITY_TYPES: ActivityType[] = [
  "ploughing",
  "sowing",
  "irrigation",
  "fertilising",
  "spraying",
  "weeding",
  "scouting",
  "other",
];

/** Mirrors the server transitions so only workable moves are offered. */
const NEXT_STATUSES: Record<PlantingStatus, PlantingStatus[]> = {
  planned: ["planted", "failed"],
  planted: ["growing", "failed"],
  growing: ["harvesting", "failed"],
  harvesting: ["harvested", "failed"],
  harvested: [],
  failed: [],
};

const STATUS_TONE: Record<PlantingStatus, string> = {
  planned: "bg-muted text-muted-foreground",
  planted: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  growing: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  harvesting: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  harvested: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  failed: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function PlantingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [status, setStatus] = React.useState("");
  const [liveOnly, setLiveOnly] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [working, setWorking] = React.useState<AgriculturePlanting | null>(null);
  const [picking, setPicking] = React.useState<AgriculturePlanting | null>(null);

  const [form, setForm] = React.useState({
    field_id: "",
    crop_id: "",
    season_id: "",
    area_hectares: "",
    planted_on: new Date().toISOString().slice(0, 10),
    seed_quantity: "0",
  });

  const [activityForm, setActivityForm] = React.useState({
    type: "weeding",
    performed_on: new Date().toISOString().slice(0, 10),
    input_name: "",
    input_cost: "0",
    labour_cost: "0",
    machinery_cost: "0",
  });

  const [harvestForm, setHarvestForm] = React.useState({
    harvested_on: new Date().toISOString().slice(0, 10),
    quantity_kg: "",
    waste_kg: "0",
    quality_grade: "A",
  });

  const plantingsQuery = useQuery({
    queryKey: ["agriculture", "plantings", status, liveOnly],
    queryFn: () =>
      agricultureApi
        .listPlantings({
          limit: 25,
          ...(status ? { status } : {}),
          ...(liveOnly ? { live_only: 1 } : {}),
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
  });

  const fieldsQuery = useQuery({
    queryKey: ["agriculture", "field-options"],
    queryFn: () => agricultureApi.listFields({ limit: 100 }).then((res) => res.data),
  });

  const cropsQuery = useQuery({
    queryKey: ["agriculture", "crop-options"],
    queryFn: () => agricultureApi.listCrops({ limit: 100 }).then((res) => res.data),
  });

  const seasonsQuery = useQuery({
    queryKey: ["agriculture", "season-options"],
    queryFn: () => agricultureApi.listSeasons({ limit: 50 }).then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["agriculture", "overview-plantings"],
    queryFn: () => agricultureApi.overview().then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["agriculture"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const create = useMutation({
    mutationFn: () =>
      agricultureApi.createPlanting({
        field_id: Number(form.field_id),
        crop_id: Number(form.crop_id),
        ...(form.season_id ? { season_id: Number(form.season_id) } : {}),
        area_hectares: Number(form.area_hectares),
        ...(form.planted_on ? { planted_on: form.planted_on } : {}),
        seed_quantity: Number(form.seed_quantity || 0),
      }),
    onSuccess: (response: any) => {
      toast.success(response?.data?.message ?? t("agriculture.plantings.saved", "Planting recorded."));
      invalidate();
      setCreateOpen(false);
    },
    // The API refuses more land than the field has free, and says how much.
    onError: (error: any) =>
      toast.error(errorText(error, t("agriculture.plantings.save_failed", "Could not record it."))),
  });

  const transition = useMutation({
    mutationFn: ({ id, next }: { id: number; next: PlantingStatus }) =>
      agricultureApi.transitionPlanting(id, next),
    onSuccess: () => {
      toast.success(t("agriculture.plantings.moved", "Planting updated."));
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("agriculture.plantings.move_failed", "Could not move it."))),
  });

  const recordActivity = useMutation({
    mutationFn: () =>
      agricultureApi.recordActivity(working!.id, {
        type: activityForm.type,
        performed_on: activityForm.performed_on,
        input_name: activityForm.input_name || null,
        input_cost: Number(activityForm.input_cost || 0),
        labour_cost: Number(activityForm.labour_cost || 0),
        machinery_cost: Number(activityForm.machinery_cost || 0),
      }),
    onSuccess: () => {
      toast.success(t("agriculture.plantings.activity_saved", "Field work recorded."));
      invalidate();
      setWorking(null);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("agriculture.plantings.activity_failed", "Could not record it."))),
  });

  const recordHarvest = useMutation({
    mutationFn: () =>
      agricultureApi.recordHarvest(picking!.id, {
        harvested_on: harvestForm.harvested_on,
        quantity_kg: Number(harvestForm.quantity_kg),
        waste_kg: Number(harvestForm.waste_kg || 0),
        quality_grade: harvestForm.quality_grade,
      }),
    onSuccess: (response: any) => {
      const planting = response?.data?.data?.planting;
      toast.success(
        planting
          ? t("agriculture.plantings.harvest_saved_total", "Recorded — {kg} kg picked so far.").replace(
              "{kg}",
              Number(planting.harvested_kg).toLocaleString(),
            )
          : t("agriculture.plantings.harvest_saved", "Harvest recorded."),
      );
      invalidate();
      setPicking(null);
      setHarvestForm({
        harvested_on: new Date().toISOString().slice(0, 10),
        quantity_kg: "",
        waste_kg: "0",
        quality_grade: "A",
      });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("agriculture.plantings.harvest_failed", "Could not record it."))),
  });

  const plantings = (plantingsQuery.data?.data ?? []) as AgriculturePlanting[];
  const fields = (fieldsQuery.data?.data ?? []) as AgricultureField[];
  const crops = (cropsQuery.data?.data ?? []) as AgricultureCrop[];
  const seasons = (seasonsQuery.data?.data ?? []) as AgricultureSeason[];
  const summary = overviewQuery.data?.data?.plantings;

  const selectedField = fields.find((field) => String(field.id) === form.field_id);
  const freeHectares = selectedField
    ? Math.max(0, n(selectedField.area_hectares) - n(selectedField.planted_hectares))
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("agriculture.plantings.title", "Plantings")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "agriculture.plantings.subtitle",
              "One crop on one piece of land. Yield divides by the area actually planted, and sums every pick — most crops are harvested many times.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("agriculture.plantings.add", "New Planting")}
        </Button>
      </div>

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t("agriculture.plantings.live", "In the ground")}
            value={n(summary.live).toLocaleString()}
          />
          <StatTile
            label={t("agriculture.plantings.harvested", "Harvested")}
            value={n(summary.harvested).toLocaleString()}
          />
          <StatTile
            label={t("agriculture.overview.overdue", "Overdue")}
            value={n(summary.overdue).toLocaleString()}
            alert={n(summary.overdue) > 0}
          />
          <StatTile
            label={t("agriculture.plantings.failed", "Failed")}
            value={n(summary.failed).toLocaleString()}
            alert={n(summary.failed) > 0}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label htmlFor="pl-status" className="text-xs">
            {t("agriculture.common.status", "Status")}
          </Label>
          <select
            id="pl-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm capitalize"
          >
            <option value="">{t("agriculture.common.any", "Any")}</option>
            {(Object.keys(NEXT_STATUSES) as PlantingStatus[]).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            checked={liveOnly}
            onChange={(event) => setLiveOnly(event.target.checked)}
            className="h-4 w-4"
          />
          {t("agriculture.plantings.live_only", "In the ground only")}
        </label>
      </div>

      <Panel
        title={t("agriculture.plantings.list", "Plantings")}
        description={t(
          "agriculture.plantings.list_desc",
          "A crop still growing shows no achievement figure yet — that is different from having done badly.",
        )}
      >
        {plantingsQuery.isLoading ? (
          <LoadingPanel label={t("agriculture.common.loading", "Loading plantings...")} />
        ) : plantings.length === 0 ? (
          <EmptyPanel label={t("agriculture.plantings.none", "No plantings match those filters.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[66rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.plantings.planting", "Planting")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.plantings.area", "Area")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.common.status", "Status")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.plantings.harvested_kg", "Picked")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.plantings.yield", "Yield / ha")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.plantings.cost", "Cost / kg")}</th>
                  <th className="pb-2 pr-6 text-right font-semibold">
                    {t("agriculture.common.actions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {plantings.map((row) => (
                  <tr key={row.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="block font-medium">
                        {row.crop?.name ?? "—"} · {row.field?.name ?? "—"}
                      </span>
                      <span className="block text-[11px] tabular-nums text-muted-foreground">
                        {row.reference}
                        {row.planted_on ? ` · planted ${String(row.planted_on).slice(0, 10)}` : ""}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">{n(row.area_hectares)} ha</td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant="outline"
                        className={`border-transparent text-[10px] font-black uppercase tracking-widest ${STATUS_TONE[row.status]}`}
                      >
                        {row.status}
                      </Badge>
                      {row.is_overdue_for_harvest ? (
                        <span className="block text-[11px] font-semibold text-destructive">
                          {t("agriculture.plantings.overdue_word", "overdue")}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {n(row.harvested_kg).toLocaleString()} kg
                      {n(row.waste_kg) > 0 ? (
                        <span className="block text-[11px] text-muted-foreground">
                          {t("agriculture.plantings.waste_meta", "{n} kg waste").replace(
                            "{n}",
                            n(row.waste_kg).toLocaleString(),
                          )}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {row.yield_per_hectare === null || row.yield_per_hectare === undefined
                        ? "—"
                        : n(row.yield_per_hectare).toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                      {/* Null while growing, which is not a bad result. */}
                      <span className="block text-[11px] text-muted-foreground">
                        {row.yield_achievement_percent === null ||
                        row.yield_achievement_percent === undefined
                          ? t("agriculture.plantings.not_scored", "not scored yet")
                          : t("agriculture.overview.of_expected", "{n}% of expected").replace(
                              "{n}",
                              row.yield_achievement_percent.toFixed(0),
                            )}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {row.cost_per_kg === null || row.cost_per_kg === undefined
                        ? "—"
                        : `ETB ${n(row.cost_per_kg).toFixed(2)}`}
                      <span className="block text-[11px] text-muted-foreground">
                        {money(row.total_cost)}
                      </span>
                    </td>
                    <td className="py-2 pr-6 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {row.is_live ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              onClick={() => setWorking(row)}
                            >
                              {t("agriculture.plantings.log_work", "Log work")}
                            </Button>
                            {row.status !== "planned" ? (
                              <Button
                                size="sm"
                                className="h-7 text-[11px]"
                                onClick={() => setPicking(row)}
                              >
                                {t("agriculture.plantings.harvest", "Harvest")}
                              </Button>
                            ) : null}
                          </>
                        ) : null}
                        {(NEXT_STATUSES[row.status] ?? []).map((next) => (
                          <Button
                            key={next}
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] capitalize"
                            disabled={transition.isPending}
                            onClick={() => transition.mutate({ id: row.id, next })}
                          >
                            {next}
                          </Button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* New planting */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("agriculture.plantings.add", "New Planting")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "agriculture.plantings.add_desc",
                  "The area you enter is the denominator for every yield figure this crop produces, and it cannot exceed the land the field has free.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="np-field">{t("agriculture.plantings.field", "Field")}</Label>
              <select
                id="np-field"
                value={form.field_id}
                onChange={(event) => setForm({ ...form, field_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("agriculture.common.select", "Select...")}</option>
                {fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-crop">{t("agriculture.plantings.crop", "Crop")}</Label>
              <select
                id="np-crop"
                value={form.crop_id}
                onChange={(event) => setForm({ ...form, crop_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("agriculture.common.select", "Select...")}</option>
                {crops.map((crop) => (
                  <option key={crop.id} value={crop.id}>
                    {crop.name}
                    {crop.variety ? ` (${crop.variety})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-area">{t("agriculture.plantings.area_ha", "Area (hectares)")}</Label>
              <Input
                id="np-area"
                type="number"
                min={0}
                step="0.01"
                value={form.area_hectares}
                onChange={(event) => setForm({ ...form, area_hectares: event.target.value })}
              />
              {freeHectares !== null ? (
                <p className="text-[11px] text-muted-foreground">
                  {t("agriculture.plantings.free_meta", "{n} ha free in this field").replace(
                    "{n}",
                    freeHectares.toFixed(2),
                  )}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-planted">{t("agriculture.plantings.planted_on", "Planted on")}</Label>
              <Input
                id="np-planted"
                type="date"
                value={form.planted_on}
                onChange={(event) => setForm({ ...form, planted_on: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-season">{t("agriculture.plantings.season", "Season")}</Label>
              <select
                id="np-season"
                value={form.season_id}
                onChange={(event) => setForm({ ...form, season_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("agriculture.plantings.no_season", "Not tied to a season")}</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-seed">{t("agriculture.plantings.seed", "Seed (kg)")}</Label>
              <Input
                id="np-seed"
                type="number"
                min={0}
                value={form.seed_quantity}
                onChange={(event) => setForm({ ...form, seed_quantity: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {t("agriculture.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={
                create.isPending || !form.field_id || !form.crop_id || !form.area_hectares
              }
            >
              {t("agriculture.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field work */}
      <Dialog open={working !== null} onOpenChange={(open) => !open && setWorking(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("agriculture.plantings.log_work", "Log work")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "agriculture.plantings.log_work_desc",
                  "What this costs feeds straight into cost per kilogram. The total is computed from the three figures below.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="na-type">{t("agriculture.plantings.work_type", "Operation")}</Label>
              <select
                id="na-type"
                value={activityForm.type}
                onChange={(event) => setActivityForm({ ...activityForm, type: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {ACTIVITY_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="na-date">{t("agriculture.plantings.performed_on", "Done on")}</Label>
              <Input
                id="na-date"
                type="date"
                value={activityForm.performed_on}
                onChange={(event) =>
                  setActivityForm({ ...activityForm, performed_on: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="na-input">{t("agriculture.plantings.input", "Input applied")}</Label>
              <Input
                id="na-input"
                value={activityForm.input_name}
                onChange={(event) =>
                  setActivityForm({ ...activityForm, input_name: event.target.value })
                }
                placeholder={t("agriculture.plantings.input_hint", "Urea, compost, herbicide")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="na-input-cost">{t("agriculture.plantings.input_cost", "Input cost")}</Label>
              <Input
                id="na-input-cost"
                type="number"
                min={0}
                value={activityForm.input_cost}
                onChange={(event) =>
                  setActivityForm({ ...activityForm, input_cost: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="na-labour">{t("agriculture.plantings.labour_cost", "Labour cost")}</Label>
              <Input
                id="na-labour"
                type="number"
                min={0}
                value={activityForm.labour_cost}
                onChange={(event) =>
                  setActivityForm({ ...activityForm, labour_cost: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="na-machinery">
                {t("agriculture.plantings.machinery_cost", "Machinery cost")}
              </Label>
              <Input
                id="na-machinery"
                type="number"
                min={0}
                value={activityForm.machinery_cost}
                onChange={(event) =>
                  setActivityForm({ ...activityForm, machinery_cost: event.target.value })
                }
              />
            </div>
            <p className="self-end pb-2 text-xs text-muted-foreground">
              {t("agriculture.plantings.total_preview", "Total: {v}").replace(
                "{v}",
                money(
                  Number(activityForm.input_cost || 0) +
                    Number(activityForm.labour_cost || 0) +
                    Number(activityForm.machinery_cost || 0),
                ),
              )}
            </p>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setWorking(null)}>
              {t("agriculture.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => recordActivity.mutate()} disabled={recordActivity.isPending}>
              {t("agriculture.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Harvest */}
      <Dialog open={picking !== null} onOpenChange={(open) => !open && setPicking(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("agriculture.plantings.harvest", "Record harvest")}
              </DialogTitle>
              <DialogDescription>
                {picking
                  ? t(
                      "agriculture.plantings.harvest_desc",
                      "{crop} on {ha} ha, {kg} kg picked so far. This adds to the total rather than replacing it — most crops are picked many times.",
                    )
                      .replace("{crop}", picking.crop?.name ?? "")
                      .replace("{ha}", String(n(picking.area_hectares)))
                      .replace("{kg}", n(picking.harvested_kg).toLocaleString())
                  : ""}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nh-date">{t("agriculture.plantings.harvested_on", "Picked on")}</Label>
              <Input
                id="nh-date"
                type="date"
                value={harvestForm.harvested_on}
                onChange={(event) =>
                  setHarvestForm({ ...harvestForm, harvested_on: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nh-grade">{t("agriculture.plantings.grade", "Grade")}</Label>
              <select
                id="nh-grade"
                value={harvestForm.quality_grade}
                onChange={(event) =>
                  setHarvestForm({ ...harvestForm, quality_grade: event.target.value })
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {["A", "B", "C", "reject"].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nh-qty">{t("agriculture.plantings.saleable", "Saleable (kg)")}</Label>
              <Input
                id="nh-qty"
                type="number"
                min={0}
                value={harvestForm.quantity_kg}
                onChange={(event) =>
                  setHarvestForm({ ...harvestForm, quantity_kg: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nh-waste">{t("agriculture.plantings.waste", "Waste (kg)")}</Label>
              <Input
                id="nh-waste"
                type="number"
                min={0}
                value={harvestForm.waste_kg}
                onChange={(event) => setHarvestForm({ ...harvestForm, waste_kg: event.target.value })}
              />
            </div>
            {harvestForm.quantity_kg !== "" && picking ? (
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                {/* Waste against everything picked, and yield against the
                    planted area — both the way the server computes them. */}
                {t(
                  "agriculture.plantings.harvest_preview",
                  "{waste}% waste of {gross} kg picked · this pick alone is {yield} kg per hectare.",
                )
                  .replace(
                    "{waste}",
                    (
                      (Number(harvestForm.waste_kg || 0) /
                        Math.max(
                          1,
                          Number(harvestForm.quantity_kg || 0) + Number(harvestForm.waste_kg || 0),
                        )) *
                      100
                    ).toFixed(1),
                  )
                  .replace(
                    "{gross}",
                    (
                      Number(harvestForm.quantity_kg || 0) + Number(harvestForm.waste_kg || 0)
                    ).toLocaleString(),
                  )
                  .replace(
                    "{yield}",
                    (
                      Number(harvestForm.quantity_kg || 0) / Math.max(0.0001, n(picking.area_hectares))
                    ).toLocaleString(undefined, { maximumFractionDigits: 0 }),
                  )}
              </p>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setPicking(null)}>
              {t("agriculture.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => recordHarvest.mutate()}
              disabled={recordHarvest.isPending || harvestForm.quantity_kg === ""}
            >
              {t("agriculture.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
