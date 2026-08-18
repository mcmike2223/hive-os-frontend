"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AlertTriangle, LoaderCircle, Sprout } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const sections = [
  ["Overview", "/dashboard/procurement"],
  ["Suppliers", "/dashboard/procurement/suppliers"],
  ["Requisitions", "/dashboard/procurement/requisitions"],
  ["Sourcing", "/dashboard/procurement/sourcing"],
  ["Orders", "/dashboard/procurement/orders"],
  ["Receiving", "/dashboard/procurement/receiving"],
  ["Invoice matching", "/dashboard/procurement/invoices"],
  ["Agreements", "/dashboard/procurement/agreements"],
  ["Reports", "/dashboard/procurement/reports"],
] as const;

export function ProcurementShell({
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
    <section
      aria-labelledby="procurement-page-title"
      className="flex min-w-0 flex-col gap-6 pb-10"
    >
      <header className="relative isolate overflow-hidden rounded-[2rem] border border-amber-900/15 bg-[#f8f1df] p-5 text-[#173d32] shadow-sm dark:border-amber-200/20 dark:bg-[#142c26] dark:text-[#f7f0db] sm:p-7">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 -z-10 w-2/5 bg-[radial-gradient(circle_at_center,#d3942d33_0,transparent_68%)]"
        />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-[#7b4d06] dark:text-[#f0c77b]">
              <Sprout aria-hidden="true" className="size-4" />
              Field-to-ledger control
            </p>
            <h1
              id="procurement-page-title"
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              {title}
            </h1>
            <p className="text-sm leading-relaxed text-[#3d5d53] dark:text-[#c7d9d2]">
              {description}
            </p>
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
          ) : null}
        </div>
      </header>
      <nav
        aria-label="Procurement management sections"
        className="overflow-x-auto rounded-xl border bg-card p-1"
      >
        <div className="flex min-w-max gap-1">
          {sections.map(([label, href]) => {
            const active =
              href === "/dashboard/procurement"
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
                    ? "bg-[#1d5b49] text-white dark:bg-[#d9a441] dark:text-[#172e27]"
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

export function ProcurementError({
  error,
  title = "Procurement data could not be loaded",
}: {
  error: unknown;
  title?: string;
}) {
  const message =
    typeof error === "object" && error && "response" in error
      ? String(
          (
            error as {
              response?: {
                data?: { message?: string; errors?: Record<string, string[]> };
              };
            }
          ).response?.data?.message ??
            Object.values(
              (
                error as {
                  response?: { data?: { errors?: Record<string, string[]> } };
                }
              ).response?.data?.errors ?? {},
            ).flat()[0] ??
            "The server rejected this request.",
        )
      : error instanceof Error
        ? error.message
        : "Try again or contact your administrator.";
  return (
    <Alert variant="destructive">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
export function ProcurementLoading({ cards = 4 }: { cards?: number }) {
  return (
    <div
      aria-label="Loading procurement data"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
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
export function ProcurementEmpty({
  title = "No records yet",
  description,
}: {
  title?: string;
  description: string;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Sprout aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
export function ProcurementStatus({ value }: { value: string }) {
  const danger = [
    "rejected",
    "cancelled",
    "failed",
    "blocked",
    "exception",
    "debarred",
    "overdue",
  ].includes(value);
  const warning = [
    "draft",
    "pending",
    "pending_approval",
    "published",
    "evaluation",
    "issued",
    "partially_received",
    "conditional",
    "not_checked",
  ].includes(value);
  return (
    <Badge
      variant={danger ? "destructive" : warning ? "outline" : "secondary"}
      className={
        warning
          ? "border-amber-700/40 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
          : undefined
      }
    >
      {value.replaceAll("_", " ")}
    </Badge>
  );
}
export function MetricCard({
  title,
  value,
  description,
  status,
}: {
  title: string;
  value: ReactNode;
  description: string;
  status?: string;
}) {
  return (
    <Card className="border-[#214f42]/15">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardDescription>{title}</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-[#1d5b49] dark:text-[#9fd5c2]">
              {value}
            </CardTitle>
          </div>
          {status ? <ProcurementStatus value={status} /> : null}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
export function ProcurementTable<T>({
  caption,
  columns,
  rows,
  getKey,
}: {
  caption: string;
  columns: Array<{
    key: string;
    label: string;
    align?: "left" | "right";
    render: (row: T) => ReactNode;
  }>;
  rows: T[];
  getKey: (row: T) => string | number;
}) {
  if (!rows.length) return <ProcurementEmpty description={caption} />;
  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableCaption>{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead
                scope="col"
                key={column.key}
                className={column.align === "right" ? "text-right" : undefined}
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={getKey(row)}>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={
                    column.align === "right" ? "text-right" : undefined
                  }
                >
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
export function BusyLabel({
  busy,
  children,
}: {
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {busy ? (
        <LoaderCircle
          aria-hidden="true"
          data-icon="inline-start"
          className="animate-spin"
        />
      ) : null}
      {children}
    </>
  );
}
export const formatMoney = (value: number | string, currency = "ETB") =>
  new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
