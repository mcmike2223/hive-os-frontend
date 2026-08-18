"use client";

import { ShieldCheck, Sparkles } from "lucide-react";

import DataTableLoading from "@/components/datatable/datatable-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function AccentOrb({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute rounded-full bg-primary/15 blur-3xl",
        className
      )}
    />
  );
}

export function FullScreenPlaceholder({
  label = "Preparing secure workspace",
  detail = "Loading your session, language pack, and node configuration.",
}: {
  label?: string;
  detail?: string;
}) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-6">
      <AccentOrb className="-left-24 top-12 h-64 w-64" />
      <AccentOrb className="-right-20 bottom-10 h-72 w-72" />

      <div className="relative w-full max-w-3xl rounded-[2rem] border border-border/50 bg-card/70 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-primary/80">
              HIVE.OS
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground">
              {label}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">{detail}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.5rem] border border-border/50 bg-background/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Skeleton className="h-4 w-28 rounded-full" />
                <Skeleton className="mt-3 h-8 w-52 rounded-xl" />
              </div>
              <Skeleton className="h-12 w-12 rounded-2xl" />
            </div>
            <div className="mt-6 space-y-3">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-5/6 rounded-xl" />
              <Skeleton className="h-10 w-4/6 rounded-xl" />
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-border/50 bg-background/60 p-5">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <p className="text-[11px] font-black uppercase tracking-[0.3em]">
                Secure Boot
              </p>
            </div>
            <div className="mt-5 space-y-4">
              {["Session", "Translations", "Branding"].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/50 p-4"
                >
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-24 rounded-full" />
                    <Skeleton className="mt-2 h-3 w-40 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthPagePlaceholder() {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background px-6 py-10">
      <AccentOrb className="-left-24 top-0 h-72 w-72" />
      <AccentOrb className="right-0 top-10 h-80 w-80" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 lg:flex-row">
        <div className="flex-1 rounded-[2.5rem] border border-border/50 bg-card/60 p-8 shadow-xl backdrop-blur-xl">
          <Skeleton className="h-8 w-40 rounded-xl" />
          <Skeleton className="mt-6 h-14 w-2/3 rounded-2xl" />
          <Skeleton className="mt-4 h-4 w-5/6 rounded-full" />
          <Skeleton className="mt-2 h-4 w-3/5 rounded-full" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-32 rounded-[1.75rem]" />
            <Skeleton className="h-32 rounded-[1.75rem]" />
          </div>
        </div>

        <div className="w-full max-w-xl rounded-[2.5rem] border border-border/50 bg-card/75 p-8 shadow-2xl backdrop-blur-xl">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="mt-5 h-12 w-48 rounded-2xl" />
          <Skeleton className="mt-2 h-4 w-64 rounded-full" />
          <div className="mt-8 space-y-4">
            <Skeleton className="h-14 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
          <div className="mt-8 grid gap-3">
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardOverviewPlaceholder() {
  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-end">
        <Skeleton className="h-8 w-44 rounded-xl" />
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-3 w-32 rounded-full" />
          <Skeleton className="h-12 w-72 rounded-2xl" />
          <div className="flex flex-wrap gap-3 pt-3">
            <Skeleton className="h-10 w-36 rounded-full" />
            <Skeleton className="h-10 w-36 rounded-full" />
            <Skeleton className="h-10 w-32 rounded-full" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-8 w-36 rounded-full" />
          <Skeleton className="h-4 w-48 rounded-full" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-[1.75rem] border border-border/50 bg-card/40 p-5 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-11 w-11 rounded-2xl" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="mt-6 h-9 w-24 rounded-xl" />
            <Skeleton className="mt-3 h-3 w-32 rounded-full" />
            <Skeleton className="mt-2 h-3 w-40 rounded-full" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-border/50 bg-card/40 p-6">
          <Skeleton className="h-6 w-48 rounded-xl" />
          <Skeleton className="mt-2 h-4 w-72 rounded-full" />
          <Skeleton className="mt-8 h-[320px] w-full rounded-[1.5rem]" />
        </div>
        <div className="rounded-[2rem] border border-border/50 bg-card/40 p-6">
          <Skeleton className="h-6 w-44 rounded-xl" />
          <div className="mt-6 space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="rounded-[1.5rem] border border-border/40 bg-background/40 p-4"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-36 rounded-full" />
                    <Skeleton className="mt-2 h-3 w-28 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsWorkspaceSkeleton() {
  return (
    <div className="space-y-6 pt-2">
      <div className="flex justify-end">
        <Skeleton className="h-8 w-40 rounded-xl" />
      </div>

      <div className="rounded-[2rem] border border-border/50 bg-card/40 p-6">
        <Skeleton className="h-8 w-64 rounded-xl" />
      </div>

      <div className="flex flex-col gap-6 xl:flex-row">
        <div className="w-full shrink-0 rounded-[2rem] border border-border/50 bg-card/40 p-3 xl:w-64">
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full rounded-xl" />
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] border border-border/50 bg-card/40 p-8">
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-32 rounded-[1.5rem]" />
              ))}
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 rounded-xl" />
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-border/50 bg-card/40 p-8">
            <div className="grid gap-6 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-44 rounded-[1.75rem]" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsPanelSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-border/50 bg-card/40 p-8">
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-[1.5rem]" />
          ))}
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 rounded-xl" />
          ))}
        </div>
      </div>

      <div className="rounded-[2rem] border border-border/50 bg-card/40 p-8">
        <div className="grid gap-6 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-44 rounded-[1.75rem]" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ModulePageSkeleton({
  titleWidth = "w-56",
  subtitleWidth = "w-80",
  rows = 7,
  cols = 5,
}: {
  titleWidth?: string;
  subtitleWidth?: string;
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Skeleton className="h-8 w-40 rounded-xl" />
      </div>

      <div className="rounded-[2rem] border border-border/50 bg-card/40 p-6">
        <Skeleton className={cn("h-8 rounded-xl", titleWidth)} />
        <Skeleton className={cn("mt-3 h-4 rounded-full", subtitleWidth)} />
      </div>

      <DataTableLoading titleWidth={titleWidth} descWidth={subtitleWidth} rows={rows} cols={cols} />
    </div>
  );
}

export function TabbedModuleSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-[1.5rem] border border-border/60 bg-muted/40 p-2">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="hidden h-8 w-28 rounded-lg sm:block" />
      </div>

      <DataTableLoading rows={rows} cols={cols} titleWidth="w-56" descWidth="w-80" />
    </div>
  );
}

export function AlertsFeedSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Skeleton className="h-8 w-40 rounded-xl" />
      </div>

      <div className="rounded-[2rem] border border-border/50 bg-card/40 p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Skeleton className="h-10 w-64 rounded-2xl" />
            <Skeleton className="mt-3 h-4 w-96 rounded-full" />
          </div>
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-28 rounded-full" />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {Array.from({ length: items }).map((_, index) => (
          <div
            key={index}
            className="rounded-[1.5rem] border border-border/50 bg-card/30 p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-start gap-4">
                <Skeleton className="mt-1 h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-56 rounded-full" />
                  <Skeleton className="mt-3 h-4 w-full rounded-full" />
                  <Skeleton className="mt-2 h-4 w-4/5 rounded-full" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-28 rounded-xl" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfileWorkspaceSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Skeleton className="h-8 w-44 rounded-xl" />
      </div>

      <div className="rounded-[2rem] border border-border/50 bg-card/40 p-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="w-full max-w-sm space-y-4">
            <Skeleton className="h-40 w-full rounded-[1.75rem]" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <div className="flex-1 space-y-5">
            <Skeleton className="h-10 w-56 rounded-xl" />
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-12 w-40 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact table placeholder — same muted pulse language as DataTableLoading. */
export function PanelTableSkeleton({
  rows = 6,
  cols = 6,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div
      role="status"
      aria-label="Loading records"
      className="w-full overflow-hidden rounded-[1.5rem] border border-border/50 bg-card/50"
    >
      <div
        className="grid gap-4 border-b border-border/40 bg-muted/30 px-4 py-4"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }).map((_, index) => (
          <div key={index} className="h-3 w-full animate-pulse rounded bg-muted" />
        ))}
      </div>
      <div className="divide-y divide-border/40">
        {Array.from({ length: rows }).map((_, row) => (
          <div
            key={row}
            className="grid gap-4 px-4 py-4"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((_, col) => (
              <div
                key={col}
                className="h-4 w-full animate-pulse rounded bg-muted/60"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PanelCardGridSkeleton({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading cards"
      className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="space-y-3 rounded-[1.5rem] border border-border/50 bg-card/50 p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            <div className="h-5 w-12 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-6 w-3/4 animate-pulse rounded-xl bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted/60" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted/60" />
          <div className="mt-2 h-16 w-full animate-pulse rounded-xl bg-muted/60" />
        </div>
      ))}
    </div>
  );
}

export function PanelKanbanSkeleton({
  columns = 6,
}: {
  columns?: number;
}) {
  return (
    <div
      role="status"
      aria-label="Loading pipeline"
      className="grid gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-cols-6"
    >
      {Array.from({ length: columns }).map((_, column) => (
        <div
          key={column}
          className="min-w-[200px] space-y-3 rounded-[1.5rem] border border-border/50 bg-card/50 p-3"
        >
          <div className="mb-1 flex items-center justify-between border-b border-border/40 pb-2">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-5 w-8 animate-pulse rounded bg-muted" />
          </div>
          {Array.from({ length: 2 }).map((_, card) => (
            <div
              key={card}
              className="space-y-2 rounded-xl border border-border/40 bg-muted/10 p-3"
            >
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted/60" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted/60" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
