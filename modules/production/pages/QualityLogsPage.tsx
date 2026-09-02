"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Droplets,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  SprayCan,
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
import { productionApi } from "@/modules/production/api";
import type {
  ProductionLine,
  ProductionOrder,
  SanitationLog,
  WaterTreatmentLog,
  WaterTreatmentParameter,
} from "@/modules/production/types";
import { TreatmentStatusBadge } from "@/modules/production/components/status-badges";
import {
  BusyLabel,
  ProductionError,
  ProductionLoading,
  ProductionMetricCard,
  ProductionShell,
} from "@/modules/production/components/production-shell";
import { errorText, isoDaysAgo, useDebouncedValue } from "../utils";

const CIP_TYPES = [
  "pre_rinse",
  "caustic",
  "acid",
  "sanitize",
  "full_cip",
  "filler_bowl",
  "tank",
] as const;

const SOURCE_TYPES = ["borehole", "spring", "municipal", "surface", "tanker"] as const;

const TREATMENT_STATUSES = ["pass", "warning", "fail"] as const;
type TreatmentStatusFilter = (typeof TREATMENT_STATUSES)[number] | "all";
type SanitationRinseFilter = "pending" | "pass" | "fail" | "all";
type QualityTab = "treatment" | "sanitation";

type TreatmentFormState = Record<string, string | boolean>;

type SanitationFormState = {
  production_line_id: string;
  production_order_id: string;
  cip_type: string;
  started_at: string;
  ended_at: string;
  chemical: string;
  concentration_percent: string;
  temperature_c: string;
  contact_minutes: string;
  notes: string;
};

function emptyTreatmentForm(): TreatmentFormState {
  return {
    logged_at: "",
    source_type: "borehole",
    source_reference: "",
    production_line_id: "",
    production_order_id: "",
    backwash_performed: false,
    filters_changed: false,
    corrective_action: "",
  };
}

function toLocalDateTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function treatmentToForm(log: WaterTreatmentLog, parameters: WaterTreatmentParameter[]): TreatmentFormState {
  const form = emptyTreatmentForm();
  form.logged_at = toLocalDateTime(log.logged_at);
  form.source_type = log.source_type;
  form.source_reference = log.source_reference ?? "";
  form.production_line_id = log.production_line_id ? String(log.production_line_id) : "";
  form.production_order_id = log.production_order_id ? String(log.production_order_id) : "";
  form.backwash_performed = log.backwash_performed;
  form.filters_changed = log.filters_changed;
  form.corrective_action = log.corrective_action ?? "";

  for (const parameter of parameters) {
    const value = (log as unknown as Record<string, unknown>)[parameter.field];
    if (value !== null && value !== undefined) {
      form[parameter.field] = String(value);
    }
  }

  return form;
}

function treatmentPayloadFromForm(
  form: TreatmentFormState,
  parameters: WaterTreatmentParameter[],
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    logged_at: form.logged_at || new Date().toISOString().slice(0, 16),
    source_type: form.source_type,
    source_reference: form.source_reference || undefined,
    production_line_id: form.production_line_id ? Number(form.production_line_id) : undefined,
    production_order_id: form.production_order_id ? Number(form.production_order_id) : undefined,
    backwash_performed: Boolean(form.backwash_performed),
    filters_changed: Boolean(form.filters_changed),
    corrective_action: form.corrective_action || undefined,
  };

  for (const parameter of parameters) {
    const value = form[parameter.field];
    if (value !== undefined && value !== "") {
      payload[parameter.field] = Number(value);
    }
  }

  return payload;
}

function emptySanitationForm(): SanitationFormState {
  return {
    production_line_id: "",
    production_order_id: "",
    cip_type: "full_cip",
    started_at: "",
    ended_at: "",
    chemical: "",
    concentration_percent: "",
    temperature_c: "",
    contact_minutes: "",
    notes: "",
  };
}

function sanitationToForm(log: SanitationLog): SanitationFormState {
  return {
    production_line_id: log.production_line_id ? String(log.production_line_id) : "",
    production_order_id: log.production_order_id ? String(log.production_order_id) : "",
    cip_type: log.cip_type,
    started_at: toLocalDateTime(log.started_at),
    ended_at: toLocalDateTime(log.ended_at),
    chemical: log.chemical ?? "",
    concentration_percent: log.concentration_percent ? String(log.concentration_percent) : "",
    temperature_c: log.temperature_c ? String(log.temperature_c) : "",
    contact_minutes: log.contact_minutes ? String(log.contact_minutes) : "",
    notes: log.notes ?? "",
  };
}

function sanitationPayloadFromForm(form: SanitationFormState): Partial<SanitationLog> {
  return {
    production_line_id: form.production_line_id ? Number(form.production_line_id) : undefined,
    production_order_id: form.production_order_id ? Number(form.production_order_id) : undefined,
    cip_type: form.cip_type,
    started_at: form.started_at,
    ended_at: form.ended_at || undefined,
    chemical: form.chemical || undefined,
    concentration_percent: form.concentration_percent ? Number(form.concentration_percent) : undefined,
    temperature_c: form.temperature_c ? Number(form.temperature_c) : undefined,
    contact_minutes: form.contact_minutes ? Number(form.contact_minutes) : undefined,
    notes: form.notes || undefined,
  };
}

function hasActiveTreatmentFilters(opts: {
  search: string;
  status: TreatmentStatusFilter;
  lineId: string;
  sourceType: string;
  breachOnly: boolean;
  from: string;
  to: string;
}): boolean {
  return Boolean(
    opts.search.trim() ||
      opts.status !== "all" ||
      opts.lineId ||
      opts.sourceType ||
      opts.breachOnly ||
      opts.from ||
      opts.to,
  );
}

function hasActiveSanitationFilters(opts: {
  search: string;
  lineId: string;
  cipType: string;
  rinseResult: SanitationRinseFilter;
  pendingOnly: boolean;
  from: string;
  to: string;
}): boolean {
  return Boolean(
    opts.search.trim() ||
      opts.lineId ||
      opts.cipType ||
      opts.rinseResult !== "all" ||
      opts.pendingOnly ||
      opts.from ||
      opts.to,
  );
}

function parameterRangeLabel(parameter: WaterTreatmentParameter): string {
  if (parameter.min !== null && parameter.max !== null) {
    return `${parameter.min} – ${parameter.max} ${parameter.unit}`;
  }
  if (parameter.min !== null) return `≥ ${parameter.min} ${parameter.unit}`;
  if (parameter.max !== null) return `≤ ${parameter.max} ${parameter.unit}`;
  return parameter.unit;
}

const PAGE_SIZE = 15;

export default function QualityLogsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { hasAnyPermission } = usePermissions();

  const canRecordTreatment = hasAnyPermission(["record_water_treatment", "manage_production"]);
  const canEditTreatment = hasAnyPermission(["record_water_treatment", "manage_production"]);
  const canRecordSanitation = hasAnyPermission(["record_production_sanitation", "manage_production"]);
  const canEditSanitation = hasAnyPermission(["record_production_sanitation", "manage_production"]);
  const canVerify = hasAnyPermission(["verify_production_sanitation", "manage_production"]);
  const canDelete = hasAnyPermission(["manage_production"]);

  const [tab, setTab] = React.useState<QualityTab>(
    searchParams.get("tab") === "sanitation" ? "sanitation" : "treatment",
  );

  const [treatmentPage, setTreatmentPage] = React.useState(Number(searchParams.get("page") || 1));
  const [treatmentSearch, setTreatmentSearch] = React.useState(searchParams.get("search") ?? "");
  const [treatmentStatus, setTreatmentStatus] = React.useState<TreatmentStatusFilter>(
    (searchParams.get("status") as TreatmentStatusFilter) || "all",
  );
  const [treatmentLineId, setTreatmentLineId] = React.useState(searchParams.get("line_id") ?? "");
  const [treatmentSource, setTreatmentSource] = React.useState(searchParams.get("source_type") ?? "");
  const [breachOnly, setBreachOnly] = React.useState(searchParams.get("breach_only") === "1");
  const [fromDate, setFromDate] = React.useState(searchParams.get("from") ?? "");
  const [toDate, setToDate] = React.useState(searchParams.get("to") ?? "");

  const [sanitationPage, setSanitationPage] = React.useState(Number(searchParams.get("page") || 1));
  const [sanitationSearch, setSanitationSearch] = React.useState(searchParams.get("search") ?? "");
  const [sanitationLineId, setSanitationLineId] = React.useState(searchParams.get("line_id") ?? "");
  const [cipTypeFilter, setCipTypeFilter] = React.useState(searchParams.get("cip_type") ?? "");
  const [rinseFilter, setRinseFilter] = React.useState<SanitationRinseFilter>(
    (searchParams.get("rinse") as SanitationRinseFilter) || "all",
  );
  const [pendingOnly, setPendingOnly] = React.useState(searchParams.get("pending_only") === "1");

  const debouncedTreatmentSearch = useDebouncedValue(treatmentSearch);
  const debouncedSanitationSearch = useDebouncedValue(sanitationSearch);

  const [treatmentOpen, setTreatmentOpen] = React.useState(searchParams.get("add") === "1");
  const [sanitationOpen, setSanitationOpen] = React.useState(searchParams.get("add_cip") === "1");
  const [treatmentForm, setTreatmentForm] = React.useState<TreatmentFormState>(emptyTreatmentForm());
  const [sanitationForm, setSanitationForm] = React.useState<SanitationFormState>(emptySanitationForm());
  const [editingTreatment, setEditingTreatment] = React.useState<WaterTreatmentLog | null>(null);
  const [editingSanitation, setEditingSanitation] = React.useState<SanitationLog | null>(null);
  const [inspectTreatmentId, setInspectTreatmentId] = React.useState<number | null>(
    searchParams.get("treatment_id") ? Number(searchParams.get("treatment_id")) : null,
  );
  const [inspectSanitationId, setInspectSanitationId] = React.useState<number | null>(
    searchParams.get("sanitation_id") ? Number(searchParams.get("sanitation_id")) : null,
  );
  const [verifyLog, setVerifyLog] = React.useState<SanitationLog | null>(null);
  const [verifyResult, setVerifyResult] = React.useState<"pass" | "fail">("pass");
  const [verifyConductivity, setVerifyConductivity] = React.useState("");
  const [verifyNotes, setVerifyNotes] = React.useState("");
  const [deleteTreatment, setDeleteTreatment] = React.useState<WaterTreatmentLog | null>(null);
  const [deleteSanitation, setDeleteSanitation] = React.useState<SanitationLog | null>(null);
  const [orderSearch, setOrderSearch] = React.useState("");
  const debouncedOrderSearch = useDebouncedValue(orderSearch);

  const periodFrom = fromDate || isoDaysAgo(29);
  const periodTo = toDate || isoDaysAgo(0);

  const specQuery = useQuery({
    queryKey: ["production", "treatment", "specification"],
    queryFn: () => productionApi.treatmentSpecification().then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["production", "overview", "quality-page", periodFrom, periodTo],
    queryFn: () =>
      productionApi.overview({ from: periodFrom, to: periodTo }).then((res) => res.data),
  });

  const pendingCipQuery = useQuery({
    queryKey: ["production", "sanitation", "pending-count", periodFrom, periodTo],
    queryFn: () =>
      productionApi
        .listSanitationLogs({
          pending_only: 1,
          limit: 1,
          from: periodFrom,
          to: periodTo,
        })
        .then((res) => res.data),
  });

  const linesQuery = useQuery({
    queryKey: ["production", "lines", "select"],
    queryFn: () => productionApi.listLines({ limit: 100, is_active: true }).then((res) => res.data),
  });

  const treatmentLogsQuery = useQuery({
    queryKey: [
      "production",
      "treatment",
      "logs",
      treatmentPage,
      debouncedTreatmentSearch,
      treatmentStatus,
      treatmentLineId,
      treatmentSource,
      breachOnly,
      fromDate,
      toDate,
    ],
    queryFn: () =>
      productionApi
        .listTreatmentLogs({
          page: treatmentPage,
          limit: PAGE_SIZE,
          search: debouncedTreatmentSearch || undefined,
          status: treatmentStatus === "all" ? undefined : treatmentStatus,
          production_line_id: treatmentLineId ? Number(treatmentLineId) : undefined,
          source_type: treatmentSource || undefined,
          breach_only: breachOnly ? 1 : undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
    enabled: tab === "treatment",
  });

  const sanitationLogsQuery = useQuery({
    queryKey: [
      "production",
      "sanitation",
      "logs",
      sanitationPage,
      debouncedSanitationSearch,
      sanitationLineId,
      cipTypeFilter,
      rinseFilter,
      pendingOnly,
      fromDate,
      toDate,
    ],
    queryFn: () =>
      productionApi
        .listSanitationLogs({
          page: sanitationPage,
          limit: PAGE_SIZE,
          search: debouncedSanitationSearch || undefined,
          production_line_id: sanitationLineId ? Number(sanitationLineId) : undefined,
          cip_type: cipTypeFilter || undefined,
          final_rinse_result: rinseFilter === "all" ? undefined : rinseFilter,
          pending_only: pendingOnly ? 1 : undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        })
        .then((res) => res.data),
    placeholderData: (previous) => previous,
    enabled: tab === "sanitation",
  });

  const treatmentDetailQuery = useQuery({
    queryKey: ["production", "treatment", inspectTreatmentId],
    queryFn: () => productionApi.getTreatmentLog(inspectTreatmentId!).then((res) => res.data.data),
    enabled: inspectTreatmentId !== null,
  });

  const sanitationDetailQuery = useQuery({
    queryKey: ["production", "sanitation", inspectSanitationId],
    queryFn: () => productionApi.getSanitationLog(inspectSanitationId!).then((res) => res.data.data),
    enabled: inspectSanitationId !== null,
  });

  const openOrdersQuery = useQuery({
    queryKey: ["production", "orders", "quality-picker", debouncedOrderSearch],
    queryFn: () =>
      productionApi
        .listOrders({ limit: 50, open_only: true, search: debouncedOrderSearch || undefined })
        .then((res) => res.data),
    enabled: treatmentOpen || sanitationOpen || editingTreatment !== null || editingSanitation !== null,
  });

  const parameters: WaterTreatmentParameter[] = specQuery.data?.data ?? [];
  const lines: ProductionLine[] = linesQuery.data?.data ?? [];
  const orders: ProductionOrder[] = openOrdersQuery.data?.data ?? [];
  const treatmentLogs: WaterTreatmentLog[] = treatmentLogsQuery.data?.data ?? [];
  const sanitationLogs: SanitationLog[] = sanitationLogsQuery.data?.data ?? [];
  const overview = overviewQuery.data?.data;
  const wt = overview?.water_treatment;

  const invalidateTreatment = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["production", "treatment"] });
    queryClient.invalidateQueries({ queryKey: ["production", "overview"] });
  }, [queryClient]);

  const invalidateSanitation = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["production", "sanitation"] });
  }, [queryClient]);

  const syncUrl = React.useCallback(() => {
    const params = new URLSearchParams();
    if (tab === "sanitation") params.set("tab", "sanitation");
    const search = tab === "treatment" ? treatmentSearch.trim() : sanitationSearch.trim();
    if (search) params.set("search", search);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (tab === "treatment") {
      if (treatmentStatus !== "all") params.set("status", treatmentStatus);
      if (treatmentLineId) params.set("line_id", treatmentLineId);
      if (treatmentSource) params.set("source_type", treatmentSource);
      if (breachOnly) params.set("breach_only", "1");
      if (treatmentPage > 1) params.set("page", String(treatmentPage));
      if (inspectTreatmentId) params.set("treatment_id", String(inspectTreatmentId));
      if (treatmentOpen) params.set("add", "1");
    } else {
      if (sanitationLineId) params.set("line_id", sanitationLineId);
      if (cipTypeFilter) params.set("cip_type", cipTypeFilter);
      if (rinseFilter !== "all") params.set("rinse", rinseFilter);
      if (pendingOnly) params.set("pending_only", "1");
      if (sanitationPage > 1) params.set("page", String(sanitationPage));
      if (inspectSanitationId) params.set("sanitation_id", String(inspectSanitationId));
      if (sanitationOpen) params.set("add_cip", "1");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    breachOnly,
    cipTypeFilter,
    fromDate,
    inspectSanitationId,
    inspectTreatmentId,
    pathname,
    pendingOnly,
    rinseFilter,
    router,
    sanitationLineId,
    sanitationOpen,
    sanitationPage,
    sanitationSearch,
    tab,
    toDate,
    treatmentLineId,
    treatmentOpen,
    treatmentPage,
    treatmentSearch,
    treatmentSource,
    treatmentStatus,
  ]);

  React.useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  React.useEffect(() => {
    if (tab === "treatment") setTreatmentPage(1);
    else setSanitationPage(1);
  }, [
    tab,
    debouncedTreatmentSearch,
    treatmentStatus,
    treatmentLineId,
    treatmentSource,
    breachOnly,
    debouncedSanitationSearch,
    sanitationLineId,
    cipTypeFilter,
    rinseFilter,
    pendingOnly,
    fromDate,
    toDate,
  ]);

  const createTreatmentMutation = useMutation({
    mutationFn: () => productionApi.createTreatmentLog(treatmentPayloadFromForm(treatmentForm, parameters)),
    onSuccess: (response) => {
      toast.success(
        response?.data?.message || t("production.quality.treatment_saved", "Treatment reading logged."),
      );
      invalidateTreatment();
      setTreatmentOpen(false);
      setTreatmentForm(emptyTreatmentForm());
    },
    onError: (error) => {
      toast.error(errorText(error, t("production.quality.treatment_failed", "Could not log the reading.")));
    },
  });

  const updateTreatmentMutation = useMutation({
    mutationFn: () =>
      productionApi.updateTreatmentLog(editingTreatment!.id, treatmentPayloadFromForm(treatmentForm, parameters)),
    onSuccess: () => {
      toast.success(t("production.quality.treatment_updated", "Treatment reading updated."));
      invalidateTreatment();
      setEditingTreatment(null);
      setTreatmentForm(emptyTreatmentForm());
      if (inspectTreatmentId) treatmentDetailQuery.refetch();
    },
    onError: (error) => {
      toast.error(errorText(error, t("production.quality.treatment_update_failed", "Could not update the reading.")));
    },
  });

  const deleteTreatmentMutation = useMutation({
    mutationFn: () => productionApi.deleteTreatmentLog(deleteTreatment!.id),
    onSuccess: () => {
      toast.success(t("production.quality.treatment_deleted", "Treatment reading deleted."));
      invalidateTreatment();
      if (inspectTreatmentId === deleteTreatment?.id) setInspectTreatmentId(null);
      setDeleteTreatment(null);
    },
    onError: (error) => {
      toast.error(errorText(error, t("production.quality.treatment_delete_failed", "Could not delete the reading.")));
    },
  });

  const createSanitationMutation = useMutation({
    mutationFn: () => productionApi.createSanitationLog(sanitationPayloadFromForm(sanitationForm)),
    onSuccess: () => {
      toast.success(t("production.quality.sanitation_saved", "Sanitation record logged."));
      invalidateSanitation();
      pendingCipQuery.refetch();
      setSanitationOpen(false);
      setSanitationForm(emptySanitationForm());
    },
    onError: (error) => {
      toast.error(errorText(error, t("production.quality.sanitation_failed", "Could not log the CIP record.")));
    },
  });

  const updateSanitationMutation = useMutation({
    mutationFn: () =>
      productionApi.updateSanitationLog(editingSanitation!.id, sanitationPayloadFromForm(sanitationForm)),
    onSuccess: () => {
      toast.success(t("production.quality.sanitation_updated", "Sanitation record updated."));
      invalidateSanitation();
      setEditingSanitation(null);
      setSanitationForm(emptySanitationForm());
      if (inspectSanitationId) sanitationDetailQuery.refetch();
    },
    onError: (error) => {
      toast.error(errorText(error, t("production.quality.sanitation_update_failed", "Could not update the CIP record.")));
    },
  });

  const deleteSanitationMutation = useMutation({
    mutationFn: () => productionApi.deleteSanitationLog(deleteSanitation!.id),
    onSuccess: () => {
      toast.success(t("production.quality.sanitation_deleted", "Sanitation record deleted."));
      invalidateSanitation();
      pendingCipQuery.refetch();
      if (inspectSanitationId === deleteSanitation?.id) setInspectSanitationId(null);
      setDeleteSanitation(null);
    },
    onError: (error) => {
      toast.error(errorText(error, t("production.quality.sanitation_delete_failed", "Could not delete the record.")));
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () =>
      productionApi.verifySanitationLog(verifyLog!.id, {
        final_rinse_result: verifyResult,
        final_rinse_conductivity_us: verifyConductivity ? Number(verifyConductivity) : undefined,
        notes: verifyNotes || undefined,
      }),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("production.quality.verified", "Sanitation record verified."));
      invalidateSanitation();
      pendingCipQuery.refetch();
      setVerifyLog(null);
      setVerifyConductivity("");
      setVerifyNotes("");
      if (inspectSanitationId) sanitationDetailQuery.refetch();
    },
    onError: (error) => {
      toast.error(errorText(error, t("production.quality.verify_failed", "Could not verify.")));
    },
  });

  const treatmentFiltersActive = hasActiveTreatmentFilters({
    search: treatmentSearch,
    status: treatmentStatus,
    lineId: treatmentLineId,
    sourceType: treatmentSource,
    breachOnly,
    from: fromDate,
    to: toDate,
  });

  const sanitationFiltersActive = hasActiveSanitationFilters({
    search: sanitationSearch,
    lineId: sanitationLineId,
    cipType: cipTypeFilter,
    rinseResult: rinseFilter,
    pendingOnly,
    from: fromDate,
    to: toDate,
  });

  const refetching =
    tab === "treatment"
      ? treatmentLogsQuery.isFetching && !treatmentLogsQuery.isLoading
      : sanitationLogsQuery.isFetching && !sanitationLogsQuery.isLoading;

  const clearTreatmentFilters = () => {
    setTreatmentSearch("");
    setTreatmentStatus("all");
    setTreatmentLineId("");
    setTreatmentSource("");
    setBreachOnly(false);
    setFromDate("");
    setToDate("");
  };

  const clearSanitationFilters = () => {
    setSanitationSearch("");
    setSanitationLineId("");
    setCipTypeFilter("");
    setRinseFilter("all");
    setPendingOnly(false);
    setFromDate("");
    setToDate("");
  };

  const inspectTreatment = treatmentDetailQuery.data ?? null;
  const inspectSanitation = sanitationDetailQuery.data ?? null;

  return (
    <ProductionShell
      title={t("production.quality.title", "Water Treatment & Sanitation")}
      description={t(
        "production.quality.subtitle",
        "Process-side evidence that the water entering the filler met specification and the equipment touching it was clean.",
      )}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (tab === "treatment") treatmentLogsQuery.refetch();
              else sanitationLogsQuery.refetch();
              overviewQuery.refetch();
              pendingCipQuery.refetch();
            }}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refetching ? "animate-spin" : ""}`} />
            {t("production.common.refresh", "Refresh")}
          </Button>
          {tab === "treatment" && canRecordTreatment ? (
            <Button
              type="button"
              onClick={() => {
                setTreatmentForm(emptyTreatmentForm());
                setTreatmentOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("production.quality.add_reading", "Log reading")}
            </Button>
          ) : null}
          {tab === "sanitation" && canRecordSanitation ? (
            <Button
              type="button"
              onClick={() => {
                setSanitationForm(emptySanitationForm());
                setSanitationOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("production.quality.add_cip", "Log CIP")}
            </Button>
          ) : null}
        </div>
      }
    >
      {wt ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link href="/dashboard/production/quality?breach_only=1" className="block">
            <ProductionMetricCard
              title={t("production.quality.compliance", "Spec compliance")}
              value={`${wt.compliance_percent.toFixed(1)}%`}
              description={`${wt.passed} ${t("production.quality.passed", "passed")} · ${wt.warnings} ${t("production.quality.warnings", "warnings")} · ${wt.failed} ${t("production.overview.failed", "failed")}`}
            />
          </Link>
          <ProductionMetricCard
            title={t("production.quality.readings_logged", "Treatment readings")}
            value={wt.logs.toLocaleString()}
            description={t(
              "production.quality.readings_desc",
              "In-process water checks graded against the plant specification.",
            )}
          />
          <ProductionMetricCard
            title={t("production.quality.avg_ph", "Average pH")}
            value={wt.average_ph !== null ? wt.average_ph.toFixed(2) : "—"}
            description={
              wt.average_tds_ppm !== null
                ? `${wt.average_tds_ppm.toFixed(0)} ppm ${t("production.quality.avg_tds", "avg TDS")}`
                : t("production.quality.no_tds", "No TDS readings in period")
            }
          />
          <Link href="/dashboard/production/quality?tab=sanitation&pending_only=1" className="block">
            <ProductionMetricCard
              title={t("production.quality.pending_verification", "CIP awaiting sign-off")}
              value={(pendingCipQuery.data?.meta?.total ?? 0).toLocaleString()}
              description={t(
                "production.quality.pending_desc",
                "Final rinse not yet verified by a second person.",
              )}
            />
          </Link>
        </div>
      ) : overviewQuery.isLoading ? (
        <ProductionLoading />
      ) : null}

      <div className="flex gap-2 border-b border-border/60">
        <TabButton
          active={tab === "treatment"}
          onClick={() => setTab("treatment")}
          icon={<Droplets className="h-4 w-4" />}
        >
          {t("production.quality.tab_treatment", "Treatment readings")}
        </TabButton>
        <TabButton
          active={tab === "sanitation"}
          onClick={() => setTab("sanitation")}
          icon={<SprayCan className="h-4 w-4" />}
        >
          {t("production.quality.tab_sanitation", "CIP & sanitation")}
        </TabButton>
      </div>

      {tab === "treatment" ? (
        <>
          <FilterBar
            filtersActive={treatmentFiltersActive}
            onClear={clearTreatmentFilters}
            search={
              <Input
                className="h-9 w-48"
                placeholder={t("production.quality.search_treatment", "Search source or line...")}
                value={treatmentSearch}
                onChange={(event) => setTreatmentSearch(event.target.value)}
              />
            }
          >
            <FilterSelect
              label={t("production.common.status", "Status")}
              value={treatmentStatus}
              onChange={(value) => setTreatmentStatus(value as TreatmentStatusFilter)}
              options={[
                { value: "all", label: t("production.common.all", "All") },
                ...TREATMENT_STATUSES.map((status) => ({ value: status, label: status })),
              ]}
            />
            <FilterSelect
              label={t("production.common.line", "Line")}
              value={treatmentLineId || "all"}
              onChange={(value) => setTreatmentLineId(value === "all" ? "" : value)}
              options={[
                { value: "all", label: t("production.common.all", "All") },
                ...lines.map((line) => ({ value: String(line.id), label: line.name })),
              ]}
            />
            <FilterSelect
              label={t("production.quality.source", "Source")}
              value={treatmentSource || "all"}
              onChange={(value) => setTreatmentSource(value === "all" ? "" : value)}
              options={[
                { value: "all", label: t("production.common.all", "All") },
                ...SOURCE_TYPES.map((source) => ({ value: source, label: source })),
              ]}
            />
            <DateFilter from={fromDate} to={toDate} onFromChange={setFromDate} onToChange={setToDate} />
            <label className="flex h-9 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={breachOnly}
                onChange={(event) => setBreachOnly(event.target.checked)}
                className="rounded border"
              />
              {t("production.quality.breach_only", "Out of spec only")}
            </label>
          </FilterBar>

          {treatmentLogsQuery.isError ? (
            <ProductionError error={treatmentLogsQuery.error} />
          ) : treatmentLogsQuery.isLoading ? (
            <LoadingRow label={t("production.common.loading", "Loading...")} />
          ) : treatmentLogs.length === 0 ? (
            <EmptyRow label={t("production.quality.no_readings", "No treatment readings logged yet.")} />
          ) : (
            <div className="space-y-3">
              {treatmentLogs.map((log) => (
                <TreatmentCard
                  key={log.id}
                  log={log}
                  parameters={parameters}
                  canEdit={canEditTreatment}
                  canDelete={canDelete}
                  onInspect={() => setInspectTreatmentId(log.id)}
                  onEdit={() => {
                    setEditingTreatment(log);
                    setTreatmentForm(treatmentToForm(log, parameters));
                  }}
                  onDelete={() => setDeleteTreatment(log)}
                  t={t}
                />
              ))}
              <PaginationBar
                page={treatmentPage}
                total={treatmentLogsQuery.data?.meta?.total ?? 0}
                pageSize={PAGE_SIZE}
                onPageChange={setTreatmentPage}
              />
            </div>
          )}
        </>
      ) : (
        <>
          <FilterBar
            filtersActive={sanitationFiltersActive}
            onClear={clearSanitationFilters}
            search={
              <Input
                className="h-9 w-48"
                placeholder={t("production.quality.search_sanitation", "Search chemical or notes...")}
                value={sanitationSearch}
                onChange={(event) => setSanitationSearch(event.target.value)}
              />
            }
          >
            <FilterSelect
              label={t("production.common.line", "Line")}
              value={sanitationLineId || "all"}
              onChange={(value) => setSanitationLineId(value === "all" ? "" : value)}
              options={[
                { value: "all", label: t("production.common.all", "All") },
                ...lines.map((line) => ({ value: String(line.id), label: line.name })),
              ]}
            />
            <FilterSelect
              label={t("production.quality.cip_type", "CIP type")}
              value={cipTypeFilter || "all"}
              onChange={(value) => setCipTypeFilter(value === "all" ? "" : value)}
              options={[
                { value: "all", label: t("production.common.all", "All") },
                ...CIP_TYPES.map((type) => ({ value: type, label: type.replace(/_/g, " ") })),
              ]}
            />
            <FilterSelect
              label={t("production.quality.rinse_result", "Final rinse")}
              value={rinseFilter}
              onChange={(value) => setRinseFilter(value as SanitationRinseFilter)}
              options={[
                { value: "all", label: t("production.common.all", "All") },
                { value: "pending", label: t("production.quality.pending", "Pending") },
                { value: "pass", label: t("production.quality.pass", "Pass") },
                { value: "fail", label: t("production.quality.fail", "Fail") },
              ]}
            />
            <DateFilter from={fromDate} to={toDate} onFromChange={setFromDate} onToChange={setToDate} />
            <label className="flex h-9 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pendingOnly}
                onChange={(event) => setPendingOnly(event.target.checked)}
                className="rounded border"
              />
              {t("production.quality.pending_only", "Awaiting sign-off")}
            </label>
          </FilterBar>

          {sanitationLogsQuery.isError ? (
            <ProductionError error={sanitationLogsQuery.error} />
          ) : sanitationLogsQuery.isLoading ? (
            <LoadingRow label={t("production.common.loading", "Loading...")} />
          ) : sanitationLogs.length === 0 ? (
            <EmptyRow label={t("production.quality.no_cip", "No sanitation records logged yet.")} />
          ) : (
            <div className="space-y-3">
              {sanitationLogs.map((log) => (
                <SanitationCard
                  key={log.id}
                  log={log}
                  canVerify={canVerify}
                  canEdit={canEditSanitation}
                  canDelete={canDelete}
                  onInspect={() => setInspectSanitationId(log.id)}
                  onVerify={() => {
                    setVerifyLog(log);
                    setVerifyResult("pass");
                    setVerifyConductivity(
                      log.final_rinse_conductivity_us ? String(log.final_rinse_conductivity_us) : "",
                    );
                    setVerifyNotes("");
                  }}
                  onEdit={() => {
                    setEditingSanitation(log);
                    setSanitationForm(sanitationToForm(log));
                  }}
                  onDelete={() => setDeleteSanitation(log)}
                  t={t}
                />
              ))}
              <PaginationBar
                page={sanitationPage}
                total={sanitationLogsQuery.data?.meta?.total ?? 0}
                pageSize={PAGE_SIZE}
                onPageChange={setSanitationPage}
              />
            </div>
          )}
        </>
      )}

      <TreatmentFormDialog
        open={treatmentOpen || editingTreatment !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTreatmentOpen(false);
            setEditingTreatment(null);
            setTreatmentForm(emptyTreatmentForm());
          }
        }}
        title={
          editingTreatment
            ? t("production.quality.edit_reading", "Edit treatment reading")
            : t("production.quality.reading_title", "Log treatment reading")
        }
        description={t(
          "production.quality.reading_desc",
          "The pass/warning/fail verdict is graded on the server against the specification — an out-of-limit reading cannot be filed as a pass.",
        )}
        form={treatmentForm}
        setForm={setTreatmentForm}
        parameters={parameters}
        lines={lines}
        orders={orders}
        orderSearch={orderSearch}
        setOrderSearch={setOrderSearch}
        busy={createTreatmentMutation.isPending || updateTreatmentMutation.isPending}
        submitLabel={editingTreatment ? t("production.common.save", "Save") : t("production.quality.save_reading", "Save reading")}
        onSubmit={() => {
          if (editingTreatment) updateTreatmentMutation.mutate();
          else createTreatmentMutation.mutate();
        }}
      />

      <SanitationFormDialog
        open={sanitationOpen || editingSanitation !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSanitationOpen(false);
            setEditingSanitation(null);
            setSanitationForm(emptySanitationForm());
          }
        }}
        title={
          editingSanitation
            ? t("production.quality.edit_cip", "Edit CIP record")
            : t("production.quality.cip_title", "Log CIP / sanitation")
        }
        description={t(
          "production.quality.cip_desc",
          "The final rinse is verified by a second person, which is the point of the verification step.",
        )}
        form={sanitationForm}
        setForm={setSanitationForm}
        lines={lines}
        orders={orders}
        orderSearch={orderSearch}
        setOrderSearch={setOrderSearch}
        busy={createSanitationMutation.isPending || updateSanitationMutation.isPending}
        submitLabel={editingSanitation ? t("production.common.save", "Save") : t("production.quality.save_cip", "Save record")}
        onSubmit={() => {
          if (!sanitationForm.started_at) {
            toast.error(t("production.quality.cip_required", "A start time is required."));
            return;
          }
          if (editingSanitation) updateSanitationMutation.mutate();
          else createSanitationMutation.mutate();
        }}
      />

      <Dialog open={inspectTreatmentId !== null} onOpenChange={(open) => !open && setInspectTreatmentId(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("production.quality.inspect_reading", "Treatment reading")}</DialogTitle>
            <DialogDescription>
              {inspectTreatment ? new Date(inspectTreatment.logged_at).toLocaleString() : ""}
            </DialogDescription>
          </DialogHeader>
          {treatmentDetailQuery.isLoading ? (
            <LoadingRow label={t("production.common.loading", "Loading...")} />
          ) : inspectTreatment ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <TreatmentStatusBadge status={inspectTreatment.status} />
                {inspectTreatment.logged_by ? (
                  <span className="text-xs text-muted-foreground">
                    {t("production.quality.logged_by", "Logged by")}{" "}
                    {typeof inspectTreatment.logged_by === "object"
                      ? (inspectTreatment.logged_by as { name?: string }).name
                      : inspectTreatment.logged_by}
                  </span>
                ) : null}
              </div>
              <ParameterGrid log={inspectTreatment} parameters={parameters} t={t} showBreaches />
              {inspectTreatment.production_order_id ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/production/orders?order_id=${inspectTreatment.production_order_id}`}>
                    <ScrollText className="mr-1 h-3.5 w-3.5" />
                    {t("production.runs.view_order", "Work order")}
                  </Link>
                </Button>
              ) : null}
              <DialogFooter className="gap-2 sm:justify-between">
                <div />
                <div className="flex gap-2">
                  {canEditTreatment ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingTreatment(inspectTreatment);
                        setTreatmentForm(treatmentToForm(inspectTreatment, parameters));
                      }}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      {t("production.common.edit", "Edit")}
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button size="sm" variant="destructive" onClick={() => setDeleteTreatment(inspectTreatment)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      {t("production.common.delete", "Delete")}
                    </Button>
                  ) : null}
                </div>
              </DialogFooter>
            </>
          ) : (
            <ProductionError error={treatmentDetailQuery.error} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={inspectSanitationId !== null} onOpenChange={(open) => !open && setInspectSanitationId(null)}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("production.quality.inspect_cip", "CIP record")}</DialogTitle>
            <DialogDescription className="capitalize">
              {inspectSanitation?.cip_type.replace(/_/g, " ")}
            </DialogDescription>
          </DialogHeader>
          {sanitationDetailQuery.isLoading ? (
            <LoadingRow label={t("production.common.loading", "Loading...")} />
          ) : inspectSanitation ? (
            <>
              <RinseBadge result={inspectSanitation.final_rinse_result} />
              <SanitationDetails log={inspectSanitation} t={t} />
              {inspectSanitation.verified_at ? (
                <p className="text-sm text-muted-foreground">
                  {t("production.quality.verified_at", "Verified")}{" "}
                  {new Date(inspectSanitation.verified_at).toLocaleString()}
                  {inspectSanitation.verified_by?.name ? ` · ${inspectSanitation.verified_by.name}` : ""}
                </p>
              ) : null}
              <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                <div className="flex gap-2">
                  {canVerify && !inspectSanitation.verified_at ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setVerifyLog(inspectSanitation);
                        setVerifyResult("pass");
                        setVerifyConductivity(
                          inspectSanitation.final_rinse_conductivity_us
                            ? String(inspectSanitation.final_rinse_conductivity_us)
                            : "",
                        );
                      }}
                    >
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                      {t("production.quality.verify", "Verify")}
                    </Button>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {canEditSanitation ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingSanitation(inspectSanitation);
                        setSanitationForm(sanitationToForm(inspectSanitation));
                      }}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      {t("production.common.edit", "Edit")}
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button size="sm" variant="destructive" onClick={() => setDeleteSanitation(inspectSanitation)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      {t("production.common.delete", "Delete")}
                    </Button>
                  ) : null}
                </div>
              </DialogFooter>
            </>
          ) : (
            <ProductionError error={sanitationDetailQuery.error} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={verifyLog !== null} onOpenChange={(open) => !open && setVerifyLog(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>{t("production.quality.verify_title", "Verify final rinse")}</DialogTitle>
            <DialogDescription>
              {t(
                "production.quality.verify_desc",
                "Second-person sign-off on the CIP final rinse result.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("production.quality.rinse_result", "Result")}</Label>
              <Select value={verifyResult} onValueChange={(value) => setVerifyResult(value as "pass" | "fail")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pass">{t("production.quality.verify_pass", "Pass")}</SelectItem>
                  <SelectItem value="fail">{t("production.quality.verify_fail", "Fail")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="verify-conductivity">
                {t("production.quality.rinse_conductivity", "Final rinse conductivity (µS)")}
              </Label>
              <Input
                id="verify-conductivity"
                type="number"
                step="0.01"
                value={verifyConductivity}
                onChange={(event) => setVerifyConductivity(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="verify-notes">{t("production.common.notes", "Notes")}</Label>
              <Input
                id="verify-notes"
                value={verifyNotes}
                onChange={(event) => setVerifyNotes(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyLog(null)}>
              {t("production.common.cancel", "Cancel")}
            </Button>
            <Button disabled={verifyMutation.isPending} onClick={() => verifyMutation.mutate()}>
              {verifyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("production.quality.confirm_verify", "Confirm sign-off")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTreatment !== null} onOpenChange={(open) => !open && setDeleteTreatment(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("production.quality.delete_reading_title", "Delete treatment reading?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("production.quality.delete_reading_desc", "This removes the reading from compliance history for the period.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("production.common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTreatmentMutation.mutate()}
            >
              {t("production.common.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteSanitation !== null} onOpenChange={(open) => !open && setDeleteSanitation(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("production.quality.delete_cip_title", "Delete CIP record?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("production.quality.delete_cip_desc", "This removes the sanitation record and any verification on it.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("production.common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteSanitationMutation.mutate()}
            >
              {t("production.common.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProductionShell>
  );
}

function TreatmentCard({
  log,
  parameters,
  canEdit,
  canDelete,
  onInspect,
  onEdit,
  onDelete,
  t,
}: {
  log: WaterTreatmentLog;
  parameters: WaterTreatmentParameter[];
  canEdit: boolean;
  canDelete: boolean;
  onInspect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string, fallback: string) => string;
}) {
  return (
    <article className="rounded-2xl border border-border/60 bg-card p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <button type="button" className="text-left hover:underline" onClick={onInspect}>
          <p className="text-sm font-bold">{new Date(log.logged_at).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">
            {log.source_type}
            {log.source_reference ? ` · ${log.source_reference}` : ""}
            {log.line ? ` · ${log.line.name}` : ""}
          </p>
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <TreatmentStatusBadge status={log.status} />
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onInspect}>
            <Eye className="h-3 w-3" />
          </Button>
          {canEdit ? (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onEdit}>
              <Pencil className="h-3 w-3" />
            </Button>
          ) : null}
          {canDelete ? (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          ) : null}
        </div>
      </header>
      <ParameterGrid log={log} parameters={parameters} t={t} showBreaches />
    </article>
  );
}

function SanitationCard({
  log,
  canVerify,
  canEdit,
  canDelete,
  onInspect,
  onVerify,
  onEdit,
  onDelete,
  t,
}: {
  log: SanitationLog;
  canVerify: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onInspect: () => void;
  onVerify: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string, fallback: string) => string;
}) {
  const needsVerify = !log.verified_at;

  return (
    <article className="rounded-2xl border border-border/60 bg-card p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <button type="button" className="text-left hover:underline" onClick={onInspect}>
          <p className="text-sm font-bold capitalize">{log.cip_type.replace(/_/g, " ")}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(log.started_at).toLocaleString()}
            {log.line ? ` · ${log.line.name}` : ""}
            {log.performed_by?.name ? ` · ${log.performed_by.name}` : ""}
          </p>
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <RinseBadge result={log.final_rinse_result} />
          {canVerify && needsVerify ? (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onVerify}>
              <ShieldCheck className="mr-1 h-3 w-3" />
              {t("production.quality.verify", "Verify")}
            </Button>
          ) : log.verified_by?.name ? (
            <span className="text-[11px] text-muted-foreground">
              {t("production.quality.verified_by", "Verified by")} {log.verified_by.name}
            </span>
          ) : null}
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onInspect}>
            <Eye className="h-3 w-3" />
          </Button>
          {canEdit ? (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onEdit}>
              <Pencil className="h-3 w-3" />
            </Button>
          ) : null}
          {canDelete ? (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          ) : null}
        </div>
      </header>
      <SanitationDetails log={log} t={t} />
    </article>
  );
}

function ParameterGrid({
  log,
  parameters,
  t,
  showBreaches,
}: {
  log: WaterTreatmentLog;
  parameters: WaterTreatmentParameter[];
  t: (key: string, fallback: string) => string;
  showBreaches: boolean;
}) {
  return (
    <>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {parameters.map((parameter) => {
          const value = (log as unknown as Record<string, unknown>)[parameter.field];
          if (value === null || value === undefined) return null;
          const breached = (log.breaches ?? []).some((breach) => breach.field === parameter.field);
          return (
            <div key={parameter.field}>
              <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">{parameter.label}</dt>
              <dd className={`text-sm font-bold tabular-nums ${breached ? "text-rose-600 dark:text-rose-400" : ""}`}>
                {Number(value).toLocaleString()} {parameter.unit}
                {breached ? (
                  <AlertTriangle className="ml-1 inline h-3 w-3" aria-label="out of specification" />
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>
      {showBreaches && (log.breaches ?? []).length > 0 ? (
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
              <span className="font-semibold">{t("production.quality.action", "Action")}:</span> {log.corrective_action}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function SanitationDetails({
  log,
  t,
}: {
  log: SanitationLog;
  t: (key: string, fallback: string) => string;
}) {
  return (
    <dl className="mt-3 grid gap-3 sm:grid-cols-4">
      <Detail label={t("production.quality.chemical", "Chemical")} value={log.chemical ?? "—"} />
      <Detail
        label={t("production.quality.concentration", "Concentration")}
        value={log.concentration_percent ? `${log.concentration_percent}%` : "—"}
      />
      <Detail
        label={t("production.quality.temperature", "Temperature")}
        value={log.temperature_c ? `${log.temperature_c} °C` : "—"}
      />
      <Detail
        label={t("production.quality.contact", "Contact")}
        value={log.contact_minutes ? `${log.contact_minutes} min` : "—"}
      />
    </dl>
  );
}

function RinseBadge({ result }: { result: string }) {
  return (
    <Badge
      variant="outline"
      className={`border-transparent text-[11px] font-black uppercase tracking-widest ${
        result === "pass"
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : result === "fail"
            ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
            : "bg-muted text-muted-foreground"
      }`}
    >
      {result}
    </Badge>
  );
}

function TreatmentFormDialog({
  open,
  onOpenChange,
  title,
  description,
  form,
  setForm,
  parameters,
  lines,
  orders,
  orderSearch,
  setOrderSearch,
  busy,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  form: TreatmentFormState;
  setForm: React.Dispatch<React.SetStateAction<TreatmentFormState>>;
  parameters: WaterTreatmentParameter[];
  lines: ProductionLine[];
  orders: ProductionOrder[];
  orderSearch: string;
  setOrderSearch: (value: string) => void;
  busy: boolean;
  submitLabel: string;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl rounded-[2rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="treatment-logged">{t("production.quality.logged_at", "Logged at")}</Label>
              <Input
                id="treatment-logged"
                type="datetime-local"
                value={String(form.logged_at ?? "")}
                onChange={(event) => setForm((prev) => ({ ...prev, logged_at: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("production.quality.source", "Source")}</Label>
              <Select
                value={String(form.source_type)}
                onValueChange={(value) => setForm((prev) => ({ ...prev, source_type: value }))}
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
              <Label htmlFor="treatment-ref">{t("production.quality.source_reference", "Source reference")}</Label>
              <Input
                id="treatment-ref"
                value={String(form.source_reference ?? "")}
                onChange={(event) => setForm((prev) => ({ ...prev, source_reference: event.target.value }))}
                placeholder="BH-02"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("production.common.line", "Line")}</Label>
              <Select
                value={String(form.production_line_id ?? "")}
                onValueChange={(value) => setForm((prev) => ({ ...prev, production_line_id: value }))}
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
            <div className="space-y-2 md:col-span-2">
              <Label>{t("production.runs.work_order", "Work order")}</Label>
              <Input
                value={orderSearch}
                onChange={(event) => setOrderSearch(event.target.value)}
                placeholder={t("production.runs.search_order", "Search open orders...")}
              />
              <Select
                value={String(form.production_order_id || "none")}
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
                  value={String(form[parameter.field] ?? "")}
                  onChange={(event) => setForm((prev) => ({ ...prev, [parameter.field]: event.target.value }))}
                  placeholder={parameter.unit}
                />
                <p className="text-[11px] text-muted-foreground">{parameterRangeLabel(parameter)}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={Boolean(form.backwash_performed)}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, backwash_performed: checked === true }))
                }
              />
              {t("production.quality.backwash", "Backwash performed")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={Boolean(form.filters_changed)}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, filters_changed: checked === true }))
                }
              />
              {t("production.quality.filters_changed", "Filters changed")}
            </label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="treatment-action">{t("production.quality.corrective_action", "Corrective action")}</Label>
            <Input
              id="treatment-action"
              value={String(form.corrective_action ?? "")}
              onChange={(event) => setForm((prev) => ({ ...prev, corrective_action: event.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("production.common.cancel", "Cancel")}
          </Button>
          <Button disabled={busy} onClick={onSubmit}>
            <BusyLabel busy={busy}>{submitLabel}</BusyLabel>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SanitationFormDialog({
  open,
  onOpenChange,
  title,
  description,
  form,
  setForm,
  lines,
  orders,
  orderSearch,
  setOrderSearch,
  busy,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  form: SanitationFormState;
  setForm: React.Dispatch<React.SetStateAction<SanitationFormState>>;
  lines: ProductionLine[];
  orders: ProductionOrder[];
  orderSearch: string;
  setOrderSearch: (value: string) => void;
  busy: boolean;
  submitLabel: string;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-[2rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("production.quality.cip_type", "CIP type")}</Label>
            <Select value={form.cip_type} onValueChange={(value) => setForm((prev) => ({ ...prev, cip_type: value }))}>
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
              value={form.production_line_id}
              onValueChange={(value) => setForm((prev) => ({ ...prev, production_line_id: value }))}
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
            <Label htmlFor="cip-start">{t("production.runs.started_at", "Started")}</Label>
            <Input
              id="cip-start"
              type="datetime-local"
              value={form.started_at}
              onChange={(event) => setForm((prev) => ({ ...prev, started_at: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cip-end">{t("production.runs.ended_at", "Ended")}</Label>
            <Input
              id="cip-end"
              type="datetime-local"
              value={form.ended_at}
              onChange={(event) => setForm((prev) => ({ ...prev, ended_at: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cip-chemical">{t("production.quality.chemical", "Chemical")}</Label>
            <Input
              id="cip-chemical"
              value={form.chemical}
              onChange={(event) => setForm((prev) => ({ ...prev, chemical: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cip-concentration">{t("production.quality.concentration", "Concentration (%)")}</Label>
            <Input
              id="cip-concentration"
              type="number"
              step="0.01"
              value={form.concentration_percent}
              onChange={(event) => setForm((prev) => ({ ...prev, concentration_percent: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cip-temp">{t("production.quality.temperature", "Temperature (°C)")}</Label>
            <Input
              id="cip-temp"
              type="number"
              step="0.1"
              value={form.temperature_c}
              onChange={(event) => setForm((prev) => ({ ...prev, temperature_c: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cip-contact">{t("production.quality.contact_minutes", "Contact time (min)")}</Label>
            <Input
              id="cip-contact"
              type="number"
              value={form.contact_minutes}
              onChange={(event) => setForm((prev) => ({ ...prev, contact_minutes: event.target.value }))}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="cip-notes">{t("production.common.notes", "Notes")}</Label>
            <Input
              id="cip-notes"
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
            <BusyLabel busy={busy}>{submitLabel}</BusyLabel>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterBar({
  children,
  search,
  filtersActive,
  onClear,
}: {
  children: React.ReactNode;
  search: React.ReactNode;
  filtersActive: boolean;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
      <div className="space-y-1">
        <Label className="text-xs">{t("production.common.search", "Search")}</Label>
        {search}
      </div>
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
        <Label className="text-xs" htmlFor="quality-from">
          {t("production.common.from", "From")}
        </Label>
        <Input id="quality-from" type="date" className="h-9 w-[10rem]" value={from} onChange={(e) => onFromChange(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs" htmlFor="quality-to">
          {t("production.common.to", "To")}
        </Label>
        <Input id="quality-to" type="date" className="h-9 w-[10rem]" value={to} onChange={(e) => onToChange(e.target.value)} />
      </div>
    </>
  );
}

function PaginationBar({
  page,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useTranslation();
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
      <span>
        {total.toLocaleString()} {t("production.common.entries", "entries")}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          {t("production.common.prev", "Previous")}
        </Button>
        <span className="flex items-center tabular-nums">
          {page} / {lastPage}
        </span>
        <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>
          {t("production.common.next", "Next")}
        </Button>
      </div>
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
        active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
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
