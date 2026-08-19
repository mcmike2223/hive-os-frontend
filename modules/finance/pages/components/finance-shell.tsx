"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import type { ReactNode } from "react";
import { AlertCircle, Landmark, LoaderCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { PanelTableSkeleton } from "@/components/ui/loading-states";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import styles from "@/modules/finance/pages/components/finance-shell.module.css";

export const financeSections = [
  ["Overview", "/dashboard/finance"],
  ["Accounts", "/dashboard/finance/accounts"],
  ["Journals", "/dashboard/finance/journals"],
  ["Sales", "/dashboard/finance/sales"],
  ["Purchases", "/dashboard/finance/purchases"],
  ["Contacts", "/dashboard/finance/contacts"],
  ["Budgets", "/dashboard/finance/budgets"],
  ["Banking", "/dashboard/finance/banking"],
  ["Reports", "/dashboard/finance/reports"],
  ["Compliance", "/dashboard/finance/operations"],
  ["Settings", "/dashboard/finance/settings"],
] as const;

export const financeJournalTypes = [
  ["general", "General journal"],
  ["adjustment", "Adjustment"],
  ["opening", "Opening balance"],
] as const;

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function FinanceTableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return <PanelTableSkeleton rows={rows} cols={cols} />;
}

export function FinanceShell({ title, description, eyebrow, actions, children }: { title: string; description: string; eyebrow?: string; actions?: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <section aria-labelledby="finance-page-title" className={cn(styles.scope, "flex min-w-0 flex-col gap-6 pb-10")}>
      <header className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Landmark aria-hidden="true" className="size-4" />
            <span>{eyebrow ?? "Financial management"}</span>
          </div>
          <h1 id="finance-page-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </header>

      <nav aria-label="Finance sections" className="overflow-x-auto rounded-xl border bg-card p-1">
        <div className="flex min-w-max gap-1">
          {financeSections.map(([label, href]) => {
            const active = href === "/dashboard/finance" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
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

export function FinanceError({ error, title = "Finance data could not be loaded" }: { error: unknown; title?: string }) {
  const message = getErrorMessage(error, "The server rejected this request.");
  return <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>{title}</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>;
}

export function FinanceLoading({ cards = 4 }: { cards?: number }) {
  return <div aria-label="Loading finance data" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: cards }).map((_, index) => <Card key={index}><CardHeader><Skeleton className="h-4 w-28" /><Skeleton className="h-7 w-36" /></CardHeader><CardContent><Skeleton className="h-4 w-full" /></CardContent></Card>)}</div>;
}

export function FinanceEmpty({ title, description }: { title: string; description: string }) {
  return <Empty><EmptyHeader><EmptyMedia variant="icon"><Landmark aria-hidden="true" /></EmptyMedia><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader></Empty>;
}

export function FinanceStatus({ value }: { value: string }) {
  const destructive = ["voided", "rejected", "overdue"].includes(value);
  return <Badge variant={destructive ? "destructive" : value === "draft" || value === "pending" ? "outline" : "secondary"}>{value.replaceAll("_", " ")}</Badge>;
}

export function Money({ value, currency = "ETB" }: { value: number | string | null | undefined; currency?: string }) {
  const amount = Number(value ?? 0);
  return <span className="tabular-nums">{new Intl.NumberFormat("en-ET", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0)}</span>;
}

export function FinanceTable<T>({ caption, columns, rows, getKey, onRowClick }: { caption: string; columns: Array<{ key: string; label: string; align?: "left" | "right"; render: (row: T) => ReactNode }>; rows: T[]; getKey: (row: T) => string | number; onRowClick?: (row: T) => void }) {
  if (rows.length === 0) return <FinanceEmpty title="No records yet" description={caption} />;
  return (
    <Table>
      <TableCaption>{caption}</TableCaption>
      <TableHeader><TableRow>{columns.map((column) => <TableHead key={column.key} scope="col" className={column.align === "right" ? "text-right" : undefined}>{column.label}</TableHead>)}</TableRow></TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={getKey(row)}
            onClick={(event) => {
              if (!onRowClick) return;
              const target = event.target as HTMLElement | null;
              // Don't trigger row click when clicking on interactive controls inside the row.
              if (
                target?.closest(
                  "button, a, input, select, textarea, [role='button'], [role='menuitem'], [data-radix-dropdown-menu-item]"
                )
              ) {
                return;
              }
              // Also ignore clicks within dropdown menu content (covers cases where Radix renders menu items as non-button elements).
              if (target?.closest("[data-radix-dropdown-menu-content]")) return;
              onRowClick(row);
            }}
            className={onRowClick ? "cursor-pointer" : undefined}
          >
            {columns.map((column) => <TableCell key={column.key} className={column.align === "right" ? "text-right" : undefined}>{column.render(row)}</TableCell>)}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function MetricCard({ title, value, description, status }: { title: string; value: ReactNode; description: string; status?: string }) {
  return <Card><CardHeader><div className="flex items-start justify-between gap-3"><div className="flex flex-col gap-1"><CardDescription>{title}</CardDescription><CardTitle className="text-2xl tabular-nums">{value}</CardTitle></div>{status ? <FinanceStatus value={status} /> : null}</div></CardHeader><CardContent><p className="text-sm text-muted-foreground">{description}</p></CardContent></Card>;
}

export function BusyLabel({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <>{busy ? <LoaderCircle aria-hidden="true" data-icon="inline-start" className="animate-spin" /> : null}{children}</>;
}
