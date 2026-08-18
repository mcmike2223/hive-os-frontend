"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { usePermissions } from "@/hooks/use-permissions";
import api from "@/modules/shared/api/http";
import { financeApi } from "@/modules/finance/api";
import { FinanceError, FinanceLoading, FinanceShell, FinanceTable, MetricCard } from "@/modules/finance/pages/components/finance-shell";

const reports = [
  ["trial_balance", "Trial balance"], ["general_ledger", "General ledger"], ["balance_sheet", "Balance sheet"], ["income_statement", "Income statement"], ["cash_flow", "Cash flow statement"],
  ["aged_receivables", "Aged receivables"], ["aged_payables", "Aged payables"], ["customer_ledger", "Customer ledger"], ["vendor_ledger", "Vendor ledger"],
  ["sales_journal", "Sales journal"], ["purchase_journal", "Purchase journal"], ["cash_receipts", "Cash receipts journal"], ["cash_payments", "Cash payments journal"], ["general_journal", "General journal register"],
  ["budget_variance", "Budget variance"], ["vat_summary", "VAT summary"],
] as const;

export default function FinanceReportsPage() {
  const [report, setReport] = useState("trial_balance");
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const { hasAnyPermission } = usePermissions(); const canExport = hasAnyPermission(["manage_finance", "export_finance_reports"]);
  const query = useQuery({ queryKey: ["finance", "report", report, from, to], queryFn: () => financeApi.report(report, { from, to }) });
  const columns = useMemo(() => {
    const first = query.data?.rows[0];
    return first ? Object.keys(first).filter((key) => !["accounts", "budget_record"].includes(key)).map((key) => ({ key, label: key.replaceAll("_", " "), render: (row: Record<string, unknown>) => formatValue(row[key]) })) : [];
  }, [query.data]);
  async function download(format: "csv" | "pdf") { try { const response = await api.get(`/finance/reports/${report}/export/${format}`, { params: { from, to }, responseType: "blob" }); const url = URL.createObjectURL(response.data); const anchor = window.document.createElement("a"); anchor.href = url; anchor.download = `${report}.${format}`; anchor.click(); URL.revokeObjectURL(url); } catch { toast.error(`The ${format.toUpperCase()} report could not be downloaded.`); } }
  return <FinanceShell title="Financial reports" description="Generate statements, subledgers, journal registers, ageing, VAT, cash, and budget variance directly from posted tenant entries." actions={canExport ? <><Button variant="outline" onClick={() => download("csv")}><FileSpreadsheet data-icon="inline-start" aria-hidden="true" />Export CSV</Button><Button onClick={() => download("pdf")}><Printer data-icon="inline-start" aria-hidden="true" />Export PDF</Button></> : undefined}>
    <Card><CardHeader><CardTitle><h2 className="text-base font-semibold">Report criteria</h2></CardTitle><CardDescription>Only posted journals affect statements. Draft activity stays outside financial reporting.</CardDescription></CardHeader><CardContent><FieldGroup><div className="grid gap-4 md:grid-cols-3"><Field><FieldLabel htmlFor="finance-report">Report (required)</FieldLabel><NativeSelect id="finance-report" value={report} onChange={(event) => setReport(event.target.value)}>{reports.map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}</NativeSelect><FieldDescription>Select the financial question to answer.</FieldDescription></Field><Field><FieldLabel htmlFor="report-from">From date</FieldLabel><Input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field><Field><FieldLabel htmlFor="report-to">To date</FieldLabel><Input id="report-to" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></Field></div></FieldGroup></CardContent></Card>
    {query.isLoading ? <FinanceLoading /> : query.error || !query.data ? <FinanceError error={query.error} title="Report could not be generated" /> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(query.data.totals).slice(0, 8).map(([key, value]) => <MetricCard key={key} title={key.replaceAll("_", " ")} value={formatValue(value)} description={`Calculated for ${from} through ${to}.`} />)}</div>
      <Card><CardHeader><CardTitle><h2 className="text-base font-semibold">{reports.find(([value]) => value === report)?.[1]}</h2></CardTitle><CardDescription>Generated {new Date(query.data.generated_at).toLocaleString()}.</CardDescription></CardHeader><CardContent>{columns.length ? <FinanceTable<Record<string, unknown>> caption={`${reports.find(([value]) => value === report)?.[1]} rows for the selected reporting period.`} rows={query.data.rows} getKey={(row) => JSON.stringify(row)} columns={columns} /> : <p className="text-sm text-muted-foreground">No report rows matched this period.</p>}</CardContent></Card>
    </>}
  </FinanceShell>;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return new Intl.NumberFormat("en-ET", { maximumFractionDigits: 2 }).format(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).replaceAll("_", " ");
}
