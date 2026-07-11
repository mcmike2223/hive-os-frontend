import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type WorkflowPendingResponse = {
  requires_approval?: boolean;
  message?: string;
  submission?: unknown;
};

export function isWorkflowPendingSubmission(data: unknown): data is WorkflowPendingResponse {
  return Boolean(
    data &&
      typeof data === "object" &&
      "requires_approval" in data &&
      (data as WorkflowPendingResponse).requires_approval === true
  );
}

export function getWorkflowPendingMessage(
  data: unknown,
  fallback = "Submitted for approval."
): string {
  if (isWorkflowPendingSubmission(data) && typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }

  return fallback;
}

export function invalidateWorkflowQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ["workflow"] });
  queryClient.invalidateQueries({ queryKey: ["workflow-dashboard"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard-notifications"] });
}

export function notifyMutationOutcome(
  data: unknown,
  options: {
    savedMessage: string;
    submittedMessage?: string;
    queryClient?: QueryClient;
  }
): "saved" | "pending" {
  if (isWorkflowPendingSubmission(data)) {
    toast.info(options.submittedMessage ?? getWorkflowPendingMessage(data));
    if (options.queryClient) {
      invalidateWorkflowQueries(options.queryClient);
    }
    return "pending";
  }

  toast.success(options.savedMessage);
  return "saved";
}
