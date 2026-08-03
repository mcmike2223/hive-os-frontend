"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  FolderOpen,
  GitPullRequestArrow,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Undo2,
  UserRoundCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { FileManagerClient } from "@/components/dashboard/file-manager-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PanelTableSkeleton } from "@/components/ui/loading-states";
import { usePermissions } from "@/hooks/use-permissions";
import { authenticatedDownload } from "@/lib/authenticated-download";
import {
  getAuthHeaders,
  getBackendApiRoot,
  getWorkspaceScopeKey,
} from "@/lib/runtime-context";
import {
  Employee,
  LeaveBalance,
  LeaveRequest,
  LeaveRequestPreview,
  LeaveType,
  Paginated,
  hrFetch,
} from "@/modules/humanresources/api";

type DraftAttachment = {
  id?: number;
  path?: string;
  name: string;
  mime_type?: string | null;
  size?: number | null;
};

type RequestForm = {
  employee_id: string;
  leave_type_id: string;
  starts_on: string;
  ends_on: string;
  segment_type: LeaveRequest["segment_type"];
  starts_at: string;
  ends_at: string;
  reason: string;
  delegate_employee_id: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  idempotency_key: string;
  attachments: DraftAttachment[];
};

const controlClass =
  "min-h-11 w-full min-w-0 border-slate-500 bg-background focus-visible:ring-2 focus-visible:ring-teal-700 dark:border-slate-400 dark:focus-visible:ring-amber-300";
const selectClass =
  "min-h-11 w-full min-w-0 rounded-md border border-slate-500 bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:border-slate-400 dark:focus-visible:ring-amber-300";
const today = () => new Date().toISOString().slice(0, 10);
const newIdempotencyKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `leave-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const statusPresentation: Record<string, { label: string; className: string }> =
  {
    draft: {
      label: "Draft",
      className:
        "border-slate-500 bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
    },
    submitted: {
      label: "Awaiting approval",
      className:
        "border-amber-700 bg-amber-100 text-amber-950 dark:border-amber-300 dark:bg-amber-950 dark:text-amber-100",
    },
    approved: {
      label: "Approved",
      className:
        "border-teal-700 bg-teal-100 text-teal-950 dark:border-teal-300 dark:bg-teal-950 dark:text-teal-100",
    },
    rejected: {
      label: "Rejected",
      className:
        "border-red-700 bg-red-100 text-red-950 dark:border-red-300 dark:bg-red-950 dark:text-red-100",
    },
    returned_for_correction: {
      label: "Needs correction",
      className:
        "border-orange-700 bg-orange-100 text-orange-950 dark:border-orange-300 dark:bg-orange-950 dark:text-orange-100",
    },
    withdrawn: {
      label: "Withdrawn",
      className:
        "border-slate-500 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    },
    cancellation_pending: {
      label: "Cancellation pending",
      className:
        "border-violet-700 bg-violet-100 text-violet-950 dark:border-violet-300 dark:bg-violet-950 dark:text-violet-100",
    },
    return_pending: {
      label: "Early return pending",
      className:
        "border-sky-700 bg-sky-100 text-sky-950 dark:border-sky-300 dark:bg-sky-950 dark:text-sky-100",
    },
    cancelled: {
      label: "Cancelled",
      className:
        "border-slate-600 bg-slate-200 text-slate-950 dark:bg-slate-700 dark:text-slate-100",
    },
    in_progress: {
      label: "In progress",
      className:
        "border-blue-700 bg-blue-100 text-blue-950 dark:border-blue-300 dark:bg-blue-950 dark:text-blue-100",
    },
    completed: {
      label: "Completed",
      className:
        "border-emerald-700 bg-emerald-100 text-emerald-950 dark:border-emerald-300 dark:bg-emerald-950 dark:text-emerald-100",
    },
  };

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(parsed);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(parsed);
}

function formatFileSize(value?: number | null) {
  if (!value) return "Size unavailable";
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function leaveHasPendingApprovers(request: {
  status: string;
  workflow_run_id?: string | null;
  workflow_status?: string | null;
  approvals?: Array<{ status: string }> | null;
}): boolean {
  if (request.status !== "submitted") return false;
  if (request.workflow_status === "pending") return true;
  if (request.workflow_run_id) return true;
  return Boolean(
    request.approvals?.some((approval) => approval.status === "pending"),
  );
}

function presentLeaveStatus(request: {
  status: string;
  workflow_run_id?: string | null;
  workflow_status?: string | null;
  approvals?: Array<{ status: string }> | null;
}): { label: string; className: string } {
  if (
    request.status === "submitted" &&
    !leaveHasPendingApprovers(request)
  ) {
    return {
      label: "Submitted — no approver",
      className:
        "border-orange-700 bg-orange-100 text-orange-950 dark:border-orange-300 dark:bg-orange-950 dark:text-orange-100",
    };
  }

  return (
    statusPresentation[request.status] ?? {
      label: request.status.replaceAll("_", " "),
      className:
        "border-slate-500 bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
    }
  );
}

function StatusBadge({
  status,
  request,
}: {
  status: string;
  request?: {
    status: string;
    workflow_run_id?: string | null;
    workflow_status?: string | null;
    approvals?: Array<{ status: string }> | null;
  };
}) {
  const presentation = presentLeaveStatus(
    request ?? { status, workflow_run_id: null, workflow_status: null, approvals: [] },
  );
  return (
    <Badge
      variant="outline"
      className={`rounded-md px-2.5 py-1 font-bold ${presentation.className}`}
    >
      {presentation.label}
    </Badge>
  );
}

function ErrorSummary({
  message,
  id = "leave-request-error",
}: {
  message: string;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), [message]);
  return (
    <div
      ref={ref}
      id={id}
      role="alert"
      tabIndex={-1}
      className="rounded-lg border border-red-700 bg-red-50 p-3 text-sm font-semibold text-red-900 outline-none focus-visible:ring-2 focus-visible:ring-red-700 dark:border-red-300 dark:bg-red-950 dark:text-red-100"
    >
      {message}
    </div>
  );
}

function Field({
  id,
  label,
  required,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id} className="font-bold">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </Label>
      {children}
      {hint ? (
        <p
          id={`${id}-hint`}
          className="text-xs leading-5 text-slate-600 dark:text-slate-300"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function ReadinessPanel({
  preview,
  loading,
  idle,
  error,
}: {
  preview?: LeaveRequestPreview;
  loading: boolean;
  idle?: boolean;
  error?: string;
}) {
  const checks = [
    {
      label: "Dates and schedule",
      ready: Boolean(preview?.segments.length),
      detail: preview
        ? `${preview.chargeable_days} chargeable day${preview.chargeable_days === 1 ? "" : "s"}`
        : "Choose first and last dates",
    },
    {
      label: "Policy and balance",
      ready: Boolean(
        preview?.segments.length &&
          !(preview.blocking_reasons ?? []).some(
            (reason) =>
              !/workflow|approver|approval workflow/i.test(reason),
          ),
      ),
      detail: !preview
        ? "Waiting for leave details"
        : preview.balance_after == null
          ? "No tracked balance"
          : `${preview.balance_after} days after request`,
    },
    {
      label: "Supporting documents",
      ready: preview
        ? !preview.requires_document ||
          preview.supporting_documents_received > 0
        : false,
      detail: !preview
        ? "Checked after dates are set"
        : preview.requires_document
          ? `${preview.supporting_documents_received} attached`
          : "Not required",
    },
    {
      label: "Approval route",
      ready: Boolean(
        preview &&
          preview.workflow.configured &&
          !preview.workflow.configuration_error &&
          (preview.workflow.approver_count ?? 0) > 0,
      ),
      detail: !preview
        ? "Checked after dates are set"
        : preview.workflow.configuration_error
          ? preview.workflow.configuration_error
          : preview.workflow.configured
            ? `${preview.workflow.approver_count ?? 0} approver${preview.workflow.approver_count === 1 ? "" : "s"}`
            : "Configure a leave approval workflow before submitting",
    },
  ];

  return (
    <aside
      aria-labelledby="leave-readiness-heading"
      className="rounded-2xl border border-slate-500 bg-slate-950 p-5 text-slate-50 shadow-lg dark:border-slate-400"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
            Live check
          </p>
          <h3 id="leave-readiness-heading" className="mt-1 text-xl font-black">
            Request readiness
          </h3>
        </div>
        {loading ? (
          <Loader2
            aria-label="Calculating request"
            className="h-5 w-5 animate-spin"
          />
        ) : preview?.is_submittable ? (
          <CheckCircle2
            aria-label="Ready to submit"
            className="h-6 w-6 text-teal-300"
          />
        ) : (
          <ShieldCheck aria-hidden="true" className="h-6 w-6 text-amber-300" />
        )}
      </div>
      {idle ? (
        <p className="mt-5 rounded-lg border border-slate-600 bg-slate-900 p-3 text-sm text-slate-200">
          Fill in leave type and dates to run the readiness check. It updates a
          moment after you stop editing those fields.
        </p>
      ) : null}
      <ol className="mt-5 space-y-3">
        {checks.map((check, index) => (
          <li key={check.label} className="flex gap-3">
            <span
              className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-black ${
                check.ready
                  ? "border-teal-300 bg-teal-300 text-slate-950"
                  : "border-slate-500 text-slate-300"
              }`}
            >
              {check.ready ? (
                <Check aria-hidden="true" className="h-3.5 w-3.5" />
              ) : (
                index + 1
              )}
            </span>
            <span>
              <span className="block text-sm font-bold">{check.label}</span>
              <span className="block text-xs text-slate-300">
                {check.detail}
              </span>
            </span>
          </li>
        ))}
      </ol>
      {preview ? (
        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-700 pt-4">
          <div>
            <dt className="text-xs text-slate-300">Paid</dt>
            <dd className="text-lg font-black">{preview.paid_days} days</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-300">Unpaid</dt>
            <dd className="text-lg font-black">{preview.unpaid_days} days</dd>
          </div>
        </dl>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg border border-red-300 bg-red-950 p-3 text-sm text-red-100">
          {error}
        </p>
      ) : null}
      {preview?.blocking_reasons.length ? (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-950 p-3">
          <p className="text-sm font-black">Resolve before submitting</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-100">
            {preview.blocking_reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {preview?.warnings.length ? (
        <ul className="mt-4 space-y-2 text-xs text-amber-100">
          {preview.warnings.map((warning) => (
            <li key={warning} className="flex gap-2">
              <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}

function emptyForm(
  types: LeaveType[],
  employees: Employee[],
  canManage: boolean,
): RequestForm {
  return {
    employee_id: canManage ? String(employees[0]?.id ?? "") : "",
    leave_type_id: String(types[0]?.id ?? ""),
    starts_on: "",
    ends_on: "",
    segment_type: "full_day",
    starts_at: "09:00",
    ends_at: "11:00",
    reason: "",
    delegate_employee_id: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    idempotency_key: newIdempotencyKey(),
    attachments: [],
  };
}

function RequestComposer({
  open,
  onOpenChange,
  request,
  types,
  employees,
  canManage,
  canBrowseFiles,
  canManageFiles,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: LeaveRequest | null;
  types: LeaveType[];
  employees: Employee[];
  canManage: boolean;
  canBrowseFiles: boolean;
  canManageFiles: boolean;
  onSaved: (request: LeaveRequest) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<RequestForm>(() =>
    emptyForm(types, employees, canManage),
  );

  useEffect(() => {
    if (!open) return;
    setPickerOpen(false);
    setError("");
    setForm(
      request
        ? {
            employee_id: String(request.employee_id ?? ""),
            leave_type_id: String(request.leave_type_id),
            starts_on: request.starts_on,
            ends_on: request.ends_on,
            segment_type: request.segment_type,
            starts_at: request.starts_at?.slice(0, 5) ?? "",
            ends_at: request.ends_at?.slice(0, 5) ?? "",
            reason: request.reason ?? "",
            delegate_employee_id: String(request.delegate_employee_id ?? ""),
            emergency_contact_name: request.emergency_contact_name ?? "",
            emergency_contact_phone: request.emergency_contact_phone ?? "",
            idempotency_key: newIdempotencyKey(),
            attachments:
              request.attachments?.map((attachment) => ({
                id: attachment.id,
                name: attachment.original_name,
                mime_type: attachment.mime_type,
                size: attachment.size,
              })) ?? [],
          }
        : emptyForm(types, employees, canManage),
    );
  }, [canManage, employees, open, request, types]);

  const payload = useMemo(
    () => ({
      employee_id:
        canManage && form.employee_id ? Number(form.employee_id) : undefined,
      leave_type_id: form.leave_type_id
        ? Number(form.leave_type_id)
        : undefined,
      starts_on: form.starts_on,
      ends_on: ["first_half", "second_half", "hourly"].includes(
        form.segment_type,
      )
        ? form.starts_on
        : form.ends_on,
      segment_type: form.segment_type,
      starts_at: form.segment_type === "hourly" ? form.starts_at : null,
      ends_at: form.segment_type === "hourly" ? form.ends_at : null,
      reason: form.reason || null,
      delegate_employee_id: form.delegate_employee_id
        ? Number(form.delegate_employee_id)
        : null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      idempotency_key: request ? undefined : form.idempotency_key,
      attachments: form.attachments.map((attachment) =>
        attachment.id
          ? { id: attachment.id }
          : {
              path: attachment.path,
              name: attachment.name,
              mime_type: attachment.mime_type,
              size: attachment.size,
            },
      ),
    }),
    [canManage, form, request],
  );

  // Only fields that affect balance/policy/docs — ignore reason/contacts keystrokes.
  const previewRequest = useMemo(
    () => ({
      employee_id: payload.employee_id,
      leave_type_id: payload.leave_type_id,
      starts_on: payload.starts_on,
      ends_on: payload.ends_on,
      segment_type: payload.segment_type,
      starts_at: payload.starts_at,
      ends_at: payload.ends_at,
      attachments: payload.attachments,
    }),
    [
      payload.attachments,
      payload.employee_id,
      payload.ends_at,
      payload.ends_on,
      payload.leave_type_id,
      payload.segment_type,
      payload.starts_at,
      payload.starts_on,
    ],
  );

  const [debouncedPreviewRequest, setDebouncedPreviewRequest] =
    useState(previewRequest);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedPreviewRequest(previewRequest);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [previewRequest]);

  const canPreview =
    open &&
    Boolean(debouncedPreviewRequest.leave_type_id) &&
    Boolean(debouncedPreviewRequest.starts_on) &&
    Boolean(debouncedPreviewRequest.ends_on) &&
    (!canManage || Boolean(debouncedPreviewRequest.employee_id)) &&
    (debouncedPreviewRequest.segment_type !== "hourly" ||
      (Boolean(debouncedPreviewRequest.starts_at) &&
        Boolean(debouncedPreviewRequest.ends_at)));

  const preview = useQuery({
    queryKey: ["hr-leave-preview", debouncedPreviewRequest],
    queryFn: () =>
      hrFetch<{ data: LeaveRequestPreview }>("/leave/requests/preview", {
        method: "POST",
        body: JSON.stringify(debouncedPreviewRequest),
      }),
    enabled: canPreview,
    retry: false,
    staleTime: 15_000,
  });

  const save = useMutation({
    mutationFn: async (action: "draft" | "submit") => {
      if (request) {
        const updated = await hrFetch<{ data: LeaveRequest }>(
          `/leave/requests/${request.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ ...payload, action: "draft" }),
          },
        );
        if (action === "draft") return { ...updated, workflowConfigured: false };
        const submitted = await hrFetch<{
          data: LeaveRequest;
          workflow?: { configured?: boolean; status?: string };
        }>(`/leave/requests/${request.id}/submit`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        return {
          ...submitted,
          workflowConfigured: Boolean(submitted.workflow?.configured),
        };
      }
      const created = await hrFetch<{
        data: LeaveRequest;
        workflow?: { configured?: boolean; status?: string };
      }>("/leave/requests", {
        method: "POST",
        body: JSON.stringify({ ...payload, action }),
      });
      return {
        ...created,
        workflowConfigured: Boolean(created.workflow?.configured),
      };
    },
    onSuccess: (result, action) => {
      toast.success(
        action === "draft"
          ? "Leave request saved as a draft."
          : "Leave request sent for approval.",
      );
      onSaved(result.data);
      onOpenChange(false);
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "The leave request could not be saved.",
      ),
  });

  const workflowConfigured = Boolean(
    preview.data?.data.workflow.configured &&
      !preview.data?.data.workflow.configuration_error &&
      (preview.data?.data.workflow.approver_count ?? 0) > 0,
  );
  const canSendForApproval = Boolean(
    canPreview && preview.data?.data.is_submittable && workflowConfigured,
  );

  const previewError =
    preview.error instanceof Error ? preview.error.message : undefined;
  const describedBy = error ? "leave-request-error" : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!save.isPending) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="flex h-[min(94vh,920px)] w-[min(96vw,72rem)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        {pickerOpen ? (
          <>
            <div className="flex items-start gap-3 border-b border-slate-300 px-6 py-4 dark:border-slate-700">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPickerOpen(false)}
                aria-label="Back to leave request"
                className="shrink-0"
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
              <div>
                <DialogTitle>Select a supporting document</DialogTitle>
                <DialogDescription>
                  Choose a PDF, image, Word, or Excel file that you own in File
                  Manager.
                </DialogDescription>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden p-3">
              <FileManagerClient
                isPickerMode
                acceptedFileTypes=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                acceptedFileDescription="PDF, image, Word, or Excel files"
                access={{
                  canRead: canBrowseFiles,
                  canManage: canManageFiles,
                }}
                onFileSelect={(file) => {
                  const media = file.media_details;
                  const path = media?.url || file.url || file.path || "";
                  const name =
                    media?.download_name ||
                    media?.name ||
                    `Document ${file.id}`;
                  if (!path) {
                    toast.error("The selected file has no secure media path.");
                    return;
                  }
                  setForm((current) => ({
                    ...current,
                    attachments: [
                      ...current.attachments,
                      {
                        path,
                        name,
                        mime_type: media?.mime_type ?? null,
                        size: media?.size ?? null,
                      },
                    ].slice(0, 10),
                  }));
                  setPickerOpen(false);
                  toast.success(`${name} attached.`);
                }}
              />
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="border-b border-slate-300 px-6 py-5 text-left dark:border-slate-700">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-800 text-white dark:bg-teal-300 dark:text-slate-950">
                  <CalendarDays aria-hidden="true" />
                </span>
                <div>
                  <DialogTitle className="text-2xl font-black">
                    {request ? "Update leave request" : "Plan a leave request"}
                  </DialogTitle>
                  <DialogDescription>
                    See the exact balance, policy result, and approval route
                    before you send anything.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.75fr)]">
              <form
                id="leave-request-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setError("");
                  save.mutate("submit");
                }}
                className="grid min-h-0 content-start gap-5 overflow-y-auto p-6 md:grid-cols-2"
              >
                {error ? (
                  <div className="md:col-span-2">
                    <ErrorSummary message={error} />
                  </div>
                ) : null}

                {canManage ? (
                  <div className="md:col-span-2">
                    <Field id="leave-employee" label="Employee" required>
                      <select
                        id="leave-employee"
                        value={form.employee_id}
                        onChange={(event) =>
                          setForm({ ...form, employee_id: event.target.value })
                        }
                        required
                        aria-describedby={describedBy}
                        className={selectClass}
                      >
                        <option value="">Select an employee</option>
                        {employees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.primary_name} · {employee.employee_number}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                ) : null}

                <Field id="leave-type" label="Leave type" required>
                  <select
                    id="leave-type"
                    value={form.leave_type_id}
                    onChange={(event) =>
                      setForm({ ...form, leave_type_id: event.target.value })
                    }
                    required
                    aria-describedby={describedBy}
                    className={selectClass}
                  >
                    <option value="">Select a leave type</option>
                    {types.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field id="leave-segment" label="Duration" required>
                  <select
                    id="leave-segment"
                    value={form.segment_type}
                    onChange={(event) => {
                      const segment = event.target
                        .value as LeaveRequest["segment_type"];
                      setForm({
                        ...form,
                        segment_type: segment,
                        ends_on: [
                          "first_half",
                          "second_half",
                          "hourly",
                        ].includes(segment)
                          ? form.starts_on
                          : form.ends_on,
                      });
                    }}
                    className={selectClass}
                  >
                    <option value="full_day">One full day</option>
                    <option value="multi_day">Several days</option>
                    <option value="first_half">First half of a day</option>
                    <option value="second_half">Second half of a day</option>
                    <option value="hourly">A few hours</option>
                  </select>
                </Field>

                <Field id="leave-start" label="First date" required>
                  <Input
                    id="leave-start"
                    type="date"
                    value={form.starts_on}
                    onChange={(event) => {
                      const start = event.target.value;
                      setForm({
                        ...form,
                        starts_on: start,
                        ends_on:
                          form.ends_on < start ||
                          ["first_half", "second_half", "hourly"].includes(
                            form.segment_type,
                          )
                            ? start
                            : form.ends_on,
                      });
                    }}
                    required
                    aria-describedby={describedBy}
                    className={controlClass}
                  />
                </Field>

                <Field id="leave-end" label="Last date" required>
                  <Input
                    id="leave-end"
                    type="date"
                    min={form.starts_on}
                    value={form.ends_on}
                    onChange={(event) =>
                      setForm({ ...form, ends_on: event.target.value })
                    }
                    disabled={["first_half", "second_half", "hourly"].includes(
                      form.segment_type,
                    )}
                    required
                    aria-describedby={describedBy}
                    className={controlClass}
                  />
                </Field>

                {form.segment_type === "hourly" ? (
                  <>
                    <Field id="leave-start-time" label="From" required>
                      <Input
                        id="leave-start-time"
                        type="time"
                        value={form.starts_at}
                        onChange={(event) =>
                          setForm({ ...form, starts_at: event.target.value })
                        }
                        required
                        className={controlClass}
                      />
                    </Field>
                    <Field id="leave-end-time" label="Until" required>
                      <Input
                        id="leave-end-time"
                        type="time"
                        value={form.ends_at}
                        onChange={(event) =>
                          setForm({ ...form, ends_at: event.target.value })
                        }
                        required
                        className={controlClass}
                      />
                    </Field>
                  </>
                ) : null}

                <div className="md:col-span-2">
                  <Field
                    id="leave-reason"
                    label="Reason"
                    hint="Visible only to the employee and authorized reviewers."
                  >
                    <Textarea
                      id="leave-reason"
                      value={form.reason}
                      onChange={(event) =>
                        setForm({ ...form, reason: event.target.value })
                      }
                      rows={3}
                      maxLength={3000}
                      aria-describedby="leave-reason-hint"
                      className="border-slate-500 dark:border-slate-400"
                    />
                  </Field>
                </div>

                <Field id="leave-delegate" label="Work delegate">
                  <select
                    id="leave-delegate"
                    value={form.delegate_employee_id}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        delegate_employee_id: event.target.value,
                      })
                    }
                    className={selectClass}
                  >
                    <option value="">No delegate selected</option>
                    {employees
                      .filter(
                        (employee) => String(employee.id) !== form.employee_id,
                      )
                      .map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.primary_name}
                        </option>
                      ))}
                  </select>
                </Field>

                <Field id="leave-emergency-name" label="Emergency contact">
                  <Input
                    id="leave-emergency-name"
                    value={form.emergency_contact_name}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        emergency_contact_name: event.target.value,
                      })
                    }
                    maxLength={160}
                    className={controlClass}
                  />
                </Field>

                <Field id="leave-emergency-phone" label="Emergency phone">
                  <Input
                    id="leave-emergency-phone"
                    type="tel"
                    value={form.emergency_contact_phone}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        emergency_contact_phone: event.target.value,
                      })
                    }
                    maxLength={80}
                    className={controlClass}
                  />
                </Field>

                <div className="space-y-3 md:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">Supporting documents</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Up to 10 files, 20 MB each.
                      </p>
                    </div>
                    {canBrowseFiles ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPickerOpen(true)}
                        className="min-h-11 border-teal-700 text-teal-900 dark:border-teal-300 dark:text-teal-100"
                      >
                        <FolderOpen aria-hidden="true" />
                        Browse File Manager
                      </Button>
                    ) : null}
                  </div>
                  {form.attachments.length ? (
                    <ul className="grid gap-2">
                      {form.attachments.map((attachment, index) => (
                        <li
                          key={`${attachment.id ?? attachment.path}-${index}`}
                          className="flex items-center gap-3 rounded-lg border border-slate-400 p-3 dark:border-slate-600"
                        >
                          <FileText
                            aria-hidden="true"
                            className="h-5 w-5 shrink-0 text-teal-800 dark:text-teal-300"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold">
                              {attachment.name}
                            </span>
                            <span className="block text-xs text-slate-600 dark:text-slate-300">
                              {formatFileSize(attachment.size)}
                            </span>
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                attachments: current.attachments.filter(
                                  (_, attachmentIndex) =>
                                    attachmentIndex !== index,
                                ),
                              }))
                            }
                            aria-label={`Remove ${attachment.name}`}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-500 p-4 text-sm text-slate-600 dark:text-slate-300">
                      No document attached. The policy check will tell you when
                      one is required.
                    </p>
                  )}
                </div>
              </form>

              <div className="min-h-0 overflow-y-auto border-t border-slate-300 bg-slate-100 p-5 dark:border-slate-700 dark:bg-slate-900 lg:border-l lg:border-t-0">
                <div className="lg:sticky lg:top-0">
                  <ReadinessPanel
                    preview={canPreview ? preview.data?.data : undefined}
                    loading={canPreview && preview.isFetching}
                    idle={!canPreview}
                    error={canPreview ? previewError : undefined}
                  />
                  {canPreview && preview.data?.data.workflow.route?.length ? (
                    <div className="mt-4 rounded-xl border border-slate-400 bg-background p-4 dark:border-slate-600">
                      <p className="text-sm font-black">Approval route</p>
                      <ol className="mt-3 space-y-2">
                        {preview.data.data.workflow.route.map((step) => (
                          <li
                            key={`${step.type}-${step.id}-${step.sequence}`}
                            className="flex items-center gap-3 text-sm"
                          >
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-teal-800 text-xs font-black text-white dark:bg-teal-300 dark:text-slate-950">
                              {step.sequence}
                            </span>
                            <span>
                              <span className="block font-bold">
                                {step.label}
                              </span>
                              <span className="text-xs capitalize text-slate-600 dark:text-slate-300">
                                {step.type} approver
                              </span>
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-slate-300 px-6 py-4 dark:border-slate-700">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={save.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError("");
                  save.mutate("draft");
                }}
                disabled={save.isPending || !canPreview}
              >
                {save.isPending ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <FileCheck2 aria-hidden="true" />
                )}
                Save draft
              </Button>
              <Button
                type="submit"
                form="leave-request-form"
                disabled={
                  save.isPending ||
                  !canSendForApproval ||
                  preview.isFetching
                }
                className="bg-teal-800 text-white hover:bg-teal-700 dark:bg-teal-300 dark:text-slate-950 dark:hover:bg-teal-200"
              >
                {save.isPending ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <Send aria-hidden="true" />
                )}
                Send for approval
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChangeRequestDialog({
  mode,
  leaveRequest,
  onClose,
  onComplete,
}: {
  mode: "withdraw" | "cancel" | "return" | null;
  leaveRequest: LeaveRequest | null;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [reason, setReason] = useState("");
  const [returnOn, setReturnOn] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!mode) return;
    setReason("");
    setError("");
    setReturnOn(leaveRequest?.starts_on ?? today());
  }, [leaveRequest, mode]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!leaveRequest || !mode) throw new Error("No leave request selected.");
      const endpoint =
        mode === "withdraw"
          ? `/leave/requests/${leaveRequest.id}/withdraw`
          : mode === "cancel"
            ? `/leave/requests/${leaveRequest.id}/cancellation-requests`
            : `/leave/requests/${leaveRequest.id}/return-requests`;
      return hrFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          reason: reason || null,
          requested_return_on: mode === "return" ? returnOn : undefined,
        }),
      });
    },
    onSuccess: () => {
      toast.success(
        mode === "withdraw"
          ? "Leave request withdrawn."
          : mode === "cancel"
            ? "Cancellation sent for approval."
            : "Early return sent for approval.",
      );
      onComplete();
      onClose();
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "The request could not be completed.",
      ),
  });

  const title =
    mode === "withdraw"
      ? "Withdraw request"
      : mode === "cancel"
        ? "Request cancellation"
        : "Request early return";

  return (
    <Dialog open={Boolean(mode)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === "withdraw"
              ? "The reserved balance is released immediately. This action remains in the audit timeline."
              : "This change follows its own approval workflow before the leave balance is reversed."}
          </DialogDescription>
        </DialogHeader>
        <form
          id="leave-change-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            mutation.mutate();
          }}
        >
          {error ? (
            <ErrorSummary id="leave-change-error" message={error} />
          ) : null}
          {mode === "return" ? (
            <Field id="leave-return-on" label="Return to work on" required>
              <Input
                id="leave-return-on"
                type="date"
                min={leaveRequest?.starts_on}
                max={leaveRequest?.ends_on}
                value={returnOn}
                onChange={(event) => setReturnOn(event.target.value)}
                required
                className={controlClass}
              />
            </Field>
          ) : null}
          <Field
            id="leave-change-reason"
            label="Reason"
            required={mode === "cancel"}
          >
            <Textarea
              id="leave-change-reason"
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required={mode === "cancel"}
              maxLength={2000}
              className="border-slate-500 dark:border-slate-400"
            />
          </Field>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Keep request
          </Button>
          <Button
            type="submit"
            form="leave-change-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : mode === "withdraw" ? (
              <Undo2 aria-hidden="true" />
            ) : (
              <Send aria-hidden="true" />
            )}
            {title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestDetails({
  requestId,
  onClose,
  onEdit,
  onChange,
  onRefresh,
}: {
  requestId: number | null;
  onClose: () => void;
  onEdit: (request: LeaveRequest) => void;
  onChange: (
    mode: "withdraw" | "cancel" | "return",
    request: LeaveRequest,
  ) => void;
  onRefresh: () => void;
}) {
  const details = useQuery({
    queryKey: ["hr-leave-request", requestId],
    queryFn: () =>
      hrFetch<{ data: LeaveRequest }>(`/leave/requests/${requestId}`),
    enabled: Boolean(requestId),
    refetchInterval: 8_000,
  });
  const request = details.data?.data;

  const submit = useMutation({
    mutationFn: () =>
      hrFetch<{
        data: LeaveRequest;
        workflow?: { configured?: boolean; status?: string };
      }>(`/leave/requests/${requestId}/submit`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      toast.success("Draft sent for approval.");
      details.refetch();
      onRefresh();
    },
    onError: (failure) =>
      toast.error(
        failure instanceof Error
          ? failure.message
          : "The draft could not be submitted.",
      ),
  });

  const canEdit = request
    ? ["draft", "returned_for_correction", "rejected"].includes(request.status)
    : false;
  const canWithdraw = request
    ? ["draft", "submitted", "returned_for_correction", "rejected"].includes(
        request.status,
      )
    : false;
  const canChangeApproved = request
    ? ["approved", "in_progress"].includes(request.status)
    : false;

  return (
    <Dialog
      open={Boolean(requestId)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-0">
        <DialogHeader className="border-b border-slate-300 px-6 py-5 text-left dark:border-slate-700">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-800 dark:text-teal-300">
                {request?.request_number ?? "Leave request"}
              </p>
              <DialogTitle className="mt-1 text-2xl font-black">
                {request?.employee?.primary_name ?? "Request details"}
              </DialogTitle>
              <DialogDescription>
                {request
                  ? `${request.leave_type.name} · ${formatDate(request.starts_on)} to ${formatDate(request.ends_on)}`
                  : "Loading the complete request history."}
              </DialogDescription>
            </div>
            {request ? <StatusBadge status={request.status} request={request} /> : null}
          </div>
        </DialogHeader>

        {details.isLoading ? (
          <div className="space-y-4 p-6" role="status" aria-label="Loading leave request">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-xl bg-muted/60" />
              ))}
            </div>
            <div className="h-32 w-full animate-pulse rounded-xl bg-muted/60" />
            <div className="h-40 w-full animate-pulse rounded-xl bg-muted/60" />
          </div>
        ) : details.isError || !request ? (
          <div className="p-6">
            <ErrorSummary
              message={
                details.error instanceof Error
                  ? details.error.message
                  : "The leave request could not be loaded."
              }
            />
          </div>
        ) : (
          <div className="space-y-6 p-6">
            <section
              aria-labelledby="leave-summary-heading"
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"
            >
              <h3 id="leave-summary-heading" className="sr-only">
                Request summary
              </h3>
              {[
                ["Chargeable", `${request.requested_days} days`],
                ["Hours", `${request.requested_hours ?? 0} hours`],
                ["Submitted", formatDateTime(request.submitted_at)],
                [
                  "Balance after",
                  request.calculation_snapshot?.balance_after == null
                    ? "Not tracked"
                    : `${request.calculation_snapshot.balance_after} days`,
                ],
                ...(request.status === "approved" || request.status === "rejected"
                  ? ([["Decided", formatDateTime(request.decided_at)]] as const)
                  : []),
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-400 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-900"
                >
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {label}
                  </p>
                  <p className="mt-1 font-black">{value}</p>
                </div>
              ))}
            </section>

            {request.reason ? (
              <section aria-labelledby="leave-reason-heading">
                <h3 id="leave-reason-heading" className="font-black">
                  Reason
                </h3>
                <p className="mt-2 rounded-xl border border-slate-400 p-4 text-sm leading-6 dark:border-slate-600">
                  {request.reason}
                </p>
              </section>
            ) : null}

            <section aria-labelledby="leave-workflow-heading">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 id="leave-workflow-heading" className="font-black">
                    Approval route
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {leaveHasPendingApprovers(request)
                      ? "Status refreshes automatically while an approval is pending."
                      : request.status === "approved"
                        ? "This leave request was approved through Workflow."
                        : request.status === "rejected"
                          ? "This leave request was rejected through Workflow."
                          : request.approvals?.length
                            ? "Approvers for this leave request."
                            : request.status === "submitted"
                              ? "This request has no approver assigned. Withdraw it, configure a leave approval workflow, then submit again."
                              : "Approval steps appear here when a leave workflow rule applies."}
                  </p>
                </div>
                {request.workflow_status === "pending" ? (
                  <Button asChild variant="outline">
                    <Link href="/dashboard/workflow/approvals">
                      <GitPullRequestArrow aria-hidden="true" />
                      Open Workflow inbox
                    </Link>
                  </Button>
                ) : null}
              </div>
              {request.approvals?.length ? (
                <ol className="mt-4 grid gap-3">
                  {request.approvals
                    .slice()
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((approval) => (
                      <li
                        key={approval.id}
                        className="flex items-start gap-3 rounded-xl border border-slate-400 p-4 dark:border-slate-600"
                      >
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-black ${
                            approval.status === "approved"
                              ? "bg-teal-800 text-white dark:bg-teal-300 dark:text-slate-950"
                              : approval.status === "rejected"
                                ? "bg-red-800 text-white dark:bg-red-300 dark:text-slate-950"
                                : "bg-amber-300 text-slate-950"
                          }`}
                        >
                          {approval.sequence}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-bold">
                              {approval.user?.name ??
                                approval.role?.name ??
                                "Assigned approver"}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-black uppercase tracking-wide ${
                                approval.status === "approved"
                                  ? "border-teal-700 bg-teal-50 text-teal-900 dark:border-teal-300 dark:bg-teal-950 dark:text-teal-100"
                                  : approval.status === "rejected"
                                    ? "border-red-700 bg-red-50 text-red-900 dark:border-red-300 dark:bg-red-950 dark:text-red-100"
                                    : "border-amber-700 bg-amber-50 text-amber-950 dark:border-amber-300 dark:bg-amber-950 dark:text-amber-100"
                              }`}
                            >
                              {approval.status}
                            </span>
                          </span>
                          <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">
                            {approval.actioned_at
                              ? `Actioned ${formatDateTime(approval.actioned_at)}`
                              : "Waiting for this approver"}
                          </span>
                          {approval.notes ? (
                            <span className="mt-1 block text-sm">
                              {approval.notes}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                </ol>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-slate-500 p-4 text-sm text-slate-600 dark:text-slate-300">
                  {request.status === "submitted"
                    ? "No approval steps were created. Withdraw this request, configure LeaveRequest → submit_for_approval in Workflow, then send it again."
                    : "This request has no approval steps."}
                </p>
              )}
            </section>

            {request.attachments?.length ? (
              <section aria-labelledby="leave-documents-heading">
                <h3 id="leave-documents-heading" className="font-black">
                  Supporting documents
                </h3>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {request.attachments.map((attachment) => (
                    <li
                      key={attachment.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-400 p-3 dark:border-slate-600"
                    >
                      <FileText
                        aria-hidden="true"
                        className="h-5 w-5 text-teal-800 dark:text-teal-300"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">
                          {attachment.original_name}
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-300">
                          {formatFileSize(attachment.size)}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Download ${attachment.original_name}`}
                        onClick={() =>
                          authenticatedDownload(
                            `${getBackendApiRoot()}/hr/leave/attachments/${attachment.id}/download`,
                            {
                              filename: attachment.original_name,
                              headers: getAuthHeaders(),
                            },
                          ).catch((failure) =>
                            toast.error(
                              failure instanceof Error
                                ? failure.message
                                : "The document could not be downloaded.",
                            ),
                          )
                        }
                      >
                        <Download aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="leave-timeline-heading">
              <h3 id="leave-timeline-heading" className="font-black">
                Audit timeline
              </h3>
              <ol className="relative mt-4 space-y-4 border-l-2 border-slate-400 pl-6 dark:border-slate-600">
                {request.lifecycle_events?.length ? (
                  request.lifecycle_events.map((event) => (
                    <li key={event.id} className="relative">
                      <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-background bg-teal-700 dark:bg-teal-300" />
                      <p className="font-bold capitalize">
                        {event.event_type.replaceAll("_", " ")}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {formatDateTime(event.occurred_at)}
                        {event.from_status && event.to_status
                          ? ` · ${event.from_status.replaceAll("_", " ")} → ${event.to_status.replaceAll("_", " ")}`
                          : ""}
                      </p>
                      {event.reason ? (
                        <p className="mt-1 text-sm">{event.reason}</p>
                      ) : null}
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-slate-600 dark:text-slate-300">
                    No lifecycle events have been recorded.
                  </li>
                )}
              </ol>
            </section>
          </div>
        )}

        {request ? (
          <DialogFooter className="border-t border-slate-300 px-6 py-4 dark:border-slate-700">
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => onEdit(request)}
              >
                <Pencil aria-hidden="true" />
                Edit
              </Button>
            ) : null}
            {request.status === "draft" ? (
              <Button
                type="button"
                onClick={() => submit.mutate()}
                disabled={submit.isPending}
              >
                {submit.isPending ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <Send aria-hidden="true" />
                )}
                Send for approval
              </Button>
            ) : null}
            {canWithdraw ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => onChange("withdraw", request)}
              >
                <Undo2 aria-hidden="true" />
                Withdraw
              </Button>
            ) : null}
            {canChangeApproved ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onChange("return", request)}
                >
                  <RotateCcw aria-hidden="true" />
                  Early return
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onChange("cancel", request)}
                  className="border-red-700 text-red-800 dark:border-red-300 dark:text-red-200"
                >
                  <X aria-hidden="true" />
                  Request cancellation
                </Button>
              </>
            ) : null}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function LeaveRequestWorkspace() {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const { hasAnyPermission, hasPermission, isLoaded } = usePermissions();
  const canRequest = hasAnyPermission([
    "request_leave",
    "manage_leave_requests",
  ]);
  const canManage = hasPermission("manage_leave_requests");
  const canApprove = hasPermission("approve_leave_requests");
  const canBrowseFiles = hasAnyPermission(["view_storage", "manage_storage"]);
  const canManageFiles = hasPermission("manage_storage");

  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveRequest | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [changeMode, setChangeMode] = useState<
    "withdraw" | "cancel" | "return" | null
  >(null);
  const [changeRequest, setChangeRequest] = useState<LeaveRequest | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const types = useQuery({
    queryKey: ["hr-leave-types", scope],
    queryFn: () => hrFetch<{ data: LeaveType[] }>("/leave/types"),
    enabled: isLoaded && canRequest,
  });
  const requests = useQuery({
    queryKey: ["hr-leave", scope, canManage],
    queryFn: () =>
      canManage
        ? hrFetch<Paginated<LeaveRequest>>("/leave/requests?per_page=100")
        : hrFetch<{ data: LeaveRequest[] }>("/leave/my-requests"),
    enabled: isLoaded && canRequest,
    refetchInterval: (query) => {
      const rows = (query.state.data as { data?: LeaveRequest[] } | undefined)
        ?.data;
      return rows?.some((row) =>
        ["submitted", "cancellation_pending", "return_pending"].includes(
          row.status,
        ),
      )
        ? 8_000
        : false;
    },
  });
  const balances = useQuery({
    queryKey: ["hr-leave-balances", scope],
    queryFn: () => hrFetch<{ data: LeaveBalance[] }>("/leave/balances"),
    enabled: isLoaded && canRequest,
  });
  const employees = useQuery({
    queryKey: ["hr-leave-employees", scope],
    queryFn: () => hrFetch<Paginated<Employee>>("/employees?per_page=100"),
    enabled: isLoaded && canRequest,
  });

  const requestRows = requests.data?.data ?? [];
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requestRows.filter((request) => {
      if (status !== "all" && request.status !== status) return false;
      if (!term) return true;
      return [
        request.request_number,
        request.employee?.primary_name,
        request.employee?.employee_number,
        request.leave_type.name,
      ].some((value) => value?.toLowerCase().includes(term));
    });
  }, [requestRows, search, status]);

  const pendingCount = requestRows.filter((request) =>
    ["submitted", "cancellation_pending", "return_pending"].includes(
      request.status,
    ),
  ).length;
  const currentBalance = balances.data?.data.reduce(
    (sum, balance) => sum + Number(balance.available_days),
    0,
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["hr-leave"] });
    queryClient.invalidateQueries({ queryKey: ["hr-leave-balances"] });
    if (selectedId) {
      queryClient.invalidateQueries({
        queryKey: ["hr-leave-request", selectedId],
      });
    }
  };

  if (isLoaded && !canRequest) {
    return (
      <Card className="border-slate-500 dark:border-slate-600">
        <CardContent className="p-8 text-center">
          <ShieldCheck
            aria-hidden="true"
            className="mx-auto h-10 w-10 text-slate-600 dark:text-slate-300"
          />
          <h2 className="mt-4 text-xl font-black">
            Leave access is restricted
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Ask an administrator for the request leave permission.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="leave-workspace-heading"
        className="relative overflow-hidden rounded-3xl border border-slate-500 bg-slate-950 p-6 text-white shadow-xl dark:border-slate-400 sm:p-8"
      >
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[36px] border-teal-400/15"
        />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">
              Employee journey
            </p>
            <h2
              id="leave-workspace-heading"
              className="mt-2 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl"
            >
              Plan it once. See every rule before you send.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Hive calculates schedules, holidays, entitlement, documents, and
              approvers in one place, then tracks the request through Workflow.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              setEditing(null);
              setComposerOpen(true);
            }}
            className="min-h-12 bg-amber-300 px-5 font-black text-slate-950 hover:bg-amber-200 focus-visible:ring-amber-300"
          >
            <Plus aria-hidden="true" />
            New leave request
          </Button>
        </div>
        <dl className="relative mt-7 grid gap-3 border-t border-slate-700 pt-5 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-300">Available entitlement</dt>
            <dd className="mt-1 text-2xl font-black">
              {balances.isLoading
                ? "…"
                : currentBalance == null
                  ? "Not linked"
                  : `${currentBalance} days`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-300">Waiting now</dt>
            <dd className="mt-1 text-2xl font-black">{pendingCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-300">Live connection</dt>
            <dd className="mt-1 flex items-center gap-2 text-sm font-bold text-teal-300">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-300" />
              Workflow and ledger synced
            </dd>
          </div>
        </dl>
      </section>

      {balances.data?.data.length ? (
        <section aria-labelledby="leave-balances-heading">
          <div>
            <h3 id="leave-balances-heading" className="text-lg font-black">
              Current balances
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Reserved amounts are already committed to pending requests.
            </p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {balances.data.data.map((balance) => (
              <Card
                key={balance.id}
                className="border-slate-400 bg-slate-50 dark:border-slate-600 dark:bg-slate-900"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{balance.leave_type.name}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {balance.balance_year}
                      </p>
                    </div>
                    <CalendarDays
                      aria-hidden="true"
                      className="text-teal-800 dark:text-teal-300"
                    />
                  </div>
                  <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-400 pt-4 text-center dark:border-slate-600">
                    <div>
                      <dt className="text-xs text-slate-600 dark:text-slate-300">
                        Available
                      </dt>
                      <dd className="mt-1 text-xl font-black">
                        {balance.available_days}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-600 dark:text-slate-300">
                        Reserved
                      </dt>
                      <dd className="mt-1 text-xl font-black">
                        {balance.reserved_days}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-600 dark:text-slate-300">
                        Used
                      </dt>
                      <dd className="mt-1 text-xl font-black">
                        {balance.used_days}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="leave-requests-heading">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <h3 id="leave-requests-heading" className="text-xl font-black">
              Requests
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Open any request to see approvers, documents, and its audit
              timeline.
            </p>
          </div>
          {canApprove ? (
            <Button asChild variant="outline">
              <Link href="/dashboard/workflow/approvals">
                <GitPullRequestArrow aria-hidden="true" />
                Workflow inbox
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <Label htmlFor="leave-request-search" className="sr-only">
              Search leave requests
            </Label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600 dark:text-slate-300"
            />
            <Input
              id="leave-request-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search number, employee, or leave type"
              className={`${controlClass} pl-9`}
            />
          </div>
          <div>
            <Label htmlFor="leave-request-status" className="sr-only">
              Filter by status
            </Label>
            <select
              id="leave-request-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className={selectClass}
            >
              <option value="all">All statuses</option>
              {Object.entries(statusPresentation).map(
                ([statusValue, presentation]) => (
                  <option key={statusValue} value={statusValue}>
                    {presentation.label}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>

        <Card className="mt-4 overflow-hidden border-slate-500 dark:border-slate-600">
          <CardContent className="p-0">
            {requests.isLoading ? (
              <div className="p-4">
                <PanelTableSkeleton rows={6} cols={canManage ? 6 : 5} />
              </div>
            ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>
                  {filteredRows.length} leave request
                  {filteredRows.length === 1 ? "" : "s"} shown.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Request</TableHead>
                    {canManage ? (
                      <TableHead scope="col">Employee</TableHead>
                    ) : null}
                    <TableHead scope="col">Period</TableHead>
                    <TableHead scope="col">Amount</TableHead>
                    <TableHead scope="col">Status</TableHead>
                    <TableHead scope="col" className="text-right">
                      Details
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length ? (
                    filteredRows.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <span className="font-black">
                            {request.request_number ?? `Request ${request.id}`}
                          </span>
                          <span className="block text-xs text-slate-600 dark:text-slate-300">
                            {request.leave_type.name}
                          </span>
                        </TableCell>
                        {canManage ? (
                          <TableCell>
                            <span className="font-bold">
                              {request.employee?.primary_name ??
                                "Unknown employee"}
                            </span>
                            <span className="block text-xs text-slate-600 dark:text-slate-300">
                              {request.employee?.employee_number}
                            </span>
                          </TableCell>
                        ) : null}
                        <TableCell>
                          {formatDate(request.starts_on)}
                          {request.ends_on !== request.starts_on
                            ? ` – ${formatDate(request.ends_on)}`
                            : ""}
                        </TableCell>
                        <TableCell>
                          <span className="font-bold">
                            {request.requested_days} days
                          </span>
                          {Number(request.requested_hours) > 0 ? (
                            <span className="block text-xs text-slate-600 dark:text-slate-300">
                              {request.requested_hours} hours
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={request.status} request={request} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setSelectedId(request.id)}
                            aria-label={`View ${request.request_number ?? `request ${request.id}`}`}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={canManage ? 6 : 5}
                        className="h-40 text-center"
                      >
                        <UserRoundCheck
                          aria-hidden="true"
                          className="mx-auto h-8 w-8 text-slate-500"
                        />
                        <span className="mt-3 block font-black">
                          No matching leave requests
                        </span>
                        <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">
                          Start a request or clear the current filters.
                        </span>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            )}
          </CardContent>
        </Card>
      </section>

      <RequestComposer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        request={editing}
        types={types.data?.data ?? []}
        employees={employees.data?.data ?? []}
        canManage={canManage}
        canBrowseFiles={canBrowseFiles}
        canManageFiles={canManageFiles}
        onSaved={(saved) => {
          refresh();
          setEditing(null);
          setSelectedId(saved.id);
        }}
      />
      <RequestDetails
        requestId={selectedId}
        onClose={() => setSelectedId(null)}
        onEdit={(request) => {
          setSelectedId(null);
          setEditing(request);
          setComposerOpen(true);
        }}
        onChange={(mode, request) => {
          setChangeMode(mode);
          setChangeRequest(request);
        }}
        onRefresh={refresh}
      />
      <ChangeRequestDialog
        mode={changeMode}
        leaveRequest={changeRequest}
        onClose={() => {
          setChangeMode(null);
          setChangeRequest(null);
        }}
        onComplete={refresh}
      />
    </div>
  );
}
