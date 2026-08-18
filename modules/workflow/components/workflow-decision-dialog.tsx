"use client";

import * as React from "react";
import Image from "next/image";
import { FileUp, Loader2, PenLine, UserCheck, X, XCircle } from "lucide-react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/ui/signature-pad";
import { Textarea } from "@/components/ui/textarea";
import { actionWorkflowApproval } from "../api";
import { useBusinessType } from "@/hooks/use-business-type";

export const PRODUCT_MODEL_TYPE = "Modules\\Inventory\\Models\\Product";

export type WorkflowApprovalDecisionStatus = "approved" | "rejected";
export type ProductQaStatus = "pending" | "qa_passed" | "qa_failed" | "no_batches";

export type WorkflowDecisionSubject = {
  name?: string;
  subtitle?: string;
  title?: string;
  document_number?: string;
  qa_status?: ProductQaStatus;
  workflow_gate?: {
    requires_qa?: boolean;
    qa_status?: ProductQaStatus;
    can_approve?: boolean;
    can_reject?: boolean;
    message?: string;
  };
  payload?: Record<string, unknown> | null;
};

export type WorkflowDecisionDefinition = {
  actions?: {
    workflow_gate?: {
      enabled?: boolean;
    };
    product_quality_gate?: {
      enabled?: boolean;
      approve_when?: string;
      reject_when?: string;
    };
  } | null;
};

export type WorkflowDecisionApproval = {
  id: number;
  approvable_type: string;
  approvable_id?: number;
  approvable?: WorkflowDecisionSubject | null;
  workflow_definition?: WorkflowDecisionDefinition | null;
  workflowDefinition?: WorkflowDecisionDefinition | null;
  action_metadata?: Record<string, unknown> | null;
};

export const QA_STATUS_META: Record<ProductQaStatus, { label: string; className: string; helper: string }> = {
  qa_passed: {
    label: "QA Passed",
    className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
    helper: "Quality assurance passed. Approval is unlocked.",
  },
  qa_failed: {
    label: "QA Failed",
    className: "border-rose-500/20 bg-rose-500/10 text-rose-600",
    helper: "Quality assurance failed. Reject this request with notes and signature.",
  },
  pending: {
    label: "QA Pending",
    className: "border-yellow-500/20 bg-yellow-500/10 text-yellow-600",
    helper: "Quality assurance is not complete yet, so approval stays locked.",
  },
  no_batches: {
    label: "No QA Batch",
    className: "border-slate-500/20 bg-slate-500/10 text-slate-500",
    helper: "Create and complete a product QA batch before approving.",
  },
};

export function getWorkflowApprovalGate(approval?: WorkflowDecisionApproval | null, hasBusinessType?: (type: string) => boolean) {
  const definition = approval?.workflow_definition || approval?.workflowDefinition;
  const productGateEnabled = definition?.actions?.product_quality_gate?.enabled === true;
  const workflowGateEnabled = definition?.actions?.workflow_gate?.enabled === true;
  const isWaterBottling = hasBusinessType?.("water-bottling") || false;
  const isProduct = approval?.approvable_type === PRODUCT_MODEL_TYPE && productGateEnabled && isWaterBottling;
  const qaStatus = approval?.approvable?.workflow_gate?.qa_status || approval?.approvable?.qa_status || "pending";
  const meta = QA_STATUS_META[qaStatus] || QA_STATUS_META.pending;

  return {
    isProduct,
    qaStatus,
    meta,
    canApprove: (!isProduct && !workflowGateEnabled) || approval?.approvable?.workflow_gate?.can_approve === true || qaStatus === "qa_passed",
    canReject: !isProduct || approval?.approvable?.workflow_gate?.can_reject === true || qaStatus !== "qa_passed",
    message: isProduct ? (approval?.approvable?.workflow_gate?.message || meta.helper) : undefined,
  };
}

type WorkflowDecisionDialogProps = {
  open: boolean;
  approval?: WorkflowDecisionApproval | null;
  status?: WorkflowApprovalDecisionStatus | null;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
};

type WorkflowEvidenceFile = {
  name: string;
  type: string;
  size: number;
  last_modified: number;
  data_url: string;
};

const readEvidenceFile = (file: File): Promise<WorkflowEvidenceFile> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        last_modified: file.lastModified,
        data_url: String(reader.result || ""),
      });
    };

    reader.onerror = () => reject(reader.error || new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });

export function WorkflowDecisionDialog({
  open,
  approval,
  status,
  onOpenChange,
  onSubmitted,
}: WorkflowDecisionDialogProps) {
  const { hasBusinessType } = useBusinessType();
  const [decisionNotes, setDecisionNotes] = React.useState("");
  const [evidenceFiles, setEvidenceFiles] = React.useState<File[]>([]);
  const [signatureData, setSignatureData] = React.useState<string | null>(null);
  const [isSignaturePadOpen, setIsSignaturePadOpen] = React.useState(false);
  const [isActioning, setIsActioning] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setDecisionNotes("");
      setEvidenceFiles([]);
      setSignatureData(null);
      setIsSignaturePadOpen(false);
    }
  }, [open, approval?.id, status]);

  const gate = getWorkflowApprovalGate(approval, hasBusinessType);
  const subjectName = approval?.approvable?.name
    || approval?.approvable?.document_number
    || approval?.approvable?.title
    || `Request #${approval?.id}`;
  const subjectContext = approval?.approvable?.subtitle;

  const handleSubmit = async () => {
    if (!approval || !status) return;

    if (status === "rejected" && !decisionNotes.trim()) {
      toast.error("Please add rejection notes before signing.");
      return;
    }

    if (!signatureData) {
      toast.error("Please capture a signature before submitting.");
      return;
    }

    try {
      setIsActioning(true);
      const evidencePayload = evidenceFiles.length
        ? await Promise.all(evidenceFiles.map(readEvidenceFile))
        : [];

      await actionWorkflowApproval(approval.id, status, {
        notes: decisionNotes.trim() || undefined,
        signature_data: signatureData,
        action_metadata: evidencePayload.length
          ? {
              evidence_files: evidencePayload,
            }
          : undefined,
      });
      toast.success(status === "approved" ? "Request signed successfully" : "Request rejected");
      onSubmitted?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update approval");
    } finally {
      setIsActioning(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden rounded-[2rem] sm:max-w-[560px]">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-2xl font-black">
              {status === "approved" ? <UserCheck className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-rose-600" />}
              {status === "approved" ? "Approve with signature" : "Reject with signature"}
            </DialogTitle>
            <DialogDescription>
              This decision will be stored as workflow audit evidence with your notes, signature, time, and device metadata.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-1 py-2 pr-2">
            <div className="rounded-2xl border border-border/50 bg-muted/30 p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Workflow Subject</p>
              <p className="mt-1 font-bold">{subjectName}</p>
              {subjectContext ? (
                <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{subjectContext}</p>
              ) : null}
              {gate.isProduct ? (
                <div className="mt-3 rounded-xl border border-border/50 bg-background/70 p-3">
                  <Badge variant="outline" className={`rounded-full px-2 py-0 text-[11px] ${gate.meta.className}`}>
                    {gate.meta.label}
                  </Badge>
                  <p className="mt-2 text-xs text-muted-foreground">{gate.message}</p>
                </div>
              ) : null}
            </div>

            {approval?.approvable && (
              <div className="rounded-2xl border border-border/50 bg-muted/30 p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Request Details</p>
                <div className="mt-3 space-y-2">
                  {(() => {
                    const subject = approval.approvable as WorkflowDecisionSubject & Record<string, unknown>;
                    const payload =
                      subject.payload && typeof subject.payload === "object"
                        ? subject.payload
                        : null;

                    if (!payload || Object.keys(payload).length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground">
                          No request details were attached to this approval.
                        </p>
                      );
                    }

                    return Object.entries(payload).map(([key, value]) => {
                      if (
                        value === null ||
                        value === undefined ||
                        value === "" ||
                        key === "id" ||
                        key === "created_at" ||
                        key === "updated_at"
                      ) {
                        return null;
                      }

                      const displayKey = key.includes(" ")
                        ? key
                        : key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
                      const isLink =
                        typeof value === "string" &&
                        (key.toLowerCase().includes("open in") || value.startsWith("/dashboard/"));

                      if (isLink) {
                        return (
                          <div key={key} className="flex items-start justify-between gap-4 text-sm">
                            <span className="font-medium capitalize text-muted-foreground">{displayKey}</span>
                            <a
                              href={String(value)}
                              className="font-bold text-teal-700 underline-offset-2 hover:underline dark:text-teal-300"
                            >
                              Open record
                            </a>
                          </div>
                        );
                      }

                      const displayValue =
                        typeof value === "object" ? JSON.stringify(value) : String(value);

                      return (
                        <div key={key} className="flex items-start justify-between gap-4 text-sm">
                          <span className="font-medium capitalize text-muted-foreground">{displayKey}</span>
                          <span className="max-w-[60%] text-right font-medium">{displayValue}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="workflow-decision-notes">
                {status === "rejected" ? "Rejection reason" : "Approval notes"}
              </Label>
              <Textarea
                id="workflow-decision-notes"
                placeholder={status === "rejected" ? "Explain why this flow is rejected..." : "Optional approval note..."}
                value={decisionNotes}
                onChange={(event) => setDecisionNotes(event.target.value)}
                className="min-h-28 rounded-2xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workflow-evidence-files">Evidence files</Label>
              <div className="rounded-2xl border border-dashed border-border bg-background p-4">
                <label
                  htmlFor="workflow-evidence-files"
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-muted/40 px-4 py-3 text-sm font-bold transition hover:bg-muted"
                >
                  <span className="flex items-center gap-2">
                    <FileUp className="h-4 w-4 text-primary" />
                    Attach files for this decision
                  </span>
                  <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Max 5</span>
                </label>
                <input
                  id="workflow-evidence-files"
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []).slice(0, 5);
                    setEvidenceFiles(files);
                    event.target.value = "";
                  }}
                />
                {evidenceFiles.length ? (
                  <div className="mt-3 space-y-2">
                    {evidenceFiles.map((file, index) => (
                      <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-3 rounded-xl border bg-card/50 px-3 py-2 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-bold">{file.name}</p>
                          <p className="text-muted-foreground">{Math.ceil(file.size / 1024)} KB</p>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-full"
                          onClick={() => setEvidenceFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Optional. Attach invoices, inspection photos, PDFs, or any proof needed for this approval decision.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black">Decision Signature</p>
                  <p className="text-xs text-muted-foreground">Required for both approvals and rejections.</p>
                </div>
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsSignaturePadOpen(true)}>
                  <PenLine className="mr-2 h-4 w-4" />
                  {signatureData ? "Redraw" : "Sign"}
                </Button>
              </div>
              {signatureData ? (
                <div className="mt-4 rounded-xl border bg-white p-3">
                  <Image
                    src={signatureData}
                    alt="Captured signature"
                    width={420}
                    height={120}
                    unoptimized
                    className="max-h-20 object-contain"
                    style={{ width: "auto", height: "auto" }}
                  />
                </div>
              ) : (
                <div className="mt-4 rounded-xl bg-muted/50 px-4 py-6 text-center text-xs font-medium text-muted-foreground">
                  No signature captured yet.
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border/60 pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!approval || !status || isActioning}
              className={status === "rejected" ? "bg-rose-600 hover:bg-rose-700" : ""}
            >
              {isActioning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {status === "approved" ? "Submit Approval" : "Submit Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SignaturePad
        open={isSignaturePadOpen}
        onOpenChange={(open) => {
          setIsSignaturePadOpen(open);
        }}
        onSave={(data) => {
          setSignatureData(data);
          setIsSignaturePadOpen(false);
        }}
      />
    </>
  );
}
