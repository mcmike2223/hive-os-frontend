"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Beaker,
  CheckCircle2,
  Clock3,
  HelpCircle,
  Loader2,
  Save,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  fetchInventoryBatchQaResults,
  fetchInventoryQaProtocols,
  recordInventoryBatchQaResults,
} from "@/modules/inventory/api";
import type { QaProtocol } from "@/modules/inventory/types";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QaRecordResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId: number | null;
}

type FormState = {
  results: Record<string, string>;
  notes: string;
  testedAt: string;
  sampleSize: string;
};

const defaultFormState = (): FormState => ({
  results: {},
  notes: "",
  testedAt: "",
  sampleSize: "",
});

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  return fallback;
};

const toInputDateTimeValue = (value: string | null | undefined) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getProtocolStatus = (protocol: QaProtocol, value: string | undefined) => {
  const normalizedValue = value?.trim() ?? "";

  if (!normalizedValue) {
    return "pending" as const;
  }

  if (protocol.payload.type === "numeric_range") {
    const numericValue = Number(normalizedValue);
    if (Number.isNaN(numericValue)) {
      return "failed" as const;
    }

    if (typeof protocol.payload.min === "number" && numericValue < protocol.payload.min) {
      return "failed" as const;
    }

    if (typeof protocol.payload.max === "number" && numericValue > protocol.payload.max) {
      return "failed" as const;
    }

    return "passed" as const;
  }

  if (!protocol.payload.target) {
    return "passed" as const;
  }

  return normalizedValue.localeCompare(protocol.payload.target, undefined, { sensitivity: "accent" }) === 0
    ? "passed"
    : "failed";
};

export function QaRecordResultsModal({ isOpen, onClose, batchId }: QaRecordResultsModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<FormState>(defaultFormState);

  const protocolsQuery = useQuery({
    queryKey: ["inventory", "qa-protocols", batchId ?? "all"],
    queryFn: fetchInventoryQaProtocols,
    enabled: isOpen && !!batchId,
  });

  const historyQuery = useQuery({
    queryKey: ["inventory", "product-batches", batchId, "qa-results"],
    queryFn: () => fetchInventoryBatchQaResults(batchId as number),
    enabled: isOpen && !!batchId,
  });

  const latestResult = historyQuery.data?.data?.[0] ?? null;

  React.useEffect(() => {
    if (!isOpen) {
      setForm(defaultFormState());
      return;
    }

    if (!latestResult) {
      setForm((prev) => ({
        ...defaultFormState(),
        testedAt: prev.testedAt || toInputDateTimeValue(new Date().toISOString()),
      }));
      return;
    }

    const rawInput = latestResult.payload?.raw_input ?? {};
    const tests = latestResult.payload?.tests ?? {};
    const prefills = Object.keys(rawInput).length > 0
      ? Object.fromEntries(
          Object.entries(rawInput).map(([key, value]) => [key, value == null ? "" : String(value)])
        )
      : Object.fromEntries(
          Object.entries(tests).map(([key, value]) => [key, value?.value == null ? "" : String(value.value)])
        );

    setForm({
      results: prefills,
      notes: latestResult.notes ?? "",
      testedAt: toInputDateTimeValue(latestResult.tested_at ?? new Date().toISOString()),
      sampleSize: latestResult.payload?.sample_size ? String(latestResult.payload.sample_size) : "",
    });
  }, [isOpen, latestResult]);

  const groupedProtocols = React.useMemo(() => {
    const groups = new Map<
      string,
      {
        stage: string;
        stageLabel: string;
        protocols: QaProtocol[];
      }
    >();

    for (const protocol of protocolsQuery.data ?? []) {
      const key = protocol.stage || protocol.stage_label || "final_release";
      const existing = groups.get(key);
      if (existing) {
        existing.protocols.push(protocol);
      } else {
        groups.set(key, {
          stage: protocol.stage,
          stageLabel: protocol.stage_label,
          protocols: [protocol],
        });
      }
    }

    return Array.from(groups.values()).map((group) => ({
      ...group,
      protocols: [...group.protocols].sort((left, right) => left.position - right.position),
    }));
  }, [protocolsQuery.data]);

  const stageProgress = React.useMemo(
    () =>
      groupedProtocols.map((group) => {
        const totals = group.protocols.reduce(
          (accumulator, protocol) => {
            const status = getProtocolStatus(protocol, form.results[protocol.code]);
            accumulator.total += 1;
            accumulator[status] += 1;
            return accumulator;
          },
          { total: 0, passed: 0, failed: 0, pending: 0 }
        );

        return {
          stage: group.stage,
          stageLabel: group.stageLabel,
          ...totals,
        };
      }),
    [form.results, groupedProtocols]
  );

  const recordMutation = useMutation({
    mutationFn: (payload: {
      results: Record<string, string | number>;
      notes?: string;
      tested_at?: string;
      sample_size?: number;
    }) => recordInventoryBatchQaResults(batchId!, payload),
    onSuccess: () => {
      toast.success(t("inventory.qa.results_recorded", "Results recorded and batch updated."));
      queryClient.invalidateQueries({ queryKey: ["inventory", "product-batches"] });
      queryClient.invalidateQueries({ queryKey: ["inventory", "product-batches", batchId, "qa-results"] });
      queryClient.invalidateQueries({ queryKey: ["inventory", "product-batches", batchId, "coa"] });
      onClose();
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t("inventory.common.failed", "Failed to record results.")));
    },
  });

  const updateResult = (protocolCode: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      results: {
        ...prev.results,
        [protocolCode]: value,
      },
    }));
  };

  const handleSubmit = () => {
    const mandatoryMissing = (protocolsQuery.data ?? []).filter(
      (protocol) => protocol.payload.is_mandatory && !(form.results[protocol.code]?.trim())
    );

    if (mandatoryMissing.length > 0) {
      toast.warning(t("inventory.qa.missing_values", "Please fill in all mandatory tests."));
      return;
    }

    const formattedResults = Object.fromEntries(
      Object.entries(form.results)
        .filter(([, value]) => value.trim() !== "")
        .map(([code, value]) => [code, value])
    );

    recordMutation.mutate({
      results: formattedResults,
      notes: form.notes.trim() || undefined,
      tested_at: form.testedAt ? new Date(form.testedAt).toISOString() : undefined,
      sample_size: form.sampleSize ? Number(form.sampleSize) : undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] flex-col overflow-hidden rounded-[2.5rem] border-border/40 bg-background/95 p-0 backdrop-blur-2xl shadow-2xl sm:max-w-[98vw] lg:max-w-[98vw]">
        <div className="border-b border-border/10 bg-primary/5 px-8 py-3">
          <DialogHeader>
            <div className="mb-1 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Beaker className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black tracking-tight">
                  {t("inventory.qa.record_title", "Record QA Results")}
                </DialogTitle>
                <DialogDescription className="text-xs font-medium opacity-70">
                  {t(
                    "inventory.qa.record_batch_desc",
                    "Record control points for batch"
                  )}{" "}
                  <span className="font-bold text-primary">#{batchId}</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="grid grid-cols-2 gap-1.5 border-b border-border/10 bg-muted/20 px-8 py-1.5 md:grid-cols-5">
          {stageProgress.map((stage) => (
            <div key={stage.stage} className="rounded-xl border border-border/40 bg-background/60 p-2">
              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground truncate">
                {stage.stageLabel}
              </p>
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-baseline gap-1">
                  <p className="text-sm font-black tracking-tight">{stage.passed}/{stage.total}</p>
                </div>
                <Badge
                  variant="outline"
                  className={`h-4 text-[11px] px-1.5 ${
                    stage.failed > 0
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-600"
                      : stage.pending > 0
                        ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-700"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                  }`}
                >
                  {stage.failed > 0 ? "Fail" : stage.pending > 0 ? "Wait" : "OK"}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 border-b border-border/10 px-8 py-1.5 md:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Tested At
            </Label>
            <Input
              type="datetime-local"
              value={form.testedAt}
              onChange={(event) => setForm((prev) => ({ ...prev, testedAt: event.target.value }))}
              className="h-8 text-xs rounded-lg bg-muted/30"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Sample Size
            </Label>
            <Input
              type="number"
              min="1"
              value={form.sampleSize}
              onChange={(event) => setForm((prev) => ({ ...prev, sampleSize: event.target.value }))}
              placeholder="Units"
              className="h-8 text-xs rounded-lg bg-muted/30"
            />
          </div>
          <div className="md:col-span-3 flex items-center gap-2 rounded-xl border border-border/40 bg-muted/10 p-2 text-[11px] text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5 text-primary shrink-0" />
            <p className="leading-tight">
              <span className="font-bold text-foreground">Workflow:</span> Record checks across stages. Mandatory failures keep the batch in quarantine.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pl-8 pr-12 py-4 min-h-[300px]">
          {protocolsQuery.isLoading || historyQuery.isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : protocolsQuery.isError ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-rose-100 bg-rose-50 p-8 text-rose-500">
              <AlertCircle className="h-10 w-10" />
              <p className="font-bold">{t("inventory.qa.protocols_failed", "Failed to load QA protocols")}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {latestResult ? (
                <div className="rounded-3xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-700 dark:text-blue-300">
                  Latest QA result loaded from{" "}
                  <span className="font-bold">
                    {latestResult.tested_at ? new Date(latestResult.tested_at).toLocaleString() : "previous record"}
                  </span>
                  {latestResult.tested_by?.name ? ` by ${latestResult.tested_by.name}` : ""}.
                </div>
              ) : null}

              {groupedProtocols.map((group) => (
                <section key={group.stage} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black tracking-tight">{group.stageLabel}</h3>
                    </div>
                    <Badge variant="outline" className="rounded-full">
                      {group.protocols.length} checks
                    </Badge>
                  </div>

                  <div className="grid gap-4">
                    {group.protocols.map((protocol) => {
                      const currentValue = form.results[protocol.code] ?? "";
                      const status = getProtocolStatus(protocol, currentValue);

                      return (
                        <div
                          key={protocol.id}
                          className="rounded-2xl border border-border/40 bg-muted/20 p-3.5 transition-all hover:border-primary/30 hover:bg-muted/30"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                  {protocol.name}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-3.5 w-3.5 cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm rounded-xl border-border/40 font-medium">
                                        {protocol.payload.description || t("inventory.qa.protocol_hint", "Compliance test")}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </Label>

                                {protocol.payload.is_mandatory ? (
                                  <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-primary">
                                    Mandatory
                                  </Badge>
                                ) : null}

                                {protocol.payload.is_critical ? (
                                  <Badge variant="outline" className="rounded-full border-rose-500/30 bg-rose-500/10 text-rose-600">
                                    Critical
                                  </Badge>
                                ) : null}
                              </div>

                              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {protocol.payload.type === "numeric_range" ? (
                                  <Badge variant="outline" className="rounded-full bg-background/50 font-mono">
                                    {typeof protocol.payload.min === "number" ? `${protocol.payload.min} - ` : ""}
                                    {typeof protocol.payload.max === "number" ? protocol.payload.max : "open"}{" "}
                                    {protocol.payload.unit || ""}
                                  </Badge>
                                ) : null}

                                {protocol.payload.type === "qualitative_target" && protocol.payload.target ? (
                                  <Badge variant="outline" className="rounded-full bg-background/50 font-mono">
                                    Target: {protocol.payload.target}
                                  </Badge>
                                ) : null}
                              </div>
                            </div>

                            <Badge
                              variant="outline"
                              className={
                                status === "passed"
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                                  : status === "failed"
                                    ? "border-rose-500/30 bg-rose-500/10 text-rose-600"
                                    : "border-yellow-500/30 bg-yellow-500/10 text-yellow-700"
                              }
                            >
                              {status === "passed" ? (
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              ) : status === "failed" ? (
                                <XCircle className="mr-1 h-3.5 w-3.5" />
                              ) : (
                                <Clock3 className="mr-1 h-3.5 w-3.5" />
                              )}
                              {status === "passed" ? "Pass" : status === "failed" ? "Fail" : "Pending"}
                            </Badge>
                          </div>

                          <div className="mt-4">
                            {protocol.payload.type === "qualitative_target" && (protocol.payload.options?.length ?? 0) > 0 ? (
                              <Select
                                value={currentValue || "__empty__"}
                                onValueChange={(value) => updateResult(protocol.code, value === "__empty__" ? "" : value)}
                              >
                                <SelectTrigger className="h-12 rounded-2xl bg-background/50">
                                  <SelectValue placeholder="Select result" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__empty__">Not recorded</SelectItem>
                                  {(protocol.payload.options ?? []).map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                type={protocol.payload.type === "numeric_range" ? "number" : "text"}
                                step={protocol.payload.type === "numeric_range" ? "0.001" : undefined}
                                value={currentValue}
                                onChange={(event) => updateResult(protocol.code, event.target.value)}
                                placeholder={
                                  protocol.payload.type === "numeric_range"
                                    ? "0.000"
                                    : protocol.payload.target || "Enter observation..."
                                }
                                className="h-10 rounded-xl border-border/40 bg-background/50 px-4 font-bold"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}

              <section className="space-y-3">
                <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  Lab Notes / Disposition
                </Label>
                <RichTextEditor
                  value={form.notes}
                  onChange={(value) => setForm((prev) => ({ ...prev, notes: value }))}
                  placeholder="Record observations, deviations, retest actions, or release remarks..."
                />
              </section>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border/10 bg-muted/20 px-8 py-6">
          <div className="mr-auto flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldAlert className="h-4 w-4" />
            Mandatory failures keep the batch quarantined.
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            className="rounded-full px-6 font-bold text-muted-foreground hover:bg-background"
          >
            {t("inventory.common.cancel", "Cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={recordMutation.isPending || protocolsQuery.isLoading || historyQuery.isLoading}
            className="group relative min-w-[180px] overflow-hidden rounded-full bg-primary px-8 font-black tracking-tight text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95"
          >
            {recordMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4 transition-transform group-hover:rotate-12" />
            )}
            {t("inventory.qa.submit_results", "Record Results")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
