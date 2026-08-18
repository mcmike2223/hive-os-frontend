"use client";

import { useState, type FormEvent } from "react";
import { Calculator, Check, CircleDollarSign, Play, Plus, RefreshCw, ShieldCheck, SkipForward } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { usePermissions } from "@/hooks/use-permissions";
import { financeApi } from "@/modules/finance/api";
import { financeOperationsApi, type FinanceOperations } from "@/modules/finance/api/operations";
import type { FinanceAccount } from "@/modules/finance/types";
import { BusyLabel, FinanceError, FinanceLoading, FinanceShell, FinanceStatus, FinanceTable, MetricCard, Money } from "@/modules/finance/pages/components/finance-shell";

const today = new Date().toISOString().slice(0, 10);

export default function FinanceOperationsPage() {
  const client = useQueryClient();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["manage_finance", "manage_finance_settings", "manage_finance_integrations"]);
  const query = useQuery({ queryKey: ["finance", "operations"], queryFn: financeOperationsApi.get });
  const settings = useQuery({ queryKey: ["finance", "settings"], queryFn: financeApi.settings });
  const [showForms, setShowForms] = useState(false);
  const refresh = async () => { await client.invalidateQueries({ queryKey: ["finance"] }); };
  const mutation = useMutation({
    mutationFn: ({ task }: { task: () => Promise<unknown>; label: string }) => task(),
    onSuccess: async (_data, variables) => { await refresh(); toast.success(`${variables.label} completed.`); },
    onError: (_error, variables) => toast.error(`${variables.label} could not be completed.`),
  });

  return <FinanceShell title="Compliance and finance operations" description="Run Ethiopian tax controls, foreign-exchange rates, asset depreciation, recurring journals, bank imports, and reviewable source-module postings from one governed workspace." actions={canManage ? <Button variant="outline" aria-pressed={showForms} onClick={() => setShowForms((value) => !value)}><Plus data-icon="inline-start" aria-hidden="true" />Add operation</Button> : undefined}>
    {query.isLoading || settings.isLoading ? <FinanceLoading /> : query.error || settings.error || !query.data || !settings.data ? <FinanceError error={query.error ?? settings.error} /> : <OperationsWorkspace data={query.data} accounts={settings.data.system_accounts} canManage={canManage} showForms={showForms} busy={mutation.isPending} run={(task, label) => mutation.mutate({ task, label })} />}
  </FinanceShell>;
}

function OperationsWorkspace({ data, accounts, canManage, showForms, busy, run }: { data: FinanceOperations; accounts: FinanceAccount[]; canManage: boolean; showForms: boolean; busy: boolean; run: (task: () => Promise<unknown>, label: string) => void }) {
  const profile = data.compliance_profile;
  const pendingEvents = data.source_events.filter((event) => ["pending_mapping", "error"].includes(event.status)).length;
  const taxDue = data.tax_obligations.reduce((sum, obligation) => sum + Math.max(0, Number(obligation.tax_amount) - Number(obligation.paid_amount)), 0);
  const netAssets = data.assets.reduce((sum, asset) => sum + Number(asset.acquisition_cost) - Number(asset.accumulated_depreciation), 0);

  return <>
    <Alert><ShieldCheck aria-hidden="true" /><AlertTitle>{profile.name}</AlertTitle><AlertDescription>Effective {profile.effective_from}; {profile.reporting_framework.replaceAll("_", " ")}; VAT {Number(profile.vat_rate).toFixed(0)}%; standard withholding {Number(profile.standard_withholding_rate).toFixed(0)}%; cash control limit <Money value={profile.cash_payment_limit} />; records retained {profile.record_retention_years} years.</AlertDescription></Alert>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard title="Tax balance due" value={<Money value={taxDue} />} description={`${data.tax_obligations.filter((item) => item.status !== "paid").length} open or filed obligation(s).`} status={taxDue > 0 ? "pending" : "clear"} />
      <MetricCard title="Integration review" value={pendingEvents} description="Source events awaiting mapping or retry." status={pendingEvents ? "pending" : "clear"} />
      <MetricCard title="Net fixed assets" value={<Money value={netAssets} />} description={`${data.assets.length} registered asset(s).`} />
      <MetricCard title="Bank import queue" value={data.bank_transactions.filter((item) => item.status !== "matched").length} description="Unmatched or suggested transactions." />
    </div>

    {showForms && canManage ? <section aria-labelledby="new-operation-heading" className="space-y-4"><div><h2 id="new-operation-heading" className="text-xl font-semibold tracking-tight">Add a controlled finance operation</h2><p className="text-sm text-muted-foreground">Required fields are marked in their visible labels. Each successful action refreshes the dashboard and audit trail.</p></div><div className="grid gap-6 xl:grid-cols-2">
      <ExchangeRateForm busy={busy} onSubmit={(payload) => run(() => financeOperationsApi.exchangeRate(payload), "Exchange rate")} />
      <TaxRefreshForm busy={busy} onSubmit={(payload) => run(() => financeOperationsApi.refreshTax(payload), "Tax obligation refresh")} />
      <AssetForm accounts={accounts} busy={busy} onSubmit={(payload) => run(() => financeOperationsApi.asset(payload), "Asset registration")} />
      <RecurringForm accounts={accounts} busy={busy} onSubmit={(payload) => run(() => financeOperationsApi.recurring(payload), "Recurring journal schedule")} />
      <BankTransactionForm accounts={accounts.filter((account) => account.is_bank)} busy={busy} onSubmit={(payload) => run(() => financeOperationsApi.bankTransaction(payload), "Bank transaction import")} />
      <EinvoiceForm busy={busy} onSubmit={(documentId) => run(() => financeOperationsApi.queueEinvoice(documentId), "E-invoice outbox queue")} />
    </div></section> : null}

    <section aria-labelledby="tax-obligations-heading" className="grid min-w-0 gap-6 xl:grid-cols-2">
      <Card><CardHeader><CardTitle><h2 id="tax-obligations-heading">Tax obligations</h2></CardTitle><CardDescription>VAT and withholding calculations with filing and settlement state.</CardDescription></CardHeader><CardContent><FinanceTable caption="Tax obligations by reporting period and due date." rows={data.tax_obligations} getKey={(row) => row.id} columns={[
        { key: "type", label: "Tax", render: (row) => row.type.replaceAll("_", " ") },
        { key: "period", label: "Period", render: (row) => `${row.period_start} – ${row.period_end}` },
        { key: "due", label: "Due", render: (row) => row.due_date },
        { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.status} /> },
        { key: "balance", label: "Balance", align: "right", render: (row) => <Money value={Math.max(0, Number(row.tax_amount) - Number(row.paid_amount))} /> },
        { key: "actions", label: "Actions", align: "right", render: (row) => canManage ? <div className="flex justify-end gap-1">{row.status === "open" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => financeOperationsApi.taxAction(row.id, "file", { filing_reference: `HIVE-${row.type.toUpperCase()}-${row.period_end}` }), "Tax filing")}><Check data-icon="inline-start" aria-hidden="true" />File</Button> : null}{row.status === "filed" && Number(row.tax_amount) > Number(row.paid_amount) ? <Button size="sm" disabled={busy} onClick={() => run(() => financeOperationsApi.taxAction(row.id, "pay", { amount: Number(row.tax_amount) - Number(row.paid_amount) }), "Tax settlement")}>Settle</Button> : null}</div> : <span className="text-muted-foreground">Read only</span> },
      ]} /></CardContent></Card>

      <Card><CardHeader><CardTitle><h2>Foreign-exchange rates</h2></CardTitle><CardDescription>Spot and forward rates retain source, date, and official-rate evidence.</CardDescription></CardHeader><CardContent><FinanceTable caption="Recent transaction-currency rates against the reporting currency." rows={data.exchange_rates} getKey={(row) => row.id} columns={[
        { key: "pair", label: "Currency pair", render: (row) => <span className="font-mono">{row.base_currency}/{row.quote_currency}</span> },
        { key: "date", label: "Effective", render: (row) => row.effective_date },
        { key: "rate", label: "Rate", align: "right", render: (row) => Number(row.rate).toLocaleString("en-ET", { maximumFractionDigits: 8 }) },
        { key: "type", label: "Type", render: (row) => <FinanceStatus value={row.rate_type} /> },
        { key: "source", label: "Source", render: (row) => `${row.source}${row.is_official ? " · official" : ""}` },
      ]} /></CardContent></Card>
    </section>

    <section aria-labelledby="assets-heading" className="grid min-w-0 gap-6 xl:grid-cols-2">
      <Card><CardHeader><CardTitle><h2 id="assets-heading">Fixed assets and depreciation</h2></CardTitle><CardDescription>Straight-line books with idempotent monthly depreciation journals.</CardDescription></CardHeader><CardContent><FinanceTable caption="Registered fixed assets, accumulated depreciation, and current book value." rows={data.assets} getKey={(row) => row.id} columns={[
        { key: "asset", label: "Asset", render: (row) => <span><span className="font-mono">{row.code}</span> · {row.name}</span> },
        { key: "cost", label: "Cost", align: "right", render: (row) => <Money value={row.acquisition_cost} /> },
        { key: "book", label: "Book value", align: "right", render: (row) => <Money value={Number(row.acquisition_cost) - Number(row.accumulated_depreciation)} /> },
        { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.status} /> },
        { key: "action", label: "Action", align: "right", render: (row) => canManage && row.status === "active" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => financeOperationsApi.depreciateAsset(row.id, today), "Asset depreciation")}><Calculator data-icon="inline-start" aria-hidden="true" />Depreciate</Button> : <span className="text-muted-foreground">—</span> },
      ]} /></CardContent></Card>

      <Card><CardHeader><CardTitle><h2>Recurring journals and deferrals</h2></CardTitle><CardDescription>Scheduled postings for accruals, prepayments, deferred revenue, and recurring costs.</CardDescription></CardHeader><CardContent><FinanceTable caption="Recurring journal schedules and their next posting dates." rows={data.recurring_entries} getKey={(row) => row.id} columns={[
        { key: "name", label: "Schedule", render: (row) => row.name },
        { key: "frequency", label: "Frequency", render: (row) => row.frequency },
        { key: "next", label: "Next run", render: (row) => row.next_run_on },
        { key: "runs", label: "Runs", align: "right", render: (row) => row.run_count },
        { key: "action", label: "Action", align: "right", render: (row) => canManage && row.status === "active" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => financeOperationsApi.runRecurring(row.id, today), "Recurring journals")}><Play data-icon="inline-start" aria-hidden="true" />Run due</Button> : <FinanceStatus value={row.status} /> },
      ]} /></CardContent></Card>
    </section>

    <section aria-labelledby="integration-events-heading" className="grid min-w-0 gap-6 xl:grid-cols-2">
      <Card><CardHeader><CardTitle><h2 id="integration-events-heading">Connected module events</h2></CardTitle><CardDescription>Events post only through an explicit account mapping; exceptions stay visible and retryable.</CardDescription></CardHeader><CardContent><FinanceTable caption="Latest HR, payroll, inventory, production, warehouse, and hospitality source events." rows={data.source_events} getKey={(row) => row.id} columns={[
        { key: "source", label: "Source event", render: (row) => `${row.source_module} · ${row.event}` },
        { key: "date", label: "Date", render: (row) => row.event_date },
        { key: "amount", label: "Value", align: "right", render: (row) => <Money value={row.amount} /> },
        { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.status} /> },
        { key: "action", label: "Review action", align: "right", render: (row) => canManage && ["pending_mapping", "error"].includes(row.status) ? <div className="flex justify-end gap-1"><Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => financeOperationsApi.sourceEventAction(row.id, "retry"), "Source event retry")}><RefreshCw data-icon="inline-start" aria-hidden="true" />Retry</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => financeOperationsApi.sourceEventAction(row.id, "ignore"), "Source event review")}><SkipForward data-icon="inline-start" aria-hidden="true" />Ignore</Button></div> : <span className="font-mono text-xs">{row.journal?.number ?? "—"}</span> },
      ]} /></CardContent></Card>

      <Card><CardHeader><CardTitle><h2>Bank transaction matching</h2></CardTitle><CardDescription>Imported statement lines remain unmatched until a journal-line match is reviewed.</CardDescription></CardHeader><CardContent><FinanceTable caption="Recent imported bank transactions and matching status." rows={data.bank_transactions} getKey={(row) => row.id} columns={[
        { key: "date", label: "Date", render: (row) => row.transaction_date },
        { key: "account", label: "Account", render: (row) => row.account ? `${row.account.code} · ${row.account.name}` : String(row.account_id) },
        { key: "description", label: "Description", render: (row) => row.description },
        { key: "amount", label: "Amount", align: "right", render: (row) => <Money value={row.amount} /> },
        { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.status} /> },
      ]} /></CardContent></Card>
    </section>
  </>;
}

function ExchangeRateForm({ busy, onSubmit }: OperationFormProps) {
  return <OperationCard title="Record an exchange rate" description="Store the rate, date, type, and evidence source."><form onSubmit={(event) => submitForm(event, (values) => onSubmit({ base_currency: "ETB", quote_currency: values.get("quote_currency"), effective_date: values.get("effective_date"), rate: Number(values.get("rate")), rate_type: values.get("rate_type"), source: values.get("source"), is_official: values.get("official") === "1" }))}><FieldGroup><div className="grid gap-4 sm:grid-cols-2"><RequiredInput id="fx-currency" name="quote_currency" label="Foreign currency code (required)" maxLength={3} /><RequiredInput id="fx-date" name="effective_date" label="Effective date (required)" type="date" defaultValue={today} /><RequiredInput id="fx-rate" name="rate" label="ETB rate (required)" type="number" min="0.00000001" step="0.00000001" /><RequiredInput id="fx-source" name="source" label="Rate source (required)" /></div><Field><FieldLabel htmlFor="fx-rate-type">Rate type (required)</FieldLabel><NativeSelect id="fx-rate-type" name="rate_type" required defaultValue="spot"><NativeSelectOption value="spot">Spot</NativeSelectOption><NativeSelectOption value="forward">Forward</NativeSelectOption></NativeSelect></Field><Field><FieldLabel htmlFor="fx-official">Evidence classification</FieldLabel><NativeSelect id="fx-official" name="official" defaultValue="0"><NativeSelectOption value="0">Operational rate</NativeSelectOption><NativeSelectOption value="1">Official rate</NativeSelectOption></NativeSelect></Field><SubmitButton busy={busy}>Save exchange rate</SubmitButton></FieldGroup></form></OperationCard>;
}

function TaxRefreshForm({ busy, onSubmit }: OperationFormProps) {
  return <OperationCard title="Refresh a tax obligation" description="Recalculate VAT or withholding from posted documents."><form onSubmit={(event) => submitForm(event, (values) => onSubmit({ type: values.get("type"), period_start: values.get("period_start"), period_end: values.get("period_end"), due_date: values.get("due_date") }))}><FieldGroup><Field><FieldLabel htmlFor="tax-operation-type">Tax type (required)</FieldLabel><NativeSelect id="tax-operation-type" name="type" required defaultValue="vat"><NativeSelectOption value="vat">VAT</NativeSelectOption><NativeSelectOption value="withholding">Withholding</NativeSelectOption></NativeSelect></Field><div className="grid gap-4 sm:grid-cols-3"><RequiredInput id="tax-operation-start" name="period_start" label="Period start (required)" type="date" /><RequiredInput id="tax-operation-end" name="period_end" label="Period end (required)" type="date" /><RequiredInput id="tax-operation-due" name="due_date" label="Due date (required)" type="date" /></div><SubmitButton busy={busy}>Refresh obligation</SubmitButton></FieldGroup></form></OperationCard>;
}

function AssetForm({ accounts, busy, onSubmit }: OperationFormProps & { accounts: FinanceAccount[] }) {
  return <OperationCard title="Register a fixed asset" description="Create an asset book and its depreciation accounts."><form onSubmit={(event) => submitForm(event, (values) => onSubmit({ code: values.get("code"), name: values.get("name"), acquired_on: values.get("acquired_on"), acquisition_cost: Number(values.get("acquisition_cost")), residual_value: Number(values.get("residual_value") || 0), useful_life_months: Number(values.get("useful_life_months")), depreciation_method: "straight_line", asset_account_id: Number(values.get("asset_account_id")), accumulated_depreciation_account_id: Number(values.get("accumulated_depreciation_account_id")), depreciation_expense_account_id: Number(values.get("depreciation_expense_account_id")) }))}><FieldGroup><div className="grid gap-4 sm:grid-cols-2"><RequiredInput id="asset-code" name="code" label="Asset code (required)" /><RequiredInput id="asset-name" name="name" label="Asset name (required)" /><RequiredInput id="asset-acquired" name="acquired_on" label="Acquisition date (required)" type="date" /><RequiredInput id="asset-cost" name="acquisition_cost" label="Acquisition cost (required)" type="number" min="0.01" step="0.01" /><RequiredInput id="asset-residual" name="residual_value" label="Residual value (required)" type="number" min="0" step="0.01" defaultValue="0" /><RequiredInput id="asset-life" name="useful_life_months" label="Useful life in months (required)" type="number" min="1" /></div><AccountSelect id="asset-account" name="asset_account_id" label="Asset account (required)" accounts={accounts} defaultCode="1500" /><AccountSelect id="asset-accum" name="accumulated_depreciation_account_id" label="Accumulated depreciation account (required)" accounts={accounts} defaultCode="1510" /><AccountSelect id="asset-expense" name="depreciation_expense_account_id" label="Depreciation expense account (required)" accounts={accounts} defaultCode="5200" /><SubmitButton busy={busy}>Register asset</SubmitButton></FieldGroup></form></OperationCard>;
}

function RecurringForm({ accounts, busy, onSubmit }: OperationFormProps & { accounts: FinanceAccount[] }) {
  return <OperationCard title="Schedule a recurring journal" description="Create a balanced debit and credit template with an idempotent run schedule."><form onSubmit={(event) => submitForm(event, (values) => { const amount = Number(values.get("amount")); onSubmit({ name: values.get("name"), frequency: values.get("frequency"), starts_on: values.get("starts_on"), journal_template: { memo: values.get("name"), type: "recurring", lines: [{ account_id: Number(values.get("debit_account_id")), debit: amount, credit: 0 }, { account_id: Number(values.get("credit_account_id")), debit: 0, credit: amount }] } }); })}><FieldGroup><RequiredInput id="recurring-name" name="name" label="Schedule name (required)" /><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="recurring-frequency">Frequency (required)</FieldLabel><NativeSelect id="recurring-frequency" name="frequency" required defaultValue="monthly"><NativeSelectOption value="weekly">Weekly</NativeSelectOption><NativeSelectOption value="monthly">Monthly</NativeSelectOption><NativeSelectOption value="quarterly">Quarterly</NativeSelectOption><NativeSelectOption value="yearly">Yearly</NativeSelectOption></NativeSelect></Field><RequiredInput id="recurring-start" name="starts_on" label="First run date (required)" type="date" /></div><AccountSelect id="recurring-debit" name="debit_account_id" label="Debit account (required)" accounts={accounts} /><AccountSelect id="recurring-credit" name="credit_account_id" label="Credit account (required)" accounts={accounts} /><RequiredInput id="recurring-amount" name="amount" label="Journal amount (required)" type="number" min="0.01" step="0.01" /><SubmitButton busy={busy}>Create schedule</SubmitButton></FieldGroup></form></OperationCard>;
}

function BankTransactionForm({ accounts, busy, onSubmit }: OperationFormProps & { accounts: FinanceAccount[] }) {
  return <OperationCard title="Import a bank transaction" description="Add a statement line to the matching and reconciliation queue."><form onSubmit={(event) => submitForm(event, (values) => onSubmit({ account_id: Number(values.get("account_id")), transaction_date: values.get("transaction_date"), reference: values.get("reference"), description: values.get("description"), amount: Number(values.get("amount")), direction: values.get("direction"), import_source: "manual" }))}><FieldGroup><AccountSelect id="bank-import-account" name="account_id" label="Bank account (required)" accounts={accounts} /><div className="grid gap-4 sm:grid-cols-2"><RequiredInput id="bank-import-date" name="transaction_date" label="Transaction date (required)" type="date" defaultValue={today} /><RequiredInput id="bank-import-reference" name="reference" label="Statement reference (required)" /><RequiredInput id="bank-import-description" name="description" label="Description (required)" /><RequiredInput id="bank-import-amount" name="amount" label="Amount (required)" type="number" min="0.01" step="0.01" /></div><Field><FieldLabel htmlFor="bank-import-direction">Direction (required)</FieldLabel><NativeSelect id="bank-import-direction" name="direction" required defaultValue="inflow"><NativeSelectOption value="inflow">Inflow</NativeSelectOption><NativeSelectOption value="outflow">Outflow</NativeSelectOption></NativeSelect></Field><SubmitButton busy={busy}>Add to matching queue</SubmitButton></FieldGroup></form></OperationCard>;
}

function EinvoiceForm({ busy, onSubmit }: { busy: boolean; onSubmit: (documentId: number) => void }) {
  return <OperationCard title="Queue an electronic invoice" description="Places an approved or posted sales invoice in the connector outbox; no unsupported government API is assumed."><form onSubmit={(event) => submitForm(event, (values) => onSubmit(Number(values.get("document_id"))))}><FieldGroup><RequiredInput id="einvoice-document" name="document_id" label="Sales document ID (required)" type="number" min="1" /><FieldDescription>The connector retains queued, submitted, accepted, and failed states when an authorized integration is configured.</FieldDescription><SubmitButton busy={busy}>Queue e-invoice</SubmitButton></FieldGroup></form></OperationCard>;
}

type OperationFormProps = { busy: boolean; onSubmit: (payload: Record<string, unknown>) => void };

function OperationCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle><h3>{title}</h3></CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent>{children}</CardContent></Card>;
}

function RequiredInput({ id, name, label, ...props }: React.ComponentProps<typeof Input> & { id: string; name: string; label: string }) {
  return <Field><FieldLabel htmlFor={id}>{label}</FieldLabel><Input id={id} name={name} required {...props} /></Field>;
}

function AccountSelect({ id, name, label, accounts, defaultCode }: { id: string; name: string; label: string; accounts: FinanceAccount[]; defaultCode?: string }) {
  const defaultValue = accounts.find((account) => account.code === defaultCode)?.id;
  return <Field><FieldLabel htmlFor={id}>{label}</FieldLabel><NativeSelect id={id} name={name} required defaultValue={defaultValue ? String(defaultValue) : ""}><NativeSelectOption value="" disabled>Select an account</NativeSelectOption>{accounts.map((account) => <NativeSelectOption key={account.id} value={String(account.id)}>{account.code} · {account.name}</NativeSelectOption>)}</NativeSelect></Field>;
}

function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return <Button type="submit" disabled={busy}><CircleDollarSign data-icon="inline-start" aria-hidden="true" /><BusyLabel busy={busy}>{children}</BusyLabel></Button>;
}

function submitForm(event: FormEvent<HTMLFormElement>, callback: (values: FormData) => void) {
  event.preventDefault();
  callback(new FormData(event.currentTarget));
}
