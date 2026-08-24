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
import { PanelTableSkeleton } from "@/components/ui/loading-states";
import { getErrorMessage } from "@/lib/errors";
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
      <header className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Sprout aria-hidden="true" className="size-4" />
            <span>Procurement management</span>
          </div>
          <h1
            id="procurement-page-title"
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
        ) : null}
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

export function ProcurementError({
  error,
  title = "Procurement data could not be loaded",
}: {
  error: unknown;
  title?: string;
}) {
  const fieldErrors =
    typeof error === "object" && error && "response" in error
      ? Object.values(
          (
            error as {
              response?: { data?: { errors?: Record<string, string[]> } };
            }
          ).response?.data?.errors ?? {},
        )
          .flat()
          .map((value) => String(value).trim())
          .filter(Boolean)
      : [];
  const message = getErrorMessage(
    error,
    "Try again or contact your administrator.",
  );
  return (
    <Alert variant="destructive">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {fieldErrors.length > 1 ? (
          <ul className="list-disc space-y-1 pl-4">
            {fieldErrors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          message
        )}
      </AlertDescription>
    </Alert>
  );
}
export function ProcurementTableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return <PanelTableSkeleton rows={rows} cols={cols} />;
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
            <Skeleton className="h-7 w-36" />
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
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardDescription>{title}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
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
