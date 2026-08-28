"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  PanelCardGridSkeleton,
  PanelTableSkeleton,
} from "@/components/ui/loading-states";

export function SupplyChainFiltersSkeleton({
  filters = 2,
}: {
  filters?: number;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {Array.from({ length: filters }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-3 w-16 rounded-full" />
          <Skeleton className="h-9 w-40 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

/** Standard list-page body: filters + table pulse (same language as finance/procurement). */
export function SupplyChainListSkeleton({
  rows = 6,
  cols = 6,
  filters = 1,
}: {
  rows?: number;
  cols?: number;
  filters?: number;
}) {
  return (
    <div
      role="status"
      aria-label="Loading supply chain records"
      className="space-y-4"
    >
      {filters > 0 ? <SupplyChainFiltersSkeleton filters={filters} /> : null}
      <PanelTableSkeleton rows={rows} cols={cols} />
    </div>
  );
}

/** Replenishment: stat tiles + check panel + table. */
export function SupplyChainReplenishmentSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading replenishment"
      className="space-y-6"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="space-y-3 rounded-2xl border border-border/50 bg-card/50 p-5"
          >
            <Skeleton className="h-3 w-28 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-xl" />
            <Skeleton className="h-3 w-40 rounded-full" />
          </div>
        ))}
      </div>
      <div className="space-y-4 rounded-2xl border border-border/50 bg-card/50 p-5">
        <Skeleton className="h-5 w-48 rounded-xl" />
        <Skeleton className="h-4 w-80 rounded-full" />
        <div className="flex flex-wrap gap-3 pt-2">
          <Skeleton className="h-9 w-40 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </div>
      <SupplyChainListSkeleton filters={2} cols={7} />
    </div>
  );
}

/** Demand planning: tabs + table. */
export function SupplyChainPlanningSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading demand planning"
      className="space-y-6"
    >
      <div className="flex gap-2 border-b border-border/60 pb-0">
        <Skeleton className="mb-[-1px] h-10 w-40 rounded-none rounded-t-lg" />
        <Skeleton className="mb-[-1px] h-10 w-32 rounded-none rounded-t-lg" />
      </div>
      <PanelTableSkeleton rows={6} cols={6} />
    </div>
  );
}

export function SupplyChainDialogSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading record"
      className="space-y-4 px-6 py-5"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-20 rounded-full" />
            <Skeleton className="h-5 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="space-y-2 pt-2">
        <Skeleton className="h-4 w-24 rounded-full" />
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Overview dashboard: hero + tiles + chart blocks. */
export function SupplyChainOverviewSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading supply chain overview"
      className="space-y-6"
    >
      <section className="grid gap-4 rounded-2xl border border-border/50 bg-card/50 p-5 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <div className="space-y-3">
          <Skeleton className="h-3 w-32 rounded-full" />
          <Skeleton className="h-16 w-40 rounded-2xl" />
          <Skeleton className="h-3 w-56 rounded-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="space-y-3 rounded-2xl border border-border/40 bg-background/40 p-4"
            >
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="h-7 w-16 rounded-xl" />
              <Skeleton className="h-3 w-28 rounded-full" />
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-2xl border border-border/50 bg-card/50 p-5">
        <Skeleton className="h-5 w-40 rounded-xl" />
        <Skeleton className="mt-2 h-3 w-72 rounded-full" />
        <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-border/50 bg-card/50 p-5">
          <Skeleton className="h-5 w-44 rounded-xl" />
          <Skeleton className="mt-6 h-56 w-full rounded-2xl" />
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/50 p-5">
          <Skeleton className="h-5 w-36 rounded-xl" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      <PanelCardGridSkeleton count={3} />
    </div>
  );
}
