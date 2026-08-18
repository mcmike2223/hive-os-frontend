"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AlertCircle, LoaderCircle, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const sections = [
  ["Overview", "/dashboard/performance"], ["Cycles", "/dashboard/performance/cycles"], ["Goals", "/dashboard/performance/goals"],
  ["Reviews", "/dashboard/performance/reviews"], ["Team", "/dashboard/performance/team"], ["Development", "/dashboard/performance/development"],
  ["Reports", "/dashboard/performance/reports"], ["Settings", "/dashboard/performance/settings"],
] as const;

export function PerformanceShell({ title, description, actions, children }: { title: string; description: string; actions?: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  return <section aria-labelledby="performance-page-title" className="flex min-w-0 flex-col gap-6 pb-10">
    <header className="relative overflow-hidden rounded-3xl border bg-[linear-gradient(135deg,hsl(var(--card))_15%,hsl(var(--primary)/0.09)_100%)] p-5 shadow-sm sm:p-7">
      <div aria-hidden="true" className="absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2"><div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Sparkles aria-hidden="true" className="size-4 text-primary" /><span>Performance and growth</span></div><h1 id="performance-page-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1><p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p></div>
        {actions ? <div className="relative flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
    <nav aria-label="Performance management sections" className="overflow-x-auto rounded-xl border bg-card p-1"><div className="flex min-w-max gap-1">{sections.map(([label, href]) => { const active = href === "/dashboard/performance" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{label}</Link>; })}</div></nav>
    {children}
  </section>;
}

export function PerformanceError({ error, title = "Performance data could not be loaded" }: { error: unknown; title?: string }) { const message = typeof error === "object" && error && "response" in error ? String((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? "The server rejected this request.") : error instanceof Error ? error.message : "Try again or contact your administrator."; return <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>{title}</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>; }
export function PerformanceLoading({ cards = 4 }: { cards?: number }) { return <div aria-label="Loading performance data" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: cards }).map((_, index) => <Card key={index}><CardHeader><Skeleton className="h-4 w-28" /><Skeleton className="h-8 w-32" /></CardHeader><CardContent><Skeleton className="h-4 w-full" /></CardContent></Card>)}</div>; }
export function PerformanceEmpty({ title, description }: { title: string; description: string }) { return <Empty><EmptyHeader><EmptyMedia variant="icon"><Sparkles aria-hidden="true" /></EmptyMedia><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader></Empty>; }
export function PerformanceStatus({ value }: { value: string }) { const danger = ["blocked", "at_risk", "overdue", "rejected", "unsuccessful", "cancelled"].includes(value); const pending = ["draft", "requested", "planned", "pending_approval", "self_review", "manager_review", "calibration"].includes(value); return <Badge variant={danger ? "destructive" : pending ? "outline" : "secondary"}>{value.replaceAll("_", " ")}</Badge>; }
export function Score({ value }: { value?: string | number | null }) { const number = Number(value); return <span className="font-semibold tabular-nums">{Number.isFinite(number) ? `${number.toFixed(1)}%` : "Not scored"}</span>; }
export function PerformanceTable<T>({ caption, columns, rows, getKey }: { caption: string; columns: Array<{ key: string; label: string; align?: "left" | "right"; render: (row: T) => ReactNode }>; rows: T[]; getKey: (row: T) => number | string }) { if (!rows.length) return <PerformanceEmpty title="No records yet" description={caption} />; return <div className="w-full overflow-x-auto"><Table><TableCaption>{caption}</TableCaption><TableHeader><TableRow>{columns.map((column) => <TableHead key={column.key} scope="col" className={column.align === "right" ? "text-right" : undefined}>{column.label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={getKey(row)}>{columns.map((column) => <TableCell key={column.key} className={column.align === "right" ? "text-right" : undefined}>{column.render(row)}</TableCell>)}</TableRow>)}</TableBody></Table></div>; }
export function MetricCard({ title, value, description, status }: { title: string; value: ReactNode; description: string; status?: string }) { return <Card><CardHeader><div className="flex items-start justify-between gap-3"><div className="space-y-1"><CardDescription>{title}</CardDescription><CardTitle className="text-2xl tabular-nums">{value}</CardTitle></div>{status ? <PerformanceStatus value={status} /> : null}</div></CardHeader><CardContent><p className="text-sm text-muted-foreground">{description}</p></CardContent></Card>; }
export function BusyLabel({ busy, children }: { busy: boolean; children: ReactNode }) { return <>{busy ? <LoaderCircle aria-hidden="true" data-icon="inline-start" className="animate-spin" /> : null}{children}</>; }

