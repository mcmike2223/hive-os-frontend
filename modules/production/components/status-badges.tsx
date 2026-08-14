"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { ProductionOrderStatus, ProductionQaStatus } from "@/modules/production/types";

const ORDER_STATUS_CLASSES: Record<ProductionOrderStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  released: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  in_progress: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  on_hold: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

/**
 * QA state is the one that decides whether stock can be sold, so quarantined
 * and rejected read as alarm states rather than as neutral chips.
 */
const QA_STATUS_CLASSES: Record<ProductionQaStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  in_test: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  released: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  quarantined: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

const humanise = (value: string) => value.replace(/_/g, " ");

export function OrderStatusBadge({ status }: { status: ProductionOrderStatus }) {
  return (
    <Badge
      variant="outline"
      className={`border-transparent text-[11px] font-black uppercase tracking-widest ${ORDER_STATUS_CLASSES[status] ?? ""}`}
    >
      {humanise(status)}
    </Badge>
  );
}

export function QaStatusBadge({ status }: { status: ProductionQaStatus }) {
  return (
    <Badge
      variant="outline"
      className={`border-transparent text-[11px] font-black uppercase tracking-widest ${QA_STATUS_CLASSES[status] ?? ""}`}
    >
      {humanise(status)}
    </Badge>
  );
}

export function TreatmentStatusBadge({ status }: { status: string }) {
  const classes =
    status === "pass"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : status === "warning"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : "bg-rose-500/15 text-rose-700 dark:text-rose-300";

  return (
    <Badge variant="outline" className={`border-transparent text-[11px] font-black uppercase tracking-widest ${classes}`}>
      {status}
    </Badge>
  );
}
