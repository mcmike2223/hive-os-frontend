"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Scale } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { financeApi } from "@/modules/finance/api";
import type { FinanceDocument, FinanceJournal } from "@/modules/finance/types";
import { FinanceOverviewCharts } from "@/modules/finance/pages/components/finance-overview-charts";
import { FinanceError, FinanceLoading, FinanceShell, FinanceStatus, FinanceTable, MetricCard, Money } from "@/modules/finance/pages/components/finance-shell";

export default function FinanceDashboardPage() {
  const initialRange = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth() - 11, 1);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }, []);
  const [draftRange, setDraftRange] = useState(initialRange);
  const [range, setRange] = useState(initialRange);
  const query = useQuery({ queryKey: ["finance", "dashboard", range], queryFn: () => financeApi.dashboard(range) });
  return (
    <FinanceShell title="Finance control room" description="See whether the books balance, find posting exceptions, and move from operational activity to auditable financial statements." actions={<Button asChild><Link href="/dashboard/finance/journals">Open journal<ArrowRight data-icon="inline-end" aria-hidden="true" /></Link></Button>}>
      <form aria-label="Dashboard reporting range" className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); setRange(draftRange); }}>
        <p id="finance-range-help" className="sr-only">Choose the first and last date included in every chart and dataset on this dashboard.</p>
        <div className="grid gap-2">
          <Label htmlFor="finance-dashboard-from">Reporting range starts</Label>
          <Input id="finance-dashboard-from" type="date" value={draftRange.from} max={draftRange.to} aria-describedby="finance-range-help" onChange={(event) => setDraftRange((current) => ({ ...current, from: event.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="finance-dashboard-to">Reporting range ends</Label>
          <Input id="finance-dashboard-to" type="date" value={draftRange.to} min={draftRange.from} aria-describedby="finance-range-help" onChange={(event) => setDraftRange((current) => ({ ...current, to: event.target.value }))} />
        </div>
        <Button type="submit" disabled={query.isFetching}>Apply reporting range</Button>
        {query.isFetching ? <span role="status" className="text-sm text-muted-foreground">Updating dashboard…</span> : null}
      </form>
      {query.isLoading ? <FinanceLoading /> : query.error || !query.data ? <FinanceError error={query.error} /> : <Dashboard data={query.data} />}
    </FinanceShell>
  );
}

function Dashboard({ data }: { data: Awaited<ReturnType<typeof financeApi.dashboard>> }) {
  const balanced = Math.abs(data.book_health.difference) < 0.01;
  return <>
    <Alert variant={balanced ? "default" : "destructive"}>
      <Scale aria-hidden="true" />
      <AlertTitle>{balanced ? "Books are in balance" : "Ledger imbalance requires attention"}</AlertTitle>
      <AlertDescription>Posted debits are <Money value={data.book_health.debits} /> and posted credits are <Money value={data.book_health.credits} />. Difference: <Money value={data.book_health.difference} />.</AlertDescription>
    </Alert>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard title="Cash position" value={<Money value={data.metrics.cash_balance} />} description="Net movement across cash and bank accounts." />
      <MetricCard title="Receivables" value={<Money value={data.metrics.receivables} />} description={`${data.book_health.overdue_receivables} invoice(s) are overdue.`} />
      <MetricCard title="Payables" value={<Money value={data.metrics.payables} />} description="Outstanding supplier obligations." />
      <MetricCard title="Net income YTD" value={<Money value={data.metrics.net_income_ytd} />} description="Revenue less expense since the fiscal year began." />
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard title="Draft journals" value={data.book_health.unposted_journals} description="Entries awaiting posting." status={data.book_health.unposted_journals ? "pending" : "clear"} />
      <MetricCard title="Bank exceptions" value={data.book_health.unreconciled_bank_accounts} description="Accounts or statements needing reconciliation." status={data.book_health.unreconciled_bank_accounts ? "pending" : "clear"} />
      <MetricCard title="Locked periods" value={data.book_health.locked_periods} description="Periods protected from new postings." />
      <MetricCard title="Currency" value={data.currency} description="Default reporting and posting currency." />
    </div>
    <FinanceOverviewCharts data={data} />
    <div className="grid min-w-0 gap-6 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>Recent journal entries</CardTitle><CardDescription>Latest draft, posted, reversed, and source-module entries.</CardDescription></CardHeader><CardContent><FinanceTable<FinanceJournal> caption="Recent journal entries, newest first." rows={data.recent_journals} getKey={(row) => row.id} columns={[
        { key: "number", label: "Journal", render: (row) => <span className="font-medium">{row.number}</span> },
        { key: "date", label: "Date", render: (row) => row.entry_date },
        { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.status} /> },
        { key: "total", label: "Total", align: "right", render: (row) => <Money value={row.debit_total} /> },
      ]} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Recent financial documents</CardTitle><CardDescription>Sales, purchases, payments, expenses, and credit documents.</CardDescription></CardHeader><CardContent><FinanceTable<FinanceDocument> caption="Recent finance documents, newest first." rows={data.recent_documents} getKey={(row) => row.id} columns={[
        { key: "number", label: "Document", render: (row) => <span className="font-medium">{row.number}</span> },
        { key: "type", label: "Type", render: (row) => row.type.replaceAll("_", " ") },
        { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.status} /> },
        { key: "total", label: "Total", align: "right", render: (row) => <Money value={row.total} currency={row.currency} /> },
      ]} /></CardContent></Card>
    </div>
  </>;
}
