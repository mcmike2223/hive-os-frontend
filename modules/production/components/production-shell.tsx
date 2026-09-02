"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AlertCircle, Factory, LoaderCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const sections = [
  ["Overview", "/dashboard/production"],
  ["Work Orders", "/dashboard/production/orders"],
  ["Shift Runs", "/dashboard/production/runs"],
  ["Water & CIP", "/dashboard/production/quality"],
  ["Jars & Deposits", "/dashboard/production/containers"],
  ["Batch Trace", "/dashboard/production/traceability"],
  ["BOMs", "/dashboard/production/boms"],
  ["Lines", "/dashboard/production/lines"],
] as const;

export function ProductionShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <section aria-labelledby="production-page-title" className="flex min-w-0 flex-col gap-6 pb-10">
      <header className="relative overflow-hidden rounded-3xl border bg-[linear-gradient(135deg,hsl(var(--card))_15%,hsl(var(--primary)/0.09)_100%)] p-5 shadow-sm sm:p-7">
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Factory aria-hidden="true" className="size-4 text-primary" />
              <span>Production execution</span>
            </div>
            <h1 id="production-page-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
          {actions ? <div className="relative flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      </header>
      <nav aria-label="Production sections" className="overflow-x-auto rounded-xl border bg-card p-1">
        <div className="flex min-w-max gap-1">
          {sections.map(([label, href]) => {
            const active =
              href === "/dashboard/production"
                ? pathname === href
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </section>
  );
}

export function ProductionError({
  error,
  title = "Production data could not be loaded",
}: {
  error: unknown;
  title?: string;
}) {
  const message =
    typeof error === "object" && error && "response" in error
      ? String(
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
            "The server rejected this request.",
        )
      : error instanceof Error
        ? error.message
        : "Try again or contact your administrator.";
  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function ProductionLoading({ cards = 4 }: { cards?: number }) {
  return (
    <div aria-label="Loading production data" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: cards }).map((_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ProductionEmpty({ title, description }: { title: string; description: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Factory aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function ProductionMetricCard({
  title,
  value,
  description,
}: {
  title: string;
  value: ReactNode;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export function BusyLabel({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <>
      {busy ? <LoaderCircle aria-hidden="true" data-icon="inline-start" className="animate-spin" /> : null}
      {children}
    </>
  );
}
