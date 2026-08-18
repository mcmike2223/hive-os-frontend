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
  AgricultureLivestockGroup,
  LivestockPurpose,
} from "@/modules/agriculture/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";
import { RankedBarChart } from "@/modules/shared/charts/charts";

const PURPOSES: LivestockPurpose[] = ["dairy", "beef", "layer", "broiler", "breeding", "draught"];
const RECORD_TYPES = ["production", "feed", "health", "mortality", "movement"] as const;

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function LivestockPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [groupOpen, setGroupOpen] = React.useState(false);
  const [recording, setRecording] = React.useState<AgricultureLivestockGroup | null>(null);

  const [groupForm, setGroupForm] = React.useState({
    code: "",
    name: "",
    species: "",
    breed: "",
    purpose: "dairy",
    head_count: "0",
  });

  const [recordForm, setRecordForm] = React.useState({
    recorded_on: new Date().toISOString().slice(0, 10),
    type: "production",
    quantity: "",
    unit: "litres",
    cost: "0",
    mortality_count: "0",
    note: "",
  });

  const livestockQuery = useQuery({
    queryKey: ["agriculture", "livestock"],
    queryFn: () => agricultureApi.listLivestock({ limit: 50 }).then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["agriculture", "overview-livestock"],
    queryFn: () => agricultureApi.overview().then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["agriculture"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const createGroup = useMutation({
    mutationFn: () =>
      agricultureApi.createLivestock({
        code: groupForm.code,
        name: groupForm.name,
        species: groupForm.species,
        breed: groupForm.breed || null,
        purpose: groupForm.purpose,
        head_count: Number(groupForm.head_count || 0),
        is_active: true,
      }),
    onSuccess: () => {
      toast.success(t("agriculture.livestock.saved", "Group added."));
      invalidate();
      setGroupOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("agriculture.livestock.save_failed", "Could not add it."))),
  });

  const record = useMutation({
    mutationFn: () =>
      agricultureApi.recordLivestock(recording!.id, {
        recorded_on: recordForm.recorded_on,
        type: recordForm.type,
        quantity: Number(recordForm.quantity || 0),
        unit: recordForm.unit || null,
        cost: Number(recordForm.cost || 0),
        mortality_count: Number(recordForm.mortality_count || 0),
        note: recordForm.note || null,
      }),
    onSuccess: () => {
      toast.success(
        Number(recordForm.mortality_count || 0) > 0
          ? t("agriculture.livestock.recorded_deaths", "Recorded — the head count has been reduced.")
          : t("agriculture.livestock.recorded", "Record saved."),
      );
      invalidate();
      setRecording(null);
      setRecordForm({
        recorded_on: new Date().toISOString().slice(0, 10),
        type: "production",
        quantity: "",
        unit: "litres",
        cost: "0",
        mortality_count: "0",
        note: "",
      });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("agriculture.livestock.record_failed", "Could not record it."))),
  });

  const groups = (livestockQuery.data?.data ?? []) as AgricultureLivestockGroup[];
  const livestock = overviewQuery.data?.data?.livestock;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("agriculture.livestock.title", "Livestock")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "agriculture.livestock.subtitle",
              "Production is reported per head, and mortality is measured against the herd including the animals already lost — dividing by the survivors alone would understate it.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setGroupOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("agriculture.livestock.add", "New Group")}
        </Button>
      </div>

      {livestock ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile
            label={t("agriculture.livestock.groups", "Groups")}
            value={n(livestock.groups).toLocaleString()}
          />
          <StatTile
            label={t("agriculture.overview.head", "Head")}
            value={n(livestock.head).toLocaleString()}
          />
          <StatTile
            label={t("agriculture.livestock.species", "Species")}
            value={String((livestock.by_species ?? []).length)}
            meta={(livestock.by_species ?? [])
              .map((row: any) => `${row.species} ${row.head}`)
              .join(" · ")}
          />
        </div>
      ) : null}

      {livestock && (livestock.by_species ?? []).length > 0 ? (
        <RankedBarChart
          title={t("agriculture.livestock.by_species", "Head by species")}
          description={t(
            "agriculture.livestock.by_species_desc",
            "The herd as it stands today, after any losses recorded.",
          )}
          rows={(livestock.by_species ?? []).map((row: any) => ({
            key: row.species,
            label: row.species,
            value: n(row.head),
            meta: t("agriculture.livestock.groups_meta", "{n} groups").replace(
              "{n}",
              String(row.groups),
            ),
          }))}
          valueLabel={t("agriculture.overview.head", "Head")}
          emptyLabel={t("agriculture.livestock.none", "No livestock recorded.")}
        />
      ) : null}

      <Panel
        title={t("agriculture.livestock.register", "Groups")}
        description={t(
          "agriculture.livestock.register_desc",
          "A group with no animals has no per-head figure at all, rather than a zero.",
        )}
      >
        {livestockQuery.isLoading ? (
          <LoadingPanel label={t("agriculture.common.loading", "Loading livestock...")} />
        ) : groups.length === 0 ? (
          <EmptyPanel label={t("agriculture.livestock.none", "No livestock recorded.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.overview.group", "Group")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.livestock.purpose", "Purpose")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.overview.head", "Head")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.overview.per_head", "Per head")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("agriculture.overview.mortality", "Mortality")}</th>
                  <th className="pb-2 pr-6 text-right font-semibold">
                    {t("agriculture.common.actions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="block font-medium">{group.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {group.species}
                        {group.breed ? ` · ${group.breed}` : ""}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className="text-[11px] capitalize">
                        {group.purpose}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {n(group.head_count).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {group.production_per_head === null || group.production_per_head === undefined
                        ? "—"
                        : n(group.production_per_head).toLocaleString(undefined, {
                            maximumFractionDigits: 1,
                          })}
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {group.mortality_percent === null || group.mortality_percent === undefined ? (
                        "—"
                      ) : (
                        <span
                          className={
                            n(group.mortality_percent) > 5
                              ? "font-semibold text-destructive"
                              : "text-muted-foreground"
                          }
                        >
                          {n(group.mortality_percent).toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-6 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={() => setRecording(group)}
                      >
                        {t("agriculture.livestock.record", "Record")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* New group */}
      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("agriculture.livestock.add", "New Group")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "agriculture.livestock.add_desc",
                  "The head count is the denominator for every per-head figure this group produces.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ng-code">{t("agriculture.common.code", "Code")}</Label>
              <Input
                id="ng-code"
                value={groupForm.code}
                onChange={(event) => setGroupForm({ ...groupForm, code: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ng-name">{t("agriculture.common.name", "Name")}</Label>
              <Input
                id="ng-name"
                value={groupForm.name}
                onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ng-species">{t("agriculture.livestock.species_field", "Species")}</Label>
              <Input
                id="ng-species"
                value={groupForm.species}
                onChange={(event) => setGroupForm({ ...groupForm, species: event.target.value })}
                placeholder={t("agriculture.livestock.species_hint", "Cattle, poultry, goat")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ng-breed">{t("agriculture.livestock.breed", "Breed")}</Label>
              <Input
                id="ng-breed"
                value={groupForm.breed}
                onChange={(event) => setGroupForm({ ...groupForm, breed: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ng-purpose">{t("agriculture.livestock.purpose", "Purpose")}</Label>
              <select
                id="ng-purpose"
                value={groupForm.purpose}
                onChange={(event) => setGroupForm({ ...groupForm, purpose: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {PURPOSES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ng-head">{t("agriculture.overview.head", "Head")}</Label>
              <Input
                id="ng-head"
                type="number"
                min={0}
                value={groupForm.head_count}
                onChange={(event) => setGroupForm({ ...groupForm, head_count: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setGroupOpen(false)}>
              {t("agriculture.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => createGroup.mutate()}
              disabled={
                createGroup.isPending ||
                !groupForm.code.trim() ||
                !groupForm.name.trim() ||
                !groupForm.species.trim()
              }
            >
              {t("agriculture.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record */}
      <Dialog open={recording !== null} onOpenChange={(open) => !open && setRecording(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("agriculture.livestock.record", "Record")}
              </DialogTitle>
              <DialogDescription>
                {recording
                  ? t(
                      "agriculture.livestock.record_desc",
                      "{name}, {head} head. The herd size is stamped onto the record, so a per-head figure later reflects the herd as it was, not as it ends up.",
                    )
                      .replace("{name}", recording.name)
                      .replace("{head}", String(n(recording.head_count)))
                  : ""}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nr-type">{t("agriculture.livestock.record_type", "Type")}</Label>
              <select
                id="nr-type"
                value={recordForm.type}
                onChange={(event) => setRecordForm({ ...recordForm, type: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {RECORD_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nr-date">{t("agriculture.livestock.recorded_on", "Date")}</Label>
              <Input
                id="nr-date"
                type="date"
                value={recordForm.recorded_on}
                onChange={(event) =>
                  setRecordForm({ ...recordForm, recorded_on: event.target.value })
                }
              />
            </div>

            {recordForm.type === "mortality" ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="nr-deaths">{t("agriculture.livestock.deaths", "Deaths")}</Label>
                <Input
                  id="nr-deaths"
                  type="number"
                  min={0}
                  value={recordForm.mortality_count}
                  onChange={(event) =>
                    setRecordForm({ ...recordForm, mortality_count: event.target.value })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    "agriculture.livestock.deaths_hint",
                    "The head count drops by this many, so nobody has to remember to edit it separately.",
                  )}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="nr-qty">{t("agriculture.livestock.quantity", "Quantity")}</Label>
                  <Input
                    id="nr-qty"
                    type="number"
                    min={0}
                    step="any"
                    value={recordForm.quantity}
                    onChange={(event) =>
                      setRecordForm({ ...recordForm, quantity: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nr-unit">{t("agriculture.livestock.unit", "Unit")}</Label>
                  <Input
                    id="nr-unit"
                    value={recordForm.unit}
                    onChange={(event) => setRecordForm({ ...recordForm, unit: event.target.value })}
                    placeholder={t("agriculture.livestock.unit_hint", "litres, trays, kg")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nr-cost">{t("agriculture.livestock.cost", "Cost")}</Label>
                  <Input
                    id="nr-cost"
                    type="number"
                    min={0}
                    value={recordForm.cost}
                    onChange={(event) => setRecordForm({ ...recordForm, cost: event.target.value })}
                  />
                </div>
                {recording && recordForm.quantity !== "" && n(recording.head_count) > 0 ? (
                  <p className="self-end pb-2 text-xs text-muted-foreground">
                    {t("agriculture.livestock.per_head_preview", "{n} per head").replace(
                      "{n}",
                      (Number(recordForm.quantity) / n(recording.head_count)).toFixed(2),
                    )}
                  </p>
                ) : null}
              </>
            )}

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nr-note">{t("agriculture.livestock.note", "Note")}</Label>
              <Input
                id="nr-note"
                value={recordForm.note}
                onChange={(event) => setRecordForm({ ...recordForm, note: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setRecording(null)}>
              {t("agriculture.common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => record.mutate()} disabled={record.isPending}>
              {t("agriculture.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
