"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, BadgeCheck, ReceiptText, Waypoints } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegendContent, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { FinanceDashboard } from "@/modules/finance/types";
import { FinanceStatus, FinanceTable, Money } from "@/modules/finance/pages/components/finance-shell";

const performanceConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  expense: { label: "Expense", color: "var(--chart-3)" },
  net: { label: "Net result", color: "var(--chart-2)" },
} satisfies ChartConfig;

const cashConfig = {
  inflow: { label: "Cash in", color: "var(--chart-1)" },
  outflow: { label: "Cash out", color: "var(--chart-3)" },
} satisfies ChartConfig;

const agingConfig = {
  receivables: { label: "Receivables", color: "var(--chart-2)" },
  payables: { label: "Payables", color: "var(--chart-4)" },
} satisfies ChartConfig;

const integrationConfig = {
  posted: { label: "Posted", color: "var(--chart-1)" },
  pending: { label: "Needs review", color: "var(--chart-3)" },
} satisfies ChartConfig;

const compactMoney = new Intl.NumberFormat("en-ET", { notation: "compact", maximumFractionDigits: 1 });

export function FinanceOverviewCharts({ data }: { data: FinanceDashboard }) {
  const datasets = data.datasets;
  const lastPerformance = datasets.performance.at(-1);
  const latestCash = datasets.cash_flow.at(-1);

  return (
    <>
      <section aria-labelledby="financial-performance-heading" className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle><h2 id="financial-performance-heading">Revenue, expense and net result</h2></CardTitle>
            <CardDescription>
              {lastPerformance ? `${lastPerformance.label}: revenue ${formatEtb(lastPerformance.revenue)}, expense ${formatEtb(lastPerformance.expense)}, net ${formatEtb(lastPerformance.net)}.` : "No posted performance activity in this range."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ChartContainer config={performanceConfig} className="h-[310px] w-full aspect-auto" role="img" aria-label="Monthly revenue, expense, and net result chart. A detailed data table follows.">
              <ComposedChart accessibilityLayer data={datasets.performance} margin={{ left: 4, right: 12, top: 12 }}>
                <CartesianGrid vertical={false} strokeDasharray="4 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} tickFormatter={(value: string) => value.split(" ")[0]} />
                <YAxis tickLine={false} axisLine={false} width={54} tickFormatter={(value: number) => compactMoney.format(value)} />
                <Tooltip content={<ChartTooltipContent indicator="line" />} />
                <Legend content={<ChartLegendContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[5, 5, 0, 0]} />
                <Bar dataKey="expense" fill="var(--color-expense)" radius={[5, 5, 0, 0]} />
                <Line dataKey="net" type="monotone" stroke="var(--color-net)" strokeWidth={3} dot={{ r: 3, fill: "var(--color-net)" }} />
              </ComposedChart>
            </ChartContainer>
            <details>
              <summary className="cursor-pointer rounded-md py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">View performance dataset</summary>
              <FinanceTable caption="Monthly revenue, expense, and net result for the selected reporting range." rows={datasets.performance} getKey={(row) => row.period} columns={[
                { key: "period", label: "Month", render: (row) => row.label },
                { key: "revenue", label: "Revenue", align: "right", render: (row) => <Money value={row.revenue} /> },
                { key: "expense", label: "Expense", align: "right", render: (row) => <Money value={row.expense} /> },
                { key: "net", label: "Net result", align: "right", render: (row) => <Money value={row.net} /> },
              ]} />
            </details>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle><h2>Cash movement</h2></CardTitle>
            <CardDescription>
              {latestCash ? `${latestCash.label}: ${formatEtb(latestCash.inflow)} in, ${formatEtb(latestCash.outflow)} out, net ${formatEtb(latestCash.net)}.` : "No posted cash activity in this range."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ChartContainer config={cashConfig} className="h-[310px] w-full aspect-auto" role="img" aria-label="Monthly cash inflow and outflow area chart. A detailed data table follows.">
              <AreaChart accessibilityLayer data={datasets.cash_flow} margin={{ left: 4, right: 12, top: 12 }}>
                <defs>
                  <linearGradient id="finance-cash-in" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-inflow)" stopOpacity={0.34} /><stop offset="95%" stopColor="var(--color-inflow)" stopOpacity={0.03} /></linearGradient>
                  <linearGradient id="finance-cash-out" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-outflow)" stopOpacity={0.26} /><stop offset="95%" stopColor="var(--color-outflow)" stopOpacity={0.02} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="4 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} tickFormatter={(value: string) => value.split(" ")[0]} />
                <YAxis tickLine={false} axisLine={false} width={54} tickFormatter={(value: number) => compactMoney.format(value)} />
                <Tooltip content={<ChartTooltipContent indicator="line" />} />
                <Legend content={<ChartLegendContent />} />
                <Area dataKey="inflow" type="monotone" stroke="var(--color-inflow)" strokeWidth={3} fill="url(#finance-cash-in)" />
                <Area dataKey="outflow" type="monotone" stroke="var(--color-outflow)" strokeWidth={3} strokeDasharray="7 4" fill="url(#finance-cash-out)" />
              </AreaChart>
            </ChartContainer>
            <details>
              <summary className="cursor-pointer rounded-md py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">View cash movement dataset</summary>
              <FinanceTable caption="Monthly cash inflow, outflow, and net movement for the selected reporting range." rows={datasets.cash_flow} getKey={(row) => row.period} columns={[
                { key: "period", label: "Month", render: (row) => row.label },
                { key: "inflow", label: "Cash in", align: "right", render: (row) => <Money value={row.inflow} /> },
                { key: "outflow", label: "Cash out", align: "right", render: (row) => <Money value={row.outflow} /> },
                { key: "net", label: "Net movement", align: "right", render: (row) => <Money value={row.net} /> },
              ]} />
            </details>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="working-capital-heading" className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle><h2 id="working-capital-heading">Working-capital aging</h2></CardTitle>
            <CardDescription>Open customer and supplier balances grouped by days past due. Patterned placement and the table preserve meaning without colour.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ChartContainer config={agingConfig} className="h-[290px] w-full aspect-auto" role="img" aria-label="Receivables and payables aging by overdue bucket. A detailed data table follows.">
              <BarChart accessibilityLayer data={datasets.aging} margin={{ left: 4, right: 12, top: 12 }}>
                <CartesianGrid vertical={false} strokeDasharray="4 4" />
                <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={54} tickFormatter={(value: number) => compactMoney.format(value)} />
                <Tooltip content={<ChartTooltipContent />} />
                <Legend content={<ChartLegendContent />} />
                <Bar dataKey="receivables" fill="var(--color-receivables)" radius={[5, 5, 0, 0]} />
                <Bar dataKey="payables" fill="var(--color-payables)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ChartContainer>
            <FinanceTable caption="Receivables and payables by aging bucket as of the selected end date." rows={datasets.aging} getKey={(row) => row.bucket} columns={[
              { key: "bucket", label: "Aging bucket", render: (row) => row.bucket },
              { key: "receivables", label: "Receivables", align: "right", render: (row) => <Money value={row.receivables} /> },
              { key: "payables", label: "Payables", align: "right", render: (row) => <Money value={row.payables} /> },
            ]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle><h2>Module-to-ledger activity</h2></CardTitle>
            <CardDescription>Operational events from HR, payroll, inventory, warehouse, production, and hospitality; unconfigured mappings remain reviewable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ChartContainer config={integrationConfig} className="h-[290px] w-full aspect-auto" role="img" aria-label="Posted and pending Finance source events by connected module. A detailed data table follows.">
              <BarChart accessibilityLayer data={datasets.module_activity} margin={{ left: 4, right: 12, top: 12 }}>
                <CartesianGrid vertical={false} strokeDasharray="4 4" />
                <XAxis dataKey="module" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={34} />
                <Tooltip content={<ChartTooltipContent />} />
                <Legend content={<ChartLegendContent />} />
                <Bar dataKey="posted" stackId="events" fill="var(--color-posted)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="pending" stackId="events" fill="var(--color-pending)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
            <FinanceTable caption="Connected module events posted to the ledger or awaiting mapping and review." rows={datasets.module_activity} getKey={(row) => row.module} columns={[
              { key: "module", label: "Module", render: (row) => row.module.replaceAll("_", " ") },
              { key: "posted", label: "Posted", align: "right", render: (row) => row.posted },
              { key: "pending", label: "Needs review", align: "right", render: (row) => row.pending },
              { key: "amount", label: "Event value", align: "right", render: (row) => <Money value={row.amount} /> },
            ]} />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="compliance-heading" className="space-y-4">
        <div>
          <h2 id="compliance-heading" className="text-xl font-semibold tracking-tight">Ethiopian compliance watch</h2>
          <p className="text-sm text-muted-foreground">Effective-dated tax, cash, e-invoice, and filing exceptions requiring finance review.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ComplianceCard icon={ReceiptText} title="Tax due" value={<Money value={datasets.compliance.tax_due} />} detail={`${datasets.compliance.open_obligations} open filing obligation(s)`} />
          <ComplianceCard icon={AlertTriangle} title="Overdue filings" value={datasets.compliance.overdue_obligations} detail="Filing or payment due date has passed" alert={datasets.compliance.overdue_obligations > 0} />
          <ComplianceCard icon={BadgeCheck} title="Withholding accrued" value={<Money value={datasets.compliance.withholding_accrued} />} detail="Purchases in the selected range" />
          <ComplianceCard icon={Waypoints} title="Control exceptions" value={datasets.compliance.cash_blocks + datasets.compliance.einvoice_pending} detail={`${datasets.compliance.cash_blocks} cash block(s), ${datasets.compliance.einvoice_pending} e-invoice item(s)`} alert={datasets.compliance.cash_blocks > 0} />
        </div>
      </section>

      <section aria-labelledby="document-status-heading" className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle><h2 id="document-status-heading">Document pipeline</h2></CardTitle><CardDescription>Count and value of finance documents by workflow status.</CardDescription></CardHeader><CardContent><FinanceTable caption="Finance document count and value by workflow status for the selected range." rows={datasets.document_status} getKey={(row) => row.status} columns={[
          { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.status} /> },
          { key: "documents", label: "Documents", align: "right", render: (row) => row.documents },
          { key: "amount", label: "Value", align: "right", render: (row) => <Money value={row.amount} /> },
        ]} /></CardContent></Card>
        <Card><CardHeader><CardTitle><h2>Budget control</h2></CardTitle><CardDescription>Approved budgets compared with posted expense activity.</CardDescription></CardHeader><CardContent><FinanceTable caption="Approved budget, actual expense, and remaining variance." rows={datasets.budget_vs_actual} getKey={(row) => row.name} columns={[
          { key: "name", label: "Budget", render: (row) => row.name },
          { key: "budget", label: "Budget", align: "right", render: (row) => <Money value={row.budget} /> },
          { key: "actual", label: "Actual", align: "right", render: (row) => <Money value={row.actual} /> },
          { key: "variance", label: "Remaining", align: "right", render: (row) => <Money value={row.variance} /> },
        ]} /></CardContent></Card>
      </section>
    </>
  );
}

function ComplianceCard({ icon: Icon, title, value, detail, alert = false }: { icon: typeof ReceiptText; title: string; value: React.ReactNode; detail: string; alert?: boolean }) {
  return <Card><CardHeader><div className="flex items-start justify-between gap-3"><div><CardDescription>{title}</CardDescription><CardTitle className="mt-1 text-2xl tabular-nums">{value}</CardTitle></div><Icon aria-hidden="true" className={alert ? "size-5 text-destructive" : "size-5 text-primary-readable"} /></div></CardHeader><CardContent><p className="text-sm text-muted-foreground">{detail}</p></CardContent></Card>;
}

function formatEtb(value: number) {
  return new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(value);
}
