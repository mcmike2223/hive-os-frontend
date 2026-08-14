"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Droplets, Loader2, Plus, SprayCan } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

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
  ProductionLine,
  SanitationLog,
  WaterTreatmentLog,
  WaterTreatmentParameter,
} from "@/modules/production/types";
import { TreatmentStatusBadge } from "@/modules/production/components/status-badges";

const CIP_TYPES = ["pre_rinse", "caustic", "acid", "sanitize", "full_cip", "filler_bowl", "tank"];
const SOURCE_TYPES = ["borehole", "spring", "municipal", "surface", "tanker"];

export default function QualityLogsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tab, setTab] = React.useState<"treatment" | "sanitation">("treatment");
  const [treatmentOpen, setTreatmentOpen] = React.useState(false);
  const [sanitationOpen, setSanitationOpen] = React.useState(false);

  const [treatmentForm, setTreatmentForm] = React.useState<Record<string, string | boolean>>({
    logged_at: "",
    source_type: "borehole",
    source_reference: "",
    production_line_id: "",
    backwash_performed: false,
    filters_changed: false,
    corrective_action: "",
  });

  const [sanitationForm, setSanitationForm] = React.useState({
    production_line_id: "",
    cip_type: "full_cip",
    started_at: "",
    ended_at: "",
    chemical: "",
    concentration_percent: "",
    temperature_c: "",
    contact_minutes: "",
    notes: "",
  });

  const specQuery = useQuery({
    queryKey: ["production", "treatment", "specification"],
    queryFn: () => productionApi.treatmentSpecification().then((res) => res.data),
  });

  const linesQuery = useQuery({
    queryKey: ["production", "lines", "select"],
    queryFn: () => productionApi.listLines({ limit: 100, is_active: true }).then((res) => res.data),
  });

  const treatmentLogsQuery = useQuery({
    queryKey: ["production", "treatment", "logs"],
    queryFn: () => productionApi.listTreatmentLogs({ limit: 25 }).then((res) => res.data),
  });

  const sanitationLogsQuery = useQuery({
    queryKey: ["production", "sanitation", "logs"],
    queryFn: () => productionApi.listSanitationLogs({ limit: 25 }).then((res) => res.data),
  });

  const parameters: WaterTreatmentParameter[] = specQuery.data?.data ?? [];
  const lines: ProductionLine[] = linesQuery.data?.data ?? [];
  const treatmentLogs: WaterTreatmentLog[] = treatmentLogsQuery.data?.data ?? [];
  const sanitationLogs: SanitationLog[] = sanitationLogsQuery.data?.data ?? [];

  const createTreatmentMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        logged_at: treatmentForm.logged_at || new Date().toISOString().slice(0, 16),
        source_type: treatmentForm.source_type,
        source_reference: treatmentForm.source_reference || undefined,
        production_line_id: treatmentForm.production_line_id ? Number(treatmentForm.production_line_id) : undefined,
        backwash_performed: Boolean(treatmentForm.backwash_performed),
        filters_changed: Boolean(treatmentForm.filters_changed),
        corrective_action: treatmentForm.corrective_action || undefined,
      };

      parameters.forEach((parameter) => {
        const value = treatmentForm[parameter.field];
        if (value !== undefined && value !== "") {
          payload[parameter.field] = Number(value);
        }
      });

      return productionApi.createTreatmentLog(payload);
    },
    onSuccess: (response) => {
      // The verdict is graded server-side against the specification, so the
      // toast reports what the plant is actually allowed to do next.
      toast.success(response?.data?.message || t("production.quality.treatment_saved", "Treatment reading logged."));
      queryClient.invalidateQueries({ queryKey: ["production", "treatment"] });
      queryClient.invalidateQueries({ queryKey: ["production", "overview"] });
      setTreatmentOpen(false);
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message || t("production.quality.treatment_failed", "Could not log the reading."),
      );
    },
  });

  const createSanitationMutation = useMutation({
    mutationFn: () =>
      productionApi.createSanitationLog({
        production_line_id: sanitationForm.production_line_id ? Number(sanitationForm.production_line_id) : undefined,
        cip_type: sanitationForm.cip_type,
        started_at: sanitationForm.started_at,
        ended_at: sanitationForm.ended_at || undefined,
        chemical: sanitationForm.chemical || undefined,
        concentration_percent: sanitationForm.concentration_percent
          ? Number(sanitationForm.concentration_percent)
          : undefined,
        temperature_c: sanitationForm.temperature_c ? Number(sanitationForm.temperature_c) : undefined,
        contact_minutes: sanitationForm.contact_minutes ? Number(sanitationForm.contact_minutes) : undefined,
        notes: sanitationForm.notes || undefined,
      } as Partial<SanitationLog>),
    onSuccess: () => {
      toast.success(t("production.quality.sanitation_saved", "Sanitation record logged."));
      queryClient.invalidateQueries({ queryKey: ["production", "sanitation"] });
      setSanitationOpen(false);
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message || t("production.quality.sanitation_failed", "Could not log the CIP record."),
      );
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, result }: { id: number; result: "pass" | "fail" }) =>
      productionApi.verifySanitationLog(id, { final_rinse_result: result }),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("production.quality.verified", "Sanitation record verified."));
      queryClient.invalidateQueries({ queryKey: ["production", "sanitation"] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || t("production.quality.verify_failed", "Could not verify."));
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("production.quality.title", "Water Treatment & Sanitation")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "production.quality.subtitle",
              "Process-side evidence that the water entering the filler met specification and the equipment touching it was clean.",
            )}
          </p>
        </div>
        <Button
          className="rounded-full px-5"
          onClick={() => (tab === "treatment" ? setTreatmentOpen(true) : setSanitationOpen(true))}
        >
          <Plus className="mr-2 h-4 w-4" />
          {tab === "treatment"
            ? t("production.quality.add_reading", "Log Reading")
            : t("production.quality.add_cip", "Log CIP")}
        </Button>
      </div>

      <div className="flex gap-2 border-b border-border/60">
        <TabButton active={tab === "treatment"} onClick={() => setTab("treatment")} icon={<Droplets className="h-4 w-4" />}>
          {t("production.quality.tab_treatment", "Treatment Readings")}
        </TabButton>
        <TabButton active={tab === "sanitation"} onClick={() => setTab("sanitation")} icon={<SprayCan className="h-4 w-4" />}>
          {t("production.quality.tab_sanitation", "CIP & Sanitation")}
        </TabButton>
      </div>

      {tab === "treatment" ? (
        <div className="space-y-3">
          {treatmentLogsQuery.isLoading ? (
            <LoadingRow label={t("production.common.loading", "Loading...")} />
          ) : treatmentLogs.length === 0 ? (
            <EmptyRow label={t("production.quality.no_readings", "No treatment readings logged yet.")} />
          ) : (
            treatmentLogs.map((log) => (
              <article key={log.id} className="rounded-2xl border border-border/60 bg-card p-4">
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">{new Date(log.logged_at).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.source_type}
                      {log.source_reference ? ` · ${log.source_reference}` : ""}
                      {log.line ? ` · ${log.line.name}` : ""}
                    </p>
                  </div>
                  <TreatmentStatusBadge status={log.status} />
                </header>

                <dl className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {parameters.map((parameter) => {
                    const value = (log as unknown as Record<string, unknown>)[parameter.field];
                    if (value === null || value === undefined) return null;

                    const breached = (log.breaches ?? []).some((breach) => breach.field === parameter.field);

                    return (
                      <div key={parameter.field}>
                        <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">
                          {parameter.label}
                        </dt>
                        <dd
                          className={`text-sm font-bold tabular-nums ${breached ? "text-rose-600 dark:text-rose-400" : ""}`}
                        >
                          {Number(value).toLocaleString()} {parameter.unit}
                          {breached ? <AlertTriangle className="ml-1 inline h-3 w-3" aria-label="out of specification" /> : null}
                        </dd>
                      </div>
                    );
                  })}
                </dl>

                {(log.breaches ?? []).length > 0 ? (
                  <div className="mt-3 rounded-xl bg-rose-500/10 p-3">
                    <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
                      {t("production.quality.out_of_spec", "Out of specification")}
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-rose-700/90 dark:text-rose-300/90">
                      {(log.breaches ?? []).map((breach) => (
                        <li key={breach.field}>
                          {breach.label}: {breach.value} {breach.unit} —{" "}
                          {breach.direction === "below_minimum"
                            ? `${t("production.quality.below_min", "below minimum")} ${breach.min}`
                            : `${t("production.quality.above_max", "above maximum")} ${breach.max}`}
                          {breach.is_critical ? ` (${t("production.quality.critical", "critical")})` : ""}
                        </li>
                      ))}
                    </ul>
                    {log.corrective_action ? (
                      <p className="mt-2 text-xs">
                        <span className="font-semibold">{t("production.quality.action", "Action")}:</span>{" "}
                        {log.corrective_action}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sanitationLogsQuery.isLoading ? (
            <LoadingRow label={t("production.common.loading", "Loading...")} />
          ) : sanitationLogs.length === 0 ? (
            <EmptyRow label={t("production.quality.no_cip", "No sanitation records logged yet.")} />
          ) : (
            sanitationLogs.map((log) => (
              <article key={log.id} className="rounded-2xl border border-border/60 bg-card p-4">
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold capitalize">{log.cip_type.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.started_at).toLocaleString()}
                      {log.line ? ` · ${log.line.name}` : ""}
                      {log.performed_by?.name ? ` · ${log.performed_by.name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`border-transparent text-[11px] font-black uppercase tracking-widest ${
                        log.final_rinse_result === "pass"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : log.final_rinse_result === "fail"
                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {log.final_rinse_result}
                    </Badge>
                    {log.verified_at === null || log.verified_at === undefined ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => verifyMutation.mutate({ id: log.id, result: "pass" })}
                        >
                          {t("production.quality.verify_pass", "Verify Pass")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-destructive"
                          onClick={() => verifyMutation.mutate({ id: log.id, result: "fail" })}
                        >
                          {t("production.quality.verify_fail", "Fail")}
                        </Button>
                      </>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        {t("production.quality.verified_by", "Verified by")} {log.verified_by?.name ?? "-"}
                      </span>
                    )}
                  </div>
                </header>

                <dl className="mt-3 grid gap-3 sm:grid-cols-4">
                  <Detail label={t("production.quality.chemical", "Chemical")} value={log.chemical ?? "-"} />
                  <Detail
                    label={t("production.quality.concentration", "Concentration")}
                    value={log.concentration_percent ? `${log.concentration_percent}%` : "-"}
                  />
                  <Detail
                    label={t("production.quality.temperature", "Temperature")}
                    value={log.temperature_c ? `${log.temperature_c} °C` : "-"}
                  />
                  <Detail
                    label={t("production.quality.contact", "Contact")}
                    value={log.contact_minutes ? `${log.contact_minutes} min` : "-"}
                  />
                </dl>
              </article>
            ))
          )}
        </div>
      )}

      {/* Treatment reading dialog — fields are generated from the server-side
          specification so the limits live in exactly one place. */}
      <Dialog open={treatmentOpen} onOpenChange={setTreatmentOpen}>
        <DialogContent className="sm:max-w-3xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("production.quality.reading_title", "Log Treatment Reading")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "production.quality.reading_desc",
                  "The pass/warning/fail verdict is graded on the server against the specification — an out-of-limit reading cannot be filed as a pass.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="treatment-logged">{t("production.quality.logged_at", "Logged At")}</Label>
                <Input
                  id="treatment-logged"
                  type="datetime-local"
                  value={String(treatmentForm.logged_at ?? "")}
                  onChange={(event) => setTreatmentForm((prev) => ({ ...prev, logged_at: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("production.quality.source", "Source")}</Label>
                <Select
                  value={String(treatmentForm.source_type)}
                  onValueChange={(value) => setTreatmentForm((prev) => ({ ...prev, source_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="treatment-ref">{t("production.quality.source_reference", "Source Reference")}</Label>
                <Input
                  id="treatment-ref"
                  value={String(treatmentForm.source_reference ?? "")}
                  onChange={(event) => setTreatmentForm((prev) => ({ ...prev, source_reference: event.target.value }))}
                  placeholder="BH-02"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("production.common.line", "Line")}</Label>
                <Select
                  value={String(treatmentForm.production_line_id ?? "")}
                  onValueChange={(value) => setTreatmentForm((prev) => ({ ...prev, production_line_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("production.orders.select_line", "Select a line")} />
                  </SelectTrigger>
                  <SelectContent>
                    {lines.map((line) => (
                      <SelectItem key={line.id} value={String(line.id)}>
                        {line.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4 md:grid-cols-3">
              {parameters.map((parameter) => (
                <div key={parameter.field} className="space-y-1.5">
                  <Label htmlFor={`param-${parameter.field}`} className="text-xs">
                    {parameter.label}
                    {parameter.is_critical ? <span className="ml-1 text-rose-500">*</span> : null}
                  </Label>
                  <Input
                    id={`param-${parameter.field}`}
                    type="number"
                    step="0.001"
                    className="h-9"
                    value={String(treatmentForm[parameter.field] ?? "")}
                    onChange={(event) =>
                      setTreatmentForm((prev) => ({ ...prev, [parameter.field]: event.target.value }))
                    }
                    placeholder={parameter.unit}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {parameter.min !== null && parameter.max !== null
                      ? `${parameter.min} – ${parameter.max} ${parameter.unit}`
                      : parameter.min !== null
                        ? `≥ ${parameter.min} ${parameter.unit}`
                        : `≤ ${parameter.max} ${parameter.unit}`}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={Boolean(treatmentForm.backwash_performed)}
                  onCheckedChange={(checked) =>
                    setTreatmentForm((prev) => ({ ...prev, backwash_performed: checked === true }))
                  }
                />
                {t("production.quality.backwash", "Backwash performed")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={Boolean(treatmentForm.filters_changed)}
                  onCheckedChange={(checked) =>
                    setTreatmentForm((prev) => ({ ...prev, filters_changed: checked === true }))
                  }
                />
                {t("production.quality.filters_changed", "Filters changed")}
              </label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="treatment-action">{t("production.quality.corrective_action", "Corrective Action")}</Label>
              <Input
                id="treatment-action"
                value={String(treatmentForm.corrective_action ?? "")}
                onChange={(event) => setTreatmentForm((prev) => ({ ...prev, corrective_action: event.target.value }))}
                placeholder={t("production.quality.action_placeholder", "What was done about any breach...")}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setTreatmentOpen(false)}>
              {t("production.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={createTreatmentMutation.isPending}
              onClick={() => createTreatmentMutation.mutate()}
            >
              {createTreatmentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("production.quality.save_reading", "Save Reading")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CIP dialog */}
      <Dialog open={sanitationOpen} onOpenChange={setSanitationOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("production.quality.cip_title", "Log CIP / Sanitation")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "production.quality.cip_desc",
                  "The final rinse is verified by a second person, which is the point of the verification step.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("production.quality.cip_type", "CIP Type")}</Label>
              <Select
                value={sanitationForm.cip_type}
                onValueChange={(value) => setSanitationForm((prev) => ({ ...prev, cip_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CIP_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("production.common.line", "Line")}</Label>
              <Select
                value={sanitationForm.production_line_id}
                onValueChange={(value) => setSanitationForm((prev) => ({ ...prev, production_line_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("production.orders.select_line", "Select a line")} />
                </SelectTrigger>
                <SelectContent>
                  {lines.map((line) => (
                    <SelectItem key={line.id} value={String(line.id)}>
                      {line.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cip-start">{t("production.runs.started_at", "Started")}</Label>
              <Input
                id="cip-start"
                type="datetime-local"
                value={sanitationForm.started_at}
                onChange={(event) => setSanitationForm((prev) => ({ ...prev, started_at: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cip-end">{t("production.runs.ended_at", "Ended")}</Label>
              <Input
                id="cip-end"
                type="datetime-local"
                value={sanitationForm.ended_at}
                onChange={(event) => setSanitationForm((prev) => ({ ...prev, ended_at: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cip-chemical">{t("production.quality.chemical", "Chemical")}</Label>
              <Input
                id="cip-chemical"
                value={sanitationForm.chemical}
                onChange={(event) => setSanitationForm((prev) => ({ ...prev, chemical: event.target.value }))}
                placeholder="Caustic soda"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cip-concentration">{t("production.quality.concentration", "Concentration (%)")}</Label>
              <Input
                id="cip-concentration"
                type="number"
                step="0.01"
                value={sanitationForm.concentration_percent}
                onChange={(event) =>
                  setSanitationForm((prev) => ({ ...prev, concentration_percent: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cip-temp">{t("production.quality.temperature", "Temperature (°C)")}</Label>
              <Input
                id="cip-temp"
                type="number"
                step="0.1"
                value={sanitationForm.temperature_c}
                onChange={(event) => setSanitationForm((prev) => ({ ...prev, temperature_c: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cip-contact">{t("production.quality.contact_minutes", "Contact Time (min)")}</Label>
              <Input
                id="cip-contact"
                type="number"
                value={sanitationForm.contact_minutes}
                onChange={(event) => setSanitationForm((prev) => ({ ...prev, contact_minutes: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="cip-notes">{t("production.common.notes", "Notes")}</Label>
              <Input
                id="cip-notes"
                value={sanitationForm.notes}
                onChange={(event) => setSanitationForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setSanitationOpen(false)}>
              {t("production.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={createSanitationMutation.isPending}
              onClick={() => {
                if (!sanitationForm.started_at) {
                  toast.error(t("production.quality.cip_required", "A start time is required."));
                  return;
                }
                createSanitationMutation.mutate();
              }}
            >
              {createSanitationMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("production.quality.save_cip", "Save Record")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      {children}
    </button>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  );
}

function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card p-6 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm italic text-muted-foreground">
      {label}
    </div>
  );
}
