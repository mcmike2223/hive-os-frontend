"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Calculator, Check, CircleDollarSign, Play, Plus, RefreshCw, SkipForward } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getErrorMessage } from "@/lib/errors";
import { usePermissions } from "@/hooks/use-permissions";
import { financeApi } from "@/modules/finance/api";
import {
  financeOperationsApi,
  type FinanceComplianceProfile,
  type FinanceOperations,
} from "@/modules/finance/api/operations";
import type { FinanceAccount, FinanceDocument } from "@/modules/finance/types";
import {
  BusyLabel,
  FinanceError,
  FinanceLoading,
  FinanceShell,
  FinanceStatus,
  FinanceTable,
  FinanceTableSkeleton,
  MetricCard,
  Money,
  useDebouncedValue,
} from "@/modules/finance/pages/components/finance-shell";

const today = new Date().toISOString().slice(0, 10);

function formatDate(value: string) {
  return value.slice(0, 10);
}

const operationTypes = [
  ["compliance_profile", "Publish compliance profile"],
  ["exchange_rate", "Record exchange rate"],
  ["tax_refresh", "Refresh tax obligation"],
  ["asset", "Register fixed asset"],
  ["recurring", "Schedule recurring journal"],
  ["bank_transaction", "Import bank transaction"],
  ["einvoice", "Queue e-invoice"],
] as const;

type OperationType = (typeof operationTypes)[number][0];

type TaxObligation = FinanceOperations["tax_obligations"][number];
type ExchangeRate = FinanceOperations["exchange_rates"][number];
type Asset = FinanceOperations["assets"][number];
type RecurringEntry = FinanceOperations["recurring_entries"][number];
type SourceEvent = FinanceOperations["source_events"][number];
type BankTransaction = FinanceOperations["bank_transactions"][number];

type RunFn = (task: () => Promise<unknown>, label: string, busyKey: string) => void;

function TaxActions({
  row,
  canManage,
  anyBusy,
  busyKey,
  run,
}: {
  row: TaxObligation;
  canManage: boolean;
  anyBusy: boolean;
  busyKey: string | null;
  run: RunFn;
}) {
  if (!canManage) return <span className="text-muted-foreground">Read only</span>;

  const balance = Math.max(0, Number(row.tax_amount) - Number(row.paid_amount));
  const fileKey = `tax:${row.id}:file`;
  const payKey = `tax:${row.id}:pay`;

  if (row.status === "open") {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={anyBusy}
        onClick={() =>
          run(
            () => financeOperationsApi.taxAction(row.id, "file", { filing_reference: `HIVE-${row.type.toUpperCase()}-${row.period_end}` }),
            "Tax filing",
            fileKey,
          )
        }
      >
        {busyKey === fileKey ? (
          <BusyLabel busy>File</BusyLabel>
        ) : (
          <>
            <Check data-icon="inline-start" aria-hidden="true" />
            File
          </>
        )}
      </Button>
    );
  }

  if (row.status === "filed") {
    const label = balance > 0 ? "Settle" : "Mark paid";
    return (
      <Button
        size="sm"
        disabled={anyBusy}
        onClick={() =>
          run(
            () => financeOperationsApi.taxAction(row.id, "pay", { amount: balance }),
            balance > 0 ? "Tax settlement" : "Tax obligation closure",
            payKey,
          )
        }
      >
        {busyKey === payKey ? <BusyLabel busy>{label}</BusyLabel> : label}
      </Button>
    );
  }

  if (row.status === "paid") {
    return <span className="text-sm text-muted-foreground">Paid</span>;
  }

  return <span className="text-muted-foreground">—</span>;
}

export default function FinanceOperationsPage() {
  const client = useQueryClient();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["manage_finance", "manage_finance_settings", "manage_finance_integrations"]);
  const query = useQuery({ queryKey: ["finance", "operations"], queryFn: financeOperationsApi.get });
  const settings = useQuery({ queryKey: ["finance", "settings"], queryFn: financeApi.settings });
  const [showForms, setShowForms] = useState(false);
  const [operationType, setOperationType] = useState<OperationType>("exchange_rate");
  const [formResetKey, setFormResetKey] = useState(0);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const anyBusy = busyKey !== null;
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["finance"] });
  };
  const mutation = useMutation({
    mutationFn: ({ task }: { task: () => Promise<unknown>; label: string; busyKey: string }) => task(),
    onMutate: (variables) => setBusyKey(variables.busyKey),
    onSettled: () => setBusyKey(null),
    onSuccess: async (data, variables) => {
      await refresh();
      setFormResetKey((value) => value + 1);
      if (variables.label === "Asset depreciation" && data && typeof data === "object" && "processed" in data) {
        const processed = Number((data as { processed: number }).processed);
        if (processed === 0) {
          toast.message("No depreciation was posted.", {
            description: "Use a through date on or after the next month-end depreciation period for this asset.",
          });
          return;
        }
        toast.success(`${processed} depreciation journal(s) posted.`);
        return;
      }
      if (variables.label === "Recurring journals" && data && typeof data === "object" && "processed" in data) {
        const processed = Number((data as { processed: number }).processed);
        if (processed === 0) {
          toast.message("No recurring journals were posted.", {
            description: "Use a through date on or after the schedule's next run date.",
          });
          return;
        }
        toast.success(`${processed} recurring journal(s) posted.`);
        return;
      }
      toast.success(`${variables.label} completed.`);
    },
    onError: (error, variables) => toast.error(getErrorMessage(error, `${variables.label} could not be completed.`)),
  });

  return (
    <FinanceShell
      title="Compliance and finance operations"
      description="Run Ethiopian tax controls, foreign-exchange rates, asset depreciation, recurring journals, bank imports, and reviewable source-module postings from one governed workspace."
      actions={
        canManage ? (
          <Button variant="outline" aria-pressed={showForms} disabled={anyBusy} onClick={() => setShowForms((value) => !value)}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            {showForms ? "Hide operation form" : "Add operation"}
          </Button>
        ) : undefined
      }
    >
    {query.isPending || settings.isPending ? (
      <>
        <FinanceLoading cards={4} />
        <div className="grid gap-6 xl:grid-cols-2">
          <FinanceTableSkeleton rows={5} cols={6} />
          <FinanceTableSkeleton rows={5} cols={5} />
        </div>
      </>
    ) : query.isError || settings.isError || !query.data || !settings.data ? (
      <FinanceError error={query.error ?? settings.error} />
    ) : (
        <OperationsWorkspace
          data={query.data}
          accounts={settings.data.system_accounts}
          canManage={canManage}
          showForms={showForms}
          operationType={operationType}
          onOperationTypeChange={setOperationType}
          formResetKey={formResetKey}
          anyBusy={anyBusy}
          busyKey={busyKey}
          run={(task, label, key) => mutation.mutate({ task, label, busyKey: key })}
        />
      )}
    </FinanceShell>
  );
}

function OperationsWorkspace({
  data,
  accounts,
  canManage,
  showForms,
  operationType,
  onOperationTypeChange,
  formResetKey,
  anyBusy,
  busyKey,
  run,
}: {
  data: FinanceOperations;
  accounts: FinanceAccount[];
  canManage: boolean;
  showForms: boolean;
  operationType: OperationType;
  onOperationTypeChange: (value: OperationType) => void;
  formResetKey: number;
  anyBusy: boolean;
  busyKey: string | null;
  run: RunFn;
}) {
  const profile = data.compliance_profile;
  const pendingEvents = data.source_events.filter((event) => ["pending_mapping", "error"].includes(event.status)).length;
  const taxDue = data.tax_obligations.reduce((sum, obligation) => sum + Math.max(0, Number(obligation.tax_amount) - Number(obligation.paid_amount)), 0);
  const netAssets = data.assets.reduce((sum, asset) => sum + Number(asset.acquisition_cost) - Number(asset.accumulated_depreciation), 0);
  const bankAccounts = accounts.filter((account) => account.is_bank);

  const [taxStatusFilter, setTaxStatusFilter] = useState("");
  const [taxTypeFilter, setTaxTypeFilter] = useState("");
  const [fxQuoteFilter, setFxQuoteFilter] = useState("");
  const [assetStatusFilter, setAssetStatusFilter] = useState("");
  const [recurringStatusFilter, setRecurringStatusFilter] = useState("");
  const [sourceStatusFilter, setSourceStatusFilter] = useState("");
  const [sourceModuleInput, setSourceModuleInput] = useState("");
  const sourceModuleSearch = useDebouncedValue(sourceModuleInput.trim().toLowerCase());
  const [bankStatusFilter, setBankStatusFilter] = useState("");

  const [detailTax, setDetailTax] = useState<TaxObligation | null>(null);
  const [detailFx, setDetailFx] = useState<ExchangeRate | null>(null);
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null);
  const [detailRecurring, setDetailRecurring] = useState<RecurringEntry | null>(null);
  const [detailSource, setDetailSource] = useState<SourceEvent | null>(null);
  const [detailBankId, setDetailBankId] = useState<number | null>(null);
  const [detailBankOpen, setDetailBankOpen] = useState(false);

  const [depreciateAsset, setDepreciateAsset] = useState<Asset | null>(null);
  const [runRecurring, setRunRecurring] = useState<RecurringEntry | null>(null);

  const bankDetailQuery = useQuery({
    queryKey: ["finance", "operations", "bank-transaction", detailBankId],
    enabled: detailBankOpen && detailBankId !== null,
    queryFn: () => financeOperationsApi.getBankTransaction(detailBankId!),
  });

  const einvoiceDocuments = useQuery({
    queryKey: ["finance", "einvoice-documents"],
    enabled: showForms && operationType === "einvoice",
    queryFn: () => financeApi.documents({ group: "sales", per_page: 200 }),
  });
  const einvoiceQueueQuery = useQuery({
    queryKey: ["finance", "einvoice-queue"],
    queryFn: () => financeApi.documents({ group: "sales", per_page: 200 }),
  });
  const einvoiceOptions =
    einvoiceDocuments.data?.data.filter(
      (document) => ["sales_invoice", "credit_note"].includes(document.type) && !["draft", "voided"].includes(document.status),
    ) ?? [];
  const einvoiceQueue = useMemo(
    () =>
      (einvoiceQueueQuery.data?.data ?? []).filter(
        (document) => document.einvoice_status && document.einvoice_status !== "not_required",
      ),
    [einvoiceQueueQuery.data],
  );

  const fxCurrencies = useMemo(
    () => [...new Set(data.exchange_rates.map((row) => row.quote_currency))].sort(),
    [data.exchange_rates],
  );

  const filteredTax = useMemo(
    () =>
      data.tax_obligations.filter(
        (row) =>
          (!taxStatusFilter || row.status === taxStatusFilter) &&
          (!taxTypeFilter || row.type === taxTypeFilter),
      ),
    [data.tax_obligations, taxStatusFilter, taxTypeFilter],
  );

  const filteredFx = useMemo(
    () => data.exchange_rates.filter((row) => !fxQuoteFilter || row.quote_currency === fxQuoteFilter),
    [data.exchange_rates, fxQuoteFilter],
  );

  const filteredAssets = useMemo(
    () => data.assets.filter((row) => !assetStatusFilter || row.status === assetStatusFilter),
    [data.assets, assetStatusFilter],
  );

  const filteredRecurring = useMemo(
    () => data.recurring_entries.filter((row) => !recurringStatusFilter || row.status === recurringStatusFilter),
    [data.recurring_entries, recurringStatusFilter],
  );

  const filteredSourceEvents = useMemo(
    () =>
      data.source_events.filter(
        (row) =>
          (!sourceStatusFilter || row.status === sourceStatusFilter) &&
          (!sourceModuleSearch || row.source_module.toLowerCase().includes(sourceModuleSearch)),
      ),
    [data.source_events, sourceStatusFilter, sourceModuleSearch],
  );

  const filteredBankTransactions = useMemo(
    () => data.bank_transactions.filter((row) => !bankStatusFilter || row.status === bankStatusFilter),
    [data.bank_transactions, bankStatusFilter],
  );

  const openBankDetail = (row: BankTransaction) => {
    if (anyBusy) return;
    setDetailBankId(row.id);
    setDetailBankOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Active compliance profile</h2>
          </CardTitle>
          <CardDescription>Tax and control rules currently applied to documents and obligations.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField label="Profile">{profile.name}</DetailField>
            <DetailField label="Code"><span className="font-mono">{profile.code}</span></DetailField>
            <DetailField label="Effective from">{formatDate(profile.effective_from)}</DetailField>
            <DetailField label="Framework">{profile.reporting_framework.replaceAll("_", " ")}</DetailField>
            <DetailField label="VAT">{Number(profile.vat_rate).toFixed(0)}%</DetailField>
            <DetailField label="Standard withholding">{Number(profile.standard_withholding_rate).toFixed(0)}%</DetailField>
            <DetailField label="Cash control limit"><Money value={profile.cash_payment_limit} /></DetailField>
            <DetailField label="Record retention">{profile.record_retention_years} years</DetailField>
          </div>
        </CardContent>
      </Card>

      {data.profiles.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Compliance profile history</h2>
            </CardTitle>
            <CardDescription>Previously published profiles for this tenant.</CardDescription>
          </CardHeader>
          <CardContent>
            <FinanceTable
              caption="Compliance profiles ordered by effective date."
              rows={data.profiles}
              getKey={(row) => row.id}
              columns={[
                { key: "code", label: "Code", render: (row) => <span className="font-mono">{row.code}</span> },
                { key: "name", label: "Name", render: (row) => row.name },
                { key: "effective", label: "Effective", render: (row) => `${formatDate(row.effective_from)}${row.effective_to ? ` – ${formatDate(row.effective_to)}` : ""}` },
                { key: "framework", label: "Framework", render: (row) => row.reporting_framework.replaceAll("_", " ") },
                { key: "vat", label: "VAT", align: "right", render: (row) => `${Number(row.vat_rate).toFixed(0)}%` },
                {
                  key: "default",
                  label: "Active",
                  render: (row) => (row.id === profile.id ? <FinanceStatus value="active" /> : "—"),
                },
              ]}
            />
          </CardContent>
        </Card>
      ) : null}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard title="Tax balance due" value={<Money value={taxDue} />} description={`${data.tax_obligations.filter((item) => item.status !== "paid").length} open or filed obligation(s).`} status={taxDue > 0 ? "pending" : "clear"} />
      <MetricCard title="Integration review" value={pendingEvents} description="Source events awaiting mapping or retry." status={pendingEvents ? "pending" : "clear"} />
      <MetricCard title="Net fixed assets" value={<Money value={netAssets} />} description={`${data.assets.length} registered asset(s).`} />
      <MetricCard title="Bank import queue" value={data.bank_transactions.filter((item) => item.status !== "matched").length} description="Unmatched or suggested transactions." />
    </div>

      {showForms && canManage ? (
        <section aria-labelledby="new-operation-heading" className="space-y-4">
          <h2 id="new-operation-heading" className="text-xl font-semibold tracking-tight">
            Add a controlled finance operation
          </h2>
          <Card>
            <CardContent className="pt-6">
              <Field>
                <FieldLabel htmlFor="operation-type">Operation type</FieldLabel>
                <NativeSelect
                  id="operation-type"
                  value={operationType}
                  disabled={anyBusy}
                  onChange={(event) => onOperationTypeChange(event.target.value as OperationType)}
                >
                  {operationTypes.map(([value, label]) => (
                    <NativeSelectOption key={value} value={value}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </CardContent>
          </Card>

          {operationType === "compliance_profile" ? (
            <ComplianceProfileForm
              key={`compliance-${formResetKey}`}
              profile={profile}
              anyBusy={anyBusy}
              loading={busyKey === "form:compliance_profile"}
              onSubmit={(payload) => run(() => financeOperationsApi.complianceProfile(payload), "Compliance profile", "form:compliance_profile")}
            />
          ) : null}
          {operationType === "exchange_rate" ? (
            <ExchangeRateForm key={`fx-${formResetKey}`} anyBusy={anyBusy} loading={busyKey === "form:exchange_rate"} onSubmit={(payload) => run(() => financeOperationsApi.exchangeRate(payload), "Exchange rate", "form:exchange_rate")} />
          ) : null}
          {operationType === "tax_refresh" ? (
            <TaxRefreshForm key={`tax-${formResetKey}`} anyBusy={anyBusy} loading={busyKey === "form:tax_refresh"} onSubmit={(payload) => run(() => financeOperationsApi.refreshTax(payload), "Tax obligation refresh", "form:tax_refresh")} />
          ) : null}
          {operationType === "asset" ? (
            <AssetForm key={`asset-${formResetKey}`} accounts={accounts} anyBusy={anyBusy} loading={busyKey === "form:asset"} onSubmit={(payload) => run(() => financeOperationsApi.asset(payload), "Asset registration", "form:asset")} />
          ) : null}
          {operationType === "recurring" ? (
            <RecurringForm key={`recurring-${formResetKey}`} accounts={accounts} anyBusy={anyBusy} loading={busyKey === "form:recurring"} onSubmit={(payload) => run(() => financeOperationsApi.recurring(payload), "Recurring journal schedule", "form:recurring")} />
          ) : null}
          {operationType === "bank_transaction" ? (
            <BankTransactionForm key={`bank-${formResetKey}`} accounts={bankAccounts} anyBusy={anyBusy} loading={busyKey === "form:bank_transaction"} onSubmit={(payload) => run(() => financeOperationsApi.bankTransaction(payload), "Bank transaction import", "form:bank_transaction")} />
          ) : null}
          {operationType === "einvoice" ? (
            <EinvoiceForm
              key={`einvoice-${formResetKey}`}
              documents={einvoiceOptions}
              loading={einvoiceDocuments.isPending}
              anyBusy={anyBusy}
              formLoading={busyKey === "form:einvoice"}
              onSubmit={(documentId) => run(() => financeOperationsApi.queueEinvoice(documentId), "E-invoice outbox queue", "form:einvoice")}
            />
          ) : null}
        </section>
      ) : null}

    <section aria-labelledby="tax-obligations-heading" className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id="tax-obligations-heading">Tax obligations</h2>
            </CardTitle>
            <CardDescription>VAT and withholding calculations with filing and settlement state.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="tax-status-filter">Status</FieldLabel>
                <NativeSelect id="tax-status-filter" value={taxStatusFilter} onChange={(event) => setTaxStatusFilter(event.target.value)}>
                  <NativeSelectOption value="">All statuses</NativeSelectOption>
                  <NativeSelectOption value="open">Open</NativeSelectOption>
                  <NativeSelectOption value="filed">Filed</NativeSelectOption>
                  <NativeSelectOption value="paid">Paid</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="tax-type-filter">Tax type</FieldLabel>
                <NativeSelect id="tax-type-filter" value={taxTypeFilter} onChange={(event) => setTaxTypeFilter(event.target.value)}>
                  <NativeSelectOption value="">All types</NativeSelectOption>
                  <NativeSelectOption value="vat">VAT</NativeSelectOption>
                  <NativeSelectOption value="withholding">Withholding</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>
            <FinanceTable
              caption="Tax obligations by reporting period and due date."
              rows={filteredTax}
              getKey={(row) => row.id}
              onRowClick={(row) => {
                if (anyBusy) return;
                setDetailTax(row);
              }}
              columns={[
        { key: "type", label: "Tax", render: (row) => row.type.replaceAll("_", " ") },
        { key: "period", label: "Period", render: (row) => `${row.period_start} – ${row.period_end}` },
        { key: "due", label: "Due", render: (row) => row.due_date },
        { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.status} /> },
        { key: "balance", label: "Balance", align: "right", render: (row) => <Money value={Math.max(0, Number(row.tax_amount) - Number(row.paid_amount))} /> },
                {
                  key: "actions",
                  label: "Actions",
                  align: "right",
                  render: (row) => <TaxActions row={row} canManage={canManage} anyBusy={anyBusy} busyKey={busyKey} run={run} />,
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Foreign-exchange rates</h2>
            </CardTitle>
            <CardDescription>Spot and forward rates retain source, date, and official-rate evidence.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="fx-quote-filter">Quote currency</FieldLabel>
              <NativeSelect id="fx-quote-filter" value={fxQuoteFilter} onChange={(event) => setFxQuoteFilter(event.target.value)}>
                <NativeSelectOption value="">All currencies</NativeSelectOption>
                {fxCurrencies.map((currency) => (
                  <NativeSelectOption key={currency} value={currency}>
                    {currency}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <FinanceTable
              caption="Recent transaction-currency rates against the reporting currency."
              rows={filteredFx}
              getKey={(row) => row.id}
              onRowClick={(row) => {
                if (anyBusy) return;
                setDetailFx(row);
              }}
              columns={[
        { key: "pair", label: "Currency pair", render: (row) => <span className="font-mono">{row.base_currency}/{row.quote_currency}</span> },
        { key: "date", label: "Effective", render: (row) => row.effective_date },
        { key: "rate", label: "Rate", align: "right", render: (row) => Number(row.rate).toLocaleString("en-ET", { maximumFractionDigits: 8 }) },
        { key: "type", label: "Type", render: (row) => <FinanceStatus value={row.rate_type} /> },
        { key: "source", label: "Source", render: (row) => `${row.source}${row.is_official ? " · official" : ""}` },
              ]}
            />
          </CardContent>
        </Card>
    </section>

    <section aria-labelledby="assets-heading" className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id="assets-heading">Fixed assets and depreciation</h2>
            </CardTitle>
            <CardDescription>Straight-line books with idempotent monthly depreciation journals.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="asset-status-filter">Status</FieldLabel>
              <NativeSelect id="asset-status-filter" value={assetStatusFilter} onChange={(event) => setAssetStatusFilter(event.target.value)}>
                <NativeSelectOption value="">All statuses</NativeSelectOption>
                <NativeSelectOption value="active">Active</NativeSelectOption>
                <NativeSelectOption value="fully_depreciated">Fully depreciated</NativeSelectOption>
                <NativeSelectOption value="disposed">Disposed</NativeSelectOption>
              </NativeSelect>
            </Field>
            <FinanceTable
              caption="Registered fixed assets, accumulated depreciation, and current book value."
              rows={filteredAssets}
              getKey={(row) => row.id}
              onRowClick={(row) => {
                if (anyBusy) return;
                setDetailAsset(row);
              }}
              columns={[
        { key: "asset", label: "Asset", render: (row) => <span><span className="font-mono">{row.code}</span> · {row.name}</span> },
        { key: "cost", label: "Cost", align: "right", render: (row) => <Money value={row.acquisition_cost} /> },
        { key: "book", label: "Book value", align: "right", render: (row) => <Money value={Number(row.acquisition_cost) - Number(row.accumulated_depreciation)} /> },
        { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.status} /> },
                {
                  key: "action",
                  label: "Action",
                  align: "right",
                  render: (row) => {
                    if (!canManage || row.status !== "active") {
                      return <span className="text-muted-foreground">—</span>;
                    }
                    const actionKey = `asset:${row.id}:depreciate`;
                    return (
                      <Button size="sm" variant="outline" disabled={anyBusy} onClick={() => setDepreciateAsset(row)}>
                        {busyKey === actionKey ? (
                          <BusyLabel busy>Depreciate</BusyLabel>
                        ) : (
                          <>
                            <Calculator data-icon="inline-start" aria-hidden="true" />
                            Depreciate
                          </>
                        )}
                      </Button>
                    );
                  },
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Recurring journals and deferrals</h2>
            </CardTitle>
            <CardDescription>Scheduled postings for accruals, prepayments, deferred revenue, and recurring costs.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="recurring-status-filter">Status</FieldLabel>
              <NativeSelect id="recurring-status-filter" value={recurringStatusFilter} onChange={(event) => setRecurringStatusFilter(event.target.value)}>
                <NativeSelectOption value="">All statuses</NativeSelectOption>
                <NativeSelectOption value="active">Active</NativeSelectOption>
                <NativeSelectOption value="completed">Completed</NativeSelectOption>
              </NativeSelect>
            </Field>
            <FinanceTable
              caption="Recurring journal schedules and their next posting dates."
              rows={filteredRecurring}
              getKey={(row) => row.id}
              onRowClick={(row) => {
                if (anyBusy) return;
                setDetailRecurring(row);
              }}
              columns={[
        { key: "name", label: "Schedule", render: (row) => row.name },
        { key: "frequency", label: "Frequency", render: (row) => row.frequency },
                { key: "next", label: "Next run", render: (row) => formatDate(row.next_run_on) },
        { key: "runs", label: "Runs", align: "right", render: (row) => row.run_count },
                {
                  key: "action",
                  label: "Action",
                  align: "right",
                  render: (row) => {
                    if (!canManage || row.status !== "active") {
                      return <FinanceStatus value={row.status} />;
                    }
                    const actionKey = `recurring:${row.id}:run`;
                    return (
                      <Button size="sm" variant="outline" disabled={anyBusy} onClick={() => setRunRecurring(row)}>
                        {busyKey === actionKey ? (
                          <BusyLabel busy>Run due</BusyLabel>
                        ) : (
                          <>
                            <Play data-icon="inline-start" aria-hidden="true" />
                            Run due
                          </>
                        )}
                      </Button>
                    );
                  },
                },
              ]}
            />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="einvoice-queue-heading">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id="einvoice-queue-heading">E-invoice outbox</h2>
            </CardTitle>
            <CardDescription>Queued sales invoices and credit notes awaiting connector submission.</CardDescription>
          </CardHeader>
          <CardContent>
            {einvoiceQueueQuery.isPending ? (
              <FinanceTableSkeleton rows={4} cols={5} />
            ) : einvoiceQueue.length === 0 ? (
              <p className="text-sm text-muted-foreground">No queued e-invoices.</p>
            ) : (
              <FinanceTable
                caption="Sales documents in the e-invoice connector queue."
                rows={einvoiceQueue}
                getKey={(row) => row.id}
                columns={[
                  { key: "number", label: "Document", render: (row) => <span className="font-mono">{row.number}</span> },
                  { key: "type", label: "Type", render: (row) => row.type.replaceAll("_", " ") },
                  { key: "date", label: "Date", render: (row) => formatDate(row.document_date) },
                  { key: "status", label: "Document status", render: (row) => <FinanceStatus value={row.status} /> },
                  { key: "einvoice", label: "E-invoice", render: (row) => <FinanceStatus value={row.einvoice_status ?? "queued"} /> },
                ]}
              />
            )}
          </CardContent>
        </Card>
    </section>

    <section aria-labelledby="integration-events-heading" className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id="integration-events-heading">Connected module events</h2>
            </CardTitle>
            <CardDescription>Events post only through an explicit account mapping; exceptions stay visible and retryable.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="source-status-filter">Status</FieldLabel>
                <NativeSelect id="source-status-filter" value={sourceStatusFilter} onChange={(event) => setSourceStatusFilter(event.target.value)}>
                  <NativeSelectOption value="">All statuses</NativeSelectOption>
                  <NativeSelectOption value="pending_mapping">Pending mapping</NativeSelectOption>
                  <NativeSelectOption value="posted">Posted</NativeSelectOption>
                  <NativeSelectOption value="ignored">Ignored</NativeSelectOption>
                  <NativeSelectOption value="error">Error</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="source-module-search">Source module</FieldLabel>
                <Input
                  id="source-module-search"
                  type="search"
                  value={sourceModuleInput}
                  onChange={(event) => setSourceModuleInput(event.target.value)}
                  placeholder="Filter by module name"
                />
              </Field>
            </div>
            <FinanceTable
              caption="Latest HR, payroll, inventory, production, warehouse, and hospitality source events."
              rows={filteredSourceEvents}
              getKey={(row) => row.id}
              onRowClick={(row) => {
                if (anyBusy) return;
                setDetailSource(row);
              }}
              columns={[
        { key: "source", label: "Source event", render: (row) => `${row.source_module} · ${row.event}` },
        { key: "date", label: "Date", render: (row) => row.event_date },
        { key: "amount", label: "Value", align: "right", render: (row) => <Money value={row.amount} /> },
        { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.status} /> },
                {
                  key: "action",
                  label: "Review action",
                  align: "right",
                  render: (row) => {
                    if (!canManage || !["pending_mapping", "error"].includes(row.status)) {
                      return <span className="font-mono text-xs">{row.journal?.number ?? "—"}</span>;
                    }
                    const retryKey = `source:${row.id}:retry`;
                    const ignoreKey = `source:${row.id}:ignore`;
                    return (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={anyBusy}
                          onClick={() => run(() => financeOperationsApi.sourceEventAction(row.id, "retry"), "Source event retry", retryKey)}
                        >
                          {busyKey === retryKey ? (
                            <BusyLabel busy>Retry</BusyLabel>
                          ) : (
                            <>
                              <RefreshCw data-icon="inline-start" aria-hidden="true" />
                              Retry
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={anyBusy}
                          onClick={() => run(() => financeOperationsApi.sourceEventAction(row.id, "ignore"), "Source event review", ignoreKey)}
                        >
                          {busyKey === ignoreKey ? (
                            <BusyLabel busy>Ignore</BusyLabel>
                          ) : (
                            <>
                              <SkipForward data-icon="inline-start" aria-hidden="true" />
                              Ignore
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  },
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Bank transaction matching</h2>
            </CardTitle>
            <CardDescription>Imported statement lines remain unmatched until a journal-line match is reviewed.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="bank-status-filter">Status</FieldLabel>
              <NativeSelect id="bank-status-filter" value={bankStatusFilter} onChange={(event) => setBankStatusFilter(event.target.value)}>
                <NativeSelectOption value="">All statuses</NativeSelectOption>
                <NativeSelectOption value="unmatched">Unmatched</NativeSelectOption>
                <NativeSelectOption value="suggested">Suggested</NativeSelectOption>
                <NativeSelectOption value="matched">Matched</NativeSelectOption>
                <NativeSelectOption value="ignored">Ignored</NativeSelectOption>
              </NativeSelect>
            </Field>
            <FinanceTable
              caption="Recent imported bank transactions and matching status."
              rows={filteredBankTransactions}
              getKey={(row) => row.id}
              onRowClick={openBankDetail}
              columns={[
        { key: "date", label: "Date", render: (row) => row.transaction_date },
                { key: "account", label: "Account", render: (row) => (row.account ? `${row.account.code} · ${row.account.name}` : String(row.account_id)) },
        { key: "description", label: "Description", render: (row) => row.description },
        { key: "amount", label: "Amount", align: "right", render: (row) => <Money value={row.amount} /> },
        { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.status} /> },
              ]}
            />
          </CardContent>
        </Card>
    </section>

      <TaxDetailDialog
        obligation={detailTax}
        canManage={canManage}
        anyBusy={anyBusy}
        busyKey={busyKey}
        run={run}
        onOpenChange={(open) => { if (!open) setDetailTax(null); }}
      />
      <ExchangeRateDetailDialog rate={detailFx} onOpenChange={(open) => { if (!open) setDetailFx(null); }} />
      <AssetDetailDialog asset={detailAsset} onOpenChange={(open) => { if (!open) setDetailAsset(null); }} />
      <RecurringDetailDialog entry={detailRecurring} onOpenChange={(open) => { if (!open) setDetailRecurring(null); }} />
      <SourceEventDetailDialog event={detailSource} onOpenChange={(open) => { if (!open) setDetailSource(null); }} />

      <BankTransactionDetailDialog
        open={detailBankOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDetailBankOpen(false);
            setDetailBankId(null);
          }
        }}
        detail={bankDetailQuery.data}
        loading={bankDetailQuery.isPending}
        error={bankDetailQuery.error}
        canManage={canManage}
        anyBusy={anyBusy}
        busyKey={busyKey}
        transactionId={detailBankId}
        onMatch={(journalLineId) => {
          if (!detailBankId) return;
          run(
            () => financeOperationsApi.bankTransactionAction(detailBankId, "match", { journal_line_id: journalLineId }),
            "Bank transaction match",
            `bank:${detailBankId}:match`,
          );
          setDetailBankOpen(false);
          setDetailBankId(null);
        }}
        onIgnore={() => {
          if (!detailBankId) return;
          run(
            () => financeOperationsApi.bankTransactionAction(detailBankId, "ignore"),
            "Bank transaction review",
            `bank:${detailBankId}:ignore`,
          );
          setDetailBankOpen(false);
          setDetailBankId(null);
        }}
      />

      <ThroughDateDialog
        key={depreciateAsset ? `dep-${depreciateAsset.id}` : "dep-none"}
        open={depreciateAsset !== null}
        title="Run asset depreciation"
        description={depreciateAsset ? `${depreciateAsset.code} · ${depreciateAsset.name}` : ""}
        submitLabel="Depreciate through date"
        anyBusy={anyBusy}
        loading={depreciateAsset !== null && busyKey === `asset:${depreciateAsset.id}:depreciate`}
        defaultDate={today}
        onOpenChange={(open) => { if (!open) setDepreciateAsset(null); }}
        onSubmit={(throughDate) => {
          if (!depreciateAsset) return;
          run(
            () => financeOperationsApi.depreciateAsset(depreciateAsset.id, throughDate),
            "Asset depreciation",
            `asset:${depreciateAsset.id}:depreciate`,
          );
          setDepreciateAsset(null);
        }}
      />

      <ThroughDateDialog
        key={runRecurring ? `rec-${runRecurring.id}` : "rec-none"}
        open={runRecurring !== null}
        title="Run recurring journal"
        description={runRecurring ? runRecurring.name : ""}
        submitLabel="Run through date"
        anyBusy={anyBusy}
        loading={runRecurring !== null && busyKey === `recurring:${runRecurring.id}:run`}
        defaultDate={runRecurring ? formatDate(runRecurring.next_run_on) : today}
        minDate={runRecurring ? formatDate(runRecurring.next_run_on) : undefined}
        onOpenChange={(open) => { if (!open) setRunRecurring(null); }}
        onSubmit={(throughDate) => {
          if (!runRecurring) return;
          run(
            () => financeOperationsApi.runRecurring(runRecurring.id, throughDate),
            "Recurring journals",
            `recurring:${runRecurring.id}:run`,
          );
          setRunRecurring(null);
        }}
      />
    </>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{children}</div>
    </div>
  );
}

function TaxDetailDialog({
  obligation,
  canManage,
  anyBusy,
  busyKey,
  run,
  onOpenChange,
}: {
  obligation: TaxObligation | null;
  canManage: boolean;
  anyBusy: boolean;
  busyKey: string | null;
  run: RunFn;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={obligation !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tax obligation details</DialogTitle>
          <DialogDescription>Reporting period, filing state, and settlement balance.</DialogDescription>
        </DialogHeader>
        {obligation ? (
          <div className="flex flex-col gap-4 pb-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Tax type">{obligation.type.replaceAll("_", " ")}</DetailField>
              <DetailField label="Status"><FinanceStatus value={obligation.status} /></DetailField>
              <DetailField label="Period">{obligation.period_start} – {obligation.period_end}</DetailField>
              <DetailField label="Due date">{obligation.due_date}</DetailField>
              <DetailField label="Taxable amount"><Money value={obligation.taxable_amount} /></DetailField>
              <DetailField label="Tax amount"><Money value={obligation.tax_amount} /></DetailField>
              <DetailField label="Paid amount"><Money value={obligation.paid_amount} /></DetailField>
              <DetailField label="Balance due"><Money value={Math.max(0, Number(obligation.tax_amount) - Number(obligation.paid_amount))} /></DetailField>
              {obligation.filing_reference ? (
                <DetailField label="Filing reference"><span className="font-mono">{obligation.filing_reference}</span></DetailField>
              ) : null}
            </div>
            <div className="flex justify-end">
              <TaxActions row={obligation} canManage={canManage} anyBusy={anyBusy} busyKey={busyKey} run={run} />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ExchangeRateDetailDialog({ rate, onOpenChange }: { rate: ExchangeRate | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={rate !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Exchange rate details</DialogTitle>
          <DialogDescription>Rate evidence retained for audit and revaluation.</DialogDescription>
        </DialogHeader>
        {rate ? (
          <div className="grid gap-4 pb-2 sm:grid-cols-2">
            <DetailField label="Currency pair"><span className="font-mono">{rate.base_currency}/{rate.quote_currency}</span></DetailField>
            <DetailField label="Effective date">{rate.effective_date}</DetailField>
            <DetailField label="Rate">{Number(rate.rate).toLocaleString("en-ET", { maximumFractionDigits: 8 })}</DetailField>
            <DetailField label="Rate type"><FinanceStatus value={rate.rate_type} /></DetailField>
            <DetailField label="Source">{rate.source}</DetailField>
            <DetailField label="Classification">{rate.is_official ? "Official rate" : "Operational rate"}</DetailField>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AssetDetailDialog({ asset, onOpenChange }: { asset: Asset | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={asset !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fixed asset details</DialogTitle>
          <DialogDescription>Acquisition, depreciation, and current book value.</DialogDescription>
        </DialogHeader>
        {asset ? (
          <div className="grid gap-4 pb-2 sm:grid-cols-2">
            <DetailField label="Code"><span className="font-mono">{asset.code}</span></DetailField>
            <DetailField label="Name">{asset.name}</DetailField>
            {asset.category ? <DetailField label="Category">{asset.category}</DetailField> : null}
            <DetailField label="Acquired on">{formatDate(asset.acquired_on)}</DetailField>
            <DetailField label="Status"><FinanceStatus value={asset.status} /></DetailField>
            <DetailField label="Acquisition cost"><Money value={asset.acquisition_cost} /></DetailField>
            <DetailField label="Residual value"><Money value={asset.residual_value} /></DetailField>
            <DetailField label="Accumulated depreciation"><Money value={asset.accumulated_depreciation} /></DetailField>
            <DetailField label="Book value"><Money value={Number(asset.acquisition_cost) - Number(asset.accumulated_depreciation)} /></DetailField>
            <DetailField label="Useful life">{asset.useful_life_months} months</DetailField>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RecurringDetailDialog({ entry, onOpenChange }: { entry: RecurringEntry | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={entry !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Recurring journal details</DialogTitle>
          <DialogDescription>Schedule metadata and run history.</DialogDescription>
        </DialogHeader>
        {entry ? (
          <div className="grid gap-4 pb-2 sm:grid-cols-2">
            <DetailField label="Schedule">{entry.name}</DetailField>
            <DetailField label="Status"><FinanceStatus value={entry.status} /></DetailField>
            <DetailField label="Frequency">{entry.frequency}</DetailField>
            <DetailField label="Next run">{formatDate(entry.next_run_on)}</DetailField>
            {entry.starts_on ? <DetailField label="Starts on">{formatDate(entry.starts_on)}</DetailField> : null}
            <DetailField label="Run count">{entry.run_count}</DetailField>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SourceEventDetailDialog({ event, onOpenChange }: { event: SourceEvent | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={event !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Source event details</DialogTitle>
          <DialogDescription>Integration posting context and journal linkage.</DialogDescription>
        </DialogHeader>
        {event ? (
          <div className="grid gap-4 pb-2 sm:grid-cols-2">
            <DetailField label="Source module">{event.source_module}</DetailField>
            <DetailField label="Event">{event.event}</DetailField>
            <DetailField label="Event date">{event.event_date}</DetailField>
            <DetailField label="Amount"><Money value={event.amount} /></DetailField>
            <DetailField label="Status"><FinanceStatus value={event.status} /></DetailField>
            {event.journal ? (
              <DetailField label="Journal"><span className="font-mono">{event.journal.number}</span> · <FinanceStatus value={event.journal.status} /></DetailField>
            ) : null}
            {event.error_message ? (
              <div className="sm:col-span-2">
                <DetailField label="Error">{event.error_message}</DetailField>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function BankTransactionDetailDialog({
  open,
  onOpenChange,
  detail,
  loading,
  error,
  canManage,
  anyBusy,
  busyKey,
  transactionId,
  onMatch,
  onIgnore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: Awaited<ReturnType<typeof financeOperationsApi.getBankTransaction>> | undefined;
  loading: boolean;
  error: unknown;
  canManage: boolean;
  anyBusy: boolean;
  busyKey: string | null;
  transactionId: number | null;
  onMatch: (journalLineId: number) => void;
  onIgnore: () => void;
}) {
  const [selectedLineId, setSelectedLineId] = useState("");
  const transaction = detail?.transaction;
  const canMatch = transaction && ["unmatched", "suggested"].includes(transaction.status);
  const matchedJournalNumber = transaction?.journalLine?.journal?.number;
  const matchKey = transactionId !== null ? `bank:${transactionId}:match` : null;
  const ignoreKey = transactionId !== null ? `bank:${transactionId}:ignore` : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSelectedLineId("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bank transaction matching</DialogTitle>
          <DialogDescription>Review the imported statement line and link it to a journal entry.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-4 text-muted-foreground">Loading…</div>
        ) : error ? (
          <FinanceError error={error} />
        ) : transaction ? (
          <div className="flex flex-col gap-6 pb-2">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Date">{transaction.transaction_date}</DetailField>
              <DetailField label="Account">
                {transaction.account ? `${transaction.account.code} · ${transaction.account.name}` : transaction.account_id}
              </DetailField>
              <DetailField label="Status"><FinanceStatus value={transaction.status} /></DetailField>
              <DetailField label="Amount"><Money value={transaction.amount} /></DetailField>
              <DetailField label="Direction">{transaction.direction}</DetailField>
              {transaction.reference ? <DetailField label="Reference"><span className="font-mono">{transaction.reference}</span></DetailField> : null}
            </div>

            <DetailField label="Description">{transaction.description}</DetailField>

            {transaction.status === "matched" && matchedJournalNumber ? (
              <DetailField label="Linked journal"><span className="font-mono">{matchedJournalNumber}</span></DetailField>
            ) : null}

            {canMatch ? (
              <div className="space-y-4 rounded-md border p-4">
                <Field>
                  <FieldLabel htmlFor="bank-match-candidate">Journal line candidate</FieldLabel>
                  <NativeSelect
                    id="bank-match-candidate"
                    value={selectedLineId}
                    onChange={(event) => setSelectedLineId(event.target.value)}
                    required
                  >
                    <NativeSelectOption value="" disabled>
                      {detail?.candidates.length ? "Select a journal line" : "No candidates found"}
                    </NativeSelectOption>
                    {(detail?.candidates ?? []).map((candidate) => (
                      <NativeSelectOption key={candidate.id} value={String(candidate.id)}>
                        {candidate.journal?.number ?? `#${candidate.id}`} · {candidate.journal?.entry_date ?? "—"} ·{" "}
                        {Number(candidate.debit) > 0 ? `Dr ${candidate.debit}` : `Cr ${candidate.credit}`}
                        {candidate.description ? ` · ${candidate.description}` : ""}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldDescription>Suggested journal lines within amount and date tolerance.</FieldDescription>
                </Field>

                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={anyBusy || !selectedLineId}
                      onClick={() => onMatch(Number(selectedLineId))}
                    >
                      {busyKey === matchKey ? (
                        <BusyLabel busy>Match</BusyLabel>
                      ) : (
                        <>
                          <Check data-icon="inline-start" aria-hidden="true" />
                          Match
                        </>
                      )}
                    </Button>
                    <Button variant="outline" disabled={anyBusy} onClick={onIgnore}>
                      {busyKey === ignoreKey ? (
                        <BusyLabel busy>Ignore</BusyLabel>
                      ) : (
                        <>
                          <SkipForward data-icon="inline-start" aria-hidden="true" />
                          Ignore
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">You have read-only access to bank matching.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ThroughDateDialog({
  open,
  title,
  description,
  submitLabel,
  anyBusy,
  loading,
  defaultDate,
  minDate,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  submitLabel: string;
  anyBusy: boolean;
  loading: boolean;
  defaultDate: string;
  minDate?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (throughDate: string) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(String(new FormData(event.currentTarget).get("through_date")));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="through-date">Through date (required)</FieldLabel>
            <Input id="through-date" name="through_date" type="date" required defaultValue={defaultDate} min={minDate} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={anyBusy}>
              Cancel
            </Button>
            <Button type="submit" disabled={anyBusy}>
              {loading ? <BusyLabel busy>{submitLabel}</BusyLabel> : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ComplianceProfileForm({
  profile,
  anyBusy,
  loading,
  onSubmit,
}: OperationFormProps & { profile: FinanceComplianceProfile }) {
  return (
    <OperationCard title="Publish a compliance profile" description="Create a new effective-dated Ethiopian tax and control profile. Defaults are copied from the active profile.">
      <form
        onSubmit={(event) =>
          submitForm(event, (values) =>
            onSubmit({
              code: values.get("code"),
              name: values.get("name"),
              jurisdiction: values.get("jurisdiction") || undefined,
              reporting_framework: values.get("reporting_framework"),
              effective_from: values.get("effective_from"),
              effective_to: values.get("effective_to") || undefined,
              vat_rate: Number(values.get("vat_rate")),
              goods_withholding_threshold: Number(values.get("goods_withholding_threshold")),
              services_withholding_threshold: Number(values.get("services_withholding_threshold")),
              standard_withholding_rate: Number(values.get("standard_withholding_rate")),
              unlicensed_withholding_rate: Number(values.get("unlicensed_withholding_rate")),
              cash_payment_limit: Number(values.get("cash_payment_limit")),
              record_retention_years: Number(values.get("record_retention_years")),
            }),
          )
        }
      >
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <RequiredInput id="compliance-code" name="code" label="Profile code (required)" defaultValue={profile.code} />
            <RequiredInput id="compliance-name" name="name" label="Profile name (required)" defaultValue={profile.name} />
            <Field>
              <FieldLabel htmlFor="compliance-jurisdiction">Jurisdiction</FieldLabel>
              <Input id="compliance-jurisdiction" name="jurisdiction" defaultValue={profile.jurisdiction ?? "ET"} />
            </Field>
            <Field>
              <FieldLabel htmlFor="compliance-framework">Reporting framework (required)</FieldLabel>
              <NativeSelect id="compliance-framework" name="reporting_framework" required defaultValue={profile.reporting_framework}>
                <NativeSelectOption value="IFRS">IFRS</NativeSelectOption>
                <NativeSelectOption value="IFRS_FOR_SMES">IFRS for SMEs</NativeSelectOption>
                <NativeSelectOption value="IPSAS">IPSAS</NativeSelectOption>
              </NativeSelect>
            </Field>
            <RequiredInput id="compliance-effective-from" name="effective_from" label="Effective from (required)" type="date" defaultValue={formatDate(profile.effective_from)} />
            <Field>
              <FieldLabel htmlFor="compliance-effective-to">Effective to</FieldLabel>
              <Input id="compliance-effective-to" name="effective_to" type="date" defaultValue={profile.effective_to ?? ""} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <RequiredInput id="compliance-vat" name="vat_rate" label="VAT rate % (required)" type="number" min="0" step="0.01" defaultValue={profile.vat_rate} />
            <RequiredInput id="compliance-standard-wh" name="standard_withholding_rate" label="Standard withholding % (required)" type="number" min="0" step="0.01" defaultValue={profile.standard_withholding_rate} />
            <RequiredInput id="compliance-unlicensed-wh" name="unlicensed_withholding_rate" label="Unlicensed withholding % (required)" type="number" min="0" step="0.01" defaultValue={profile.unlicensed_withholding_rate} />
            <RequiredInput id="compliance-goods-threshold" name="goods_withholding_threshold" label="Goods withholding threshold (required)" type="number" min="0" step="0.01" defaultValue={profile.goods_withholding_threshold} />
            <RequiredInput id="compliance-services-threshold" name="services_withholding_threshold" label="Services withholding threshold (required)" type="number" min="0" step="0.01" defaultValue={profile.services_withholding_threshold} />
            <RequiredInput id="compliance-cash-limit" name="cash_payment_limit" label="Cash payment limit (required)" type="number" min="0" step="0.01" defaultValue={profile.cash_payment_limit} />
            <RequiredInput id="compliance-retention" name="record_retention_years" label="Record retention years (required)" type="number" min="1" defaultValue={String(profile.record_retention_years)} />
          </div>
          <SubmitButton disabled={anyBusy} loading={loading}>Publish compliance profile</SubmitButton>
        </FieldGroup>
      </form>
    </OperationCard>
  );
}

const commonCurrencies = ["USD", "EUR", "GBP", "CHF", "CNY", "AED", "SAR", "KES"];

function ExchangeRateForm({ anyBusy, loading, onSubmit }: OperationFormProps) {
  return (
    <OperationCard title="Record an exchange rate" description="Store the rate, date, type, and evidence source.">
      <form onSubmit={(event) => submitForm(event, (values) => onSubmit({ base_currency: "ETB", quote_currency: values.get("quote_currency"), effective_date: values.get("effective_date"), rate: Number(values.get("rate")), rate_type: values.get("rate_type"), source: values.get("source"), is_official: values.get("official") === "1" }))}>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="fx-currency">Foreign currency (required)</FieldLabel>
              <NativeSelect id="fx-currency" name="quote_currency" required defaultValue="USD">
                {commonCurrencies.map((currency) => (
                  <NativeSelectOption key={currency} value={currency}>
                    {currency}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <RequiredInput id="fx-date" name="effective_date" label="Effective date (required)" type="date" defaultValue={today} />
            <RequiredInput id="fx-rate" name="rate" label="ETB rate (required)" type="number" min="0.00000001" step="0.00000001" />
            <RequiredInput id="fx-source" name="source" label="Rate source (required)" placeholder="NBE, bank, manual" />
          </div>
          <Field>
            <FieldLabel htmlFor="fx-rate-type">Rate type (required)</FieldLabel>
            <NativeSelect id="fx-rate-type" name="rate_type" required defaultValue="spot">
              <NativeSelectOption value="spot">Spot</NativeSelectOption>
              <NativeSelectOption value="forward">Forward</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="fx-official">Evidence classification</FieldLabel>
            <NativeSelect id="fx-official" name="official" defaultValue="0">
              <NativeSelectOption value="0">Operational rate</NativeSelectOption>
              <NativeSelectOption value="1">Official rate</NativeSelectOption>
            </NativeSelect>
          </Field>
          <SubmitButton disabled={anyBusy} loading={loading}>Save exchange rate</SubmitButton>
        </FieldGroup>
      </form>
    </OperationCard>
  );
}

function TaxRefreshForm({ anyBusy, loading, onSubmit }: OperationFormProps) {
  return (
    <OperationCard title="Refresh a tax obligation" description="Recalculate VAT or withholding from posted documents for a reporting period.">
      <form onSubmit={(event) => submitForm(event, (values) => onSubmit({ type: values.get("type"), period_start: values.get("period_start"), period_end: values.get("period_end"), due_date: values.get("due_date") }))}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="tax-operation-type">Tax type (required)</FieldLabel>
            <NativeSelect id="tax-operation-type" name="type" required defaultValue="vat">
              <NativeSelectOption value="vat">VAT</NativeSelectOption>
              <NativeSelectOption value="withholding">Withholding</NativeSelectOption>
            </NativeSelect>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <RequiredInput id="tax-operation-start" name="period_start" label="Period start (required)" type="date" />
            <RequiredInput id="tax-operation-end" name="period_end" label="Period end (required)" type="date" />
            <RequiredInput id="tax-operation-due" name="due_date" label="Due date (required)" type="date" />
          </div>
          <SubmitButton disabled={anyBusy} loading={loading}>Refresh obligation</SubmitButton>
        </FieldGroup>
      </form>
    </OperationCard>
  );
}

function AssetForm({ accounts, anyBusy, loading, onSubmit }: OperationFormProps & { accounts: FinanceAccount[] }) {
  return (
    <OperationCard title="Register a fixed asset" description="Create an asset book and its depreciation accounts.">
      <form
        onSubmit={(event) =>
          submitForm(event, (values) =>
            onSubmit({
              code: values.get("code"),
              name: values.get("name"),
              category: values.get("category") || undefined,
              acquired_on: values.get("acquired_on"),
              acquisition_cost: Number(values.get("acquisition_cost")),
              residual_value: Number(values.get("residual_value") || 0),
              useful_life_months: Number(values.get("useful_life_months")),
              depreciation_method: "straight_line",
              asset_account_id: Number(values.get("asset_account_id")),
              accumulated_depreciation_account_id: Number(values.get("accumulated_depreciation_account_id")),
              depreciation_expense_account_id: Number(values.get("depreciation_expense_account_id")),
            }),
          )
        }
      >
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <RequiredInput id="asset-code" name="code" label="Asset code (required)" />
            <RequiredInput id="asset-name" name="name" label="Asset name (required)" />
            <Field>
              <FieldLabel htmlFor="asset-category">Category</FieldLabel>
              <Input id="asset-category" name="category" placeholder="Equipment, vehicles, buildings…" />
              <FieldDescription>Optional classification for reporting.</FieldDescription>
            </Field>
            <RequiredInput id="asset-acquired" name="acquired_on" label="Acquisition date (required)" type="date" />
            <RequiredInput id="asset-cost" name="acquisition_cost" label="Acquisition cost (required)" type="number" min="0.01" step="0.01" />
            <RequiredInput id="asset-residual" name="residual_value" label="Residual value (required)" type="number" min="0" step="0.01" defaultValue="0" />
            <RequiredInput id="asset-life" name="useful_life_months" label="Useful life in months (required)" type="number" min="1" />
          </div>
          <AccountSelect id="asset-account" name="asset_account_id" label="Asset account (required)" accounts={accounts} defaultCode="1500" />
          <AccountSelect id="asset-accum" name="accumulated_depreciation_account_id" label="Accumulated depreciation account (required)" accounts={accounts} defaultCode="1510" />
          <AccountSelect id="asset-expense" name="depreciation_expense_account_id" label="Depreciation expense account (required)" accounts={accounts} defaultCode="5200" />
          <SubmitButton disabled={anyBusy} loading={loading}>Register asset</SubmitButton>
        </FieldGroup>
      </form>
    </OperationCard>
  );
}

function RecurringForm({ accounts, anyBusy, loading, onSubmit }: OperationFormProps & { accounts: FinanceAccount[] }) {
  return (
    <OperationCard title="Schedule a recurring journal" description="Create a balanced debit and credit template with an idempotent run schedule.">
      <form onSubmit={(event) => submitForm(event, (values) => {
        const amount = Number(values.get("amount"));
        onSubmit({
          name: values.get("name"),
          frequency: values.get("frequency"),
          starts_on: values.get("starts_on"),
          journal_template: {
            memo: values.get("name"),
            type: "recurring",
            lines: [
              { account_id: Number(values.get("debit_account_id")), debit: amount, credit: 0 },
              { account_id: Number(values.get("credit_account_id")), debit: 0, credit: amount },
            ],
          },
        });
      })}>
        <FieldGroup>
          <RequiredInput id="recurring-name" name="name" label="Schedule name (required)" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="recurring-frequency">Frequency (required)</FieldLabel>
              <NativeSelect id="recurring-frequency" name="frequency" required defaultValue="monthly">
                <NativeSelectOption value="weekly">Weekly</NativeSelectOption>
                <NativeSelectOption value="monthly">Monthly</NativeSelectOption>
                <NativeSelectOption value="quarterly">Quarterly</NativeSelectOption>
                <NativeSelectOption value="yearly">Yearly</NativeSelectOption>
              </NativeSelect>
            </Field>
            <RequiredInput id="recurring-start" name="starts_on" label="First run date (required)" type="date" />
          </div>
          <AccountSelect id="recurring-debit" name="debit_account_id" label="Debit account (required)" accounts={accounts} />
          <AccountSelect id="recurring-credit" name="credit_account_id" label="Credit account (required)" accounts={accounts} />
          <RequiredInput id="recurring-amount" name="amount" label="Journal amount (required)" type="number" min="0.01" step="0.01" />
          <SubmitButton disabled={anyBusy} loading={loading}>Create schedule</SubmitButton>
        </FieldGroup>
      </form>
    </OperationCard>
  );
}

function BankTransactionForm({ accounts, anyBusy, loading, onSubmit }: OperationFormProps & { accounts: FinanceAccount[] }) {
  return (
    <OperationCard title="Import a bank transaction" description="Add a statement line to the matching and reconciliation queue.">
      <form onSubmit={(event) => submitForm(event, (values) => onSubmit({ account_id: Number(values.get("account_id")), transaction_date: values.get("transaction_date"), reference: values.get("reference"), description: values.get("description"), amount: Number(values.get("amount")), direction: values.get("direction"), import_source: "manual" }))}>
        <FieldGroup>
          <AccountSelect id="bank-import-account" name="account_id" label="Bank account (required)" accounts={accounts} />
          <div className="grid gap-4 sm:grid-cols-2">
            <RequiredInput id="bank-import-date" name="transaction_date" label="Transaction date (required)" type="date" defaultValue={today} />
            <RequiredInput id="bank-import-reference" name="reference" label="Statement reference (required)" />
            <RequiredInput id="bank-import-description" name="description" label="Description (required)" />
            <RequiredInput id="bank-import-amount" name="amount" label="Amount (required)" type="number" min="0.01" step="0.01" />
          </div>
          <Field>
            <FieldLabel htmlFor="bank-import-direction">Direction (required)</FieldLabel>
            <NativeSelect id="bank-import-direction" name="direction" required defaultValue="inflow">
              <NativeSelectOption value="inflow">Inflow</NativeSelectOption>
              <NativeSelectOption value="outflow">Outflow</NativeSelectOption>
            </NativeSelect>
          </Field>
          <SubmitButton disabled={anyBusy} loading={loading}>Add to matching queue</SubmitButton>
        </FieldGroup>
      </form>
    </OperationCard>
  );
}

function EinvoiceForm({
  documents,
  loading,
  anyBusy,
  formLoading,
  onSubmit,
}: {
  documents: FinanceDocument[];
  loading: boolean;
  anyBusy: boolean;
  formLoading: boolean;
  onSubmit: (documentId: number) => void;
}) {
  return (
    <OperationCard title="Queue an electronic invoice" description="Places an approved or posted sales invoice in the connector outbox.">
      <form onSubmit={(event) => submitForm(event, (values) => onSubmit(Number(values.get("document_id"))))}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="einvoice-document">Sales document (required)</FieldLabel>
            <NativeSelect id="einvoice-document" name="document_id" required defaultValue="">
              <NativeSelectOption value="" disabled>
                {loading ? "Loading documents…" : documents.length ? "Select a sales invoice or credit note" : "No eligible documents found"}
              </NativeSelectOption>
              {documents.map((document) => (
                <NativeSelectOption key={document.id} value={String(document.id)}>
                  {document.number} · {document.type.replaceAll("_", " ")} · {document.status}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>Only approved or posted sales invoices and credit notes can be queued.</FieldDescription>
          </Field>
          <SubmitButton disabled={anyBusy || loading || documents.length === 0} loading={formLoading}>Queue e-invoice</SubmitButton>
        </FieldGroup>
      </form>
    </OperationCard>
  );
}

type OperationFormProps = { anyBusy: boolean; loading: boolean; onSubmit: (payload: Record<string, unknown>) => void };

function OperationCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>{title}</h3>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function RequiredInput({ id, name, label, ...props }: React.ComponentProps<typeof Input> & { id: string; name: string; label: string }) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} name={name} required {...props} />
    </Field>
  );
}

function AccountSelect({ id, name, label, accounts, defaultCode }: { id: string; name: string; label: string; accounts: FinanceAccount[]; defaultCode?: string }) {
  const defaultValue = accounts.find((account) => account.code === defaultCode)?.id;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect id={id} name={name} required defaultValue={defaultValue ? String(defaultValue) : ""}>
        <NativeSelectOption value="" disabled>
          Select an account
        </NativeSelectOption>
        {accounts.map((account) => (
          <NativeSelectOption key={account.id} value={String(account.id)}>
            {account.code} · {account.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
}

function SubmitButton({ disabled, loading, children }: { disabled: boolean; loading: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" disabled={disabled}>
      {!loading ? <CircleDollarSign data-icon="inline-start" aria-hidden="true" /> : null}
      {loading ? <BusyLabel busy>{children}</BusyLabel> : children}
    </Button>
  );
}

function submitForm(event: FormEvent<HTMLFormElement>, callback: (values: FormData) => void) {
  event.preventDefault();
  callback(new FormData(event.currentTarget));
}
