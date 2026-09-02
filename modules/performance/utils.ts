import * as React from "react";
import type { PerformanceReview } from "@/modules/performance/types";

export type ReviewStatusFilter =
  | "all"
  | "not_started"
  | "self_review"
  | "manager_review"
  | "calibration"
  | "manager_submitted"
  | "completed"
  | "returned";

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function isReviewOverdue(review: PerformanceReview): boolean {
  if (!review.due_on || review.status === "completed") return false;
  const due = new Date(`${review.due_on}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export function reviewStageLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export function availableReviewAction(
  review: PerformanceReview,
  permissions: {
    canSelf: boolean;
    canManage: boolean;
    canCalibrate: boolean;
    canAcknowledge: boolean;
  },
): string | null {
  if (permissions.canSelf && ["not_started", "self_review", "returned"].includes(review.status)) {
    return "self-submit";
  }
  if (permissions.canManage && ["not_started", "manager_review", "returned"].includes(review.status)) {
    return "manager-submit";
  }
  if (permissions.canCalibrate && ["calibration", "manager_submitted"].includes(review.status)) {
    return "calibrate";
  }
  if (permissions.canAcknowledge && review.status === "completed" && !review.acknowledged_at) {
    return "acknowledge";
  }
  return null;
}

export function hasActiveReviewFilters(opts: {
  search: string;
  status: ReviewStatusFilter;
  cycleId: string;
  employeeId: string;
  overdueOnly: boolean;
}): boolean {
  return Boolean(
    opts.search.trim() ||
      opts.status !== "all" ||
      opts.cycleId ||
      opts.employeeId ||
      opts.overdueOnly,
  );
}

export function describeEvidence(evidence: Record<string, unknown>): string {
  if (typeof evidence.reason === "string") return evidence.reason;
  const present = Number(evidence.present_days ?? 0);
  const late = Number(evidence.late_days ?? 0);
  const absent = Number(evidence.absent_days ?? 0);
  return `${present} present day(s), ${late} late day(s), and ${absent} absent day(s) in the review period.`;
}

export function scopeLabel(scope: string): string {
  if (scope === "organization") return "Organization-wide";
  return "Your team and yourself";
}

export function scopeDescription(scope: string): string {
  if (scope === "organization") {
    return "You are viewing every employee the performance module exposes to administrators.";
  }
  return "You are viewing employees in your reporting scope plus your own record.";
}
