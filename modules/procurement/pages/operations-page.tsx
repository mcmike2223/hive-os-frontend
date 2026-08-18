"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CirclePlus, Download, Send } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { procurementApi } from "@/modules/procurement/api";
import type {
  Agreement,
  GoodsReceipt,
  ProcurementLine,
  ProcurementReferences,
  PurchaseOrder,
  Requisition,
  SourcingEvent,
  SupplierBid,
  SupplierInvoice,
  SupplierProfile,
} from "@/modules/procurement/types";
import {
  BusyLabel,
  formatMoney,
  ProcurementEmpty,
  ProcurementError,
  ProcurementLoading,
  ProcurementShell,
  ProcurementStatus,
  ProcurementTable,
} from "@/modules/procurement/pages/components/procurement-shell";

export type ProcurementSection =
  | "suppliers"
  | "requisitions"
  | "sourcing"
  | "orders"
  | "receiving"
  | "invoices"
  | "agreements";

const details: Record<
  ProcurementSection,
  { title: string; description: string }
> = {
  suppliers: {
    title: "Supplier qualification",
    description:
      "Maintain legal identity, eligibility, domestic status, operational scores, and debarment controls beside the shared Inventory supplier master.",
  },
  requisitions: {
    title: "Purchase requisitions",
    description:
      "Turn operational demand into costed, budget-checked requests with traceable approval decisions.",
  },
  sourcing: {
    title: "Sourcing and bid evaluation",
    description:
      "Publish RFQs, RFPs, tenders, or e-GP references; receive comparable offers; score them; and award the selected supplier.",
  },
  orders: {
    title: "Purchase orders",
    description:
      "Issue controlled commitments, capture supplier confirmation, revisions, delivery expectations, and receipt or invoice progress.",
  },
  receiving: {
    title: "Receiving and inspection",
    description:
      "Record partial deliveries, lot and batch evidence, inspections, nonconformance, and idempotent stock posting.",
  },
  invoices: {
    title: "Supplier invoice matching",
    description:
      "Compare supplier invoices with ordered price and accepted quantity, document exceptions, and post approved bills to Finance.",
  },
  agreements: {
    title: "Framework and blanket agreements",
    description:
      "Control validity, ceiling value, committed value, service levels, and call-off replenishment arrangements.",
  },
};

export default function ProcurementOperationsPage({
  section,
}: {
  section: ProcurementSection;
}) {
  const references = useQuery({
    queryKey: ["procurement", "references"],
    queryFn: procurementApi.references,
  });
  const heading = details[section];
  return (
    <ProcurementShell title={heading.title} description={heading.description}>
      {references.isLoading ? (
        <ProcurementLoading />
      ) : references.error || !references.data ? (
        <ProcurementError error={references.error} />
      ) : (
        <Section section={section} references={references.data} />
      )}
    </ProcurementShell>
  );
}

function Section({
  section,
  references,
}: {
  section: ProcurementSection;
  references: ProcurementReferences;
}) {
  if (section === "suppliers") return <Suppliers references={references} />;
  if (section === "requisitions")
    return <Requisitions references={references} />;
  if (section === "sourcing") return <Sourcing references={references} />;
  if (section === "orders") return <Orders references={references} />;
  if (section === "receiving") return <Receiving references={references} />;
  if (section === "invoices") return <Invoices references={references} />;
  return <Agreements references={references} />;
}

function Suppliers({ references }: { references: ProcurementReferences }) {
  const query = useQuery({
    queryKey: ["procurement", "suppliers"],
    queryFn: () => procurementApi.suppliers({ per_page: 100 }),
  });
  return (
    <RecordsLayout
      create={<SupplierForm references={references} />}
      error={query.error}
      loading={query.isLoading}
    >
      <ProcurementTable<SupplierProfile>
        caption="Qualified supplier directory ordered by operational performance."
        rows={query.data?.data ?? []}
        getKey={(row) => row.id}
        columns={[
          {
            key: "supplier",
            label: "Supplier",
            render: (row) => (
              <strong>
                {row.supplier?.name ??
                  row.legal_name ??
                  `Supplier ${row.supplier_id}`}
                <span className="block text-xs font-normal text-muted-foreground">
                  {row.supplier?.code ?? "No code"}
                </span>
              </strong>
            ),
          },
          {
            key: "eligibility",
            label: "Eligibility",
            render: (row) => (
              <ProcurementStatus value={row.eligibility_status} />
            ),
          },
          {
            key: "domestic",
            label: "Domestic",
            render: (row) => (row.domestic_supplier ? "Yes" : "No"),
          },
          {
            key: "quality",
            label: "Quality",
            align: "right",
            render: (row) => `${Number(row.quality_score).toFixed(1)}%`,
          },
          {
            key: "delivery",
            label: "On-time",
            align: "right",
            render: (row) => `${Number(row.delivery_score).toFixed(1)}%`,
          },
          {
            key: "overall",
            label: "Overall",
            align: "right",
            render: (row) => (
              <strong>{Number(row.overall_score).toFixed(1)}%</strong>
            ),
          },
          {
            key: "actions",
            label: "Actions",
            render: (row) => <SupplierEligibilityForm supplier={row} />,
          },
        ]}
      />
    </RecordsLayout>
  );
}

function Requisitions({ references }: { references: ProcurementReferences }) {
  const query = useQuery({
    queryKey: ["procurement", "requisitions"],
    queryFn: () => procurementApi.requisitions({ per_page: 100 }),
  });
  return (
    <RecordsLayout
      create={<RequisitionForm references={references} />}
      error={query.error}
      loading={query.isLoading}
    >
      <ProcurementTable<Requisition>
        caption="Purchase requisitions with budget and approval status."
        rows={query.data?.data ?? []}
        getKey={(row) => row.id}
        columns={[
          {
            key: "request",
            label: "Request",
            render: (row) => (
              <strong>
                {row.number}
                <span className="block max-w-64 truncate text-xs font-normal text-muted-foreground">
                  {row.title}
                </span>
              </strong>
            ),
          },
          {
            key: "method",
            label: "Method",
            render: (row) => row.procurement_method.replaceAll("_", " "),
          },
          {
            key: "budget",
            label: "Budget",
            render: (row) => <ProcurementStatus value={row.budget_status} />,
          },
          {
            key: "value",
            label: "Estimated value",
            align: "right",
            render: (row) => formatMoney(row.estimated_total, row.currency),
          },
          {
            key: "status",
            label: "Status",
            render: (row) => <ProcurementStatus value={row.status} />,
          },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <ActionGroup>
                {row.budget_status !== "available" && row.status === "draft" ? (
                  <BudgetCheckForm requisition={row} />
                ) : null}
                {row.status === "draft" && row.budget_status === "available" ? (
                  <ActionButton
                    label="Submit"
                    queryKey="requisitions"
                    run={() =>
                      procurementApi.requisitionAction(row.id, "submit")
                    }
                  />
                ) : null}
                {row.status === "pending_approval" ? (
                  <ActionButton
                    label="Approve"
                    queryKey="requisitions"
                    run={() =>
                      procurementApi.requisitionAction(row.id, "approve")
                    }
                  />
                ) : null}
              </ActionGroup>
            ),
          },
        ]}
      />
    </RecordsLayout>
  );
}

function Sourcing({ references }: { references: ProcurementReferences }) {
  const query = useQuery({
    queryKey: ["procurement", "sourcing"],
    queryFn: () => procurementApi.sourcingEvents({ per_page: 100 }),
  });
  return (
    <RecordsLayout
      create={
        <div className="grid gap-4 xl:grid-cols-2">
          <SourcingForm references={references} />
          <BidForm references={references} events={query.data?.data ?? []} />
        </div>
      }
      error={query.error}
      loading={query.isLoading}
    >
      <div className="space-y-4">
        {(query.data?.data ?? []).map((event) => (
          <Card key={event.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>
                    {event.number} · {event.title}
                  </CardTitle>
                  <CardDescription>
                    {event.method.replaceAll("_", " ")} ·{" "}
                    {formatMoney(event.estimated_value, event.currency)}
                    {event.egp_reference
                      ? ` · e-GP ${event.egp_reference}`
                      : ""}
                  </CardDescription>
                </div>
                <ProcurementStatus value={event.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ActionGroup>
                {event.status === "draft" ? (
                  <ActionButton
                    label="Publish"
                    queryKey="sourcing"
                    run={() =>
                      procurementApi.sourcingAction(event.id, "publish")
                    }
                  />
                ) : null}
                {event.status === "published" ? (
                  <ActionButton
                    label="Open evaluation"
                    queryKey="sourcing"
                    run={() => procurementApi.sourcingAction(event.id, "open")}
                  />
                ) : null}
              </ActionGroup>
              <ProcurementTable<SupplierBid>
                caption={`Supplier offers for ${event.number}.`}
                rows={event.bids ?? []}
                getKey={(row) => row.id}
                columns={[
                  {
                    key: "supplier",
                    label: "Supplier",
                    render: (row) =>
                      row.supplier?.name ?? `Supplier ${row.supplier_id}`,
                  },
                  {
                    key: "value",
                    label: "Total",
                    align: "right",
                    render: (row) => formatMoney(row.total),
                  },
                  {
                    key: "delivery",
                    label: "Lead time",
                    align: "right",
                    render: (row) => `${row.delivery_days} days`,
                  },
                  {
                    key: "score",
                    label: "Score",
                    align: "right",
                    render: (row) => `${Number(row.total_score).toFixed(1)}%`,
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (row) => <ProcurementStatus value={row.status} />,
                  },
                  {
                    key: "actions",
                    label: "Actions",
                    render: (row) => (
                      <ActionGroup>
                        {row.status === "submitted" ? (
                          <BidEvaluationForm bid={row} />
                        ) : null}
                        {row.status === "evaluated" &&
                        ["published", "evaluation"].includes(event.status) ? (
                          <ActionButton
                            label="Award"
                            queryKey="sourcing"
                            run={() =>
                              procurementApi.sourcingAction(event.id, "award", {
                                supplier_bid_id: row.id,
                              })
                            }
                          />
                        ) : null}
                      </ActionGroup>
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>
        ))}
        {!query.data?.data.length ? (
          <ProcurementEmpty description="Create a sourcing event to start collecting comparable supplier offers." />
        ) : null}
      </div>
    </RecordsLayout>
  );
}

function Orders({ references }: { references: ProcurementReferences }) {
  const query = useQuery({
    queryKey: ["procurement", "orders"],
    queryFn: () => procurementApi.purchaseOrders({ per_page: 100 }),
  });
  return (
    <RecordsLayout
      create={<PurchaseOrderForm references={references} />}
      error={query.error}
      loading={query.isLoading}
    >
      <ProcurementTable<PurchaseOrder>
        caption="Purchase order commitments and fulfillment progress."
        rows={query.data?.data ?? []}
        getKey={(row) => row.id}
        columns={[
          {
            key: "order",
            label: "Order",
            render: (row) => (
              <strong>
                {row.number}
                <span className="block text-xs font-normal text-muted-foreground">
                  {row.supplier?.name ?? "Supplier"}
                </span>
              </strong>
            ),
          },
          {
            key: "expected",
            label: "Expected",
            render: (row) => row.expected_on ?? "Not set",
          },
          {
            key: "value",
            label: "Total",
            align: "right",
            render: (row) => formatMoney(row.total, row.currency),
          },
          {
            key: "received",
            label: "Received",
            align: "right",
            render: (row) => `${Number(row.received_percent).toFixed(0)}%`,
          },
          {
            key: "invoiced",
            label: "Invoiced",
            align: "right",
            render: (row) => `${Number(row.invoiced_percent).toFixed(0)}%`,
          },
          {
            key: "status",
            label: "Status",
            render: (row) => <ProcurementStatus value={row.status} />,
          },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <ActionGroup>
                {row.status === "draft" ? (
                  <ActionButton
                    label="Submit"
                    queryKey="orders"
                    run={() =>
                      procurementApi.purchaseOrderAction(row.id, "submit")
                    }
                  />
                ) : null}
                {row.status === "pending_approval" ? (
                  <ActionButton
                    label="Approve"
                    queryKey="orders"
                    run={() =>
                      procurementApi.purchaseOrderAction(row.id, "approve")
                    }
                  />
                ) : null}
                {row.status === "approved" ? (
                  <ActionButton
                    label="Issue"
                    queryKey="orders"
                    run={() =>
                      procurementApi.purchaseOrderAction(row.id, "issue")
                    }
                  />
                ) : null}
                {row.status === "issued" ? (
                  <ActionButton
                    label="Confirm supplier"
                    queryKey="orders"
                    run={() =>
                      procurementApi.purchaseOrderAction(row.id, "confirm", {
                        reference: "Supplier confirmation recorded",
                      })
                    }
                  />
                ) : null}
              </ActionGroup>
            ),
          },
        ]}
      />
    </RecordsLayout>
  );
}

function Receiving({ references }: { references: ProcurementReferences }) {
  const receipts = useQuery({
    queryKey: ["procurement", "receipts"],
    queryFn: () => procurementApi.receipts({ per_page: 100 }),
  });
  const orders = useQuery({
    queryKey: ["procurement", "orders", "receivable"],
    queryFn: () => procurementApi.purchaseOrders({ per_page: 100 }),
  });
  return (
    <RecordsLayout
      create={
        <ReceiptForm references={references} orders={orders.data?.data ?? []} />
      }
      error={receipts.error ?? orders.error}
      loading={receipts.isLoading || orders.isLoading}
    >
      <ProcurementTable<GoodsReceipt>
        caption="Goods receipts, inspection decisions, and inventory posting state."
        rows={receipts.data?.data ?? []}
        getKey={(row) => row.id}
        columns={[
          {
            key: "receipt",
            label: "Receipt",
            render: (row) => (
              <strong>
                {row.number}
                <span className="block text-xs font-normal text-muted-foreground">
                  {row.purchase_order?.number ?? "Purchase order"}
                </span>
              </strong>
            ),
          },
          { key: "date", label: "Received", render: (row) => row.received_on },
          {
            key: "inspection",
            label: "Inspection",
            render: (row) => (
              <ProcurementStatus value={row.inspection_status} />
            ),
          },
          {
            key: "stock",
            label: "Stock posting",
            render: (row) => (
              <ProcurementStatus
                value={row.stock_posted_at ? "posted" : "pending"}
              />
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (row) => <ProcurementStatus value={row.status} />,
          },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <ActionGroup>
                {!row.stock_posted_at && row.inspection_status === "pending" ? (
                  <ReceiptInspectionForm receipt={row} />
                ) : null}
                {!row.stock_posted_at &&
                ["passed", "accepted_with_exception"].includes(
                  row.inspection_status,
                ) ? (
                  <ActionButton
                    label="Post stock"
                    queryKey="receipts"
                    run={() => procurementApi.postReceipt(row.id)}
                  />
                ) : null}
              </ActionGroup>
            ),
          },
        ]}
      />
    </RecordsLayout>
  );
}

function Invoices({ references }: { references: ProcurementReferences }) {
  const invoices = useQuery({
    queryKey: ["procurement", "invoices"],
    queryFn: () => procurementApi.invoices({ per_page: 100 }),
  });
  const orders = useQuery({
    queryKey: ["procurement", "orders", "invoiceable"],
    queryFn: () => procurementApi.purchaseOrders({ per_page: 100 }),
  });
  return (
    <RecordsLayout
      create={
        <InvoiceForm references={references} orders={orders.data?.data ?? []} />
      }
      error={invoices.error ?? orders.error}
      loading={invoices.isLoading || orders.isLoading}
    >
      <ProcurementTable<SupplierInvoice>
        caption="Supplier invoices with purchase-order, receipt, and Finance posting controls."
        rows={invoices.data?.data ?? []}
        getKey={(row) => row.id}
        columns={[
          {
            key: "invoice",
            label: "Invoice",
            render: (row) => (
              <strong>
                {row.number}
                <span className="block text-xs font-normal text-muted-foreground">
                  Vendor: {row.supplier_invoice_number}
                </span>
              </strong>
            ),
          },
          {
            key: "order",
            label: "PO",
            render: (row) =>
              row.purchase_order?.number ?? row.purchase_order_id,
          },
          {
            key: "value",
            label: "Total",
            align: "right",
            render: (row) => formatMoney(row.total, row.currency),
          },
          {
            key: "match",
            label: "Match",
            render: (row) => (
              <div>
                <ProcurementStatus value={row.match_status} />
                {row.discrepancies?.length ? (
                  <span className="mt-1 block text-xs text-destructive">
                    {row.discrepancies.length} discrepancy
                  </span>
                ) : null}
              </div>
            ),
          },
          {
            key: "finance",
            label: "Finance",
            render: (row) =>
              row.finance_document
                ? `${row.finance_document.number} · ${row.finance_document.status}`
                : "Not posted",
          },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <ActionGroup>
                {["pending", "exception"].includes(row.match_status) &&
                row.status !== "posted" ? (
                  <ActionButton
                    label="Run match"
                    queryKey="invoices"
                    run={() => procurementApi.invoiceAction(row.id, "match")}
                  />
                ) : null}
                {row.match_status === "exception" ? (
                  <InvoiceOverrideForm invoice={row} />
                ) : null}
                {row.status === "matched" ? (
                  <ActionButton
                    label="Submit"
                    queryKey="invoices"
                    run={() => procurementApi.invoiceAction(row.id, "submit")}
                  />
                ) : null}
                {row.status === "pending_approval" ? (
                  <ActionButton
                    label="Approve"
                    queryKey="invoices"
                    run={() => procurementApi.invoiceAction(row.id, "approve")}
                  />
                ) : null}
                {row.status === "approved" ? (
                  <ActionButton
                    label="Post to Finance"
                    queryKey="invoices"
                    run={() => procurementApi.invoiceAction(row.id, "post")}
                  />
                ) : null}
              </ActionGroup>
            ),
          },
        ]}
      />
    </RecordsLayout>
  );
}

function Agreements({ references }: { references: ProcurementReferences }) {
  const query = useQuery({
    queryKey: ["procurement", "agreements"],
    queryFn: () => procurementApi.agreements({ per_page: 100 }),
  });
  return (
    <RecordsLayout
      create={<AgreementForm references={references} />}
      error={query.error}
      loading={query.isLoading}
    >
      <ProcurementTable<Agreement>
        caption="Framework, blanket, service-level, and rate agreements."
        rows={query.data?.data ?? []}
        getKey={(row) => row.id}
        columns={[
          {
            key: "agreement",
            label: "Agreement",
            render: (row) => (
              <strong>
                {row.number}
                <span className="block text-xs font-normal text-muted-foreground">
                  {row.title}
                </span>
              </strong>
            ),
          },
          {
            key: "supplier",
            label: "Supplier",
            render: (row) => row.supplier?.name ?? row.supplier_id,
          },
          {
            key: "validity",
            label: "Validity",
            render: (row) => `${row.starts_on} – ${row.ends_on}`,
          },
          {
            key: "ceiling",
            label: "Ceiling",
            align: "right",
            render: (row) => formatMoney(row.ceiling_amount, row.currency),
          },
          {
            key: "committed",
            label: "Committed",
            align: "right",
            render: (row) => formatMoney(row.committed_amount, row.currency),
          },
          {
            key: "status",
            label: "Status",
            render: (row) => <ProcurementStatus value={row.status} />,
          },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <ActionGroup>
                {row.status === "draft" ? (
                  <ActionButton
                    label="Activate"
                    queryKey="agreements"
                    run={() =>
                      procurementApi.agreementAction(row.id, "activate")
                    }
                  />
                ) : null}
                {row.status === "active" ? (
                  <ActionButton
                    label="Suspend"
                    queryKey="agreements"
                    run={() =>
                      procurementApi.agreementAction(row.id, "suspend")
                    }
                  />
                ) : null}
                {row.status === "suspended" ? (
                  <ActionButton
                    label="Resume"
                    queryKey="agreements"
                    run={() => procurementApi.agreementAction(row.id, "resume")}
                  />
                ) : null}
              </ActionGroup>
            ),
          },
        ]}
      />
    </RecordsLayout>
  );
}

function RecordsLayout({
  create,
  loading,
  error,
  children,
}: {
  create: ReactNode;
  loading: boolean;
  error: unknown;
  children: ReactNode;
}) {
  return (
    <>
      <details className="group rounded-2xl border bg-card shadow-sm">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-2xl px-5 py-3 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <CirclePlus aria-hidden="true" className="size-5 text-[#1d5b49]" />
          Create or capture a record
        </summary>
        <div className="border-t p-5">{create}</div>
      </details>
      {error ? (
        <ProcurementError error={error} />
      ) : loading ? (
        <ProcurementLoading />
      ) : (
        children
      )}
    </>
  );
}
function ActionGroup({ children }: { children: ReactNode }) {
  return <div className="flex min-w-44 flex-wrap gap-2">{children}</div>;
}
function ActionButton({
  label,
  queryKey,
  run,
}: {
  label: string;
  queryKey: string;
  run: () => Promise<unknown>;
}) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["procurement", queryKey] });
      await client.invalidateQueries({
        queryKey: ["procurement", "dashboard"],
      });
    },
  });
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      <BusyLabel busy={mutation.isPending}>{label}</BusyLabel>
    </Button>
  );
}

function InlineAction({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details className="min-w-48 rounded-md border bg-background">
      <summary className="min-h-9 cursor-pointer list-none rounded-md px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#1d5b49] focus-visible:ring-offset-2">
        {label}
      </summary>
      <div className="border-t p-3">{children}</div>
    </details>
  );
}

function InlineMutationError({ error }: { error: unknown }) {
  if (!error) return null;
  const message =
    error instanceof Error ? error.message : "The action could not be saved.";
  return (
    <p role="alert" className="text-xs font-medium text-destructive">
      {message}
    </p>
  );
}

function SupplierEligibilityForm({ supplier }: { supplier: SupplierProfile }) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      procurementApi.updateSupplier(supplier.id, payload),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["procurement", "suppliers"] }),
  });
  return (
    <InlineAction label="Review eligibility">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          mutation.mutate({
            eligibility_status: form.get("eligibility_status"),
            quality_score: Number(form.get("quality_score")),
            delivery_score: Number(form.get("delivery_score")),
            responsiveness_score: Number(form.get("responsiveness_score")),
            invoice_accuracy_score: Number(form.get("invoice_accuracy_score")),
            debarred_until: form.get("debarred_until") || null,
          });
        }}
      >
        <Field id={`supplier-${supplier.id}-eligibility`} label="Eligibility">
          <select
            id={`supplier-${supplier.id}-eligibility`}
            name="eligibility_status"
            defaultValue={supplier.eligibility_status}
            className={fieldClass}
          >
            <option value="pending">Pending</option>
            <option value="eligible">Eligible</option>
            <option value="conditional">Conditional</option>
            <option value="suspended">Suspended</option>
            <option value="debarred">Debarred</option>
          </select>
        </Field>
        {[
          ["quality_score", "Quality", supplier.quality_score],
          ["delivery_score", "On-time delivery", supplier.delivery_score],
          [
            "responsiveness_score",
            "Responsiveness",
            supplier.responsiveness_score,
          ],
          [
            "invoice_accuracy_score",
            "Invoice accuracy",
            supplier.invoice_accuracy_score,
          ],
        ].map(([name, labelText, value]) => (
          <Field
            key={String(name)}
            id={`supplier-${supplier.id}-${name}`}
            label={`${labelText} score`}
          >
            <Input
              id={`supplier-${supplier.id}-${name}`}
              name={String(name)}
              type="number"
              min="0"
              max="100"
              step="0.1"
              defaultValue={String(value)}
              required
            />
          </Field>
        ))}
        <Field id={`supplier-${supplier.id}-debarred`} label="Debarred until">
          <Input
            id={`supplier-${supplier.id}-debarred`}
            name="debarred_until"
            type="date"
            defaultValue={supplier.debarred_until ?? ""}
          />
        </Field>
        <InlineMutationError error={mutation.error} />
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          <BusyLabel busy={mutation.isPending}>Save review</BusyLabel>
        </Button>
      </form>
    </InlineAction>
  );
}

function BudgetCheckForm({ requisition }: { requisition: Requisition }) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      procurementApi.requisitionAction(requisition.id, "budget-check", payload),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["procurement", "requisitions"] }),
  });
  return (
    <InlineAction label="Record budget check">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          mutation.mutate({
            budget_status: form.get("budget_status"),
            budget_notes: form.get("budget_notes"),
          });
        }}
      >
        <Field id={`budget-${requisition.id}-status`} label="Budget decision">
          <select
            id={`budget-${requisition.id}-status`}
            name="budget_status"
            className={fieldClass}
          >
            <option value="available">Available</option>
            <option value="conditional">Conditional</option>
            <option value="insufficient">Insufficient</option>
          </select>
        </Field>
        <Field id={`budget-${requisition.id}-notes`} label="Review notes">
          <Textarea
            id={`budget-${requisition.id}-notes`}
            name="budget_notes"
            rows={3}
            required
          />
        </Field>
        <InlineMutationError error={mutation.error} />
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          <BusyLabel busy={mutation.isPending}>Save decision</BusyLabel>
        </Button>
      </form>
    </InlineAction>
  );
}

function BidEvaluationForm({ bid }: { bid: SupplierBid }) {
  const client = useQueryClient();
  const [eligible, setEligible] = useState(false);
  const [recommended, setRecommended] = useState(false);
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      procurementApi.evaluateBid(bid.id, payload),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["procurement", "sourcing"] }),
  });
  return (
    <InlineAction label="Evaluate bid">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          mutation.mutate({
            technical_score: Number(form.get("technical_score")),
            financial_score: Number(form.get("financial_score")),
            preference_score: Number(form.get("preference_score")),
            evaluated_total: Number(form.get("evaluated_total")),
            evaluation_notes: form.get("evaluation_notes"),
            compliance_checks: [
              { check: "supplier_eligibility", passed: eligible },
            ],
            recommended,
          });
        }}
      >
        {[
          ["technical_score", "Technical score", "0"],
          ["financial_score", "Financial score", "0"],
          ["preference_score", "Preference score", "0"],
        ].map(([name, labelText, value]) => (
          <Field key={name} id={`bid-${bid.id}-${name}`} label={labelText}>
            <Input
              id={`bid-${bid.id}-${name}`}
              name={name}
              type="number"
              min="0"
              max="100"
              step="0.1"
              defaultValue={value}
              required
            />
          </Field>
        ))}
        <Field id={`bid-${bid.id}-total`} label="Evaluated total">
          <Input
            id={`bid-${bid.id}-total`}
            name="evaluated_total"
            type="number"
            min="0"
            step="0.01"
            defaultValue={String(bid.total)}
            required
          />
        </Field>
        <Field id={`bid-${bid.id}-notes`} label="Evaluation notes">
          <Textarea
            id={`bid-${bid.id}-notes`}
            name="evaluation_notes"
            rows={3}
            required
          />
        </Field>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`bid-${bid.id}-eligible`}
            checked={eligible}
            onCheckedChange={(value) => setEligible(value === true)}
          />
          <Label htmlFor={`bid-${bid.id}-eligible`}>
            Eligibility check passed
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`bid-${bid.id}-recommended`}
            checked={recommended}
            onCheckedChange={(value) => setRecommended(value === true)}
          />
          <Label htmlFor={`bid-${bid.id}-recommended`}>
            Recommend for award
          </Label>
        </div>
        <InlineMutationError error={mutation.error} />
        <Button
          type="submit"
          size="sm"
          disabled={mutation.isPending || !eligible}
        >
          <BusyLabel busy={mutation.isPending}>Save evaluation</BusyLabel>
        </Button>
      </form>
    </InlineAction>
  );
}

function ReceiptInspectionForm({ receipt }: { receipt: GoodsReceipt }) {
  const client = useQueryClient();
  const [status, setStatus] = useState("passed");
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      procurementApi.inspectReceipt(receipt.id, payload),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["procurement", "receipts"] }),
  });
  return (
    <InlineAction label="Record inspection">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const notes = String(form.get("quality_notes") ?? "");
          mutation.mutate({
            inspection_method: form.get("inspection_method"),
            inspection_status: status,
            quality_notes: notes,
            nonconformance_reference:
              form.get("nonconformance_reference") || undefined,
            inspection_results: [{ result: status, notes }],
          });
        }}
      >
        <Field id={`receipt-${receipt.id}-method`} label="Inspection method">
          <select
            id={`receipt-${receipt.id}-method`}
            name="inspection_method"
            className={fieldClass}
          >
            <option value="sample">Sample</option>
            <option value="full">Full</option>
            <option value="measurement">Measurement</option>
            <option value="document_review">Document review</option>
          </select>
        </Field>
        <Field id={`receipt-${receipt.id}-status`} label="Decision">
          <select
            id={`receipt-${receipt.id}-status`}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={fieldClass}
          >
            <option value="passed">Passed</option>
            <option value="accepted_with_exception">
              Accept with exception
            </option>
            <option value="failed">Failed</option>
          </select>
        </Field>
        <Field id={`receipt-${receipt.id}-notes`} label="Inspection notes">
          <Textarea
            id={`receipt-${receipt.id}-notes`}
            name="quality_notes"
            rows={3}
            required
          />
        </Field>
        {status !== "passed" ? (
          <Field
            id={`receipt-${receipt.id}-ncr`}
            label="Nonconformance reference"
          >
            <Input
              id={`receipt-${receipt.id}-ncr`}
              name="nonconformance_reference"
              required
            />
          </Field>
        ) : null}
        <InlineMutationError error={mutation.error} />
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          <BusyLabel busy={mutation.isPending}>Save inspection</BusyLabel>
        </Button>
      </form>
    </InlineAction>
  );
}

function InvoiceOverrideForm({ invoice }: { invoice: SupplierInvoice }) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (reason: string) =>
      procurementApi.invoiceAction(invoice.id, "override", { reason }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["procurement", "invoices"] }),
  });
  return (
    <InlineAction label="Authorize exception">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(
            String(new FormData(event.currentTarget).get("reason") ?? ""),
          );
        }}
      >
        <Field id={`invoice-${invoice.id}-reason`} label="Override reason">
          <Textarea
            id={`invoice-${invoice.id}-reason`}
            name="reason"
            rows={4}
            required
          />
        </Field>
        <InlineMutationError error={mutation.error} />
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          <BusyLabel busy={mutation.isPending}>Authorize override</BusyLabel>
        </Button>
      </form>
    </InlineAction>
  );
}

const fieldClass =
  "h-10 w-full rounded-md border border-[#6b7280] bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#1d5b49] focus-visible:ring-offset-2";
const today = () => new Date().toISOString().slice(0, 10);
const newLine = (): ProcurementLine => ({
  line_key: crypto.randomUUID(),
  description: "",
  quantity: 1,
  unit: "unit",
  unit_price: 0,
  tax_rate: 0,
});

function FormShell({
  title,
  description,
  mutation,
  onSubmit,
  children,
}: {
  title: string;
  description: string;
  mutation: { isPending: boolean; error: unknown };
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 [&_input]:border-[#6b7280] [&_input]:focus-visible:ring-[#1d5b49] [&_textarea]:border-[#6b7280] [&_textarea]:focus-visible:ring-[#1d5b49]"
    >
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {mutation.error ? (
        <ProcurementError error={mutation.error} title="Record was not saved" />
      ) : null}
      {children}
      <Button
        type="submit"
        disabled={mutation.isPending}
        className="bg-[#1d5b49] text-white hover:bg-[#164739]"
      >
        <BusyLabel busy={mutation.isPending}>Save draft</BusyLabel>
      </Button>
    </form>
  );
}
function Field({
  id,
  label,
  children,
  hint,
}: {
  id: string;
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
function Grid({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
  );
}

function SupplierForm({ references }: { references: ProcurementReferences }) {
  const client = useQueryClient();
  const [existingId, setExistingId] = useState("");
  const [domestic, setDomestic] = useState(true);
  const mutation = useMutation({
    mutationFn: procurementApi.createSupplier,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["procurement", "suppliers"] }),
  });
  return (
    <FormShell
      title="Qualify a supplier"
      description="Link an existing Inventory supplier or create a shared supplier master here."
      mutation={mutation}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        mutation.mutate({
          supplier_id: existingId ? Number(existingId) : undefined,
          name: form.get("name"),
          code: form.get("code"),
          email: form.get("email"),
          legal_name: form.get("legal_name"),
          tax_identification_number: form.get("tin"),
          business_license_number: form.get("license"),
          eligibility_status: form.get("eligibility"),
          domestic_supplier: domestic,
          responsiveness_score: Number(form.get("responsiveness")),
        });
      }}
    >
      <Grid>
        <Field id="supplier-existing" label="Existing Inventory supplier">
          <select
            id="supplier-existing"
            value={existingId}
            onChange={(e) => setExistingId(e.target.value)}
            className={fieldClass}
          >
            <option value="">Create a new supplier</option>
            {references.suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.code} · {supplier.name}
              </option>
            ))}
          </select>
        </Field>
        {!existingId ? (
          <>
            <Field id="supplier-name" label="Supplier name">
              <Input id="supplier-name" name="name" required />
            </Field>
            <Field id="supplier-code" label="Supplier code">
              <Input id="supplier-code" name="code" required />
            </Field>
            <Field id="supplier-email" label="Email">
              <Input id="supplier-email" name="email" type="email" />
            </Field>
          </>
        ) : null}
        <Field id="supplier-legal" label="Legal name">
          <Input id="supplier-legal" name="legal_name" />
        </Field>
        <Field id="supplier-tin" label="Tax identification number">
          <Input id="supplier-tin" name="tin" />
        </Field>
        <Field id="supplier-license" label="Business license number">
          <Input id="supplier-license" name="license" />
        </Field>
        <Field id="supplier-eligibility" label="Eligibility">
          <select
            id="supplier-eligibility"
            name="eligibility"
            defaultValue="eligible"
            className={fieldClass}
          >
            <option value="pending">Pending</option>
            <option value="eligible">Eligible</option>
            <option value="conditional">Conditional</option>
            <option value="suspended">Suspended</option>
            <option value="debarred">Debarred</option>
          </select>
        </Field>
        <Field id="supplier-responsiveness" label="Responsiveness score">
          <Input
            id="supplier-responsiveness"
            name="responsiveness"
            type="number"
            min="0"
            max="100"
            defaultValue="50"
          />
        </Field>
        <div className="flex items-center gap-2 self-end pb-3">
          <Checkbox
            id="supplier-domestic"
            checked={domestic}
            onCheckedChange={(value) => setDomestic(value === true)}
          />
          <Label htmlFor="supplier-domestic">Domestic supplier</Label>
        </div>
      </Grid>
    </FormShell>
  );
}

function RequisitionForm({
  references,
}: {
  references: ProcurementReferences;
}) {
  const client = useQueryClient();
  const [lines, setLines] = useState<ProcurementLine[]>([newLine()]);
  const mutation = useMutation({
    mutationFn: procurementApi.createRequisition,
    onSuccess: () => {
      setLines([newLine()]);
      client.invalidateQueries({ queryKey: ["procurement", "requisitions"] });
    },
  });
  return (
    <FormShell
      title="Create a purchase requisition"
      description="Line estimates support budget approval and later sourcing."
      mutation={mutation}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        mutation.mutate({
          title: form.get("title"),
          business_justification: form.get("justification"),
          procurement_method: form.get("method"),
          priority: form.get("priority"),
          required_on: form.get("required_on") || undefined,
          currency: "ETB",
          items: lines,
        });
      }}
    >
      <Grid>
        <Field id="pr-title" label="Request title">
          <Input id="pr-title" name="title" required />
        </Field>
        <Field id="pr-method" label="Procurement method">
          <select id="pr-method" name="method" className={fieldClass}>
            {references.methods.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="pr-priority" label="Priority">
          <select id="pr-priority" name="priority" className={fieldClass}>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
            <option value="low">Low</option>
          </select>
        </Field>
        <Field id="pr-required" label="Required date">
          <Input
            id="pr-required"
            name="required_on"
            type="date"
            min={today()}
          />
        </Field>
        <div className="md:col-span-2">
          <Field id="pr-justification" label="Business justification">
            <Textarea id="pr-justification" name="justification" rows={3} />
          </Field>
        </div>
      </Grid>
      <LineItemsEditor
        lines={lines}
        onChange={setLines}
        references={references}
      />
    </FormShell>
  );
}

function SourcingForm({ references }: { references: ProcurementReferences }) {
  const client = useQueryClient();
  const requisitions = useQuery({
    queryKey: ["procurement", "requisitions", "approved"],
    queryFn: () =>
      procurementApi.requisitions({ per_page: 100, status: "approved" }),
  });
  const mutation = useMutation({
    mutationFn: procurementApi.createSourcingEvent,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["procurement", "sourcing"] }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Open a sourcing event</CardTitle>
        <CardDescription>
          Include the official e-GP or standard bidding document reference when
          applicable.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormShell
          title="Event details"
          description="Deadlines and evaluation weights remain auditable."
          mutation={mutation}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            mutation.mutate({
              requisition_id: Number(form.get("requisition_id")) || undefined,
              title: form.get("title"),
              method: form.get("method"),
              scope: form.get("scope"),
              estimated_value: Number(form.get("estimated_value")),
              currency: "ETB",
              egp_reference: form.get("egp_reference"),
              submission_deadline: form.get("deadline") || undefined,
              tax_inclusive_evaluation: true,
              evaluation_criteria: [
                { key: "technical", weight: 40 },
                { key: "financial", weight: 50 },
                { key: "preference", weight: 10 },
              ],
            });
          }}
        >
          <Grid>
            <Field id="source-requisition" label="Approved requisition">
              <select
                id="source-requisition"
                name="requisition_id"
                className={fieldClass}
              >
                <option value="">Independent sourcing</option>
                {(requisitions.data?.data ?? []).map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.number} · {row.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="source-title" label="Event title">
              <Input id="source-title" name="title" required />
            </Field>
            <Field id="source-method" label="Method">
              <select id="source-method" name="method" className={fieldClass}>
                {references.methods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="source-value" label="Estimated value">
              <Input
                id="source-value"
                name="estimated_value"
                type="number"
                min="0"
                step="0.01"
                required
              />
            </Field>
            <Field id="source-egp" label="e-GP reference">
              <Input id="source-egp" name="egp_reference" />
            </Field>
            <Field id="source-deadline" label="Submission deadline">
              <Input
                id="source-deadline"
                name="deadline"
                type="datetime-local"
              />
            </Field>
          </Grid>
          <Field id="source-scope" label="Scope and specification">
            <Textarea id="source-scope" name="scope" rows={3} />
          </Field>
        </FormShell>
      </CardContent>
    </Card>
  );
}

function BidForm({
  references,
  events,
}: {
  references: ProcurementReferences;
  events: SourcingEvent[];
}) {
  const client = useQueryClient();
  const [lines, setLines] = useState<ProcurementLine[]>([newLine()]);
  const mutation = useMutation({
    mutationFn: ({
      eventId,
      payload,
    }: {
      eventId: number;
      payload: Record<string, unknown>;
    }) => procurementApi.createBid(eventId, payload),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["procurement", "sourcing"] }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Capture a supplier offer</CardTitle>
        <CardDescription>
          Offers preserve line price, tax, delivery lead time, and validity for
          comparison.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormShell
          title="Bid details"
          description="Only published or evaluation-stage events accept offers."
          mutation={mutation}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            mutation.mutate({
              eventId: Number(form.get("event_id")),
              payload: {
                supplier_id: Number(form.get("supplier_id")),
                reference: form.get("reference"),
                currency: "ETB",
                delivery_days: Number(form.get("delivery_days")),
                payment_terms: form.get("payment_terms"),
                valid_until: form.get("valid_until") || undefined,
                items: lines,
              },
            });
          }}
        >
          <Grid>
            <Field id="bid-event" label="Sourcing event">
              <select
                id="bid-event"
                name="event_id"
                required
                className={fieldClass}
              >
                <option value="">Select an event</option>
                {events
                  .filter((event) =>
                    ["published", "evaluation"].includes(event.status),
                  )
                  .map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.number} · {event.title}
                    </option>
                  ))}
              </select>
            </Field>
            <Field id="bid-supplier" label="Supplier">
              <select
                id="bid-supplier"
                name="supplier_id"
                required
                className={fieldClass}
              >
                <option value="">Select a supplier</option>
                {references.suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.code} · {supplier.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="bid-reference" label="Supplier reference">
              <Input id="bid-reference" name="reference" />
            </Field>
            <Field id="bid-delivery" label="Delivery lead time (days)">
              <Input
                id="bid-delivery"
                name="delivery_days"
                type="number"
                min="0"
                defaultValue="7"
                required
              />
            </Field>
            <Field id="bid-terms" label="Payment terms">
              <Input id="bid-terms" name="payment_terms" />
            </Field>
            <Field id="bid-valid" label="Valid until">
              <Input id="bid-valid" name="valid_until" type="date" />
            </Field>
          </Grid>
          <LineItemsEditor
            lines={lines}
            onChange={setLines}
            references={references}
          />
        </FormShell>
      </CardContent>
    </Card>
  );
}

function PurchaseOrderForm({
  references,
}: {
  references: ProcurementReferences;
}) {
  const client = useQueryClient();
  const [lines, setLines] = useState<ProcurementLine[]>([newLine()]);
  const [overReceipt, setOverReceipt] = useState(false);
  const mutation = useMutation({
    mutationFn: procurementApi.createPurchaseOrder,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["procurement", "orders"] }),
  });
  return (
    <FormShell
      title="Create a direct or agreement purchase order"
      description="Competitive awards generate orders automatically; use this form for approved direct and framework commitments."
      mutation={mutation}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        mutation.mutate({
          supplier_id: Number(form.get("supplier_id")),
          agreement_id: Number(form.get("agreement_id")) || undefined,
          currency: "ETB",
          items: lines,
          ordered_on: form.get("ordered_on"),
          expected_on: form.get("expected_on") || undefined,
          delivery_location: form.get("delivery_location"),
          allow_over_receipt: overReceipt,
          over_receipt_tolerance_percent: overReceipt
            ? Number(form.get("tolerance"))
            : 0,
        });
      }}
    >
      <Grid>
        <Field id="po-supplier" label="Qualified supplier">
          <select
            id="po-supplier"
            name="supplier_id"
            required
            className={fieldClass}
          >
            <option value="">Select a supplier</option>
            {references.suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.code} · {supplier.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="po-agreement" label="Agreement">
          <select id="po-agreement" name="agreement_id" className={fieldClass}>
            <option value="">No agreement</option>
            {references.agreements.map((agreement) => (
              <option key={agreement.id} value={agreement.id}>
                {agreement.number} · {agreement.title}
              </option>
            ))}
          </select>
        </Field>
        <Field id="po-ordered" label="Order date">
          <Input
            id="po-ordered"
            name="ordered_on"
            type="date"
            defaultValue={today()}
            required
          />
        </Field>
        <Field id="po-expected" label="Expected date">
          <Input
            id="po-expected"
            name="expected_on"
            type="date"
            min={today()}
          />
        </Field>
        <Field id="po-location" label="Delivery location">
          <Input id="po-location" name="delivery_location" />
        </Field>
        <div className="flex items-center gap-2 self-end pb-3">
          <Checkbox
            id="po-over-receipt"
            checked={overReceipt}
            onCheckedChange={(value) => setOverReceipt(value === true)}
          />
          <Label htmlFor="po-over-receipt">Allow controlled over-receipt</Label>
        </div>
        {overReceipt ? (
          <Field id="po-tolerance" label="Over-receipt tolerance (%)">
            <Input
              id="po-tolerance"
              name="tolerance"
              type="number"
              min="0"
              max="100"
              defaultValue="0"
            />
          </Field>
        ) : null}
      </Grid>
      <LineItemsEditor
        lines={lines}
        onChange={setLines}
        references={references}
      />
    </FormShell>
  );
}

function ReceiptForm({
  references,
  orders,
}: {
  references: ProcurementReferences;
  orders: PurchaseOrder[];
}) {
  const client = useQueryClient();
  const [orderId, setOrderId] = useState("");
  const [lines, setLines] = useState<ProcurementLine[]>([]);
  const mutation = useMutation({
    mutationFn: procurementApi.createReceipt,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["procurement", "receipts"] }),
  });
  const selectOrder = (value: string) => {
    setOrderId(value);
    const order = orders.find((row) => row.id === Number(value));
    setLines(
      order?.items.map((line) => ({
        ...line,
        received_quantity: Number(line.quantity),
        accepted_quantity: Number(line.quantity),
      })) ?? [],
    );
  };
  return (
    <FormShell
      title="Capture a goods receipt"
      description="Select the purchase order to copy its immutable line keys and enter the delivered quantities."
      mutation={mutation}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        mutation.mutate({
          purchase_order_id: Number(orderId),
          supplier_delivery_note: form.get("delivery_note"),
          received_on: form.get("received_on"),
          items: lines.map((line) => ({
            ...line,
            received_quantity: Number(line.received_quantity),
            accepted_quantity: Number(
              line.accepted_quantity ?? line.received_quantity,
            ),
          })),
        });
      }}
    >
      <Grid>
        <Field id="grn-order" label="Purchase order">
          <select
            id="grn-order"
            value={orderId}
            onChange={(e) => selectOrder(e.target.value)}
            required
            className={fieldClass}
          >
            <option value="">Select an issued order</option>
            {orders
              .filter((order) =>
                ["issued", "confirmed", "partially_received"].includes(
                  order.status,
                ),
              )
              .map((order) => (
                <option key={order.id} value={order.id}>
                  {order.number} · {order.supplier?.name}
                </option>
              ))}
          </select>
        </Field>
        <Field id="grn-delivery-note" label="Supplier delivery note">
          <Input id="grn-delivery-note" name="delivery_note" />
        </Field>
        <Field id="grn-date" label="Received date">
          <Input
            id="grn-date"
            name="received_on"
            type="date"
            defaultValue={today()}
            required
          />
        </Field>
      </Grid>
      <ReceiptLines lines={lines} onChange={setLines} references={references} />
    </FormShell>
  );
}

function InvoiceForm({
  references,
  orders,
}: {
  references: ProcurementReferences;
  orders: PurchaseOrder[];
}) {
  const client = useQueryClient();
  const [orderId, setOrderId] = useState("");
  const [lines, setLines] = useState<ProcurementLine[]>([]);
  const mutation = useMutation({
    mutationFn: procurementApi.createInvoice,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["procurement", "invoices"] }),
  });
  const selectOrder = (value: string) => {
    setOrderId(value);
    const order = orders.find((row) => row.id === Number(value));
    setLines(order?.items.map((line) => ({ ...line })) ?? []);
  };
  return (
    <FormShell
      title="Capture a supplier invoice"
      description="Purchase-order lines are copied for line-level price and quantity matching against accepted receipts."
      mutation={mutation}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        mutation.mutate({
          supplier_invoice_number: form.get("supplier_invoice_number"),
          purchase_order_id: Number(orderId),
          invoice_date: form.get("invoice_date"),
          due_date: form.get("due_date") || undefined,
          currency: "ETB",
          items: lines,
          price_tolerance_percent: Number(form.get("price_tolerance")),
          quantity_tolerance_percent: Number(form.get("quantity_tolerance")),
        });
      }}
    >
      <Grid>
        <Field id="invoice-order" label="Purchase order">
          <select
            id="invoice-order"
            value={orderId}
            onChange={(e) => selectOrder(e.target.value)}
            required
            className={fieldClass}
          >
            <option value="">Select an order</option>
            {orders
              .filter((order) => !["draft", "cancelled"].includes(order.status))
              .map((order) => (
                <option key={order.id} value={order.id}>
                  {order.number} · {order.supplier?.name}
                </option>
              ))}
          </select>
        </Field>
        <Field id="invoice-vendor-number" label="Supplier invoice number">
          <Input
            id="invoice-vendor-number"
            name="supplier_invoice_number"
            required
          />
        </Field>
        <Field id="invoice-date" label="Invoice date">
          <Input
            id="invoice-date"
            name="invoice_date"
            type="date"
            defaultValue={today()}
            required
          />
        </Field>
        <Field id="invoice-due" label="Due date">
          <Input id="invoice-due" name="due_date" type="date" min={today()} />
        </Field>
        <Field id="invoice-price-tolerance" label="Price tolerance (%)">
          <Input
            id="invoice-price-tolerance"
            name="price_tolerance"
            type="number"
            min="0"
            max="100"
            defaultValue="0"
          />
        </Field>
        <Field id="invoice-quantity-tolerance" label="Quantity tolerance (%)">
          <Input
            id="invoice-quantity-tolerance"
            name="quantity_tolerance"
            type="number"
            min="0"
            max="100"
            defaultValue="0"
          />
        </Field>
      </Grid>
      <LineItemsEditor
        lines={lines}
        onChange={setLines}
        references={references}
        preserveKeys
      />
    </FormShell>
  );
}

function AgreementForm({ references }: { references: ProcurementReferences }) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: procurementApi.createAgreement,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["procurement", "agreements"] }),
  });
  return (
    <FormShell
      title="Create a procurement agreement"
      description="Define the commercial ceiling and validity before activation."
      mutation={mutation}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        mutation.mutate({
          supplier_id: Number(form.get("supplier_id")),
          type: form.get("type"),
          title: form.get("title"),
          starts_on: form.get("starts_on"),
          ends_on: form.get("ends_on"),
          currency: "ETB",
          ceiling_amount: Number(form.get("ceiling_amount")),
          committed_amount: 0,
          auto_replenishment: form.get("auto_replenishment") === "on",
        });
      }}
    >
      <Grid>
        <Field id="agreement-supplier" label="Supplier">
          <select
            id="agreement-supplier"
            name="supplier_id"
            required
            className={fieldClass}
          >
            <option value="">Select a supplier</option>
            {references.suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.code} · {supplier.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="agreement-type" label="Agreement type">
          <select id="agreement-type" name="type" className={fieldClass}>
            <option value="framework">Framework</option>
            <option value="blanket">Blanket order</option>
            <option value="service_level">Service-level agreement</option>
            <option value="rate_contract">Rate contract</option>
          </select>
        </Field>
        <Field id="agreement-title" label="Agreement title">
          <Input id="agreement-title" name="title" required />
        </Field>
        <Field id="agreement-start" label="Start date">
          <Input
            id="agreement-start"
            name="starts_on"
            type="date"
            defaultValue={today()}
            required
          />
        </Field>
        <Field id="agreement-end" label="End date">
          <Input
            id="agreement-end"
            name="ends_on"
            type="date"
            min={today()}
            required
          />
        </Field>
        <Field id="agreement-ceiling" label="Ceiling amount">
          <Input
            id="agreement-ceiling"
            name="ceiling_amount"
            type="number"
            min="0.01"
            step="0.01"
            required
          />
        </Field>
        <div className="flex items-center gap-2 self-end pb-3">
          <Checkbox
            id="agreement-auto-replenishment"
            name="auto_replenishment"
          />
          <Label htmlFor="agreement-auto-replenishment">
            Allow automatic replenishment call-offs
          </Label>
        </div>
      </Grid>
    </FormShell>
  );
}

function LineItemsEditor({
  lines,
  onChange,
  references,
  preserveKeys = false,
}: {
  lines: ProcurementLine[];
  onChange: (lines: ProcurementLine[]) => void;
  references: ProcurementReferences;
  preserveKeys?: boolean;
}) {
  const update = (
    index: number,
    field: keyof ProcurementLine,
    value: string | number | null,
  ) =>
    onChange(
      lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line,
      ),
    );
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">Line items</legend>
      {lines.map((line, index) => (
        <div
          key={line.line_key}
          className="grid gap-3 rounded-xl border bg-muted/20 p-3 md:grid-cols-12"
        >
          <div className="md:col-span-4">
            <Label htmlFor={`line-${line.line_key}-description`}>
              Description
            </Label>
            <Input
              id={`line-${line.line_key}-description`}
              value={line.description}
              onChange={(e) => update(index, "description", e.target.value)}
              required
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor={`line-${line.line_key}-item`}>Inventory item</Label>
            <select
              id={`line-${line.line_key}-item`}
              value={line.inventory_item_id ?? ""}
              onChange={(e) =>
                update(
                  index,
                  "inventory_item_id",
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              className={fieldClass}
            >
              <option value="">Unlinked</option>
              {references.inventory_items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} · {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor={`line-${line.line_key}-quantity`}>Quantity</Label>
            <Input
              id={`line-${line.line_key}-quantity`}
              type="number"
              min="0.001"
              step="0.001"
              value={line.quantity}
              onChange={(e) =>
                update(index, "quantity", Number(e.target.value))
              }
              required
            />
          </div>
          <div className="md:col-span-1">
            <Label htmlFor={`line-${line.line_key}-unit`}>Unit</Label>
            <Input
              id={`line-${line.line_key}-unit`}
              value={line.unit ?? "unit"}
              onChange={(e) => update(index, "unit", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor={`line-${line.line_key}-price`}>Unit price</Label>
            <Input
              id={`line-${line.line_key}-price`}
              type="number"
              min="0"
              step="0.01"
              value={line.unit_price}
              onChange={(e) =>
                update(index, "unit_price", Number(e.target.value))
              }
              required
            />
          </div>
          <div className="flex items-end md:col-span-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={lines.length === 1 || preserveKeys}
              onClick={() =>
                onChange(lines.filter((_, lineIndex) => lineIndex !== index))
              }
            >
              Remove
            </Button>
          </div>
        </div>
      ))}
      {!preserveKeys ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange([...lines, newLine()])}
        >
          <CirclePlus aria-hidden="true" data-icon="inline-start" />
          Add line
        </Button>
      ) : null}
    </fieldset>
  );
}

function ReceiptLines({
  lines,
  onChange,
  references,
}: {
  lines: ProcurementLine[];
  onChange: (lines: ProcurementLine[]) => void;
  references: ProcurementReferences;
}) {
  const update = (
    index: number,
    field: keyof ProcurementLine,
    value: number | null,
  ) =>
    onChange(
      lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line,
      ),
    );
  if (!lines.length)
    return (
      <Alert>
        <Send aria-hidden="true" />
        <AlertTitle>Select a purchase order</AlertTitle>
        <AlertDescription>
          The approved lines will appear here for receipt quantities and
          Inventory links.
        </AlertDescription>
      </Alert>
    );
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">Delivered lines</legend>
      {lines.map((line, index) => (
        <div
          key={line.line_key}
          className="grid gap-3 rounded-xl border p-3 md:grid-cols-4"
        >
          <div>
            <span className="text-sm font-medium">{line.description}</span>
            <span className="block text-xs text-muted-foreground">
              Ordered {Number(line.quantity).toFixed(3)} {line.unit}
            </span>
          </div>
          <Field
            id={`receipt-${line.line_key}-quantity`}
            label="Received quantity"
          >
            <Input
              id={`receipt-${line.line_key}-quantity`}
              type="number"
              min="0.001"
              step="0.001"
              value={line.received_quantity ?? line.quantity}
              onChange={(e) =>
                update(index, "received_quantity", Number(e.target.value))
              }
            />
          </Field>
          <Field
            id={`receipt-${line.line_key}-accepted`}
            label="Accepted quantity"
          >
            <Input
              id={`receipt-${line.line_key}-accepted`}
              type="number"
              min="0"
              step="0.001"
              value={line.accepted_quantity ?? line.quantity}
              onChange={(e) =>
                update(index, "accepted_quantity", Number(e.target.value))
              }
            />
          </Field>
          <Field id={`receipt-${line.line_key}-item`} label="Inventory item">
            <select
              id={`receipt-${line.line_key}-item`}
              value={line.inventory_item_id ?? ""}
              onChange={(e) =>
                update(
                  index,
                  "inventory_item_id",
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              className={fieldClass}
            >
              <option value="">Do not post to stock</option>
              {references.inventory_items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} · {item.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ))}
    </fieldset>
  );
}

export function ReportsPage() {
  const audit = useQuery({
    queryKey: ["procurement", "audit"],
    queryFn: () => procurementApi.auditEvents({ per_page: 100 }),
  });
  const [downloadError, setDownloadError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const download = async (dataset: string) => {
    setBusy(true);
    setDownloadError(null);
    try {
      const blob = await procurementApi.exportReport(dataset);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `procurement-${dataset}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ProcurementShell
      title="Reports and audit"
      description="Export operational datasets and review the immutable procurement action trail for management, Finance, and compliance assurance."
    >
      <Card>
        <CardHeader>
          <CardTitle>Export datasets</CardTitle>
          <CardDescription>
            CSV exports use the same tenant-scoped records shown in the
            workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => download("purchase-orders")}
          >
            <Download aria-hidden="true" data-icon="inline-start" />
            Purchase orders
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => download("supplier-performance")}
          >
            <Download aria-hidden="true" data-icon="inline-start" />
            Supplier performance
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => download("invoice-matching")}
          >
            <Download aria-hidden="true" data-icon="inline-start" />
            Invoice matching
          </Button>
        </CardContent>
      </Card>
      {downloadError ? (
        <ProcurementError error={downloadError} title="Export failed" />
      ) : null}
      {audit.error ? (
        <ProcurementError error={audit.error} />
      ) : audit.isLoading ? (
        <ProcurementLoading />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Audit trail</h2>
            </CardTitle>
            <CardDescription>
              Who did what, to which record, and when.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProcurementTable
              caption="Procurement audit events in reverse chronological order."
              rows={audit.data?.data ?? []}
              getKey={(row) => row.id}
              columns={[
                {
                  key: "time",
                  label: "Occurred",
                  render: (row) => new Date(row.occurred_at).toLocaleString(),
                },
                {
                  key: "entity",
                  label: "Record",
                  render: (row) => `${row.entity_type} #${row.entity_id}`,
                },
                {
                  key: "event",
                  label: "Event",
                  render: (row) => row.event.replaceAll("_", " "),
                },
                {
                  key: "actor",
                  label: "Actor",
                  render: (row) =>
                    row.actor_id ? `User ${row.actor_id}` : "System",
                },
              ]}
            />
          </CardContent>
        </Card>
      )}
    </ProcurementShell>
  );
}
