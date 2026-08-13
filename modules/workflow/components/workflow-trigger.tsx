"use client";

import React, { useState } from "react";
import { CheckCircle2, Clock, Loader2, Send, UserCheck, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createWorkflowApproval, fetchWorkflowApprovals, fetchWorkflowDefinitions } from "../api";
import {
  WorkflowDecisionDialog,
  getWorkflowApprovalGate,
  type WorkflowApprovalDecisionStatus,
  type WorkflowDecisionApproval,
} from "./workflow-decision-dialog";

interface WorkflowTriggerProps {
  type: string;
  id: number;
  name?: string;
  approval?: WorkflowDecisionApproval | null;
  status?: string;
  moduleSlug?: string;
  submoduleSlug?: string;
  functionality?: string;
  targetUrl?: string;
  onSuccess?: () => void;
  showStatusBadge?: boolean;
}

type ActionableWorkflowApproval = WorkflowDecisionApproval & {
  can_action?: boolean;
};

const statusConfig = {
  pending: {
    label: "Pending Approval",
    icon: Clock,
    color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    color: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  },
} as const;

export function WorkflowTrigger({
  type,
  id,
  name,
  approval,
  moduleSlug,
  submoduleSlug,
  functionality = "manual",
  targetUrl,
  status,
  onSuccess,
  showStatusBadge = true,
}: WorkflowTriggerProps) {
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<{
    approval: ActionableWorkflowApproval;
    status: WorkflowApprovalDecisionStatus;
  } | null>(null);

  const inlineApprovalQuery = useQuery({
    queryKey: ["workflow", "inline-approval", type, id],
    queryFn: async () =>
      fetchWorkflowApprovals({
        type: "inbox",
        status: "pending",
        approvable_type: type,
        approvable_id: id,
        per_page: 1,
      }),
    enabled: approval === undefined && Boolean(type && id),
    staleTime: 10_000,
  });

  const manualRuleQuery = useQuery({
    queryKey: ["workflow", "manual-rule", type],
    queryFn: fetchWorkflowDefinitions,
    enabled: Boolean(type && id),
    staleTime: 30_000,
    select: (definitions) => {
      const rows = Array.isArray(definitions) ? definitions : [];

      return (
        rows.find(
          (definition) =>
            definition?.model_type === type &&
            definition?.trigger_event === "manual" &&
            definition?.is_active !== false
        ) ?? null
      );
    },
  });

  const startWorkflowMutation = useMutation({
    mutationFn: () => {
      const resolvedTargetUrl =
        targetUrl ??
        (typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : undefined);

      return createWorkflowApproval({
        approvable_type: type,
        approvable_id: id,
        trigger_event: "manual",
        module_slug: moduleSlug,
        submodule_slug: submoduleSlug,
        functionality,
        target_url: resolvedTargetUrl,
        context: {
          source: "manual_trigger",
          display_name: name ?? null,
          target_url: resolvedTargetUrl ?? null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Workflow approval started.");
      queryClient.invalidateQueries({ queryKey: ["workflow", "inline-approval", type, id] });
      queryClient.invalidateQueries({ queryKey: ["workflow", "approvals"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-notifications"] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to start workflow approval.");
    },
  });

  const activeApproval = (approval ?? inlineApprovalQuery.data?.data?.[0] ?? null) as ActionableWorkflowApproval | null;
  const approvalGate = getWorkflowApprovalGate(activeApproval);
  const canActionApproval = Boolean(activeApproval?.can_action);
  const canStartManualWorkflow = !activeApproval && Boolean(manualRuleQuery.data);
  const currentStatus = status as keyof typeof statusConfig;

  const refreshWorkflowState = () => {
    queryClient.invalidateQueries({ queryKey: ["workflow", "inline-approval", type, id] });
    queryClient.invalidateQueries({ queryKey: ["workflow", "approvals"] });
    queryClient.invalidateQueries({ queryKey: ["workflow-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-notifications"] });
    onSuccess?.();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showStatusBadge && status && statusConfig[currentStatus] ? (
        <Badge
          variant="outline"
          className={`gap-1.5 rounded-full px-2 py-0.5 font-bold ${statusConfig[currentStatus].color}`}
        >
          {React.createElement(statusConfig[currentStatus].icon, { className: "h-3 w-3" })}
          {statusConfig[currentStatus].label}
        </Badge>
      ) : null}

      {activeApproval && canActionApproval ? (
        <div className="flex flex-wrap items-center gap-2">
          {approvalGate.canApprove ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-emerald-500/30 text-emerald-600 hover:bg-emerald-500 hover:text-white"
              onClick={() => setDecision({ approval: activeApproval, status: "approved" })}
            >
              <UserCheck className="mr-1 h-3.5 w-3.5" />
              Approve
            </Button>
          ) : null}

          {approvalGate.canReject ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-rose-500/30 text-rose-600 hover:bg-rose-500 hover:text-white"
              onClick={() => setDecision({ approval: activeApproval, status: "rejected" })}
            >
              <XCircle className="mr-1 h-3.5 w-3.5" />
              Reject
            </Button>
          ) : null}

          {approvalGate.isProduct && !approvalGate.canApprove ? (
            <span className="max-w-[220px] text-[11px] font-medium leading-snug text-muted-foreground">
              {approvalGate.message}
            </span>
          ) : null}
        </div>
      ) : canStartManualWorkflow ? (
        <Button
          size="sm"
          variant="outline"
          className="rounded-full border-sky-500/30 text-sky-600 hover:bg-sky-500 hover:text-white"
          disabled={startWorkflowMutation.isPending}
          onClick={() => startWorkflowMutation.mutate()}
        >
          {startWorkflowMutation.isPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="mr-1 h-3.5 w-3.5" />
          )}
          Start Approval
        </Button>
      ) : null}

      <WorkflowDecisionDialog
        open={Boolean(decision)}
        approval={decision?.approval ?? null}
        status={decision?.status ?? null}
        onOpenChange={(open) => !open && setDecision(null)}
        onSubmitted={() => {
          refreshWorkflowState();
          setDecision(null);
        }}
      />
    </div>
  );
}

export const WorkflowApprovalActions = WorkflowTrigger;
