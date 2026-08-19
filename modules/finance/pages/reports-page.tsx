"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { usePermissions } from "@/hooks/use-permissions";
import { getErrorMessage } from "@/lib/errors";
import api from "@/modules/shared/api/http";
import { financeApi } from "@/modules/finance/api";
import { BusyLabel, FinanceError, FinanceLoading, FinanceShell, FinanceTable, FinanceTableSkeleton, MetricCard } from "@/modules/finance/pages/components/finance-shell";

export default function FinanceReportsPage() {
  const [report, setReport] = useState("trial_balance");
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState("");
  const [contactId, setContactId] = useState("");
  const [budgetId, setBudgetId] = useState("");
  const [sourceModule, setSourceModule] = useState("");
  const [downloadingFormat, setDownloadingFormat] = useState<"csv" | "pdf" | null>(null);
  const { hasAnyPermission } = usePermissions(); const canExport = hasAnyPermission(["manage_finance", "export_finance_reports"]);
  const reportCatalog = useQuery({ queryKey: ["finance", "reports"], queryFn: () => financeApi.reports() });
  const accounts = useQuery({ queryKey: ["finance", "report-accounts"], queryFn: () => financeApi.accounts({ active: true, per_page: 200 }) });
  const contacts = useQuery({ queryKey: ["finance", "report-contacts"], queryFn: () => financeApi.contacts({ active: true, per_page: 200 }) });
  const budgets = useQuery({ queryKey: ["finance", "report-budgets"], queryFn: () => financeApi.budgets({ per_page: 200 }) });
  const reportParams = {
    from,
    to,
    account_id: accountId ? Number(accountId) : undefined,
    contact_id: contactId ? Number(contactId) : undefined,
    budget_id: budgetId ? Number(budgetId) : undefined,
    source_module: sourceModule || undefined,
  };
  const query = useQuery({
    queryKey: ["finance", "report", report, from, to, accountId, contactId, budgetId, sourceModule],
    queryFn: () => financeApi.report(report, reportParams),
  });
  const reportOptions = reportCatalog.data?.reports ?? [];
  const reportLabel = reportOptions.find((item) => item.slug === report)?.name ?? formatValue(report);
  const accountOptions = accounts.data?.data ?? [];
  const contactOptions = contacts.data?.data ?? [];
  const budgetOptions = budgets.data?.data ?? [];
  const needsAccountFilter = report === "general_ledger";
  const needsContactFilter = ["aged_receivables", "aged_payables", "customer_ledger", "vendor_ledger"].includes(report);
  const needsBudgetFilter = report === "budget_variance";
  const needsSourceModuleFilter = report === "general_journal";
  const columns = useMemo(() => {
    const first = query.data?.rows[0];
    return first ? Object.keys(first).filter((key) => !["accounts", "budget_record"].includes(key)).map((key) => ({ key, label: key.replaceAll("_", " "), render: (row: Record<string, unknown>) => formatValue(row[key]) })) : [];
  }, [query.data]);
  async function download(format: "csv" | "pdf") {
    setDownloadingFormat(format);
    try {
      const response = await api.get(`/finance/reports/${report}/export/${format}`, { params: reportParams, responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `${report}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(`The ${format.toUpperCase()} report could not be downloaded.`);
    } finally {
      setDownloadingFormat(null);
    }
  }
  return <FinanceShell title="Financial reports" description="Generate statements, subledgers, journal registers, ageing, VAT, cash, and budget variance directly from posted tenant entries." actions={canExport ? <><Button variant="outline" disabled={downloadingFormat !== null} onClick={() => download("csv")}>{downloadingFormat === "csv" ? <BusyLabel busy={true}>Exporting CSV</BusyLabel> : <><FileSpreadsheet data-icon="inline-start" aria-hidden="true" />Export CSV</>}</Button><Button disabled={downloadingFormat !== null} onClick={() => download("pdf")}>{downloadingFormat === "pdf" ? <BusyLabel busy={true}>Exporting PDF</BusyLabel> : <><Printer data-icon="inline-start" aria-hidden="true" />Export PDF</>}</Button></> : undefined}>
    <Card><CardHeader><CardTitle><h2 className="text-base font-semibold">Report criteria</h2></CardTitle><CardDescription>Only posted journals affect statements. Draft activity stays outside financial reporting.</CardDescription></CardHeader><CardContent><FieldGroup><div className="grid gap-4 md:grid-cols-3"><Field><FieldLabel htmlFor="finance-report">Report (required)</FieldLabel><NativeSelect id="finance-report" value={report} onChange={(event) => setReport(event.target.value)}>{reportOptions.map((item) => <NativeSelectOption key={item.slug} value={item.slug}>{item.name}</NativeSelectOption>)}</NativeSelect><FieldDescription>Select the financial question to answer.</FieldDescription></Field><Field><FieldLabel htmlFor="report-from">From date</FieldLabel><Input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field><Field><FieldLabel htmlFor="report-to">To date</FieldLabel><Input id="report-to" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></Field></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {needsAccountFilter ? <Field><FieldLabel htmlFor="report-account">Account</FieldLabel><NativeSelect id="report-account" value={accountId} onChange={(event) => setAccountId(event.target.value)}><NativeSelectOption value="">All accounts</NativeSelectOption>{accountOptions.map((account) => <NativeSelectOption key={account.id} value={String(account.id)}>{account.code} · {account.name}</NativeSelectOption>)}</NativeSelect></Field> : null}
      {needsContactFilter ? <Field><FieldLabel htmlFor="report-contact">Contact</FieldLabel><NativeSelect id="report-contact" value={contactId} onChange={(event) => setContactId(event.target.value)}><NativeSelectOption value="">All contacts</NativeSelectOption>{contactOptions.map((contact) => <NativeSelectOption key={contact.id} value={String(contact.id)}>{contact.code} · {contact.name}</NativeSelectOption>)}</NativeSelect></Field> : null}
      {needsBudgetFilter ? <Field><FieldLabel htmlFor="report-budget">Budget</FieldLabel><NativeSelect id="report-budget" value={budgetId} onChange={(event) => setBudgetId(event.target.value)}><NativeSelectOption value="">All budgets</NativeSelectOption>{budgetOptions.map((budget) => <NativeSelectOption key={budget.id} value={String(budget.id)}>{budget.name}</NativeSelectOption>)}</NativeSelect><FieldDescription>Pick a specific budget for variance details.</FieldDescription></Field> : null}
      {needsSourceModuleFilter ? <Field><FieldLabel htmlFor="report-source-module">Source module</FieldLabel><Input id="report-source-module" value={sourceModule} onChange={(event) => setSourceModule(event.target.value)} placeholder="finance, human_resources, hospitality..." /></Field> : null}
    </div></FieldGroup></CardContent></Card>
    {query.isPending ? (
      <>
        <FinanceLoading cards={4} />
        <FinanceTableSkeleton rows={8} cols={6} />
      </>
    ) : query.isError ? (
      <FinanceError error={query.error} title="Report could not be generated" />
    ) : (
      <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(query.data.totals).slice(0, 8).map(([key, value]) => <MetricCard key={key} title={key.replaceAll("_", " ")} value={formatValue(value)} description={`Calculated for ${from} through ${to}.`} />)}</div>
        <Card><CardHeader><CardTitle><h2 className="text-base font-semibold">{reportLabel}</h2></CardTitle><CardDescription>Generated {new Date(query.data.generated_at).toLocaleString()}.</CardDescription></CardHeader><CardContent>{columns.length ? <FinanceTable<Record<string, unknown>> caption={`${reportLabel} rows for the selected reporting period.`} rows={query.data.rows} getKey={(row) => JSON.stringify(row)} columns={columns} /> : <p className="text-sm text-muted-foreground">No report rows matched this period.</p>}</CardContent></Card>
      </>
    )}
  </FinanceShell>;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return new Intl.NumberFormat("en-ET", { maximumFractionDigits: 2 }).format(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).replaceAll("_", " ");
}
