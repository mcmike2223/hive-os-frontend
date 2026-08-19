"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Check, Edit, LockKeyhole, MoreVertical, PlugZap, Plus, Power, Send, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/errors";
import { usePermissions } from "@/hooks/use-permissions";
import { financeApi } from "@/modules/finance/api";
import type {
  FinanceAccountMapping,
  FinancePeriod,
  FinanceTaxRate,
  FinanceUnlockRequest,
} from "@/modules/finance/types";
import {
  BusyLabel,
  FinanceError,
  FinanceShell,
  FinanceStatus,
  FinanceTable,
  FinanceTableSkeleton,
  useDebouncedValue,
} from "@/modules/finance/pages/components/finance-shell";

type RunFn = (task: () => Promise<unknown>, label: string, busyKey: string) => void;

type HospitalitySyncResult = Awaited<ReturnType<typeof financeApi.syncHospitality>>;

function toastHospitalitySync(data: unknown) {
  if (!data || typeof data !== "object") {
    toast.success("Hospitality sync completed.");
    return;
  }

  const result = data as HospitalitySyncResult;

  if (result.message) {
    toast.message("Hospitality sync unavailable.", { description: result.message });
    return;
  }

  if (result.available === 0) {
    toast.message("No hospitality settlements to sync.", {
      description: "Posted restaurant settlements for this tenant will appear here after POS checkout.",
    });
    return;
  }

  if (result.failed > 0) {
    const firstError = result.errors?.[0]?.message;
    toast.error(`${result.failed} posting(s) could not be synced.`, {
      description: firstError ?? `${result.created} created, ${result.skipped} already synced.`,
    });
    return;
  }

  if (result.created > 0) {
    toast.success(`${result.created} finance journal(s) created.`, {
      description: result.skipped > 0 ? `${result.skipped} posting(s) were already synced.` : undefined,
    });
    return;
  }

  toast.message("All hospitality postings were already synced.", {
    description: `${result.skipped} posting(s) checked; no new journals were needed.`,
  });
}

export default function FinanceSettingsPage() {
  const client = useQueryClient();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["manage_finance", "manage_finance_settings"]);
  const canPeriods = hasAnyPermission(["manage_finance", "manage_fiscal_periods"]);
  const canRequestUnlock = hasAnyPermission(["manage_finance", "request_finance_unlocks"]);
  const canIntegrate = hasAnyPermission(["manage_finance", "manage_finance_integrations"]);
  const canApproveUnlock = hasAnyPermission(["manage_finance", "approve_finance_unlocks"]);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const anyBusy = busyKey !== null;

  const [taxStatusFilter, setTaxStatusFilter] = useState("");
  const [taxKindFilter, setTaxKindFilter] = useState("");
  const [periodStatusFilter, setPeriodStatusFilter] = useState("");
  const [unlockStatusFilter, setUnlockStatusFilter] = useState("");
  const [mappingModuleInput, setMappingModuleInput] = useState("");
  const mappingModuleSearch = useDebouncedValue(mappingModuleInput.trim().toLowerCase());
  const [mappingStatusFilter, setMappingStatusFilter] = useState("");

  const [showTaxForm, setShowTaxForm] = useState(false);
  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const [showMappingForm, setShowMappingForm] = useState(false);

  const [editTax, setEditTax] = useState<FinanceTaxRate | null>(null);
  const [editMapping, setEditMapping] = useState<FinanceAccountMapping | null>(null);
  const [unlocking, setUnlocking] = useState<FinancePeriod | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ request: FinanceUnlockRequest; decision: "approved" | "rejected" } | null>(null);

  const [detailTax, setDetailTax] = useState<FinanceTaxRate | null>(null);
  const [detailPeriod, setDetailPeriod] = useState<FinancePeriod | null>(null);
  const [detailUnlock, setDetailUnlock] = useState<FinanceUnlockRequest | null>(null);
  const [detailMapping, setDetailMapping] = useState<FinanceAccountMapping | null>(null);

  const query = useQuery({ queryKey: ["finance", "settings"], queryFn: financeApi.settings });
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["finance"] });
  };

  const mutation = useMutation({
    mutationFn: ({ task }: { task: () => Promise<unknown>; label: string; busyKey: string }) => task(),
    onMutate: (variables) => setBusyKey(variables.busyKey),
    onSettled: () => setBusyKey(null),
    onSuccess: async (data, variables) => {
      await refresh();
      if (variables.label === "Tax rate created" || variables.label === "Tax rate updated") {
        setShowTaxForm(false);
        setEditTax(null);
      }
      if (variables.label === "Fiscal period created") setShowPeriodForm(false);
      if (variables.label === "Account mapping saved") {
        setShowMappingForm(false);
        setEditMapping(null);
      }
      if (variables.label === "Unlock request submitted") setUnlocking(null);
      if (variables.label === "Unlock request reviewed") setReviewTarget(null);
      if (variables.label === "Hospitality sync") {
        toastHospitalitySync(data);
        return;
      }
      toast.success(`${variables.label}.`);
    },
    onError: (error, variables) => toast.error(getErrorMessage(error, `${variables.label} could not be completed.`)),
  });

  const run: RunFn = (task, label, key) => {
    mutation.mutate({ task, label, busyKey: key });
  };

  const filteredTax = useMemo(() => {
    if (!query.data) return [];
    return query.data.tax_rates.filter(
      (row) =>
        (!taxStatusFilter || (taxStatusFilter === "active" ? row.is_active : !row.is_active)) &&
        (!taxKindFilter || row.kind === taxKindFilter),
    );
  }, [query.data, taxStatusFilter, taxKindFilter]);

  const filteredPeriods = useMemo(() => {
    if (!query.data) return [];
    return query.data.periods.filter((row) => !periodStatusFilter || row.status === periodStatusFilter);
  }, [query.data, periodStatusFilter]);

  const filteredUnlocks = useMemo(() => {
    if (!query.data) return [];
    return query.data.unlock_requests.filter((row) => !unlockStatusFilter || row.status === unlockStatusFilter);
  }, [query.data, unlockStatusFilter]);

  const filteredMappings = useMemo(() => {
    if (!query.data) return [];
    return query.data.account_mappings.filter(
      (row) =>
        (!mappingStatusFilter || (mappingStatusFilter === "active" ? row.is_active : !row.is_active)) &&
        (!mappingModuleSearch || row.source_module.toLowerCase().includes(mappingModuleSearch) || row.event.toLowerCase().includes(mappingModuleSearch)),
    );
  }, [query.data, mappingStatusFilter, mappingModuleSearch]);

  const taxKinds = useMemo(() => {
    if (!query.data) return [];
    return [...new Set(query.data.tax_rates.map((row) => row.kind))].sort();
  }, [query.data]);

  return (
    <FinanceShell
      title="Finance settings"
      description="Configure VAT, fiscal periods, source-module account mappings, unlock governance, and posting integrations without weakening ledger controls."
    >
      {query.isPending ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <FinanceTableSkeleton rows={5} cols={4} />
          <FinanceTableSkeleton rows={5} cols={4} />
        </div>
      ) : query.isError || !query.data ? (
        <FinanceError error={query.error} />
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle><h2 className="text-base font-semibold">Tax rates</h2></CardTitle>
                <CardDescription>VAT and other tax rates available to financial document lines.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="tax-status-filter">Status</FieldLabel>
                    <NativeSelect id="tax-status-filter" value={taxStatusFilter} onChange={(e) => setTaxStatusFilter(e.target.value)}>
                      <NativeSelectOption value="">All statuses</NativeSelectOption>
                      <NativeSelectOption value="active">Active</NativeSelectOption>
                      <NativeSelectOption value="inactive">Inactive</NativeSelectOption>
                    </NativeSelect>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="tax-kind-filter">Kind</FieldLabel>
                    <NativeSelect id="tax-kind-filter" value={taxKindFilter} onChange={(e) => setTaxKindFilter(e.target.value)}>
                      <NativeSelectOption value="">All kinds</NativeSelectOption>
                      {taxKinds.map((kind) => (
                        <NativeSelectOption key={kind} value={kind}>{kind.replaceAll("_", " ")}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>
                <FinanceTable
                  caption="Configured tenant tax rates."
                  rows={filteredTax}
                  getKey={(row) => row.id}
                  onRowClick={(row) => {
                    if (anyBusy) return;
                    setDetailTax(row);
                  }}
                  columns={[
                    { key: "code", label: "Code", render: (row) => <span className="font-mono">{row.code}</span> },
                    { key: "name", label: "Tax", render: (row) => row.name },
                    { key: "kind", label: "Kind", render: (row) => row.kind.replaceAll("_", " ") },
                    { key: "rate", label: "Rate", align: "right", render: (row) => `${Number(row.rate).toFixed(2)}%` },
                    { key: "inclusive", label: "Treatment", render: (row) => (row.is_inclusive ? "Inclusive" : "Exclusive") },
                    { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.is_active ? "active" : "inactive"} /> },
                    {
                      key: "actions",
                      label: "",
                      align: "right",
                      render: (row) =>
                        canManage ? (
                          <RowActionsMenu
                            anyBusy={anyBusy}
                            loading={busyKey === `tax:${row.id}:toggle` || busyKey === `tax:${row.id}:edit`}
                            items={[
                              { label: "Edit", icon: <Edit className="h-4 w-4" />, onClick: () => setEditTax(row) },
                              {
                                label: row.is_active ? "Deactivate" : "Activate",
                                icon: <Power className="h-4 w-4" />,
                                onClick: () =>
                                  run(
                                    () => financeApi.updateTaxRate(row.id, { is_active: !row.is_active }),
                                    "Tax rate updated",
                                    `tax:${row.id}:toggle`,
                                  ),
                              },
                            ]}
                          />
                        ) : null,
                    },
                  ]}
                />
                {canManage ? (
                  <div className="flex justify-end">
                    <Button variant="outline" disabled={anyBusy} onClick={() => setShowTaxForm((value) => !value)}>
                      <Plus data-icon="inline-start" aria-hidden="true" />
                      {showTaxForm ? "Hide tax form" : "Add tax rate"}
                    </Button>
                  </div>
                ) : null}
                {canManage && showTaxForm ? (
                  <TaxForm
                    anyBusy={anyBusy}
                    loading={busyKey === "form:tax"}
                    onSubmit={(payload) => run(() => financeApi.createTaxRate(payload), "Tax rate created", "form:tax")}
                  />
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle><h2 className="text-base font-semibold">Fiscal periods</h2></CardTitle>
                <CardDescription>Lock periods to prevent back-posting. Reopening requires a reviewed unlock request.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Field>
                  <FieldLabel htmlFor="period-status-filter">Status</FieldLabel>
                  <NativeSelect id="period-status-filter" value={periodStatusFilter} onChange={(e) => setPeriodStatusFilter(e.target.value)}>
                    <NativeSelectOption value="">All statuses</NativeSelectOption>
                    <NativeSelectOption value="open">Open</NativeSelectOption>
                    <NativeSelectOption value="locked">Locked</NativeSelectOption>
                    <NativeSelectOption value="closed">Closed</NativeSelectOption>
                  </NativeSelect>
                </Field>
                <FinanceTable
                  caption="Tenant fiscal posting periods."
                  rows={filteredPeriods}
                  getKey={(row) => row.id}
                  onRowClick={(row) => {
                    if (anyBusy) return;
                    setDetailPeriod(row);
                  }}
                  columns={[
                    { key: "name", label: "Period", render: (row) => <span className="font-medium">{row.name}</span> },
                    { key: "dates", label: "Dates", render: (row) => `${row.starts_on} – ${row.ends_on}` },
                    { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.status} /> },
                    {
                      key: "actions",
                      label: "Actions",
                      align: "right",
                      render: (row) => (
                        <div className="flex justify-end gap-1">
                          {row.status === "open" && canPeriods ? (
                            <Button
                            size="sm"
                            disabled={anyBusy}
                            onClick={(event) => {
                              event.stopPropagation();
                              run(() => financeApi.periodAction(row.id, "lock"), "Fiscal period updated", `period:${row.id}:lock`);
                            }}
                          >
                              {busyKey === `period:${row.id}:lock` ? (
                                <BusyLabel busy>Lock</BusyLabel>
                              ) : (
                                <>
                                  <LockKeyhole data-icon="inline-start" aria-hidden="true" />
                                  Lock
                                </>
                              )}
                            </Button>
                          ) : null}
                          {row.status === "locked" && canRequestUnlock ? (
                            <Button size="sm" variant="outline" disabled={anyBusy} onClick={(event) => { event.stopPropagation(); setUnlocking(row); }}>
                              <Send data-icon="inline-start" aria-hidden="true" />
                              Request unlock
                            </Button>
                          ) : null}
                          {row.status === "locked" && canPeriods ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={anyBusy}
                              onClick={(event) => {
                                event.stopPropagation();
                                run(() => financeApi.periodAction(row.id, "close"), "Fiscal period updated", `period:${row.id}:close`);
                              }}
                            >
                              {busyKey === `period:${row.id}:close` ? <BusyLabel busy>Close</BusyLabel> : "Close"}
                            </Button>
                          ) : null}
                        </div>
                      ),
                    },
                  ]}
                />
                {canPeriods ? (
                  <div className="flex justify-end">
                    <Button variant="outline" disabled={anyBusy} onClick={() => setShowPeriodForm((value) => !value)}>
                      <Plus data-icon="inline-start" aria-hidden="true" />
                      {showPeriodForm ? "Hide period form" : "Add fiscal period"}
                    </Button>
                  </div>
                ) : null}
                {canPeriods && showPeriodForm ? (
                  <PeriodForm
                    anyBusy={anyBusy}
                    loading={busyKey === "form:period"}
                    onSubmit={(payload) => run(() => financeApi.createPeriod(payload), "Fiscal period created", "form:period")}
                  />
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle><h2 className="text-base font-semibold">Period unlock requests</h2></CardTitle>
              <CardDescription>Every request retains the requester, reason, reviewer, decision, and timestamp.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="unlock-status-filter">Status</FieldLabel>
                <NativeSelect id="unlock-status-filter" value={unlockStatusFilter} onChange={(e) => setUnlockStatusFilter(e.target.value)}>
                  <NativeSelectOption value="">All statuses</NativeSelectOption>
                  <NativeSelectOption value="pending">Pending</NativeSelectOption>
                  <NativeSelectOption value="approved">Approved</NativeSelectOption>
                  <NativeSelectOption value="rejected">Rejected</NativeSelectOption>
                </NativeSelect>
              </Field>
              <FinanceTable
                caption="Recent fiscal period unlock requests."
                rows={filteredUnlocks}
                getKey={(row) => row.id}
                onRowClick={(row) => {
                  if (anyBusy) return;
                  setDetailUnlock(row);
                }}
                columns={[
                  { key: "period", label: "Period", render: (row) => row.period?.name ?? String(row.period_id) },
                  { key: "reason", label: "Reason", render: (row) => row.reason },
                  { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.status} /> },
                  {
                    key: "actions",
                    label: "Review",
                    align: "right",
                    render: (row) =>
                      row.status === "pending" && canApproveUnlock ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            disabled={anyBusy}
                            onClick={(event) => {
                              event.stopPropagation();
                              setReviewTarget({ request: row, decision: "approved" });
                            }}
                          >
                            <Check data-icon="inline-start" aria-hidden="true" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={anyBusy}
                            onClick={(event) => {
                              event.stopPropagation();
                              setReviewTarget({ request: row, decision: "rejected" });
                            }}
                          >
                            <X data-icon="inline-start" aria-hidden="true" />
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{row.status === "pending" ? "Awaiting review" : "Reviewed"}</span>
                      ),
                  },
                ]}
              />
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle><h2 className="text-base font-semibold">Source account mappings</h2></CardTitle>
                <CardDescription>Map a source module event to default debit and credit accounts.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="mapping-module-search">Source module or event</FieldLabel>
                    <Input
                      id="mapping-module-search"
                      type="search"
                      value={mappingModuleInput}
                      onChange={(e) => setMappingModuleInput(e.target.value)}
                      placeholder="Filter by module or event"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="mapping-status-filter">Status</FieldLabel>
                    <NativeSelect id="mapping-status-filter" value={mappingStatusFilter} onChange={(e) => setMappingStatusFilter(e.target.value)}>
                      <NativeSelectOption value="">All statuses</NativeSelectOption>
                      <NativeSelectOption value="active">Active</NativeSelectOption>
                      <NativeSelectOption value="inactive">Inactive</NativeSelectOption>
                    </NativeSelect>
                  </Field>
                </div>
                <FinanceTable
                  caption="Cross-module posting mappings."
                  rows={filteredMappings}
                  getKey={(row) => row.id}
                  onRowClick={(row) => {
                    if (anyBusy) return;
                    setDetailMapping(row);
                  }}
                  columns={[
                    { key: "source", label: "Source", render: (row) => `${row.source_module} · ${row.event}` },
                    {
                      key: "debit",
                      label: "Debit",
                      render: (row) => (row.debit_account ? `${row.debit_account.code} · ${row.debit_account.name}` : String(row.debit_account_id)),
                    },
                    {
                      key: "credit",
                      label: "Credit",
                      render: (row) => (row.credit_account ? `${row.credit_account.code} · ${row.credit_account.name}` : String(row.credit_account_id)),
                    },
                    {
                      key: "tax",
                      label: "Tax rate",
                      render: (row) => (row.tax_rate ? `${row.tax_rate.code} (${Number(row.tax_rate.rate).toFixed(2)}%)` : "—"),
                    },
                    { key: "status", label: "Status", render: (row) => <FinanceStatus value={row.is_active ? "active" : "inactive"} /> },
                    {
                      key: "actions",
                      label: "",
                      align: "right",
                      render: (row) =>
                        canIntegrate ? (
                          <RowActionsMenu
                            anyBusy={anyBusy}
                            loading={busyKey === `mapping:${row.id}:toggle` || busyKey === `mapping:${row.id}:edit`}
                            items={[
                              { label: "Edit", icon: <Edit className="h-4 w-4" />, onClick: () => setEditMapping(row) },
                              {
                                label: row.is_active ? "Deactivate" : "Activate",
                                icon: <Power className="h-4 w-4" />,
                                onClick: () =>
                                  run(
                                    () =>
                                      financeApi.saveMapping({
                                        source_module: row.source_module,
                                        event: row.event,
                                        debit_account_id: row.debit_account_id,
                                        credit_account_id: row.credit_account_id,
                                        tax_rate_id: row.tax_rate_id,
                                        is_active: !row.is_active,
                                      }),
                                    "Account mapping saved",
                                    `mapping:${row.id}:toggle`,
                                  ),
                              },
                            ]}
                          />
                        ) : null,
                    },
                  ]}
                />
                {canIntegrate ? (
                  <div className="flex justify-end">
                    <Button variant="outline" disabled={anyBusy} onClick={() => setShowMappingForm((value) => !value)}>
                      <Plus data-icon="inline-start" aria-hidden="true" />
                      {showMappingForm ? "Hide mapping form" : "Add mapping"}
                    </Button>
                  </div>
                ) : null}
                {canIntegrate && showMappingForm ? (
                  <MappingForm
                    accounts={query.data.system_accounts}
                    taxRates={query.data.tax_rates.filter((row) => row.is_active)}
                    anyBusy={anyBusy}
                    loading={busyKey === "form:mapping"}
                    onSubmit={(payload) => run(() => financeApi.saveMapping(payload), "Account mapping saved", "form:mapping")}
                  />
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle><h2 className="text-base font-semibold">Operational integrations</h2></CardTitle>
                <CardDescription>Module bridges for this tenant. Settlements normally post to Finance automatically when hospitality checks out an order.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Alert>
                  <PlugZap aria-hidden="true" />
                  <AlertTitle>Hospitality settlement bridge</AlertTitle>
                  <AlertDescription>
                    Posted restaurant and hospitality settlements create finance journals automatically for this tenant. Use sync below only to catch up or retry postings that failed earlier, such as during a locked fiscal period. Re-running is safe because journals are idempotent.
                  </AlertDescription>
                </Alert>
              </CardContent>
              {canIntegrate ? (
                <CardFooter>
                  <Button disabled={anyBusy} onClick={() => run(() => financeApi.syncHospitality(), "Hospitality sync", "sync:hospitality")}>
                    {busyKey === "sync:hospitality" ? (
                      <BusyLabel busy>Sync Hospitality postings</BusyLabel>
                    ) : (
                      "Sync Hospitality postings"
                    )}
                  </Button>
                </CardFooter>
              ) : null}
            </Card>
          </div>
        </div>
      )}

      <TaxEditDialog
        key={editTax?.id ?? "tax-none"}
        tax={editTax}
        anyBusy={anyBusy}
        loading={editTax !== null && busyKey === `tax:${editTax.id}:edit`}
        onOpenChange={(open) => { if (!open) setEditTax(null); }}
        onSubmit={(payload) => {
          if (!editTax) return;
          run(() => financeApi.updateTaxRate(editTax.id, payload), "Tax rate updated", `tax:${editTax.id}:edit`);
        }}
      />

      <MappingEditDialog
        key={editMapping?.id ?? "mapping-none"}
        mapping={editMapping}
        accounts={query.data?.system_accounts ?? []}
        taxRates={query.data?.tax_rates.filter((row) => row.is_active) ?? []}
        anyBusy={anyBusy}
        loading={editMapping !== null && busyKey === `mapping:${editMapping.id}:edit`}
        onOpenChange={(open) => { if (!open) setEditMapping(null); }}
        onSubmit={(payload) => {
          if (!editMapping) return;
          run(() => financeApi.saveMapping(payload), "Account mapping saved", `mapping:${editMapping.id}:edit`);
        }}
      />

      <UnlockDialog
        period={unlocking}
        anyBusy={anyBusy}
        loading={unlocking !== null && busyKey === `period:${unlocking.id}:unlock`}
        onOpenChange={(open) => { if (!open) setUnlocking(null); }}
        onSubmit={(reason) => {
          if (!unlocking) return;
          run(() => financeApi.requestUnlock(unlocking.id, reason), "Unlock request submitted", `period:${unlocking.id}:unlock`);
        }}
      />

      <ReviewUnlockDialog
        target={reviewTarget}
        anyBusy={anyBusy}
        loading={
          reviewTarget !== null &&
          (busyKey === `unlock:${reviewTarget.request.id}:approve` || busyKey === `unlock:${reviewTarget.request.id}:reject`)
        }
        onOpenChange={(open) => { if (!open) setReviewTarget(null); }}
        onSubmit={(reviewNotes) => {
          if (!reviewTarget) return;
          const { request, decision } = reviewTarget;
          run(
            () => financeApi.reviewUnlock(request.id, decision, reviewNotes || undefined),
            "Unlock request reviewed",
            `unlock:${request.id}:${decision === "approved" ? "approve" : "reject"}`,
          );
        }}
      />

      <TaxDetailDialog tax={detailTax} onOpenChange={(open) => { if (!open) setDetailTax(null); }} />
      <PeriodDetailDialog period={detailPeriod} onOpenChange={(open) => { if (!open) setDetailPeriod(null); }} />
      <UnlockDetailDialog request={detailUnlock} onOpenChange={(open) => { if (!open) setDetailUnlock(null); }} />
      <MappingDetailDialog mapping={detailMapping} onOpenChange={(open) => { if (!open) setDetailMapping(null); }} />
    </FinanceShell>
  );
}

function RowActionsMenu({
  anyBusy,
  loading,
  items,
}: {
  anyBusy: boolean;
  loading: boolean;
  items: Array<{ label: string; icon: React.ReactNode; onClick: () => void; variant?: "destructive" }>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={anyBusy} onClick={(event) => event.stopPropagation()}>
          {loading ? <BusyLabel busy>{" "}</BusyLabel> : <MoreVertical className="h-4 w-4" />}
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44" onClick={(event) => event.stopPropagation()}>
        {items.map((item, index) => (
          <span key={item.label}>
            {item.variant === "destructive" && index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem disabled={anyBusy} onClick={item.onClick} className={item.variant === "destructive" ? "text-destructive focus:text-destructive" : ""}>
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          </span>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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

function TaxForm({
  anyBusy,
  loading,
  onSubmit,
}: {
  anyBusy: boolean;
  loading: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    onSubmit({
      name: values.get("name"),
      code: values.get("code"),
      rate: Number(values.get("rate")),
      kind: values.get("kind"),
      is_inclusive: values.get("inclusive") === "1",
      is_active: true,
    });
    event.currentTarget.reset();
  }

  return (
    <form onSubmit={submit} className="rounded-xl border p-4">
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="tax-name">Tax name (required)</FieldLabel>
            <Input id="tax-name" name="name" required disabled={anyBusy} />
          </Field>
          <Field>
            <FieldLabel htmlFor="tax-code">Code (required)</FieldLabel>
            <Input id="tax-code" name="code" required disabled={anyBusy} />
          </Field>
          <Field>
            <FieldLabel htmlFor="tax-rate">Rate % (required)</FieldLabel>
            <Input id="tax-rate" name="rate" type="number" min="0" max="100" step="0.0001" required disabled={anyBusy} />
          </Field>
          <Field>
            <FieldLabel htmlFor="tax-kind">Kind (required)</FieldLabel>
            <NativeSelect id="tax-kind" name="kind" required defaultValue="vat" disabled={anyBusy}>
              <NativeSelectOption value="vat">VAT</NativeSelectOption>
              <NativeSelectOption value="withholding">Withholding</NativeSelectOption>
              <NativeSelectOption value="excise">Excise</NativeSelectOption>
              <NativeSelectOption value="other">Other</NativeSelectOption>
            </NativeSelect>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="tax-inclusive">Price treatment</FieldLabel>
          <NativeSelect id="tax-inclusive" name="inclusive" defaultValue="0" disabled={anyBusy}>
            <NativeSelectOption value="0">Tax exclusive</NativeSelectOption>
            <NativeSelectOption value="1">Tax inclusive</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Button type="submit" disabled={anyBusy}>
          {loading ? <BusyLabel busy>Add tax rate</BusyLabel> : "Add tax rate"}
        </Button>
      </FieldGroup>
    </form>
  );
}

function TaxEditDialog({
  tax,
  anyBusy,
  loading,
  onOpenChange,
  onSubmit,
}: {
  tax: FinanceTaxRate | null;
  anyBusy: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    onSubmit({
      name: values.get("name"),
      code: values.get("code"),
      rate: Number(values.get("rate")),
      kind: values.get("kind"),
      is_inclusive: values.get("inclusive") === "1",
      is_active: values.get("active") === "1",
    });
  }

  return (
    <Dialog open={tax !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Edit tax rate</DialogTitle>
            <DialogDescription>Update the tax code, rate, kind, and price treatment.</DialogDescription>
          </DialogHeader>
          {tax ? (
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="edit-tax-name">Tax name (required)</FieldLabel>
                  <Input id="edit-tax-name" name="name" required defaultValue={tax.name} disabled={anyBusy} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-tax-code">Code (required)</FieldLabel>
                  <Input id="edit-tax-code" name="code" required defaultValue={tax.code} disabled={anyBusy} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-tax-rate">Rate % (required)</FieldLabel>
                  <Input id="edit-tax-rate" name="rate" type="number" min="0" max="100" step="0.0001" required defaultValue={tax.rate} disabled={anyBusy} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-tax-kind">Kind (required)</FieldLabel>
                  <NativeSelect id="edit-tax-kind" name="kind" required defaultValue={tax.kind} disabled={anyBusy}>
                    <NativeSelectOption value="vat">VAT</NativeSelectOption>
                    <NativeSelectOption value="withholding">Withholding</NativeSelectOption>
                    <NativeSelectOption value="excise">Excise</NativeSelectOption>
                    <NativeSelectOption value="other">Other</NativeSelectOption>
                  </NativeSelect>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="edit-tax-inclusive">Price treatment</FieldLabel>
                <NativeSelect id="edit-tax-inclusive" name="inclusive" defaultValue={tax.is_inclusive ? "1" : "0"} disabled={anyBusy}>
                  <NativeSelectOption value="0">Tax exclusive</NativeSelectOption>
                  <NativeSelectOption value="1">Tax inclusive</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-tax-active">Status</FieldLabel>
                <NativeSelect id="edit-tax-active" name="active" defaultValue={tax.is_active ? "1" : "0"} disabled={anyBusy}>
                  <NativeSelectOption value="1">Active</NativeSelectOption>
                  <NativeSelectOption value="0">Inactive</NativeSelectOption>
                </NativeSelect>
              </Field>
            </FieldGroup>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={anyBusy}>Cancel</Button>
            <Button type="submit" disabled={anyBusy}>{loading ? <BusyLabel busy>Save changes</BusyLabel> : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PeriodForm({
  anyBusy,
  loading,
  onSubmit,
}: {
  anyBusy: boolean;
  loading: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    onSubmit({ name: values.get("name"), starts_on: values.get("starts_on"), ends_on: values.get("ends_on") });
    event.currentTarget.reset();
  }

  return (
    <form onSubmit={submit} className="rounded-xl border p-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="period-name">Period name (required)</FieldLabel>
          <Input id="period-name" name="name" required disabled={anyBusy} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="period-start">Start date (required)</FieldLabel>
            <Input id="period-start" name="starts_on" type="date" required disabled={anyBusy} />
          </Field>
          <Field>
            <FieldLabel htmlFor="period-end">End date (required)</FieldLabel>
            <Input id="period-end" name="ends_on" type="date" required disabled={anyBusy} />
          </Field>
        </div>
        <Button type="submit" disabled={anyBusy}>
          {loading ? <BusyLabel busy>Add fiscal period</BusyLabel> : "Add fiscal period"}
        </Button>
      </FieldGroup>
    </form>
  );
}

function MappingForm({
  accounts,
  taxRates,
  anyBusy,
  loading,
  onSubmit,
}: {
  accounts: Array<{ id: number; code: string; name: string }>;
  taxRates: FinanceTaxRate[];
  anyBusy: boolean;
  loading: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const taxRateId = values.get("tax_rate_id");
    onSubmit({
      source_module: values.get("source_module"),
      event: values.get("event"),
      debit_account_id: Number(values.get("debit_account_id")),
      credit_account_id: Number(values.get("credit_account_id")),
      tax_rate_id: taxRateId ? Number(taxRateId) : null,
      is_active: true,
    });
    event.currentTarget.reset();
  }

  return (
    <form onSubmit={submit} className="rounded-xl border p-4">
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="mapping-module">Source module (required)</FieldLabel>
            <Input id="mapping-module" name="source_module" placeholder="Example: payroll" required disabled={anyBusy} />
          </Field>
          <Field>
            <FieldLabel htmlFor="mapping-event">Event (required)</FieldLabel>
            <Input id="mapping-event" name="event" placeholder="Example: payroll_posted" required disabled={anyBusy} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="mapping-debit">Debit account (required)</FieldLabel>
            <NativeSelect id="mapping-debit" name="debit_account_id" required defaultValue="" disabled={anyBusy}>
              <NativeSelectOption value="" disabled>Select account</NativeSelectOption>
              {accounts.map((account) => (
                <NativeSelectOption key={account.id} value={String(account.id)}>{account.code} · {account.name}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="mapping-credit">Credit account (required)</FieldLabel>
            <NativeSelect id="mapping-credit" name="credit_account_id" required defaultValue="" disabled={anyBusy}>
              <NativeSelectOption value="" disabled>Select account</NativeSelectOption>
              {accounts.map((account) => (
                <NativeSelectOption key={account.id} value={String(account.id)}>{account.code} · {account.name}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="mapping-tax">Linked tax rate</FieldLabel>
          <NativeSelect id="mapping-tax" name="tax_rate_id" defaultValue="" disabled={anyBusy}>
            <NativeSelectOption value="">None</NativeSelectOption>
            {taxRates.map((rate) => (
              <NativeSelectOption key={rate.id} value={String(rate.id)}>{rate.code} · {rate.name} ({Number(rate.rate).toFixed(2)}%)</NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Button type="submit" disabled={anyBusy || accounts.length === 0}>
          {loading ? <BusyLabel busy>Save mapping</BusyLabel> : "Save mapping"}
        </Button>
      </FieldGroup>
    </form>
  );
}

function MappingEditDialog({
  mapping,
  accounts,
  taxRates,
  anyBusy,
  loading,
  onOpenChange,
  onSubmit,
}: {
  mapping: FinanceAccountMapping | null;
  accounts: Array<{ id: number; code: string; name: string }>;
  taxRates: FinanceTaxRate[];
  anyBusy: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mapping) return;
    const values = new FormData(event.currentTarget);
    const taxRateId = values.get("tax_rate_id");
    onSubmit({
      source_module: mapping.source_module,
      event: mapping.event,
      debit_account_id: Number(values.get("debit_account_id")),
      credit_account_id: Number(values.get("credit_account_id")),
      tax_rate_id: taxRateId ? Number(taxRateId) : null,
      is_active: values.get("active") === "1",
    });
  }

  return (
    <Dialog open={mapping !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Edit account mapping</DialogTitle>
            <DialogDescription>
              {mapping ? `${mapping.source_module} · ${mapping.event}` : ""}
            </DialogDescription>
          </DialogHeader>
          {mapping ? (
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="edit-mapping-debit">Debit account (required)</FieldLabel>
                  <NativeSelect id="edit-mapping-debit" name="debit_account_id" required defaultValue={String(mapping.debit_account_id)} disabled={anyBusy}>
                    {accounts.map((account) => (
                      <NativeSelectOption key={account.id} value={String(account.id)}>{account.code} · {account.name}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-mapping-credit">Credit account (required)</FieldLabel>
                  <NativeSelect id="edit-mapping-credit" name="credit_account_id" required defaultValue={String(mapping.credit_account_id)} disabled={anyBusy}>
                    {accounts.map((account) => (
                      <NativeSelectOption key={account.id} value={String(account.id)}>{account.code} · {account.name}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="edit-mapping-tax">Linked tax rate</FieldLabel>
                <NativeSelect id="edit-mapping-tax" name="tax_rate_id" defaultValue={mapping.tax_rate_id ? String(mapping.tax_rate_id) : ""} disabled={anyBusy}>
                  <NativeSelectOption value="">None</NativeSelectOption>
                  {taxRates.map((rate) => (
                    <NativeSelectOption key={rate.id} value={String(rate.id)}>{rate.code} · {rate.name} ({Number(rate.rate).toFixed(2)}%)</NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-mapping-active">Status</FieldLabel>
                <NativeSelect id="edit-mapping-active" name="active" defaultValue={mapping.is_active ? "1" : "0"} disabled={anyBusy}>
                  <NativeSelectOption value="1">Active</NativeSelectOption>
                  <NativeSelectOption value="0">Inactive</NativeSelectOption>
                </NativeSelect>
              </Field>
            </FieldGroup>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={anyBusy}>Cancel</Button>
            <Button type="submit" disabled={anyBusy}>{loading ? <BusyLabel busy>Save mapping</BusyLabel> : "Save mapping"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UnlockDialog({
  period,
  anyBusy,
  loading,
  onOpenChange,
  onSubmit,
}: {
  period: FinancePeriod | null;
  anyBusy: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(String(new FormData(event.currentTarget).get("reason")));
  }

  return (
    <Dialog open={Boolean(period)} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Request fiscal period unlock</DialogTitle>
            <DialogDescription>
              Explain why {period?.name} must reopen. A finance controller must review the request before postings are allowed.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="unlock-reason">Reason (required)</FieldLabel>
            <Input id="unlock-reason" name="reason" required minLength={10} autoFocus disabled={anyBusy} />
            <FieldDescription>Include the affected document or journal reference and the correction required.</FieldDescription>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={anyBusy}>Cancel</Button>
            <Button type="submit" disabled={anyBusy}>{loading ? <BusyLabel busy>Submit request</BusyLabel> : "Submit request"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReviewUnlockDialog({
  target,
  anyBusy,
  loading,
  onOpenChange,
  onSubmit,
}: {
  target: { request: FinanceUnlockRequest; decision: "approved" | "rejected" } | null;
  anyBusy: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reviewNotes: string) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(String(new FormData(event.currentTarget).get("review_notes") ?? ""));
  }

  const decision = target?.decision;
  const periodName = target?.request.period?.name ?? String(target?.request.period_id ?? "");

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{decision === "approved" ? "Approve unlock request" : "Reject unlock request"}</DialogTitle>
            <DialogDescription>
              {periodName ? `Review the request to reopen ${periodName}.` : "Review the unlock request."}
            </DialogDescription>
          </DialogHeader>
          {target ? (
            <div className="rounded-md border p-4 text-sm">
              <div className="font-medium">Request reason</div>
              <p className="mt-1 text-muted-foreground">{target.request.reason}</p>
            </div>
          ) : null}
          <Field>
            <FieldLabel htmlFor="review-notes">Review notes</FieldLabel>
            <Textarea id="review-notes" name="review_notes" rows={3} disabled={anyBusy} placeholder="Optional notes for the audit trail." />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={anyBusy}>Cancel</Button>
            <Button type="submit" disabled={anyBusy} variant={decision === "rejected" ? "outline" : "default"}>
              {loading ? (
                <BusyLabel busy>{decision === "approved" ? "Approve request" : "Reject request"}</BusyLabel>
              ) : (
                decision === "approved" ? "Approve request" : "Reject request"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaxDetailDialog({ tax, onOpenChange }: { tax: FinanceTaxRate | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={tax !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tax rate details</DialogTitle>
          <DialogDescription>Document line tax configuration.</DialogDescription>
        </DialogHeader>
        {tax ? (
          <div className="grid gap-4 pb-2 sm:grid-cols-2">
            <DetailField label="Code"><span className="font-mono">{tax.code}</span></DetailField>
            <DetailField label="Name">{tax.name}</DetailField>
            <DetailField label="Kind">{tax.kind.replaceAll("_", " ")}</DetailField>
            <DetailField label="Rate">{Number(tax.rate).toFixed(2)}%</DetailField>
            <DetailField label="Price treatment">{tax.is_inclusive ? "Tax inclusive" : "Tax exclusive"}</DetailField>
            <DetailField label="Status"><FinanceStatus value={tax.is_active ? "active" : "inactive"} /></DetailField>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PeriodDetailDialog({ period, onOpenChange }: { period: FinancePeriod | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={period !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fiscal period details</DialogTitle>
          <DialogDescription>Posting window and lock state.</DialogDescription>
        </DialogHeader>
        {period ? (
          <div className="grid gap-4 pb-2 sm:grid-cols-2">
            <DetailField label="Period">{period.name}</DetailField>
            <DetailField label="Status"><FinanceStatus value={period.status} /></DetailField>
            <DetailField label="Starts on">{period.starts_on}</DetailField>
            <DetailField label="Ends on">{period.ends_on}</DetailField>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function UnlockDetailDialog({ request, onOpenChange }: { request: FinanceUnlockRequest | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={request !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unlock request details</DialogTitle>
          <DialogDescription>Audit trail for fiscal period reopening.</DialogDescription>
        </DialogHeader>
        {request ? (
          <div className="grid gap-4 pb-2 sm:grid-cols-2">
            <DetailField label="Period">{request.period?.name ?? request.period_id}</DetailField>
            <DetailField label="Status"><FinanceStatus value={request.status} /></DetailField>
            <div className="sm:col-span-2">
              <DetailField label="Reason">{request.reason}</DetailField>
            </div>
            {request.review_notes ? (
              <div className="sm:col-span-2">
                <DetailField label="Review notes">{request.review_notes}</DetailField>
              </div>
            ) : null}
            {request.reviewed_at ? <DetailField label="Reviewed at">{request.reviewed_at.slice(0, 19).replace("T", " ")}</DetailField> : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MappingDetailDialog({ mapping, onOpenChange }: { mapping: FinanceAccountMapping | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={mapping !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Account mapping details</DialogTitle>
          <DialogDescription>Cross-module posting defaults.</DialogDescription>
        </DialogHeader>
        {mapping ? (
          <div className="grid gap-4 pb-2 sm:grid-cols-2">
            <DetailField label="Source module">{mapping.source_module}</DetailField>
            <DetailField label="Event">{mapping.event}</DetailField>
            <DetailField label="Debit account">
              {mapping.debit_account ? `${mapping.debit_account.code} · ${mapping.debit_account.name}` : mapping.debit_account_id}
            </DetailField>
            <DetailField label="Credit account">
              {mapping.credit_account ? `${mapping.credit_account.code} · ${mapping.credit_account.name}` : mapping.credit_account_id}
            </DetailField>
            <DetailField label="Tax rate">
              {mapping.tax_rate ? `${mapping.tax_rate.code} · ${mapping.tax_rate.name}` : "—"}
            </DetailField>
            <DetailField label="Status"><FinanceStatus value={mapping.is_active ? "active" : "inactive"} /></DetailField>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
