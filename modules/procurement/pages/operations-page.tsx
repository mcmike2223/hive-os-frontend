"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CirclePlus, Download, Send } from "lucide-react";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { procurementApi } from "@/modules/procurement/api";
import { getErrorMessage } from "@/lib/errors";
import { usePermissions } from "@/hooks/use-permissions";
import type {
  Agreement,
  AuditEvent,
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
  MetricCard,
  ProcurementEmpty,
  ProcurementError,
  ProcurementLoading,
  ProcurementShell,
  ProcurementStatus,
  ProcurementTable,
  ProcurementTableSkeleton,
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

type PaginatedListData = { data?: unknown[] };

function isProcurementListLoading(query: {
  isPending: boolean;
  isFetching: boolean;
  data?: PaginatedListData;
}) {
  if (query.isPending || query.data === undefined) return true;
  return query.isFetching && (query.data.data?.length ?? 0) === 0;
}

function isCostCenterActive(center: { is_active?: boolean | number | string | null }) {
  return center.is_active !== false && center.is_active !== 0 && center.is_active !== "0";
}

function selectableCostCenters(
  centers: ProcurementReferences["cost_centers"],
  selectedId?: number | null,
) {
  return centers.filter((center) => isCostCenterActive(center) || center.id === selectedId);
}

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
      {references.isPending || references.data === undefined ? (
        <ProcurementTableSkeleton rows={8} cols={6} />
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
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [eligibility, setEligibility] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const query = useQuery({
    queryKey: ["procurement", "suppliers", search, eligibility],
    queryFn: () =>
      procurementApi.suppliers({
        per_page: 100,
        search: search || undefined,
        eligibility_status: eligibility || undefined,
      }),
  });
  return (
    <RecordsLayout
      create={
        <SupplierForm
          references={references}
          qualifiedProfiles={query.data?.data ?? []}
          loading={isProcurementListLoading(query)}
        />
      }
      toolbar={
        <div className="grid gap-3 md:grid-cols-2">
          <Field id="supplier-search" label="Search">
            <Input
              id="supplier-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Name, code, or legal name"
            />
          </Field>
          <Field id="supplier-eligibility-filter" label="Eligibility">
            <select
              id="supplier-eligibility-filter"
              value={eligibility}
              onChange={(event) => setEligibility(event.target.value)}
              className={fieldClass}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="eligible">Eligible</option>
              <option value="conditional">Conditional</option>
              <option value="suspended">Suspended</option>
              <option value="debarred">Debarred</option>
            </select>
          </Field>
        </div>
      }
      error={query.error}
      loading={isProcurementListLoading(query)}
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
                  {row.legal_name ? ` · ${row.legal_name}` : ""}
                </span>
              </strong>
            ),
          },
          {
            key: "identity",
            label: "TIN / license",
            render: (row) => (
              <span>
                {row.tax_identification_number || "No TIN"}
                <span className="block text-xs text-muted-foreground">
                  {row.business_license_number || "No license"}
                </span>
              </span>
            ),
          },
          {
            key: "eligibility",
            label: "Eligibility",
            render: (row) => (
              <span>
              <ProcurementStatus value={row.eligibility_status} />
                {row.debarred_until ? (
                  <span className="block text-xs text-muted-foreground">
                    Debarred until {row.debarred_until}
                  </span>
                ) : null}
              </span>
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
            key: "invoice",
            label: "Invoice",
            align: "right",
            render: (row) =>
              `${Number(row.invoice_accuracy_score).toFixed(1)}%`,
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
  const { hasAnyPermission } = usePermissions();
  const canCreate = hasAnyPermission([
    "create_procurement_requisitions",
    "manage_procurement",
  ]);
  const canApprove = hasAnyPermission([
    "approve_procurement_requisitions",
    "manage_procurement",
  ]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const query = useQuery({
    queryKey: ["procurement", "requisitions", search, statusFilter, page],
    queryFn: () =>
      procurementApi.requisitions({
        per_page: 25,
        page,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
  });
  return (
    <RecordsLayout
      create={
        canCreate ? (
          <RequisitionForm references={references} />
        ) : (
          <Alert>
            <Send aria-hidden="true" />
            <AlertTitle>Create permission required</AlertTitle>
            <AlertDescription>
              You can review requisitions but cannot create or edit them with
              this role.
            </AlertDescription>
          </Alert>
        )
      }
      toolbar={
        <div className="grid gap-3 md:grid-cols-2">
          <Field id="requisition-search" label="Search">
            <Input
              id="requisition-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by number or title"
            />
          </Field>
          <Field id="requisition-status" label="Status">
            <select
              id="requisition-status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className={fieldClass}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="pending_approval">Pending approval</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
        </div>
      }
      error={query.error}
      loading={isProcurementListLoading(query)}
    >
      <div className="space-y-3">
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
                  {row.business_justification ? (
                    <span className="block max-w-64 truncate text-xs font-normal text-muted-foreground">
                      {row.business_justification}
                    </span>
                  ) : null}
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
              render: (row) => (
                <span>
                  <ProcurementStatus value={row.budget_status} />
                  {row.budget_notes ? (
                    <span className="block max-w-64 truncate text-xs text-muted-foreground">
                      {row.budget_notes}
                    </span>
                  ) : null}
                </span>
              ),
          },
          {
            key: "value",
            label: "Estimated value",
            align: "right",
            render: (row) => formatMoney(row.estimated_total, row.currency),
          },
            {
              key: "pipeline",
              label: "Pipeline",
              render: (row) => (
                <span className="text-xs">
                  {(row.sourcing_events_count ?? 0).toString()} sourcing ·{" "}
                  {(row.purchase_orders_count ?? 0).toString()} orders
                </span>
              ),
            },
          {
            key: "status",
            label: "Status",
              render: (row) => (
                <span>
                  <ProcurementStatus value={row.status} />
                  {row.rejection_reason ? (
                    <span className="block max-w-64 truncate text-xs text-destructive">
                      {row.rejection_reason}
                    </span>
                  ) : null}
                </span>
              ),
          },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
                <ActionGroup stack>
                  {canCreate &&
                  row.budget_status !== "available" &&
                  row.status === "draft" ? (
                    <BudgetCheckForm
                      requisition={row}
                      group={`requisition-actions-${row.id}`}
                    />
                ) : null}
                  {canCreate && row.status === "draft" ? (
                    <RequisitionEditForm
                      requisition={row}
                      references={references}
                    />
                  ) : null}
                  {canCreate &&
                  row.status === "draft" &&
                  row.budget_status === "available" ? (
                  <ActionButton
                    label="Submit"
                    queryKey="requisitions"
                      successText={`Requisition ${row.number} submitted.`}
                      errorFallback="Requisition could not be submitted."
                    run={() =>
                      procurementApi.requisitionAction(row.id, "submit")
                    }
                  />
                ) : null}
                  {canApprove && row.status === "pending_approval" ? (
                    <>
                  <ActionButton
                    label="Approve"
                    queryKey="requisitions"
                        successText={`Requisition ${row.number} approved.`}
                        errorFallback="Requisition could not be approved."
                    run={() =>
                      procurementApi.requisitionAction(row.id, "approve")
                        }
                      />
                      <RequisitionReasonAction
                        requisition={row}
                        action="reject"
                        label="Reject"
                        group={`requisition-actions-${row.id}`}
                      />
                    </>
                  ) : null}
                  {canCreate &&
                  ["draft", "pending_approval", "approved"].includes(
                    row.status,
                  ) ? (
                    <RequisitionReasonAction
                      requisition={row}
                      action="cancel"
                      label="Cancel"
                      group={`requisition-actions-${row.id}`}
                    />
                  ) : null}
                  {canCreate &&
                  ["rejected", "cancelled"].includes(row.status) ? (
                    <ActionButton
                      label="Reopen"
                      queryKey="requisitions"
                      successText={`Requisition ${row.number} reopened.`}
                      errorFallback="Requisition could not be reopened."
                      run={() =>
                        procurementApi.requisitionAction(row.id, "reopen")
                    }
                  />
                ) : null}
              </ActionGroup>
            ),
          },
        ]}
      />
        <RequisitionPagination
          page={query.data?.current_page ?? 1}
          lastPage={query.data?.last_page ?? 1}
          onPageChange={setPage}
        />
      </div>
    </RecordsLayout>
  );
}

function Sourcing({ references }: { references: ProcurementReferences }) {
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission([
    "manage_procurement_sourcing",
    "manage_procurement",
  ]);
  const canEvaluate = hasAnyPermission([
    "evaluate_procurement_bids",
    "manage_procurement",
  ]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const query = useQuery({
    queryKey: ["procurement", "sourcing", search, statusFilter, page],
    queryFn: () =>
      procurementApi.sourcingEvents({
        per_page: 25,
        page,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
  });
  const publishedEvents = useQuery({
    queryKey: ["procurement", "sourcing", "published"],
    queryFn: () =>
      procurementApi.sourcingEvents({ per_page: 100, status: "published" }),
  });
  return (
    <RecordsLayout
      create={
        canManage ? (
          <div className="grid gap-4">
          <SourcingForm references={references} />
            <BidForm
              references={references}
              events={publishedEvents.data?.data ?? []}
            />
          </div>
        ) : (
          <Alert>
            <Send aria-hidden="true" />
            <AlertTitle>Sourcing permission required</AlertTitle>
            <AlertDescription>
              You can review events but cannot create, publish, or capture
              offers with this role.
            </AlertDescription>
          </Alert>
        )
      }
      toolbar={
        <div className="grid gap-3 md:grid-cols-2">
          <Field id="sourcing-search" label="Search">
            <Input
              id="sourcing-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by number, title, or e-GP reference"
            />
          </Field>
          <Field id="sourcing-status" label="Status">
            <select
              id="sourcing-status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className={fieldClass}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="evaluation">Evaluation</option>
              <option value="awarded">Awarded</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
        </div>
      }
      error={query.error}
      loading={isProcurementListLoading(query)}
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
                    {event.standard_bidding_document
                      ? ` · ${event.standard_bidding_document}`
                      : ""}
                    {event.submission_deadline
                      ? ` · submit by ${event.submission_deadline}`
                      : ""}
                  </CardDescription>
                </div>
                <ProcurementStatus value={event.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ActionGroup stack>
                {canManage && event.status === "draft" ? (
                  <SourcingEditForm event={event} references={references} />
                ) : null}
                {canManage && event.status === "draft" ? (
                  <ActionButton
                    label="Publish"
                    queryKey="sourcing"
                    successText={`${event.number} published. Capture supplier offers next.`}
                    errorFallback="Sourcing event could not be published."
                    run={() =>
                      procurementApi.sourcingAction(event.id, "publish")
                    }
                  />
                ) : null}
                {canManage && event.status === "published" ? (
                  <ActionButton
                    label="Open evaluation"
                    queryKey="sourcing"
                    successText={`${event.number} is open for scoring.`}
                    errorFallback="Evaluation could not be opened."
                    run={() => procurementApi.sourcingAction(event.id, "open")}
                  />
                ) : null}
                {canManage &&
                ["draft", "published", "evaluation"].includes(event.status) ? (
                  <ActionButton
                    label="Cancel"
                    queryKey="sourcing"
                    successText={`${event.number} cancelled.`}
                    errorFallback="Sourcing event could not be cancelled."
                    run={() =>
                      procurementApi.sourcingAction(event.id, "cancel")
                    }
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
                    render: (row) => (
                      <span>
                        <ProcurementStatus value={row.status} />
                        {row.recommended ? (
                          <span className="block text-xs text-muted-foreground">
                            Recommended
                          </span>
                        ) : null}
                      </span>
                    ),
                  },
                  {
                    key: "actions",
                    label: "Actions",
                    render: (row) => (
                      <ActionGroup>
                        {canEvaluate &&
                        event.status === "evaluation" &&
                        row.status === "submitted" ? (
                          <BidEvaluationForm bid={row} />
                        ) : null}
                        {(canEvaluate || canManage) &&
                        event.status === "evaluation" &&
                        row.status === "evaluated" ? (
                          <ActionButton
                            label="Award"
                            queryKey="sourcing"
                            successText={`${event.number} awarded. A draft purchase order was created.`}
                            errorFallback="Award could not be completed."
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
        <RequisitionPagination
          page={query.data?.current_page ?? 1}
          lastPage={query.data?.last_page ?? 1}
          onPageChange={setPage}
        />
      </div>
    </RecordsLayout>
  );
}

function Orders({ references }: { references: ProcurementReferences }) {
  const { hasAnyPermission } = usePermissions();
  const canCreate = hasAnyPermission([
    "create_procurement_orders",
    "manage_procurement",
  ]);
  const canApprove = hasAnyPermission([
    "approve_procurement_orders",
    "manage_procurement",
  ]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const query = useQuery({
    queryKey: ["procurement", "orders", search, statusFilter, page],
    queryFn: () =>
      procurementApi.purchaseOrders({
        per_page: 25,
        page,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
  });
  return (
    <RecordsLayout
      create={
        canCreate ? (
          <PurchaseOrderForm references={references} />
        ) : (
          <Alert>
            <Send aria-hidden="true" />
            <AlertTitle>Order permission required</AlertTitle>
            <AlertDescription>
              You can review purchase orders but cannot create or edit them with
              this role.
            </AlertDescription>
          </Alert>
        )
      }
      toolbar={
        <div className="grid gap-3 md:grid-cols-2">
          <Field id="order-search" label="Search">
            <Input
              id="order-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by number or delivery location"
            />
          </Field>
          <Field id="order-status" label="Status">
            <select
              id="order-status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className={fieldClass}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="pending_approval">Pending approval</option>
              <option value="approved">Approved</option>
              <option value="issued">Issued</option>
              <option value="confirmed">Confirmed</option>
              <option value="partially_received">Partially received</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
              <option value="closed">Closed</option>
            </select>
          </Field>
        </div>
      }
      error={query.error}
      loading={isProcurementListLoading(query)}
    >
      <div className="space-y-3">
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
                  <span className="block max-w-64 truncate text-xs font-normal text-muted-foreground">
                  {row.supplier?.name ?? "Supplier"}
                </span>
                  {row.revision_number > 1 ? (
                    <span className="block text-xs font-normal text-muted-foreground">
                      Rev {row.revision_number}
                      {termText(row.terms, "revision_reason") ? (
                        <span className="block max-w-64 truncate" title={termText(row.terms, "revision_reason")}>
                          {termText(row.terms, "revision_reason")}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  {row.allow_over_receipt ? (
                    <span className="block text-xs font-normal text-muted-foreground">
                      Over-receipt {Number(row.over_receipt_tolerance_percent ?? 0)}%
                    </span>
                  ) : null}
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
              render: (row) => (
                <span>
                  <ProcurementStatus value={row.status} />
                  {row.supplier_confirmation_reference ? (
                    <span className="block max-w-40 truncate text-xs text-muted-foreground">
                      Confirmed: {row.supplier_confirmation_reference}
                    </span>
                  ) : null}
                </span>
              ),
          },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
                <ActionGroup stack>
                  {canCreate && row.status === "draft" ? (
                    <PurchaseOrderEditForm
                      order={row}
                      references={references}
                    />
                  ) : null}
                  {canCreate && row.status === "draft" ? (
                  <ActionButton
                    label="Submit"
                    queryKey="orders"
                      successText={`${row.number} submitted.`}
                      errorFallback="Purchase order could not be submitted."
                    run={() =>
                      procurementApi.purchaseOrderAction(row.id, "submit")
                    }
                  />
                ) : null}
                  {canApprove && row.status === "pending_approval" ? (
                  <ActionButton
                    label="Approve"
                    queryKey="orders"
                      successText={`${row.number} approved.`}
                      errorFallback="Purchase order could not be approved."
                    run={() =>
                      procurementApi.purchaseOrderAction(row.id, "approve")
                    }
                  />
                ) : null}
                  {canCreate && row.status === "approved" ? (
                  <ActionButton
                    label="Issue"
                    queryKey="orders"
                      successText={`${row.number} issued.`}
                      errorFallback="Purchase order could not be issued."
                    run={() =>
                      procurementApi.purchaseOrderAction(row.id, "issue")
                    }
                  />
                ) : null}
                  {canCreate && row.status === "issued" ? (
                    <PurchaseOrderConfirmForm order={row} />
                  ) : null}
                  {canCreate &&
                  ["approved", "issued", "confirmed"].includes(row.status) &&
                  !(row.receipts_count || row.invoices_count) ? (
                    <PurchaseOrderReasonAction
                      order={row}
                      action="revise"
                      label="Revise"
                      group={`order-actions-${row.id}`}
                    />
                  ) : null}
                  {canCreate &&
                  [
                    "draft",
                    "pending_approval",
                    "approved",
                    "issued",
                    "confirmed",
                  ].includes(row.status) ? (
                    <PurchaseOrderReasonAction
                      order={row}
                      action="cancel"
                      label="Cancel"
                      group={`order-actions-${row.id}`}
                    />
                  ) : null}
                  {canCreate &&
                  ["received", "partially_received", "confirmed"].includes(
                    row.status,
                  ) ? (
                  <ActionButton
                      label="Close"
                    queryKey="orders"
                      successText={`${row.number} closed.`}
                      errorFallback="Purchase order could not be closed."
                    run={() =>
                        procurementApi.purchaseOrderAction(row.id, "close")
                    }
                  />
                ) : null}
              </ActionGroup>
            ),
          },
        ]}
      />
        <RequisitionPagination
          page={query.data?.current_page ?? 1}
          lastPage={query.data?.last_page ?? 1}
          onPageChange={setPage}
        />
      </div>
    </RecordsLayout>
  );
}

function Receiving({ references }: { references: ProcurementReferences }) {
  const { hasAnyPermission } = usePermissions();
  const canReceive = hasAnyPermission([
    "receive_procurement_goods",
    "manage_procurement",
  ]);
  const canInspect = hasAnyPermission([
    "inspect_procurement_goods",
    "manage_procurement",
  ]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const receipts = useQuery({
    queryKey: ["procurement", "receipts", search, statusFilter, page],
    queryFn: () =>
      procurementApi.receipts({
        per_page: 25,
        page,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
  });
  const orders = useQuery({
    queryKey: ["procurement", "orders", "receivable"],
    queryFn: () => procurementApi.purchaseOrders({ per_page: 100 }),
    enabled: canReceive,
  });
  const receivableOrders = (orders.data?.data ?? []).filter(isReceivableOrder);
  return (
    <RecordsLayout
      create={
        canReceive ? (
          <ReceiptForm
            references={references}
            orders={receivableOrders}
            ordersLoading={isProcurementListLoading(orders)}
          />
        ) : (
          <Alert>
            <Send aria-hidden="true" />
            <AlertTitle>Receiving permission required</AlertTitle>
            <AlertDescription>
              You can review goods receipts but cannot capture or post them with
              this role.
            </AlertDescription>
          </Alert>
        )
      }
      toolbar={
        <div className="grid gap-3 md:grid-cols-2">
          <Field id="receipt-search" label="Search">
            <Input
              id="receipt-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by receipt or delivery note"
            />
          </Field>
          <Field id="receipt-status" label="Status">
            <select
              id="receipt-status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className={fieldClass}
            >
              <option value="">All statuses</option>
              <option value="received">Received (awaiting / after inspect)</option>
              <option value="inspected">Inspected</option>
              <option value="rejected">Rejected (failed inspection)</option>
              <option value="posted">Posted to stock</option>
            </select>
          </Field>
        </div>
      }
      error={receipts.error ?? (canReceive ? orders.error : null)}
      loading={
        isProcurementListLoading(receipts) ||
        (canReceive && isProcurementListLoading(orders))
      }
    >
      <div className="space-y-3">
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
                    {row.purchase_order?.supplier?.name
                      ? ` · ${row.purchase_order.supplier.name}`
                      : ""}
                </span>
                  {row.supplier_delivery_note ? (
                    <span className="block max-w-56 truncate text-xs font-normal text-muted-foreground">
                      DN: {row.supplier_delivery_note}
                    </span>
                  ) : null}
              </strong>
            ),
          },
          { key: "date", label: "Received", render: (row) => row.received_on },
          {
            key: "inspection",
            label: "Inspection",
            render: (row) => (
                <span>
              <ProcurementStatus value={row.inspection_status} />
                  {row.nonconformance_reference ? (
                    <span className="block max-w-40 truncate text-xs text-muted-foreground">
                      NCR: {row.nonconformance_reference}
                    </span>
                  ) : null}
                </span>
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
                <ActionGroup stack>
                  {canInspect &&
                  !row.stock_posted_at &&
                  row.inspection_status === "pending" ? (
                  <ReceiptInspectionForm receipt={row} />
                ) : null}
                  {canReceive &&
                  !row.stock_posted_at &&
                ["passed", "accepted_with_exception"].includes(
                  row.inspection_status,
                ) ? (
                  <ActionButton
                    label="Post stock"
                    queryKey="receipts"
                      invalidateKeys={["orders"]}
                      successText={`${row.number} posted to stock.`}
                      errorFallback="Stock could not be posted."
                    run={() => procurementApi.postReceipt(row.id)}
                  />
                ) : null}
              </ActionGroup>
            ),
          },
        ]}
      />
        <RequisitionPagination
          page={receipts.data?.current_page ?? 1}
          lastPage={receipts.data?.last_page ?? 1}
          onPageChange={setPage}
        />
      </div>
    </RecordsLayout>
  );
}

function Invoices({ references }: { references: ProcurementReferences }) {
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission([
    "manage_supplier_invoices",
    "manage_procurement",
  ]);
  const canApprove = hasAnyPermission([
    "approve_supplier_invoices",
    "manage_procurement",
  ]);
  const canOverride = hasAnyPermission([
    "override_procurement_controls",
    "manage_procurement",
  ]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [matchFilter, setMatchFilter] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const invoices = useQuery({
    queryKey: ["procurement", "invoices", search, statusFilter, matchFilter, page],
    queryFn: () =>
      procurementApi.invoices({
        per_page: 25,
        page,
        search: search || undefined,
        status: statusFilter || undefined,
        match_status: matchFilter || undefined,
      }),
  });
  const orders = useQuery({
    queryKey: ["procurement", "orders", "invoiceable"],
    queryFn: () => procurementApi.purchaseOrders({ per_page: 100 }),
    enabled: canManage,
  });
  const invoiceableOrders = (orders.data?.data ?? []).filter(isInvoiceableOrder);
  return (
    <RecordsLayout
      create={
        canManage ? (
          <InvoiceForm
            references={references}
            orders={invoiceableOrders}
            ordersLoading={isProcurementListLoading(orders)}
          />
        ) : (
          <Alert>
            <Send aria-hidden="true" />
            <AlertTitle>Invoice permission required</AlertTitle>
            <AlertDescription>
              You can review supplier invoices but cannot capture or edit them
              with this role.
            </AlertDescription>
          </Alert>
        )
      }
      toolbar={
        <div className="grid gap-3 md:grid-cols-3">
          <Field id="invoice-search" label="Search">
            <Input
              id="invoice-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by number or vendor invoice"
            />
          </Field>
          <Field id="invoice-status" label="Status">
            <select
              id="invoice-status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className={fieldClass}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="matched">Matched</option>
              <option value="blocked">Blocked</option>
              <option value="pending_approval">Pending approval</option>
              <option value="approved">Approved</option>
              <option value="posted">Posted</option>
              <option value="rejected">Rejected</option>
            </select>
          </Field>
          <Field id="invoice-match" label="Match status">
            <select
              id="invoice-match"
              value={matchFilter}
              onChange={(event) => {
                setMatchFilter(event.target.value);
                setPage(1);
              }}
              className={fieldClass}
            >
              <option value="">All match states</option>
              <option value="pending">Pending</option>
              <option value="matched">Matched</option>
              <option value="exception">Exception</option>
              <option value="override_approved">Override approved</option>
            </select>
          </Field>
        </div>
      }
      error={invoices.error ?? (canManage ? orders.error : null)}
      loading={
        isProcurementListLoading(invoices) ||
        (canManage && isProcurementListLoading(orders))
      }
    >
      <div className="space-y-3">
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
                  {row.purchase_order?.supplier?.name ? (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {row.purchase_order.supplier.name}
                    </span>
                  ) : null}
              </strong>
            ),
          },
          {
            key: "order",
            label: "PO",
              render: (row) => (
                <span>
                  {row.purchase_order?.number ?? row.purchase_order_id}
                  {row.purchase_order ? (
                    <span className="block text-xs text-muted-foreground">
                      Received {Number(row.purchase_order.received_percent ?? 0).toFixed(0)}%
                    </span>
                  ) : null}
                </span>
              ),
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
                <InvoiceMatchCell invoice={row} />
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (row) => <ProcurementStatus value={row.status} />,
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
                <ActionGroup stack>
                  {canManage && row.status === "draft" ? (
                    <InvoiceEditForm invoice={row} references={references} />
                  ) : null}
                  {canManage &&
                  ["pending", "exception"].includes(row.match_status) &&
                row.status !== "posted" ? (
                  <ActionButton
                    label="Run match"
                    queryKey="invoices"
                      successText={`${row.number} three-way match completed.`}
                      errorFallback="Three-way match could not be run."
                    run={() => procurementApi.invoiceAction(row.id, "match")}
                  />
                ) : null}
                  {canOverride && row.match_status === "exception" ? (
                  <InvoiceOverrideForm invoice={row} />
                ) : null}
                  {canManage &&
                  row.status === "matched" &&
                  ["matched", "override_approved"].includes(row.match_status) ? (
                  <ActionButton
                    label="Submit"
                    queryKey="invoices"
                      successText={`${row.number} submitted for approval.`}
                      errorFallback="Invoice could not be submitted."
                    run={() => procurementApi.invoiceAction(row.id, "submit")}
                  />
                ) : null}
                  {canApprove && row.status === "pending_approval" ? (
                  <ActionButton
                    label="Approve"
                    queryKey="invoices"
                      successText={`${row.number} approved.`}
                      errorFallback="Invoice could not be approved."
                    run={() => procurementApi.invoiceAction(row.id, "approve")}
                  />
                ) : null}
                  {canApprove &&
                  ["pending_approval", "matched", "blocked"].includes(
                    row.status,
                  ) ? (
                    <InvoiceRejectAction invoice={row} />
                  ) : null}
                  {canManage && row.status === "approved" ? (
                  <ActionButton
                    label="Post to Finance"
                    queryKey="invoices"
                      invalidateKeys={["orders"]}
                      successText={`${row.number} posted to Finance.`}
                      errorFallback="Invoice could not be posted to Finance."
                    run={() => procurementApi.invoiceAction(row.id, "post")}
                  />
                ) : null}
              </ActionGroup>
            ),
          },
        ]}
      />
        <RequisitionPagination
          page={invoices.data?.current_page ?? 1}
          lastPage={invoices.data?.last_page ?? 1}
          onPageChange={setPage}
        />
      </div>
    </RecordsLayout>
  );
}

function Agreements({ references }: { references: ProcurementReferences }) {
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission([
    "manage_procurement_agreements",
    "manage_procurement",
  ]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const query = useQuery({
    queryKey: ["procurement", "agreements", search, statusFilter, page],
    queryFn: () =>
      procurementApi.agreements({
        per_page: 25,
        page,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
  });
  return (
    <RecordsLayout
      create={
        canManage ? (
          <AgreementForm references={references} />
        ) : (
          <Alert>
            <Send aria-hidden="true" />
            <AlertTitle>Agreement permission required</AlertTitle>
            <AlertDescription>
              You can review agreements but cannot create or edit them with this
              role.
            </AlertDescription>
          </Alert>
        )
      }
      toolbar={
        <div className="grid gap-3 md:grid-cols-2">
          <Field id="agreement-search" label="Search">
            <Input
              id="agreement-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by number or title"
            />
          </Field>
          <Field id="agreement-status" label="Status">
            <select
              id="agreement-status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className={fieldClass}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="closed">Closed</option>
            </select>
          </Field>
        </div>
      }
      error={query.error}
      loading={isProcurementListLoading(query)}
    >
      <div className="space-y-3">
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
                  <span className="block max-w-64 truncate text-xs font-normal text-muted-foreground">
                  {row.title}
                </span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {row.type.replaceAll("_", " ")}
                    {row.auto_replenishment ? " · auto replenishment" : ""}
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
                <ActionGroup stack>
                  {canManage && row.status === "draft" ? (
                    <AgreementEditForm
                      agreement={row}
                      references={references}
                    />
                  ) : null}
                  {canManage && row.status === "draft" ? (
                  <ActionButton
                    label="Activate"
                    queryKey="agreements"
                      successText={`${row.number} activated.`}
                      errorFallback="Agreement could not be activated."
                    run={() =>
                      procurementApi.agreementAction(row.id, "activate")
                    }
                  />
                ) : null}
                  {canManage && row.status === "active" ? (
                  <ActionButton
                    label="Suspend"
                    queryKey="agreements"
                      successText={`${row.number} suspended.`}
                      errorFallback="Agreement could not be suspended."
                    run={() =>
                      procurementApi.agreementAction(row.id, "suspend")
                    }
                  />
                ) : null}
                  {canManage && row.status === "suspended" ? (
                  <ActionButton
                    label="Resume"
                    queryKey="agreements"
                      successText={`${row.number} resumed.`}
                      errorFallback="Agreement could not be resumed."
                      run={() =>
                        procurementApi.agreementAction(row.id, "resume")
                      }
                    />
                  ) : null}
                  {canManage &&
                  ["active", "suspended"].includes(row.status) ? (
                    <ActionButton
                      label="Close"
                      queryKey="agreements"
                      successText={`${row.number} closed.`}
                      errorFallback="Agreement could not be closed."
                      run={() =>
                        procurementApi.agreementAction(row.id, "close")
                      }
                  />
                ) : null}
              </ActionGroup>
            ),
          },
        ]}
      />
        <RequisitionPagination
          page={query.data?.current_page ?? 1}
          lastPage={query.data?.last_page ?? 1}
          onPageChange={setPage}
        />
      </div>
    </RecordsLayout>
  );
}

function RecordsLayout({
  create,
  loading,
  error,
  toolbar,
  children,
}: {
  create: ReactNode;
  loading: boolean;
  error: unknown;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  const createRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#create") return;
    const panel = createRef.current;
    if (!panel) return;
    panel.open = true;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  return (
    <>
      <details
        id="create"
        ref={createRef}
        className="group rounded-2xl border bg-card shadow-sm"
      >
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-2xl px-5 py-3 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <CirclePlus aria-hidden="true" className="size-5 text-primary" />
          Create or capture a record
        </summary>
        <div className="border-t p-5">{create}</div>
      </details>
      {toolbar}
      {error ? (
        <ProcurementError error={error} />
      ) : loading ? (
        <ProcurementTableSkeleton rows={6} cols={6} />
      ) : (
        children
      )}
    </>
  );
}
function ActionGroup({
  children,
  stack = false,
}: {
  children: ReactNode;
  stack?: boolean;
}) {
  return (
    <div
      className={
        stack
          ? "flex w-48 flex-col items-stretch gap-2 [&_button]:w-full [&_details]:w-full"
          : "flex min-w-44 flex-wrap gap-2"
      }
    >
      {children}
    </div>
  );
}
function ActionButton({
  label,
  queryKey,
  invalidateKeys,
  run,
  successText,
  errorFallback,
}: {
  label: string;
  queryKey: string;
  invalidateKeys?: string[];
  run: () => Promise<unknown>;
  successText?: string;
  errorFallback?: string;
}) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: run,
    onSuccess: async () => {
      const keys = [queryKey, ...(invalidateKeys ?? [])];
      await Promise.all(
        keys.map((key) =>
          client.invalidateQueries({ queryKey: ["procurement", key] }),
        ),
      );
      await client.invalidateQueries({
        queryKey: ["procurement", "dashboard"],
      });
      if (successText) toast.success(successText);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, errorFallback ?? "Action failed.")),
  });
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      className="hover:text-foreground"
    >
      <BusyLabel busy={mutation.isPending}>{label}</BusyLabel>
    </Button>
  );
}

function RequisitionPagination({
  page,
  lastPage,
  onPageChange,
}: {
  page: number;
  lastPage: number;
  onPageChange: (page: number) => void;
}) {
  if (lastPage <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </Button>
      <span className="text-xs text-muted-foreground">
        Page {page} of {lastPage}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= lastPage}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}

function InlineAction({
  label,
  children,
  detailsRef,
  group,
}: {
  label: string;
  children: ReactNode;
  detailsRef?: React.RefObject<HTMLDetailsElement | null>;
  group?: string;
}) {
  return (
    <details
      ref={detailsRef}
      name={group}
      className="w-full min-w-0 rounded-md border bg-background"
    >
      <summary
        title={label}
        className="min-h-9 cursor-pointer list-none truncate rounded-md px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#1d5b49] focus-visible:ring-offset-2"
      >
        {label}
      </summary>
      <div className="border-t p-3">{children}</div>
    </details>
  );
}

function InlineMutationError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-xs font-medium text-destructive">
      {getErrorMessage(error, "The action could not be saved.")}
    </p>
  );
}

function SupplierEligibilityForm({ supplier }: { supplier: SupplierProfile }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [eligibility, setEligibility] = useState(supplier.eligibility_status);
  const [domestic, setDomestic] = useState(supplier.domestic_supplier);
  const [name, setName] = useState(supplier.supplier?.name ?? "");
  const [code, setCode] = useState(supplier.supplier?.code ?? "");
  const [email, setEmail] = useState(supplier.supplier?.email ?? "");
  const [phone, setPhone] = useState(supplier.supplier?.phone ?? "");
  const [address, setAddress] = useState(supplier.supplier?.address ?? "");
  const [legalName, setLegalName] = useState(supplier.legal_name ?? "");
  const [tin, setTin] = useState(supplier.tax_identification_number ?? "");
  const [license, setLicense] = useState(supplier.business_license_number ?? "");
  const [countryCode, setCountryCode] = useState(supplier.country_code ?? "ETH");
  const [region, setRegion] = useState(supplier.region ?? "");
  const [city, setCity] = useState(supplier.city ?? "");
  const [contactPerson, setContactPerson] = useState(supplier.contact_person ?? "");
  const [paymentTerms, setPaymentTerms] = useState(supplier.payment_terms ?? "");
  const [leadTimeDays, setLeadTimeDays] = useState(supplier.lead_time_days ?? 0);
  const [categories, setCategories] = useState(joinList(supplier.categories));
  const [certifications, setCertifications] = useState(joinList(supplier.certifications));
  const [documents, setDocuments] = useState(joinList(supplier.eligibility_documents));
  const [bankName, setBankName] = useState(bankingText(supplier.banking_details, "bank_name"));
  const [accountNumber, setAccountNumber] = useState(bankingText(supplier.banking_details, "account_number"));
  const [quality, setQuality] = useState(supplier.quality_score);
  const [delivery, setDelivery] = useState(supplier.delivery_score);
  const [responsiveness, setResponsiveness] = useState(supplier.responsiveness_score);
  const [invoiceAccuracy, setInvoiceAccuracy] = useState(supplier.invoice_accuracy_score);
  const [debarredUntil, setDebarredUntil] = useState(supplier.debarred_until ?? "");

  const resetFromSupplier = () => {
    setEligibility(supplier.eligibility_status);
    setDomestic(supplier.domestic_supplier);
    setName(supplier.supplier?.name ?? "");
    setCode(supplier.supplier?.code ?? "");
    setEmail(supplier.supplier?.email ?? "");
    setPhone(supplier.supplier?.phone ?? "");
    setAddress(supplier.supplier?.address ?? "");
    setLegalName(supplier.legal_name ?? "");
    setTin(supplier.tax_identification_number ?? "");
    setLicense(supplier.business_license_number ?? "");
    setCountryCode(supplier.country_code ?? "ETH");
    setRegion(supplier.region ?? "");
    setCity(supplier.city ?? "");
    setContactPerson(supplier.contact_person ?? "");
    setPaymentTerms(supplier.payment_terms ?? "");
    setLeadTimeDays(supplier.lead_time_days ?? 0);
    setCategories(joinList(supplier.categories));
    setCertifications(joinList(supplier.certifications));
    setDocuments(joinList(supplier.eligibility_documents));
    setBankName(bankingText(supplier.banking_details, "bank_name"));
    setAccountNumber(bankingText(supplier.banking_details, "account_number"));
    setQuality(supplier.quality_score);
    setDelivery(supplier.delivery_score);
    setResponsiveness(supplier.responsiveness_score);
    setInvoiceAccuracy(supplier.invoice_accuracy_score);
    setDebarredUntil(supplier.debarred_until ?? "");
  };

  const hasChanges =
    eligibility !== supplier.eligibility_status ||
    domestic !== supplier.domestic_supplier ||
    name !== (supplier.supplier?.name ?? "") ||
    code !== (supplier.supplier?.code ?? "") ||
    email !== (supplier.supplier?.email ?? "") ||
    phone !== (supplier.supplier?.phone ?? "") ||
    address !== (supplier.supplier?.address ?? "") ||
    legalName !== (supplier.legal_name ?? "") ||
    tin !== (supplier.tax_identification_number ?? "") ||
    license !== (supplier.business_license_number ?? "") ||
    countryCode !== (supplier.country_code ?? "ETH") ||
    region !== (supplier.region ?? "") ||
    city !== (supplier.city ?? "") ||
    contactPerson !== (supplier.contact_person ?? "") ||
    paymentTerms !== (supplier.payment_terms ?? "") ||
    leadTimeDays !== (supplier.lead_time_days ?? 0) ||
    categories !== joinList(supplier.categories) ||
    certifications !== joinList(supplier.certifications) ||
    documents !== joinList(supplier.eligibility_documents) ||
    bankName !== bankingText(supplier.banking_details, "bank_name") ||
    accountNumber !== bankingText(supplier.banking_details, "account_number") ||
    quality !== supplier.quality_score ||
    delivery !== supplier.delivery_score ||
    responsiveness !== supplier.responsiveness_score ||
    invoiceAccuracy !== supplier.invoice_accuracy_score ||
    debarredUntil !== (supplier.debarred_until ?? "");

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      procurementApi.updateSupplier(supplier.id, payload),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["procurement", "suppliers"] });
      toast.success("Supplier review saved.");
      setOpen(false);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Supplier review could not be saved.")),
  });

  const supplierLabel =
    supplier.supplier?.name ??
    supplier.legal_name ??
    `Supplier ${supplier.supplier_id}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) resetFromSupplier();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Review eligibility
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Review {supplierLabel}</DialogTitle>
          <DialogDescription>
            Update identity, eligibility, scores, and banking details for this
            qualified supplier.
          </DialogDescription>
        </DialogHeader>
      <form
          key={open ? `open-${supplier.id}` : `closed-${supplier.id}`}
          className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
            const parseList = (value: string) =>
              value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean);
          mutation.mutate({
              name: name.trim() || undefined,
              code: code.trim() || undefined,
              email: email.trim() || undefined,
              phone: phone.trim() || undefined,
              address: address.trim() || undefined,
              legal_name: legalName.trim() || undefined,
              tax_identification_number: tin.trim() || undefined,
              business_license_number: license.trim() || undefined,
              country_code: countryCode.trim() || "ETH",
              region: region.trim() || undefined,
              city: city.trim() || undefined,
              contact_person: contactPerson.trim() || undefined,
              payment_terms: paymentTerms.trim() || undefined,
              lead_time_days: leadTimeDays,
              categories: parseList(categories).length
                ? parseList(categories)
                : undefined,
              certifications: parseList(certifications).length
                ? parseList(certifications)
                : undefined,
              eligibility_documents: parseList(documents).length
                ? parseList(documents)
                : undefined,
              banking_details:
                bankName || accountNumber
                  ? {
                      bank_name: bankName.trim() || undefined,
                      account_number: accountNumber.trim() || undefined,
                    }
                  : undefined,
              eligibility_status: eligibility,
              debarred_until: debarredUntil || null,
              quality_score: quality,
              delivery_score: delivery,
              responsiveness_score: responsiveness,
              invoice_accuracy_score: invoiceAccuracy,
              domestic_supplier: domestic,
          });
        }}
      >
          <Grid>
            <Field id={`supplier-${supplier.id}-name`} label="Supplier name">
              <Input
                id={`supplier-${supplier.id}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field id={`supplier-${supplier.id}-code`} label="Supplier code">
              <Input
                id={`supplier-${supplier.id}-code`}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </Field>
            <Field id={`supplier-${supplier.id}-email`} label="Email">
              <Input
                id={`supplier-${supplier.id}-email`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field id={`supplier-${supplier.id}-phone`} label="Phone">
              <Input
                id={`supplier-${supplier.id}-phone`}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <Field id={`supplier-${supplier.id}-address`} label="Address">
              <Input
                id={`supplier-${supplier.id}-address`}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>
            <Field id={`supplier-${supplier.id}-legal`} label="Legal name">
              <Input
                id={`supplier-${supplier.id}-legal`}
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
              />
            </Field>
            <Field
              id={`supplier-${supplier.id}-tin`}
              label="Tax identification number"
            >
              <Input
                id={`supplier-${supplier.id}-tin`}
                value={tin}
                onChange={(e) => setTin(e.target.value)}
              />
            </Field>
            <Field
              id={`supplier-${supplier.id}-license`}
              label="Business license number"
            >
              <Input
                id={`supplier-${supplier.id}-license`}
                value={license}
                onChange={(e) => setLicense(e.target.value)}
              />
            </Field>
            <Field id={`supplier-${supplier.id}-country`} label="Country code">
              <Input
                id={`supplier-${supplier.id}-country`}
                maxLength={3}
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
              />
            </Field>
            <Field id={`supplier-${supplier.id}-region`} label="Region">
              <Input
                id={`supplier-${supplier.id}-region`}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              />
            </Field>
            <Field id={`supplier-${supplier.id}-city`} label="City">
              <Input
                id={`supplier-${supplier.id}-city`}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </Field>
            <Field id={`supplier-${supplier.id}-contact`} label="Contact person">
              <Input
                id={`supplier-${supplier.id}-contact`}
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
              />
            </Field>
            <Field id={`supplier-${supplier.id}-terms`} label="Payment terms">
              <Input
                id={`supplier-${supplier.id}-terms`}
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
              />
            </Field>
            <Field id={`supplier-${supplier.id}-lead`} label="Lead time (days)">
              <Input
                id={`supplier-${supplier.id}-lead`}
                type="number"
                min="0"
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(Number(e.target.value))}
              />
            </Field>
            <Field
              id={`supplier-${supplier.id}-categories`}
              label="Categories"
              hint="Comma-separated"
            >
              <Input
                id={`supplier-${supplier.id}-categories`}
                value={categories}
                onChange={(e) => setCategories(e.target.value)}
              />
            </Field>
            <Field
              id={`supplier-${supplier.id}-certs`}
              label="Certifications"
              hint="Comma-separated"
            >
              <Input
                id={`supplier-${supplier.id}-certs`}
                value={certifications}
                onChange={(e) => setCertifications(e.target.value)}
              />
            </Field>
            <Field
              id={`supplier-${supplier.id}-docs`}
              label="Eligibility documents"
              hint="Comma-separated references"
            >
              <Input
                id={`supplier-${supplier.id}-docs`}
                value={documents}
                onChange={(e) => setDocuments(e.target.value)}
              />
            </Field>
            <Field id={`supplier-${supplier.id}-bank`} label="Bank name">
              <Input
                id={`supplier-${supplier.id}-bank`}
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </Field>
            <Field id={`supplier-${supplier.id}-account`} label="Account number">
              <Input
                id={`supplier-${supplier.id}-account`}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </Field>
        <Field id={`supplier-${supplier.id}-eligibility`} label="Eligibility">
          <select
            id={`supplier-${supplier.id}-eligibility`}
                value={eligibility}
                onChange={(e) => setEligibility(e.target.value)}
            className={fieldClass}
          >
            <option value="pending">Pending</option>
            <option value="eligible">Eligible</option>
            <option value="conditional">Conditional</option>
            <option value="suspended">Suspended</option>
            <option value="debarred">Debarred</option>
          </select>
        </Field>
            <Field id={`supplier-${supplier.id}-quality`} label="Quality score">
              <Input
                id={`supplier-${supplier.id}-quality`}
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                required
              />
            </Field>
          <Field
              id={`supplier-${supplier.id}-delivery`}
              label="On-time delivery score"
          >
            <Input
                id={`supplier-${supplier.id}-delivery`}
              type="number"
              min="0"
              max="100"
              step="0.1"
                value={delivery}
                onChange={(e) => setDelivery(Number(e.target.value))}
              required
            />
          </Field>
            <Field
              id={`supplier-${supplier.id}-responsiveness`}
              label="Responsiveness score"
            >
              <Input
                id={`supplier-${supplier.id}-responsiveness`}
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={responsiveness}
                onChange={(e) => setResponsiveness(Number(e.target.value))}
                required
              />
            </Field>
            <Field
              id={`supplier-${supplier.id}-invoice`}
              label="Invoice accuracy score"
            >
              <Input
                id={`supplier-${supplier.id}-invoice`}
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={invoiceAccuracy}
                onChange={(e) => setInvoiceAccuracy(Number(e.target.value))}
                required
              />
            </Field>
        <Field id={`supplier-${supplier.id}-debarred`} label="Debarred until">
          <Input
            id={`supplier-${supplier.id}-debarred`}
            type="date"
                value={debarredUntil}
                onChange={(e) => setDebarredUntil(e.target.value)}
          />
        </Field>
            <div className="flex items-center gap-2 self-end pb-3">
              <Checkbox
                id={`supplier-${supplier.id}-domestic`}
                checked={domestic}
                onCheckedChange={(value) => setDomestic(value === true)}
              />
              <Label htmlFor={`supplier-${supplier.id}-domestic`}>
                Domestic supplier
              </Label>
            </div>
          </Grid>
        <InlineMutationError error={mutation.error} />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !hasChanges}
            >
          <BusyLabel busy={mutation.isPending}>Save review</BusyLabel>
        </Button>
          </div>
      </form>
      </DialogContent>
    </Dialog>
  );
}

function BudgetCheckForm({
  requisition,
  group,
}: {
  requisition: Requisition;
  group?: string;
}) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      procurementApi.requisitionAction(requisition.id, "budget-check", payload),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["procurement", "requisitions"] });
      toast.success(`Budget review saved for ${requisition.number}.`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Budget review could not be saved.")),
  });
  return (
    <InlineAction label="Record budget check" group={group}>
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
            defaultValue={
              ["available", "conditional", "insufficient"].includes(
                requisition.budget_status,
              )
                ? requisition.budget_status
                : "available"
            }
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
            defaultValue={requisition.budget_notes ?? ""}
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

function RequisitionReasonAction({
  requisition,
  action,
  label,
  group,
}: {
  requisition: Requisition;
  action: "reject" | "cancel";
  label: string;
  group?: string;
}) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (reason: string) =>
      procurementApi.requisitionAction(requisition.id, action, {
        reason: reason || undefined,
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["procurement", "requisitions"] });
      toast.success(`Requisition ${requisition.number} ${action}ed.`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, `Requisition could not be ${action}ed.`)),
  });
  return (
    <InlineAction label={label} group={group}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          mutation.mutate(String(form.get("reason") ?? ""));
        }}
      >
        <Field id={`requisition-${requisition.id}-${action}`} label="Reason">
          <Textarea
            id={`requisition-${requisition.id}-${action}`}
            name="reason"
            rows={3}
          />
        </Field>
        <InlineMutationError error={mutation.error} />
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          <BusyLabel busy={mutation.isPending}>{label}</BusyLabel>
        </Button>
      </form>
    </InlineAction>
  );
}

function BidEvaluationForm({ bid }: { bid: SupplierBid }) {
  const client = useQueryClient();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [eligible, setEligible] = useState(false);
  const [recommended, setRecommended] = useState(false);
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      procurementApi.evaluateBid(bid.id, payload),
    onSuccess: async (updated) => {
      detailsRef.current?.removeAttribute("open");
      client.setQueriesData(
        { queryKey: ["procurement", "sourcing"] },
        (old: unknown) => {
          if (!old || typeof old !== "object" || !("data" in old)) return old;
          const page = old as { data: SourcingEvent[] };
          return {
            ...page,
            data: page.data.map((event) => ({
              ...event,
              bids: (event.bids ?? []).map((row) =>
                row.id === bid.id
                  ? {
                      ...row,
                      ...(updated && typeof updated === "object" ? updated : {}),
                      status: "evaluated",
                      recommended,
                    }
                  : row,
              ),
            })),
          };
        },
      );
      await client.invalidateQueries({ queryKey: ["procurement", "sourcing"] });
      toast.success("Bid evaluation saved.");
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Bid could not be evaluated.")),
  });
  return (
    <InlineAction label="Evaluate bid" detailsRef={detailsRef}>
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
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["procurement", "receipts"] });
      await client.invalidateQueries({ queryKey: ["procurement", "orders"] });
      toast.success(`${receipt.number} inspection saved.`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Inspection could not be saved.")),
  });
  return (
    <InlineAction label="Record inspection" group={`receipt-actions-${receipt.id}`}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const notes = String(form.get("quality_notes") ?? "").trim();
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
            defaultValue={receipt.inspection_method || "sample"}
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
            defaultValue={receipt.quality_notes ?? ""}
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
              defaultValue={receipt.nonconformance_reference ?? ""}
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

function InvoiceMatchCell({ invoice }: { invoice: SupplierInvoice }) {
  return (
    <span>
      <ProcurementStatus value={invoice.match_status} />
      {invoice.discrepancies?.length ? (
        <span className="mt-1 block space-y-0.5">
          {invoice.discrepancies.slice(0, 2).map((item) => (
            <span
              key={`${invoice.id}-${item.line}-${item.type}`}
              className="block max-w-56 truncate text-xs text-destructive"
              title={item.message}
            >
              Line {item.line}: {item.message}
            </span>
          ))}
          {invoice.discrepancies.length > 2 ? (
            <span className="block text-xs text-muted-foreground">
              +{invoice.discrepancies.length - 2} more
            </span>
          ) : null}
        </span>
      ) : null}
      {invoice.override_reason ? (
        <span
          className="mt-1 block max-w-56 truncate text-xs text-muted-foreground"
          title={invoice.override_reason}
        >
          Override: {invoice.override_reason}
        </span>
      ) : null}
    </span>
  );
}

function InvoiceRejectAction({ invoice }: { invoice: SupplierInvoice }) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (reason: string) =>
      procurementApi.invoiceAction(invoice.id, "reject", {
        reason: reason || undefined,
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["procurement", "invoices"] });
      toast.success(`${invoice.number} rejected.`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Invoice could not be rejected.")),
  });
  return (
    <InlineAction label="Reject" group={`invoice-actions-${invoice.id}`}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(
            String(new FormData(event.currentTarget).get("reason") ?? ""),
          );
        }}
      >
        <Field id={`invoice-${invoice.id}-reject-reason`} label="Reason">
          <Textarea
            id={`invoice-${invoice.id}-reject-reason`}
            name="reason"
            rows={3}
          />
        </Field>
        <InlineMutationError error={mutation.error} />
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          <BusyLabel busy={mutation.isPending}>Reject</BusyLabel>
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
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["procurement", "invoices"] });
      toast.success(`${invoice.number} match exception authorized.`);
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, "Match exception could not be authorized."),
      ),
  });
  return (
    <InlineAction
      label="Authorize exception"
      group={`invoice-actions-${invoice.id}`}
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const reason = String(
            new FormData(event.currentTarget).get("reason") ?? "",
          ).trim();
          if (!reason) {
            toast.error("Enter an override reason.");
            return;
          }
          mutation.mutate(reason);
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
  "h-10 w-full min-w-0 truncate rounded-md border border-[#6b7280] bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#1d5b49] focus-visible:ring-offset-2";
const RECEIVABLE_ORDER_STATUSES = [
  "issued",
  "confirmed",
  "partially_received",
] as const;
const isReceivableOrder = (order: PurchaseOrder) =>
  RECEIVABLE_ORDER_STATUSES.includes(
    order.status as (typeof RECEIVABLE_ORDER_STATUSES)[number],
  ) && Number(order.received_percent ?? 0) < 100;
const isInvoiceableOrder = (order: PurchaseOrder) =>
  !["draft", "cancelled", "pending_approval"].includes(order.status) &&
  Number(order.received_percent ?? 0) > 0 &&
  Number(order.invoiced_percent ?? 100) < 100;
const today = () => new Date().toISOString().slice(0, 10);
const dateInputValue = (value?: string | null) =>
  value ? value.slice(0, 10) : "";
const datetimeLocalValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
const criteriaWeight = (
  criteria: SourcingEvent["evaluation_criteria"],
  key: string,
  fallback: number,
) => {
  const row = criteria?.find((item) => item.key === key);
  return Number(row?.weight ?? fallback);
};
const sourcingPayloadFromForm = (
  form: FormData,
  taxInclusive: boolean,
  invitedSupplierIds: number[],
) => ({
  requisition_id: Number(form.get("requisition_id")) || undefined,
  title: textValue(form, "title"),
  method: textValue(form, "method"),
  scope: textValue(form, "scope"),
  estimated_value: Number(form.get("estimated_value") || 0),
  currency: "ETB",
  egp_reference: textValue(form, "egp_reference"),
  standard_bidding_document: textValue(form, "standard_bidding_document"),
  bid_security_amount: Number(form.get("bid_security_amount") || 0),
  performance_security_percent: Number(form.get("performance_security_percent") || 0),
  domestic_preference_percent: Number(form.get("domestic_preference_percent") || 0),
  tax_inclusive_evaluation: taxInclusive,
  clarification_deadline: textValue(form, "clarification_deadline"),
  submission_deadline: textValue(form, "submission_deadline"),
  documents: listValue(form, "documents") ?? [],
  invited_supplier_ids: invitedSupplierIds,
  evaluation_criteria: [
    { key: "technical", weight: Number(form.get("weight_technical") || 40) },
    { key: "financial", weight: Number(form.get("weight_financial") || 50) },
    { key: "preference", weight: Number(form.get("weight_preference") || 10) },
  ],
});
const requisitionLines = (items?: ProcurementLine[]) => {
  const rows = (items ?? []).map((line) => ({
    ...line,
    line_key: line.line_key || crypto.randomUUID(),
  }));
  return rows.length ? rows : [newLine()];
};
const textValue = (form: FormData, key: string) => {
  const value = String(form.get(key) ?? "").trim();
  return value || undefined;
};
const listValue = (form: FormData, key: string) => {
  const items = String(form.get(key) ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
};
const joinList = (value?: string[] | null) => (value ?? []).join(", ");
const serviceLevelsText = (
  value?: string[] | Array<Record<string, unknown>> | null,
) =>
  (value ?? [])
    .map((item) =>
      typeof item === "string"
        ? item
        : String(item.name ?? item.label ?? item.description ?? "").trim(),
    )
    .filter(Boolean)
    .join(", ");
const agreementPayloadFromForm = (
  form: FormData,
  lines: ProcurementLine[],
  autoReplenishment: boolean,
) => ({
  supplier_id: Number(form.get("supplier_id")),
  type: textValue(form, "type"),
  title: textValue(form, "title"),
  starts_on: textValue(form, "starts_on"),
  ends_on: textValue(form, "ends_on"),
  currency: "ETB",
  ceiling_amount: Number(form.get("ceiling_amount")),
  committed_amount: Number(form.get("committed_amount") || 0),
  auto_replenishment: autoReplenishment,
  documents: listValue(form, "documents") ?? [],
  service_levels: listValue(form, "service_levels") ?? [],
  items: lines,
});
const termText = (
  terms: Record<string, unknown> | null | undefined,
  key: string,
) => {
  const value = terms?.[key];
  return typeof value === "string" ? value : "";
};
const purchaseOrderPayloadFromForm = (
  form: FormData,
  lines: ProcurementLine[],
  options: {
    overReceipt: boolean;
    replenishmentCallOff?: boolean;
    agreementId?: string;
    baseTerms?: Record<string, unknown> | null;
    includeReplenishment?: boolean;
  },
) => {
  const paymentTerms = textValue(form, "payment_terms");
  const attachments = listValue(form, "attachments");
  const terms = {
    ...(options.baseTerms ?? {}),
    ...(paymentTerms ? { payment_terms: paymentTerms } : {}),
  };
  if (!paymentTerms && "payment_terms" in terms) {
    delete terms.payment_terms;
  }
  return {
    supplier_id: Number(form.get("supplier_id")),
    requisition_id: Number(form.get("requisition_id")) || undefined,
    agreement_id: Number(options.agreementId || form.get("agreement_id")) || undefined,
    project_id: Number(form.get("project_id")) || undefined,
    cost_center_id: Number(form.get("cost_center_id")) || undefined,
    currency: "ETB",
    exchange_rate: Number(form.get("exchange_rate") || 1),
    items: lines,
    ordered_on: textValue(form, "ordered_on"),
    expected_on: textValue(form, "expected_on"),
    delivery_location: textValue(form, "delivery_location"),
    allow_over_receipt: options.overReceipt,
    over_receipt_tolerance_percent: options.overReceipt
      ? Number(form.get("tolerance") || 0)
      : 0,
    ...(options.includeReplenishment !== false
      ? { replenishment_call_off: options.replenishmentCallOff ?? false }
      : {}),
    terms: Object.keys(terms).length ? terms : undefined,
    attachments: attachments ?? [],
  };
};
const invoicePayloadFromForm = (
  form: FormData,
  lines: ProcurementLine[],
  purchaseOrderId: string | number,
) => ({
  supplier_invoice_number: textValue(form, "supplier_invoice_number"),
  purchase_order_id: Number(purchaseOrderId),
  invoice_date: textValue(form, "invoice_date"),
  due_date: textValue(form, "due_date"),
  currency: "ETB",
  items: lines,
  price_tolerance_percent: Number(form.get("price_tolerance") || 0),
  quantity_tolerance_percent: Number(form.get("quantity_tolerance") || 0),
  attachments: listValue(form, "attachments") ?? [],
});
const optionText = (label: string, max = 56) =>
  label.length > max ? `${label.slice(0, max - 1)}…` : label;
const bankingFromForm = (form: FormData) => {
  const bank_name = textValue(form, "bank_name");
  const account_number = textValue(form, "account_number");
  if (!bank_name && !account_number) return undefined;
  return { bank_name, account_number };
};
const bankingText = (
  details?: Record<string, unknown> | null,
  key?: string,
) => {
  if (!details || !key) return "";
  const value = details[key];
  return typeof value === "string" ? value : "";
};
const profileFieldsFromForm = (form: FormData) => ({
  legal_name: textValue(form, "legal_name"),
  tax_identification_number: textValue(form, "tin"),
  business_license_number: textValue(form, "license"),
  country_code: textValue(form, "country_code") || "ETH",
  region: textValue(form, "region"),
  city: textValue(form, "city"),
  contact_person: textValue(form, "contact_person"),
  payment_terms: textValue(form, "payment_terms"),
  lead_time_days: Number(form.get("lead_time_days") || 0),
  categories: listValue(form, "categories"),
  certifications: listValue(form, "certifications"),
  eligibility_documents: listValue(form, "documents"),
  banking_details: bankingFromForm(form),
  eligibility_status: String(form.get("eligibility") ?? "eligible"),
  debarred_until: textValue(form, "debarred_until") || null,
  quality_score: Number(form.get("quality") || 0),
  delivery_score: Number(form.get("delivery") || 0),
  responsiveness_score: Number(form.get("responsiveness") || 0),
  invoice_accuracy_score: Number(form.get("invoice_accuracy") || 0),
});
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
  submitLabel = "Save draft",
  children,
}: {
  title: string;
  description: string;
  mutation: { isPending: boolean; error: unknown };
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
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
        <BusyLabel busy={mutation.isPending}>{submitLabel}</BusyLabel>
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

function SupplierForm({
  references,
  qualifiedProfiles,
  loading,
}: {
  references: ProcurementReferences;
  qualifiedProfiles: SupplierProfile[];
  loading: boolean;
}) {
  const client = useQueryClient();
  const [formKey, setFormKey] = useState(0);
  const [existingId, setExistingId] = useState("");
  const [domestic, setDomestic] = useState(true);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [legalName, setLegalName] = useState("");
  const qualifiedSupplierIds = new Set(
    qualifiedProfiles.map((profile) => profile.supplier_id),
  );
  const linkableSuppliers = references.suppliers.filter(
    (supplier) => !qualifiedSupplierIds.has(supplier.id),
  );
  const selected = linkableSuppliers.find(
    (supplier) => String(supplier.id) === existingId,
  );
  useEffect(() => {
    if (
      existingId &&
      !linkableSuppliers.some((supplier) => supplier.id === Number(existingId))
    ) {
      setExistingId("");
    }
  }, [existingId, linkableSuppliers]);
  useEffect(() => {
    if (!selected) {
      setEmail("");
      setPhone("");
      setAddress("");
      setLegalName("");
      return;
    }
    setEmail(selected.email ?? "");
    setPhone(selected.phone ?? "");
    setAddress(selected.address ?? "");
    setLegalName(selected.name ?? "");
  }, [selected]);
  const mutation = useMutation({
    mutationFn: procurementApi.createSupplier,
    onSuccess: async () => {
      setExistingId("");
      setDomestic(true);
      setEmail("");
      setPhone("");
      setAddress("");
      setLegalName("");
      setFormKey((key) => key + 1);
      await client.invalidateQueries({ queryKey: ["procurement", "suppliers"] });
      await client.invalidateQueries({
        queryKey: ["procurement", "references"],
      });
    },
  });
  const title = "Qualify a supplier";
  const description =""
  if (loading) {
  return (
    <FormShell
        title={title}
        description={description}
      mutation={mutation}
        submitLabel="Qualify supplier"
        onSubmit={() => {}}
      >
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">
            Loading suppliers...
          </div>
        </div>
      </FormShell>
    );
  }
  return (
    <FormShell
      key={formKey}
      title={title}
      description={description}
      mutation={mutation}
      submitLabel="Qualify supplier"
      onSubmit={(event) => {
        event.preventDefault();
        if (
          existingId &&
          !linkableSuppliers.some(
            (supplier) => supplier.id === Number(existingId),
          )
        ) {
          return;
        }
        const form = new FormData(event.currentTarget);
        const payload: Record<string, unknown> = {
          ...profileFieldsFromForm(form),
          domestic_supplier: domestic,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
        };
        if (existingId) {
          payload.supplier_id = Number(existingId);
        } else {
          payload.name = String(form.get("name") ?? "").trim();
          payload.code = String(form.get("code") ?? "").trim();
        }
        mutation.mutate(payload);
      }}
    >
      <Grid>
        <Field
          id="supplier-existing"
          label="Existing Inventory supplier"
          hint={
            linkableSuppliers.length === 0
              ? "Every active inventory supplier is already qualified. Use Review eligibility below, or choose Create a new supplier."
              : "Only inventory suppliers not yet in the qualified table appear here. Choosing one fills the known inventory fields."
          }
        >
          <select
            id="supplier-existing"
            value={existingId}
            onChange={(e) => setExistingId(e.target.value)}
            className={fieldClass}
          >
            <option value="">Create a new supplier</option>
            {linkableSuppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.code} · {supplier.name}
              </option>
            ))}
          </select>
        </Field>
        {selected ? (
          <>
            <Field
              id="supplier-name"
              label="Supplier name"
              hint="From inventory"
            >
              <Input id="supplier-name" value={selected.name} disabled />
            </Field>
            <Field
              id="supplier-code"
              label="Supplier code"
              hint="From inventory"
            >
              <Input id="supplier-code" value={selected.code} disabled />
            </Field>
          </>
        ) : (
          <>
            <Field id="supplier-name" label="Supplier name">
              <Input id="supplier-name" name="name" placeholder="e.g. Acme Corporation" required />
            </Field>
            <Field id="supplier-code" label="Supplier code">
              <Input id="supplier-code" name="code" placeholder="e.g. ACME001" required />
            </Field>
          </>
        )}
        <Field
          id="supplier-email"
          label="Email"
          hint={
            selected
              ? selected.email
                ? "From inventory — change if needed"
                : "Not on the inventory record — add it here"
              : undefined
          }
        >
          <Input
            id="supplier-email"
            name="email"
            type="email"
            placeholder="e.g. contact@acme.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field
          id="supplier-phone"
          label="Phone"
          hint={
            selected
              ? selected.phone
                ? "From inventory — change if needed"
                : "Not on the inventory record — add it here"
              : undefined
          }
        >
          <Input
            id="supplier-phone"
            name="phone"
            placeholder="e.g. +251911234567"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>
        <Field
          id="supplier-address"
          label="Address"
          hint={
            selected
              ? selected.address
                ? "From inventory — change if needed"
                : "Not on the inventory record — add it here"
              : undefined
          }
        >
          <Input
            id="supplier-address"
            name="address"
            placeholder="e.g. Bole Road, Addis Ababa"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </Field>
        <Field
          id="supplier-legal"
          label="Legal name"
          hint={
            selected
              ? "Prefilled from the inventory name — change if the legal name is different"
              : undefined
          }
        >
          <Input
            id="supplier-legal"
            name="legal_name"
            placeholder="e.g. Acme Corporation PLC"
            value={legalName}
            onChange={(event) => setLegalName(event.target.value)}
          />
        </Field>
        <Field id="supplier-tin" label="Tax identification number">
          <Input id="supplier-tin" name="tin" placeholder="e.g. 100012345" />
        </Field>
        <Field id="supplier-license" label="Business license number">
          <Input id="supplier-license" name="license" placeholder="e.g. BL-2024-001" />
        </Field>
        <Field id="supplier-country" label="Country code">
          <Input
            id="supplier-country"
            name="country_code"
            maxLength={3}
            defaultValue="ETH"
            placeholder="e.g. ETH"
          />
        </Field>
        <Field id="supplier-region" label="Region">
          <Input id="supplier-region" name="region" placeholder="e.g. Addis Ababa" />
        </Field>
        <Field id="supplier-city" label="City">
          <Input id="supplier-city" name="city" placeholder="e.g. Addis Ababa" />
        </Field>
        <Field id="supplier-contact" label="Contact person">
          <Input id="supplier-contact" name="contact_person" placeholder="e.g. John Doe" />
        </Field>
        <Field id="supplier-terms" label="Payment terms">
          <Input id="supplier-terms" name="payment_terms" placeholder="e.g. Net 30" />
        </Field>
        <Field id="supplier-lead" label="Lead time (days)">
          <Input
            id="supplier-lead"
            name="lead_time_days"
            type="number"
            min="0"
            defaultValue="0"
            placeholder="e.g. 14"
          />
        </Field>
        <Field
          id="supplier-categories"
          label="Categories"
          hint="Comma-separated"
        >
          <Input id="supplier-categories" name="categories" placeholder="e.g. electronics, raw materials" />
        </Field>
        <Field
          id="supplier-certs"
          label="Certifications"
          hint="Comma-separated"
        >
          <Input id="supplier-certs" name="certifications" placeholder="e.g. ISO 9001, ISO 14001" />
        </Field>
        <Field
          id="supplier-docs"
          label="Eligibility documents"
          hint="Comma-separated references"
        >
          <Input id="supplier-docs" name="documents" placeholder="e.g. DOC-001, DOC-002" />
        </Field>
        <Field id="supplier-bank" label="Bank name">
          <Input id="supplier-bank" name="bank_name" placeholder="e.g. Commercial Bank of Ethiopia" />
        </Field>
        <Field id="supplier-account" label="Account number">
          <Input id="supplier-account" name="account_number" placeholder="e.g. 1000123456789" />
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
        <Field id="supplier-quality" label="Quality score">
          <Input
            id="supplier-quality"
            name="quality"
            type="number"
            min="0"
            max="100"
            step="0.1"
            defaultValue="0"
          />
        </Field>
        <Field id="supplier-delivery" label="On-time delivery score">
          <Input
            id="supplier-delivery"
            name="delivery"
            type="number"
            min="0"
            max="100"
            step="0.1"
            defaultValue="0"
          />
        </Field>
        <Field id="supplier-responsiveness" label="Responsiveness score">
          <Input
            id="supplier-responsiveness"
            name="responsiveness"
            type="number"
            min="0"
            max="100"
            step="0.1"
            defaultValue="50"
          />
        </Field>
        <Field id="supplier-invoice" label="Invoice accuracy score">
          <Input
            id="supplier-invoice"
            name="invoice_accuracy"
            type="number"
            min="0"
            max="100"
            step="0.1"
            defaultValue="0"
          />
        </Field>
        <Field id="supplier-debarred" label="Debarred until">
          <Input id="supplier-debarred" name="debarred_until" type="date" />
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
  const [formKey, setFormKey] = useState(0);
  const [lines, setLines] = useState<ProcurementLine[]>([newLine()]);
  const mutation = useMutation({
    mutationFn: procurementApi.createRequisition,
    onSuccess: () => {
      setLines([newLine()]);
      setFormKey((prev) => prev + 1);
      client.invalidateQueries({ queryKey: ["procurement", "requisitions"] });
      toast.success("Requisition created.");
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Requisition could not be created.")),
  });
  return (
    <FormShell
      key={formKey}
      title="Create a purchase requisition"
      description="Line estimates support budget approval and later sourcing."
      mutation={mutation}
      submitLabel="Create requisition"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        mutation.mutate({
          title: form.get("title"),
          business_justification: form.get("justification"),
          department_id: Number(form.get("department_id")) || undefined,
          cost_center_id: Number(form.get("cost_center_id")) || undefined,
          project_id: Number(form.get("project_id")) || undefined,
          procurement_method: form.get("method"),
          priority: form.get("priority"),
          required_on: form.get("required_on") || undefined,
          attachments: listValue(form, "attachments"),
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
        <Field id="pr-project" label="Project">
          <select id="pr-project" name="project_id" className={fieldClass}>
            <option value="">No project</option>
            {references.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="pr-cost-center" label="Cost center">
          <select id="pr-cost-center" name="cost_center_id" className={fieldClass}>
            <option value="">No cost center</option>
            {selectableCostCenters(references.cost_centers).map((center) => (
              <option key={center.id} value={center.id}>
                {center.code} · {center.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="pr-department"
          label="Department ID"
          hint="Use only if your tenant maps departments by numeric ID."
        >
          <Input id="pr-department" name="department_id" type="number" min="1" />
        </Field>
        <div className="md:col-span-2">
          <Field id="pr-justification" label="Business justification">
            <Textarea id="pr-justification" name="justification" rows={3} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field
            id="pr-attachments"
            label="Attachments"
            hint="Comma-separated references or links"
          >
            <Input id="pr-attachments" name="attachments" />
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

function RequisitionEditForm({
  requisition,
  references,
}: {
  requisition: Requisition;
  references: ProcurementReferences;
  group?: string;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<ProcurementLine[]>(() =>
    requisitionLines(requisition.items),
  );
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      procurementApi.updateRequisition(requisition.id, payload),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["procurement", "requisitions"] });
      toast.success(`Requisition ${requisition.number} updated.`);
      setOpen(false);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Requisition could not be updated.")),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setLines(requisitionLines(requisition.items));
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="w-full">
          Edit draft
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit {requisition.number}</DialogTitle>
          <DialogDescription>
            Update this draft requisition, then save before submitting it.
          </DialogDescription>
        </DialogHeader>
        <form
          key={open ? `open-${requisition.id}` : `closed-${requisition.id}`}
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            mutation.mutate({
              title: textValue(form, "title"),
              business_justification: textValue(form, "justification"),
              department_id: Number(form.get("department_id")) || undefined,
              cost_center_id: Number(form.get("cost_center_id")) || undefined,
              project_id: Number(form.get("project_id")) || undefined,
              procurement_method: textValue(form, "method"),
              priority: textValue(form, "priority"),
              required_on: textValue(form, "required_on"),
              attachments: listValue(form, "attachments"),
              items: lines,
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`req-${requisition.id}-title`} label="Request title">
              <Input
                id={`req-${requisition.id}-title`}
                name="title"
                defaultValue={requisition.title ?? ""}
                required
              />
            </Field>
            <Field id={`req-${requisition.id}-method`} label="Procurement method">
              <select
                id={`req-${requisition.id}-method`}
                name="method"
                className={fieldClass}
                defaultValue={requisition.procurement_method}
              >
                {references.methods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={`req-${requisition.id}-priority`} label="Priority">
              <select
                id={`req-${requisition.id}-priority`}
                name="priority"
                className={fieldClass}
                defaultValue={requisition.priority}
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
                <option value="low">Low</option>
              </select>
            </Field>
            <Field id={`req-${requisition.id}-required`} label="Required date">
              <Input
                id={`req-${requisition.id}-required`}
                name="required_on"
                type="date"
                defaultValue={dateInputValue(requisition.required_on)}
              />
            </Field>
            <Field id={`req-${requisition.id}-project`} label="Project">
              <select
                id={`req-${requisition.id}-project`}
                name="project_id"
                className={fieldClass}
                defaultValue={requisition.project_id ?? ""}
              >
                <option value="">No project</option>
                {references.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={`req-${requisition.id}-cost`} label="Cost center">
              <select
                id={`req-${requisition.id}-cost`}
                name="cost_center_id"
                className={fieldClass}
                defaultValue={requisition.cost_center_id ?? ""}
              >
                <option value="">No cost center</option>
                {selectableCostCenters(references.cost_centers, requisition.cost_center_id).map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.code} · {center.name}
                    {isCostCenterActive(center) ? "" : " (inactive)"}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={`req-${requisition.id}-department`} label="Department ID">
              <Input
                id={`req-${requisition.id}-department`}
                name="department_id"
                type="number"
                min="1"
                defaultValue={requisition.department_id ?? ""}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field id={`req-${requisition.id}-justification`} label="Business justification">
                <Textarea
                  id={`req-${requisition.id}-justification`}
                  name="justification"
                  rows={3}
                  defaultValue={requisition.business_justification ?? ""}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field
                id={`req-${requisition.id}-attachments`}
                label="Attachments"
                hint="Comma-separated references or links"
              >
                <Input
                  id={`req-${requisition.id}-attachments`}
                  name="attachments"
                  defaultValue={joinList(
                    (requisition.attachments ?? []).map((item) => String(item)),
                  )}
                />
              </Field>
            </div>
          </div>
          <LineItemsEditor
            lines={lines}
            onChange={setLines}
            references={references}
          />
          <InlineMutationError error={mutation.error} />
          <Button type="submit" disabled={mutation.isPending}>
            <BusyLabel busy={mutation.isPending}>Save changes</BusyLabel>
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SourcingForm({ references }: { references: ProcurementReferences }) {
  const client = useQueryClient();
  const [formKey, setFormKey] = useState(0);
  const [taxInclusive, setTaxInclusive] = useState(true);
  const [invitedIds, setInvitedIds] = useState<number[]>([]);
  const requisitions = useQuery({
    queryKey: ["procurement", "requisitions", "approved"],
    queryFn: () =>
      procurementApi.requisitions({ per_page: 100, status: "approved" }),
  });
  const mutation = useMutation({
    mutationFn: procurementApi.createSourcingEvent,
    onSuccess: () => {
      setFormKey((prev) => prev + 1);
      setTaxInclusive(true);
      setInvitedIds([]);
      client.invalidateQueries({ queryKey: ["procurement", "sourcing"] });
      toast.success("Sourcing event created.");
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Sourcing event could not be created.")),
  });
  return (
    <Card key={formKey}>
      <CardHeader>
        <CardTitle>Open a sourcing event</CardTitle>
        <CardDescription>
          Set method, deadlines, securities, invited suppliers, and evaluation
          weights before publishing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormShell
          title="Event details"
          description="Draft events can be edited until they are published."
          mutation={mutation}
          submitLabel="Create sourcing event"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(
              sourcingPayloadFromForm(
                new FormData(event.currentTarget),
                taxInclusive,
                invitedIds,
              ),
            );
          }}
        >
          <SourcingFields
            idPrefix="source"
            references={references}
            requisitions={requisitions.data?.data ?? []}
            taxInclusive={taxInclusive}
            onTaxInclusiveChange={setTaxInclusive}
            invitedIds={invitedIds}
            onInvitedIdsChange={setInvitedIds}
          />
        </FormShell>
      </CardContent>
    </Card>
  );
}

function SourcingEditForm({
  event,
  references,
}: {
  event: SourcingEvent;
  references: ProcurementReferences;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [taxInclusive, setTaxInclusive] = useState(
    event.tax_inclusive_evaluation !== false,
  );
  const [invitedIds, setInvitedIds] = useState<number[]>(
    event.invited_supplier_ids ?? [],
  );
  const requisitions = useQuery({
    queryKey: ["procurement", "requisitions", "approved"],
    queryFn: () =>
      procurementApi.requisitions({ per_page: 100, status: "approved" }),
  });
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      procurementApi.updateSourcingEvent(event.id, payload),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["procurement", "sourcing"] });
      toast.success(`${event.number} updated.`);
      setOpen(false);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Sourcing event could not be updated.")),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setTaxInclusive(event.tax_inclusive_evaluation !== false);
          setInvitedIds(event.invited_supplier_ids ?? []);
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="w-full">
          Edit draft
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit {event.number}</DialogTitle>
          <DialogDescription>
            Update this draft event, then save before publishing it.
          </DialogDescription>
        </DialogHeader>
        <form
          key={open ? `open-${event.id}` : `closed-${event.id}`}
          className="space-y-4"
          onSubmit={(formEvent) => {
            formEvent.preventDefault();
            mutation.mutate(
              sourcingPayloadFromForm(
                new FormData(formEvent.currentTarget),
                taxInclusive,
                invitedIds,
              ),
            );
          }}
        >
          <SourcingFields
            idPrefix={`source-${event.id}`}
            event={event}
            references={references}
            requisitions={requisitions.data?.data ?? []}
            taxInclusive={taxInclusive}
            onTaxInclusiveChange={setTaxInclusive}
            invitedIds={invitedIds}
            onInvitedIdsChange={setInvitedIds}
          />
          <InlineMutationError error={mutation.error} />
          <Button type="submit" disabled={mutation.isPending}>
            <BusyLabel busy={mutation.isPending}>Save changes</BusyLabel>
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SourcingFields({
  idPrefix,
  event,
  references,
  requisitions,
  taxInclusive,
  onTaxInclusiveChange,
  invitedIds,
  onInvitedIdsChange,
}: {
  idPrefix: string;
  event?: SourcingEvent;
  references: ProcurementReferences;
  requisitions: Requisition[];
  taxInclusive: boolean;
  onTaxInclusiveChange: (value: boolean) => void;
  invitedIds: number[];
  onInvitedIdsChange: (value: number[]) => void;
}) {
  return (
    <>
          <Grid>
        <Field id={`${idPrefix}-requisition`} label="Approved requisition">
              <select
            id={`${idPrefix}-requisition`}
                name="requisition_id"
                className={fieldClass}
            defaultValue={event?.requisition_id ?? ""}
              >
                <option value="">Independent sourcing</option>
            {requisitions.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.number} · {row.title}
                  </option>
                ))}
              </select>
            </Field>
        <Field id={`${idPrefix}-title`} label="Event title">
          <Input
            id={`${idPrefix}-title`}
            name="title"
            required
            defaultValue={event?.title ?? ""}
          />
            </Field>
        <Field id={`${idPrefix}-method`} label="Method">
          <select
            id={`${idPrefix}-method`}
            name="method"
            className={fieldClass}
            defaultValue={event?.method ?? "request_for_quotation"}
          >
                {references.methods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </Field>
        <Field id={`${idPrefix}-value`} label="Estimated value">
              <Input
            id={`${idPrefix}-value`}
                name="estimated_value"
                type="number"
                min="0"
                step="0.01"
                required
            defaultValue={event ? String(event.estimated_value) : ""}
              />
            </Field>
        <Field id={`${idPrefix}-egp`} label="e-GP reference">
          <Input
            id={`${idPrefix}-egp`}
            name="egp_reference"
            defaultValue={event?.egp_reference ?? ""}
          />
            </Field>
        <Field id={`${idPrefix}-sbd`} label="Standard bidding document">
              <Input
            id={`${idPrefix}-sbd`}
            name="standard_bidding_document"
            defaultValue={event?.standard_bidding_document ?? ""}
          />
        </Field>
        <Field id={`${idPrefix}-clarify`} label="Clarification deadline">
          <Input
            id={`${idPrefix}-clarify`}
            name="clarification_deadline"
                type="datetime-local"
            defaultValue={datetimeLocalValue(event?.clarification_deadline)}
          />
        </Field>
        <Field id={`${idPrefix}-deadline`} label="Submission deadline">
          <Input
            id={`${idPrefix}-deadline`}
            name="submission_deadline"
            type="datetime-local"
            defaultValue={datetimeLocalValue(event?.submission_deadline)}
          />
        </Field>
        <Field id={`${idPrefix}-security`} label="Bid security amount">
          <Input
            id={`${idPrefix}-security`}
            name="bid_security_amount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={String(event?.bid_security_amount ?? 0)}
          />
        </Field>
        <Field id={`${idPrefix}-performance`} label="Performance security %">
          <Input
            id={`${idPrefix}-performance`}
            name="performance_security_percent"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={String(event?.performance_security_percent ?? 0)}
          />
        </Field>
        <Field id={`${idPrefix}-preference`} label="Domestic preference %">
          <Input
            id={`${idPrefix}-preference`}
            name="domestic_preference_percent"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={String(event?.domestic_preference_percent ?? 0)}
          />
        </Field>
        <Field id={`${idPrefix}-tech`} label="Technical weight">
          <Input
            id={`${idPrefix}-tech`}
            name="weight_technical"
            type="number"
            min="0"
            max="100"
            step="1"
            required
            defaultValue={String(criteriaWeight(event?.evaluation_criteria, "technical", 40))}
          />
        </Field>
        <Field id={`${idPrefix}-fin`} label="Financial weight">
          <Input
            id={`${idPrefix}-fin`}
            name="weight_financial"
            type="number"
            min="0"
            max="100"
            step="1"
            required
            defaultValue={String(criteriaWeight(event?.evaluation_criteria, "financial", 50))}
          />
        </Field>
        <Field id={`${idPrefix}-pref-weight`} label="Preference weight">
          <Input
            id={`${idPrefix}-pref-weight`}
            name="weight_preference"
            type="number"
            min="0"
            max="100"
            step="1"
            required
            defaultValue={String(criteriaWeight(event?.evaluation_criteria, "preference", 10))}
              />
            </Field>
          </Grid>
      <Field id={`${idPrefix}-scope`} label="Scope and specification">
        <Textarea
          id={`${idPrefix}-scope`}
          name="scope"
          rows={3}
          defaultValue={event?.scope ?? ""}
        />
          </Field>
      <Field
        id={`${idPrefix}-documents`}
        label="Documents"
        hint="Comma-separated document names or references."
      >
        <Input
          id={`${idPrefix}-documents`}
          name="documents"
          defaultValue={joinList(event?.documents)}
        />
      </Field>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${idPrefix}-tax`}
          checked={taxInclusive}
          onCheckedChange={(value) => onTaxInclusiveChange(value === true)}
        />
        <Label htmlFor={`${idPrefix}-tax`}>Evaluate prices tax inclusive</Label>
      </div>
      <Field
        id={`${idPrefix}-invited`}
        label="Invited suppliers"
        hint="Leave empty for an open invitation. Selected suppliers are recorded on the event."
      >
        <div
          id={`${idPrefix}-invited`}
          className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-[#6b7280] p-3"
        >
          {references.suppliers.length ? (
            references.suppliers.map((supplier) => (
              <div key={supplier.id} className="flex items-center gap-2">
                <Checkbox
                  id={`${idPrefix}-invite-${supplier.id}`}
                  checked={invitedIds.includes(supplier.id)}
                  onCheckedChange={(value) =>
                    onInvitedIdsChange(
                      value === true
                        ? [...invitedIds, supplier.id]
                        : invitedIds.filter((id) => id !== supplier.id),
                    )
                  }
                />
                <Label htmlFor={`${idPrefix}-invite-${supplier.id}`}>
                  {supplier.code} · {supplier.name}
                </Label>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No active suppliers are available to invite.
            </p>
          )}
        </div>
      </Field>
    </>
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
  const [formKey, setFormKey] = useState(0);
  const mutation = useMutation({
    mutationFn: ({
      eventId,
      payload,
    }: {
      eventId: number;
      payload: Record<string, unknown>;
    }) => procurementApi.createBid(eventId, payload),
    onSuccess: () => {
      setLines([newLine()]);
      setFormKey((prev) => prev + 1);
      client.invalidateQueries({ queryKey: ["procurement", "sourcing"] });
      toast.success("Supplier offer captured.");
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Offer could not be captured.")),
  });
  return (
    <Card key={formKey}>
      <CardHeader>
        <CardTitle>Capture a supplier offer</CardTitle>
        <CardDescription>
          Offers preserve line price, tax, delivery lead time, and validity for
          comparison. Only published events accept offers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormShell
          title="Bid details"
          description="Publish the sourcing event first, then record comparable supplier offers."
          mutation={mutation}
          submitLabel="Capture offer"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            mutation.mutate({
              eventId: Number(form.get("event_id")),
              payload: {
                supplier_id: Number(form.get("supplier_id")),
                reference: textValue(form, "reference"),
                currency: "ETB",
                delivery_days: Number(form.get("delivery_days")),
                payment_terms: textValue(form, "payment_terms"),
                valid_until: textValue(form, "valid_until"),
                documents: listValue(form, "documents"),
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
                <option value="">Select a published event</option>
                {events.map((event) => (
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
          <Field
            id="bid-documents"
            label="Bid documents"
            hint="Comma-separated document names or references."
          >
            <Input id="bid-documents" name="documents" />
          </Field>
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
  const [formKey, setFormKey] = useState(0);
  const [lines, setLines] = useState<ProcurementLine[]>([newLine()]);
  const [overReceipt, setOverReceipt] = useState(false);
  const [agreementId, setAgreementId] = useState("");
  const [replenishmentCallOff, setReplenishmentCallOff] = useState(false);
  const requisitions = useQuery({
    queryKey: ["procurement", "requisitions", "approved"],
    queryFn: () =>
      procurementApi.requisitions({ per_page: 100, status: "approved" }),
  });
  const selectedAgreement = references.agreements.find(
    (row) => String(row.id) === agreementId,
  );
  const allowsReplenishment = Boolean(selectedAgreement?.auto_replenishment);
  const mutation = useMutation({
    mutationFn: procurementApi.createPurchaseOrder,
    onSuccess: () => {
      setFormKey((prev) => prev + 1);
      setLines([newLine()]);
      setOverReceipt(false);
      setAgreementId("");
      setReplenishmentCallOff(false);
      client.invalidateQueries({ queryKey: ["procurement", "orders"] });
      client.invalidateQueries({ queryKey: ["procurement", "agreements"] });
      client.invalidateQueries({ queryKey: ["procurement", "references"] });
      toast.success("Purchase order created.");
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Purchase order could not be created.")),
  });
  return (
    <Card key={formKey}>
      <CardHeader>
        <CardTitle>Create a purchase order</CardTitle>
        <CardDescription>
          Competitive awards generate orders automatically; use this for direct
          buys and agreement call-offs.
        </CardDescription>
      </CardHeader>
      <CardContent>
    <FormShell
          title="Order details"
          description="Link a requisition or agreement when applicable, then set delivery and receipt rules."
      mutation={mutation}
          submitLabel="Create purchase order"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(
              purchaseOrderPayloadFromForm(new FormData(event.currentTarget), lines, {
                overReceipt,
                replenishmentCallOff,
                agreementId,
              }),
            );
          }}
        >
          <PurchaseOrderFields
            idPrefix="po"
            references={references}
            requisitions={requisitions.data?.data ?? []}
            lines={lines}
            onLinesChange={setLines}
            overReceipt={overReceipt}
            onOverReceiptChange={setOverReceipt}
            agreementId={agreementId}
            onAgreementIdChange={(nextId) => {
              setAgreementId(nextId);
              const next = references.agreements.find(
                (row) => String(row.id) === nextId,
              );
              if (!next?.auto_replenishment) setReplenishmentCallOff(false);
            }}
            replenishmentCallOff={replenishmentCallOff}
            onReplenishmentCallOffChange={setReplenishmentCallOff}
            allowsReplenishment={allowsReplenishment}
            showReplenishment
          />
        </FormShell>
      </CardContent>
    </Card>
  );
}

function PurchaseOrderEditForm({
  order,
  references,
}: {
  order: PurchaseOrder;
  references: ProcurementReferences;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<ProcurementLine[]>(() =>
    requisitionLines(order.items),
  );
  const [overReceipt, setOverReceipt] = useState(
    Boolean(order.allow_over_receipt),
  );
  const [agreementId, setAgreementId] = useState(
    order.agreement_id ? String(order.agreement_id) : "",
  );
  const requisitions = useQuery({
    queryKey: ["procurement", "requisitions", "approved"],
    queryFn: () =>
      procurementApi.requisitions({ per_page: 100, status: "approved" }),
  });
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      procurementApi.updatePurchaseOrder(order.id, payload),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["procurement", "orders"] });
      toast.success(`${order.number} updated.`);
      setOpen(false);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Purchase order could not be updated.")),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setLines(requisitionLines(order.items));
          setOverReceipt(Boolean(order.allow_over_receipt));
          setAgreementId(order.agreement_id ? String(order.agreement_id) : "");
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="w-full">
          Edit draft
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit {order.number}</DialogTitle>
          <DialogDescription>
            Update this draft order, then save before submitting it.
          </DialogDescription>
        </DialogHeader>
        <form
          key={open ? `open-${order.id}` : `closed-${order.id}`}
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(
              purchaseOrderPayloadFromForm(new FormData(event.currentTarget), lines, {
                overReceipt,
                agreementId,
                baseTerms: order.terms,
                includeReplenishment: false,
              }),
            );
          }}
        >
          <PurchaseOrderFields
            idPrefix={`po-${order.id}`}
            order={order}
            references={references}
            requisitions={requisitions.data?.data ?? []}
            lines={lines}
            onLinesChange={setLines}
            overReceipt={overReceipt}
            onOverReceiptChange={setOverReceipt}
            agreementId={agreementId}
            onAgreementIdChange={setAgreementId}
            showReplenishment={false}
          />
          <InlineMutationError error={mutation.error} />
          <Button type="submit" disabled={mutation.isPending}>
            <BusyLabel busy={mutation.isPending}>Save changes</BusyLabel>
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseOrderConfirmForm({ order }: { order: PurchaseOrder }) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (reference: string) =>
      procurementApi.purchaseOrderAction(order.id, "confirm", { reference }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["procurement", "orders"] });
      await client.invalidateQueries({ queryKey: ["procurement", "dashboard"] });
      toast.success(`${order.number} confirmed by supplier.`);
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, "Purchase order could not be confirmed."),
      ),
  });
  return (
    <InlineAction label="Confirm supplier" group={`order-actions-${order.id}`}>
      <form
        className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
          const reference = String(form.get("reference") ?? "").trim();
          if (!reference) {
            toast.error("Enter the supplier confirmation reference.");
            return;
          }
          mutation.mutate(reference);
        }}
      >
        <Field
          id={`order-${order.id}-confirm-ref`}
          label="Confirmation reference"
        >
          <Input
            id={`order-${order.id}-confirm-ref`}
            name="reference"
            required
            placeholder="Supplier PO ack / email ref"
          />
        </Field>
        <InlineMutationError error={mutation.error} />
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          <BusyLabel busy={mutation.isPending}>Confirm</BusyLabel>
        </Button>
      </form>
    </InlineAction>
  );
}

function PurchaseOrderReasonAction({
  order,
  action,
  label,
  group,
}: {
  order: PurchaseOrder;
  action: "revise" | "cancel";
  label: string;
  group?: string;
}) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (reason: string) =>
      procurementApi.purchaseOrderAction(order.id, action, {
        reason: reason || undefined,
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["procurement", "orders"] });
      await client.invalidateQueries({ queryKey: ["procurement", "dashboard"] });
      toast.success(
        action === "revise"
          ? `${order.number} revised back to draft.`
          : `${order.number} cancelled.`,
      );
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(
          error,
          action === "revise"
            ? "Purchase order could not be revised."
            : "Purchase order could not be cancelled.",
        ),
      ),
  });
  return (
    <InlineAction label={label} group={group}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const reason = String(form.get("reason") ?? "").trim();
          if (action === "revise" && !reason) {
            toast.error("Enter a revision reason.");
            return;
          }
          mutation.mutate(reason);
        }}
      >
        <Field id={`order-${order.id}-${action}`} label="Reason">
          <Textarea
            id={`order-${order.id}-${action}`}
            name="reason"
            rows={3}
            required={action === "revise"}
          />
        </Field>
        <InlineMutationError error={mutation.error} />
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          <BusyLabel busy={mutation.isPending}>{label}</BusyLabel>
        </Button>
      </form>
    </InlineAction>
  );
}

function PurchaseOrderFields({
  idPrefix,
  order,
  references,
  requisitions,
  lines,
  onLinesChange,
  overReceipt,
  onOverReceiptChange,
  agreementId,
  onAgreementIdChange,
  replenishmentCallOff = false,
  onReplenishmentCallOffChange,
  allowsReplenishment = false,
  showReplenishment,
}: {
  idPrefix: string;
  order?: PurchaseOrder;
  references: ProcurementReferences;
  requisitions: Requisition[];
  lines: ProcurementLine[];
  onLinesChange: (lines: ProcurementLine[]) => void;
  overReceipt: boolean;
  onOverReceiptChange: (value: boolean) => void;
  agreementId: string;
  onAgreementIdChange: (value: string) => void;
  replenishmentCallOff?: boolean;
  onReplenishmentCallOffChange?: (value: boolean) => void;
  allowsReplenishment?: boolean;
  showReplenishment: boolean;
}) {
  const selectedAgreement = references.agreements.find(
    (row) => String(row.id) === agreementId,
  );
  return (
    <>
      <Grid>
        <Field id={`${idPrefix}-supplier`} label="Qualified supplier">
          <select
            key={`${idPrefix}-supplier-${agreementId || "none"}`}
            id={`${idPrefix}-supplier`}
            name="supplier_id"
            required
            className={fieldClass}
            defaultValue={order?.supplier_id ?? selectedAgreement?.supplier_id ?? ""}
          >
            <option value="">Select a supplier</option>
            {references.suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.code} · {supplier.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${idPrefix}-requisition`} label="Approved requisition">
          <select
            id={`${idPrefix}-requisition`}
            name="requisition_id"
            className={fieldClass}
            defaultValue={order?.requisition_id ?? ""}
          >
            <option value="">No requisition</option>
            {requisitions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.number} · {row.title}
              </option>
            ))}
            {order?.requisition_id &&
            !requisitions.some((row) => row.id === order.requisition_id) &&
            order.requisition ? (
              <option value={order.requisition.id}>
                {order.requisition.number} · {order.requisition.title}
              </option>
            ) : null}
          </select>
        </Field>
        <Field id={`${idPrefix}-agreement`} label="Agreement">
          <select
            id={`${idPrefix}-agreement`}
            name="agreement_id"
            className={fieldClass}
            value={agreementId}
            onChange={(event) => onAgreementIdChange(event.target.value)}
          >
            <option value="">No agreement</option>
            {references.agreements.map((agreement) => (
              <option key={agreement.id} value={agreement.id}>
                {agreement.number} · {agreement.title}
                {agreement.auto_replenishment ? " · replenishment OK" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${idPrefix}-project`} label="Project">
          <select
            id={`${idPrefix}-project`}
            name="project_id"
            className={fieldClass}
            defaultValue={order?.project_id ?? ""}
          >
            <option value="">No project</option>
            {references.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${idPrefix}-cost-center`} label="Cost center">
          <select
            id={`${idPrefix}-cost-center`}
            name="cost_center_id"
            className={fieldClass}
            defaultValue={order?.cost_center_id ?? ""}
          >
            <option value="">No cost center</option>
            {selectableCostCenters(
              references.cost_centers,
              order?.cost_center_id,
            ).map((center) => (
              <option key={center.id} value={center.id}>
                {center.code} · {center.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${idPrefix}-exchange`} label="Exchange rate">
          <Input
            id={`${idPrefix}-exchange`}
            name="exchange_rate"
            type="number"
            min="0.00000001"
            step="0.00000001"
            defaultValue={String(order?.exchange_rate ?? 1)}
            required
          />
        </Field>
        <Field id={`${idPrefix}-ordered`} label="Order date">
          <Input
            id={`${idPrefix}-ordered`}
            name="ordered_on"
            type="date"
            defaultValue={dateInputValue(order?.ordered_on) || today()}
            required
          />
        </Field>
        <Field id={`${idPrefix}-expected`} label="Expected date">
          <Input
            id={`${idPrefix}-expected`}
            name="expected_on"
            type="date"
            min={dateInputValue(order?.ordered_on) || today()}
            defaultValue={dateInputValue(order?.expected_on)}
          />
        </Field>
        <Field id={`${idPrefix}-location`} label="Delivery location">
          <Input
            id={`${idPrefix}-location`}
            name="delivery_location"
            defaultValue={order?.delivery_location ?? ""}
          />
        </Field>
        <Field id={`${idPrefix}-terms`} label="Payment terms">
          <Input
            id={`${idPrefix}-terms`}
            name="payment_terms"
            placeholder="e.g. Net 30"
            defaultValue={termText(order?.terms, "payment_terms")}
          />
        </Field>
        <div className="md:col-span-2">
          <Field
            id={`${idPrefix}-attachments`}
            label="Attachments"
            hint="Comma-separated references or links"
          >
            <Input
              id={`${idPrefix}-attachments`}
              name="attachments"
              defaultValue={joinList(order?.attachments)}
            />
          </Field>
        </div>
        <div className="flex items-center gap-2 self-end pb-3">
          <Checkbox
            id={`${idPrefix}-over-receipt`}
            checked={overReceipt}
            onCheckedChange={(value) => onOverReceiptChange(value === true)}
          />
          <Label htmlFor={`${idPrefix}-over-receipt`}>
            Allow controlled over-receipt
          </Label>
        </div>
        {overReceipt ? (
          <Field id={`${idPrefix}-tolerance`} label="Over-receipt tolerance (%)">
            <Input
              id={`${idPrefix}-tolerance`}
              name="tolerance"
              type="number"
              min="0"
              max="100"
              defaultValue={String(order?.over_receipt_tolerance_percent ?? 0)}
            />
          </Field>
        ) : null}
        {showReplenishment ? (
          <div className="flex items-center gap-2 self-end pb-3">
            <Checkbox
              id={`${idPrefix}-replenishment`}
              checked={replenishmentCallOff}
              disabled={!allowsReplenishment}
              onCheckedChange={(value) =>
                onReplenishmentCallOffChange?.(value === true)
              }
            />
            <Label htmlFor={`${idPrefix}-replenishment`}>
              Replenishment call-off
              {!agreementId
                ? " (select an agreement)"
                : allowsReplenishment
                  ? ""
                  : " (agreement does not allow this)"}
            </Label>
          </div>
        ) : null}
      </Grid>
      <LineItemsEditor
        lines={lines}
        onChange={onLinesChange}
        references={references}
      />
    </>
  );
}

function ReceiptForm({
  references,
  orders,
  ordersLoading = false,
}: {
  references: ProcurementReferences;
  orders: PurchaseOrder[];
  ordersLoading?: boolean;
}) {
  const client = useQueryClient();
  const [formKey, setFormKey] = useState(0);
  const [orderId, setOrderId] = useState("");
  const [lines, setLines] = useState<ProcurementLine[]>([]);
  const mutation = useMutation({
    mutationFn: procurementApi.createReceipt,
    onSuccess: () => {
      setFormKey((prev) => prev + 1);
      setOrderId("");
      setLines([]);
      client.invalidateQueries({ queryKey: ["procurement", "receipts"] });
      client.invalidateQueries({ queryKey: ["procurement", "orders"] });
      toast.success("Goods receipt captured.");
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Goods receipt could not be captured.")),
  });
  const selectOrder = (value: string) => {
    setOrderId(value);
    const order = orders.find((row) => row.id === Number(value));
    setLines(
      order?.items.map((line) => ({
        ...line,
        received_quantity: Number(line.quantity),
        accepted_quantity: Number(line.quantity),
        rejected_quantity: 0,
        lot_number: "",
        batch_number: "",
        serial_numbers: [],
        expiry_date: "",
      })) ?? [],
    );
  };
  return (
    <Card key={formKey}>
      <CardHeader>
        <CardTitle>Capture a goods receipt</CardTitle>
        <CardDescription>
          Only issued, confirmed, or partially received purchase orders can be
          received. Approve then Issue the order on Orders first.
        </CardDescription>
      </CardHeader>
      <CardContent>
    <FormShell
          title="Receipt details"
      description="Select the purchase order to copy its immutable line keys and enter the delivered quantities."
      mutation={mutation}
          submitLabel="Capture goods receipt"
      onSubmit={(event) => {
        event.preventDefault();
            if (!orderId) {
              toast.error("Select an issued purchase order.");
              return;
            }
            if (!lines.length) {
              toast.error("The selected order has no lines to receive.");
              return;
            }
        const form = new FormData(event.currentTarget);
        mutation.mutate({
          purchase_order_id: Number(orderId),
              supplier_delivery_note: textValue(form, "delivery_note"),
              received_on: textValue(form, "received_on"),
              attachments: listValue(form, "attachments") ?? [],
              items: lines.map((line) => {
                const received = Number(line.received_quantity ?? 0);
                const accepted = Number(
                  line.accepted_quantity ?? line.received_quantity ?? 0,
                );
                return {
                  line_key: line.line_key,
                  description: line.description,
                  unit: line.unit,
                  unit_price: line.unit_price,
                  inventory_item_id: line.inventory_item_id || undefined,
                  received_quantity: received,
                  accepted_quantity: accepted,
                  rejected_quantity: Number(
                    line.rejected_quantity ?? Math.max(0, received - accepted),
                  ),
                  lot_number: line.lot_number || undefined,
                  batch_number: line.batch_number || undefined,
                  serial_numbers: line.serial_numbers?.length
                    ? line.serial_numbers
                    : undefined,
                  expiry_date: line.expiry_date || undefined,
                };
              }),
        });
      }}
    >
      <Grid>
            <Field
              id="grn-order"
              label="Purchase order"
              hint={
                ordersLoading
                  ? "Loading receivable orders…"
                  : orders.length
                    ? "Issued, confirmed, or partially received only."
                    : "No receivable orders yet. Issue a purchase order first."
              }
            >
          <select
            id="grn-order"
            value={orderId}
            onChange={(e) => selectOrder(e.target.value)}
            required
                disabled={ordersLoading || !orders.length}
            className={fieldClass}
          >
                <option value="">
                  {orders.length
                    ? "Select an issued order"
                    : "No issued / confirmed orders"}
                </option>
                {orders.map((order) => (
                <option key={order.id} value={order.id}>
                    {order.number} · {order.supplier?.name ?? "Supplier"} ·{" "}
                    {order.status}
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
            <div className="md:col-span-2">
              <Field
                id="grn-attachments"
                label="Attachments"
                hint="Comma-separated references or links"
              >
                <Input id="grn-attachments" name="attachments" />
              </Field>
            </div>
      </Grid>
          {!ordersLoading && !orders.length ? (
            <Alert>
              <Send aria-hidden="true" />
              <AlertTitle>No receivable purchase orders</AlertTitle>
              <AlertDescription>
                Draft and approved orders do not appear here. On Orders, submit
                → approve → issue the PO, then return to capture the receipt.
              </AlertDescription>
            </Alert>
          ) : null}
          <ReceiptLines
            lines={lines}
            onChange={setLines}
            references={references}
          />
    </FormShell>
      </CardContent>
    </Card>
  );
}

function InvoiceForm({
  references,
  orders,
  ordersLoading = false,
}: {
  references: ProcurementReferences;
  orders: PurchaseOrder[];
  ordersLoading?: boolean;
}) {
  const client = useQueryClient();
  const [formKey, setFormKey] = useState(0);
  const [orderId, setOrderId] = useState("");
  const [lines, setLines] = useState<ProcurementLine[]>([]);
  const mutation = useMutation({
    mutationFn: procurementApi.createInvoice,
    onSuccess: () => {
      setFormKey((prev) => prev + 1);
      setOrderId("");
      setLines([]);
      client.invalidateQueries({ queryKey: ["procurement", "invoices"] });
      toast.success("Supplier invoice captured.");
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Supplier invoice could not be captured.")),
  });
  const selectOrder = (value: string) => {
    setOrderId(value);
    const order = orders.find((row) => row.id === Number(value));
    setLines(order?.items.map((line) => ({ ...line })) ?? []);
  };
  return (
    <Card key={formKey}>
      <CardHeader>
        <CardTitle>Capture a supplier invoice</CardTitle>
        <CardDescription>
          Three-way matching compares invoice lines against the purchase order
          and posted stock receipts. Post a goods receipt before invoicing.
        </CardDescription>
      </CardHeader>
      <CardContent>
    <FormShell
          title="Invoice details"
          description="Purchase-order lines are copied for line-level price and quantity matching."
      mutation={mutation}
          submitLabel="Capture supplier invoice"
      onSubmit={(event) => {
        event.preventDefault();
            if (!orderId) {
              toast.error("Select a purchase order with posted receipts.");
              return;
            }
            mutation.mutate(
              invoicePayloadFromForm(
                new FormData(event.currentTarget),
                lines,
                orderId,
              ),
            );
          }}
        >
          <InvoiceFields
            idPrefix="invoice"
            references={references}
            orders={orders}
            ordersLoading={ordersLoading}
            orderId={orderId}
            onOrderIdChange={selectOrder}
            lines={lines}
            onLinesChange={setLines}
          />
        </FormShell>
      </CardContent>
    </Card>
  );
}

function InvoiceEditForm({
  invoice,
  references,
}: {
  invoice: SupplierInvoice;
  references: ProcurementReferences;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState(String(invoice.purchase_order_id));
  const [lines, setLines] = useState<ProcurementLine[]>(() =>
    requisitionLines(invoice.items),
  );
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      procurementApi.updateInvoice(invoice.id, payload),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["procurement", "invoices"] });
      toast.success(`${invoice.number} updated.`);
      setOpen(false);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Invoice could not be updated.")),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setOrderId(String(invoice.purchase_order_id));
          setLines(requisitionLines(invoice.items));
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="w-full">
          Edit draft
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit {invoice.number}</DialogTitle>
          <DialogDescription>
            Update this draft invoice before running the three-way match.
          </DialogDescription>
        </DialogHeader>
        <form
          key={open ? `open-${invoice.id}` : `closed-${invoice.id}`}
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(
              invoicePayloadFromForm(
                new FormData(event.currentTarget),
                lines,
                orderId,
              ),
            );
          }}
        >
          <InvoiceFields
            idPrefix={`invoice-${invoice.id}`}
            invoice={invoice}
            references={references}
            orders={invoice.purchase_order ? [invoice.purchase_order] : []}
            orderId={orderId}
            onOrderIdChange={(value) => {
              setOrderId(value);
              const order = invoice.purchase_order;
              if (order && String(order.id) === value) {
                setLines(requisitionLines(invoice.items));
              }
            }}
            lines={lines}
            onLinesChange={setLines}
            lockOrder
          />
          <InlineMutationError error={mutation.error} />
          <Button type="submit" disabled={mutation.isPending}>
            <BusyLabel busy={mutation.isPending}>Save changes</BusyLabel>
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceFields({
  idPrefix,
  invoice,
  references,
  orders,
  ordersLoading = false,
  orderId,
  onOrderIdChange,
  lines,
  onLinesChange,
  lockOrder = false,
}: {
  idPrefix: string;
  invoice?: SupplierInvoice;
  references: ProcurementReferences;
  orders: PurchaseOrder[];
  ordersLoading?: boolean;
  orderId: string;
  onOrderIdChange: (value: string) => void;
  lines: ProcurementLine[];
  onLinesChange: (lines: ProcurementLine[]) => void;
  lockOrder?: boolean;
}) {
  return (
    <>
      <Grid>
        <Field
          id={`${idPrefix}-order`}
          label="Purchase order"
          hint={
            lockOrder
              ? "Purchase order is fixed after capture."
              : ordersLoading
                ? "Loading invoiceable orders…"
                : orders.length
                  ? "Only POs with posted stock receipts and open invoice capacity."
                  : "No invoiceable orders yet. Post a goods receipt first."
          }
        >
          <select
            id={`${idPrefix}-order`}
            name="purchase_order_id"
            value={orderId}
            onChange={(event) => onOrderIdChange(event.target.value)}
            required
            disabled={lockOrder || ordersLoading || (!lockOrder && !orders.length)}
            className={fieldClass}
          >
            <option value="">
              {orders.length
                ? "Select a purchase order"
                : "No invoiceable purchase orders"}
            </option>
            {orders.map((order) => (
                <option key={order.id} value={order.id}>
                {order.number} · {order.supplier?.name ?? "Supplier"} · received{" "}
                {Number(order.received_percent ?? 0).toFixed(0)}%
                </option>
              ))}
            {invoice?.purchase_order &&
            !orders.some((row) => row.id === invoice.purchase_order?.id) ? (
              <option value={invoice.purchase_order.id}>
                {invoice.purchase_order.number} ·{" "}
                {invoice.purchase_order.supplier?.name ?? "Supplier"}
              </option>
            ) : null}
          </select>
        </Field>
        <Field
          id={`${idPrefix}-vendor-number`}
          label="Supplier invoice number"
        >
          <Input
            id={`${idPrefix}-vendor-number`}
            name="supplier_invoice_number"
            required
            defaultValue={invoice?.supplier_invoice_number ?? ""}
          />
        </Field>
        <Field id={`${idPrefix}-date`} label="Invoice date">
          <Input
            id={`${idPrefix}-date`}
            name="invoice_date"
            type="date"
            defaultValue={dateInputValue(invoice?.invoice_date) || today()}
            required
          />
        </Field>
        <Field id={`${idPrefix}-due`} label="Due date">
          <Input
            id={`${idPrefix}-due`}
            name="due_date"
            type="date"
            min={dateInputValue(invoice?.invoice_date) || today()}
            defaultValue={dateInputValue(invoice?.due_date)}
          />
        </Field>
        <Field id={`${idPrefix}-price-tolerance`} label="Price tolerance (%)">
          <Input
            id={`${idPrefix}-price-tolerance`}
            name="price_tolerance"
            type="number"
            min="0"
            max="100"
            defaultValue={String(invoice?.price_tolerance_percent ?? 0)}
          />
        </Field>
        <Field
          id={`${idPrefix}-quantity-tolerance`}
          label="Quantity tolerance (%)"
        >
          <Input
            id={`${idPrefix}-quantity-tolerance`}
            name="quantity_tolerance"
            type="number"
            min="0"
            max="100"
            defaultValue={String(invoice?.quantity_tolerance_percent ?? 0)}
          />
        </Field>
        <div className="md:col-span-2">
          <Field
            id={`${idPrefix}-attachments`}
            label="Attachments"
            hint="Comma-separated references or links"
          >
            <Input
              id={`${idPrefix}-attachments`}
              name="attachments"
              defaultValue={joinList(invoice?.attachments)}
            />
          </Field>
        </div>
      </Grid>
      {!lockOrder && !ordersLoading && !orders.length ? (
        <Alert>
          <Send aria-hidden="true" />
          <AlertTitle>No invoiceable purchase orders</AlertTitle>
          <AlertDescription>
            Issue a PO, capture a goods receipt, pass inspection, and post stock
            before creating a supplier invoice.
          </AlertDescription>
        </Alert>
      ) : null}
      <LineItemsEditor
        lines={lines}
        onChange={onLinesChange}
        references={references}
        preserveKeys
      />
    </>
  );
}

function AgreementForm({ references }: { references: ProcurementReferences }) {
  const client = useQueryClient();
  const [formKey, setFormKey] = useState(0);
  const [lines, setLines] = useState<ProcurementLine[]>([newLine()]);
  const [autoReplenishment, setAutoReplenishment] = useState(false);
  const mutation = useMutation({
    mutationFn: procurementApi.createAgreement,
    onSuccess: () => {
      setLines([newLine()]);
      setAutoReplenishment(false);
      setFormKey((prev) => prev + 1);
      client.invalidateQueries({ queryKey: ["procurement", "agreements"] });
      client.invalidateQueries({ queryKey: ["procurement", "references"] });
      toast.success("Agreement created.");
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Agreement could not be created.")),
  });
  return (
    <FormShell
      key={formKey}
      title="Create a procurement agreement"
      description="Set ceiling, catalogue lines, service levels, and whether replenishment call-offs are allowed."
      mutation={mutation}
      submitLabel="Create agreement"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate(
          agreementPayloadFromForm(
            new FormData(event.currentTarget),
            lines,
            autoReplenishment,
          ),
        );
      }}
    >
      <AgreementFields
        idPrefix="agreement"
        references={references}
        lines={lines}
        onLinesChange={setLines}
        autoReplenishment={autoReplenishment}
        onAutoReplenishmentChange={setAutoReplenishment}
      />
    </FormShell>
  );
}

function AgreementEditForm({
  agreement,
  references,
}: {
  agreement: Agreement;
  references: ProcurementReferences;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<ProcurementLine[]>(() =>
    requisitionLines(agreement.items ?? undefined),
  );
  const [autoReplenishment, setAutoReplenishment] = useState(
    Boolean(agreement.auto_replenishment),
  );
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      procurementApi.updateAgreement(agreement.id, payload),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["procurement", "agreements"] });
      await client.invalidateQueries({ queryKey: ["procurement", "references"] });
      toast.success(`${agreement.number} updated.`);
      setOpen(false);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Agreement could not be updated.")),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setLines(requisitionLines(agreement.items ?? undefined));
          setAutoReplenishment(Boolean(agreement.auto_replenishment));
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="w-full">
          Edit draft
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit {agreement.number}</DialogTitle>
          <DialogDescription>
            Update this draft agreement, then save before activating it.
          </DialogDescription>
        </DialogHeader>
        <form
          key={open ? `open-${agreement.id}` : `closed-${agreement.id}`}
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(
              agreementPayloadFromForm(
                new FormData(event.currentTarget),
                lines,
                autoReplenishment,
              ),
            );
          }}
        >
          <AgreementFields
            idPrefix={`agreement-${agreement.id}`}
            agreement={agreement}
            references={references}
            lines={lines}
            onLinesChange={setLines}
            autoReplenishment={autoReplenishment}
            onAutoReplenishmentChange={setAutoReplenishment}
          />
          <InlineMutationError error={mutation.error} />
          <Button type="submit" disabled={mutation.isPending}>
            <BusyLabel busy={mutation.isPending}>Save changes</BusyLabel>
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AgreementFields({
  idPrefix,
  agreement,
  references,
  lines,
  onLinesChange,
  autoReplenishment,
  onAutoReplenishmentChange,
}: {
  idPrefix: string;
  agreement?: Agreement;
  references: ProcurementReferences;
  lines: ProcurementLine[];
  onLinesChange: (lines: ProcurementLine[]) => void;
  autoReplenishment: boolean;
  onAutoReplenishmentChange: (value: boolean) => void;
}) {
  return (
    <>
      <Grid>
        <Field id={`${idPrefix}-supplier`} label="Supplier">
          <select
            id={`${idPrefix}-supplier`}
            name="supplier_id"
            required
            className={fieldClass}
            defaultValue={agreement?.supplier_id ?? ""}
          >
            <option value="">Select a supplier</option>
            {references.suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.code} · {supplier.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${idPrefix}-type`} label="Agreement type">
          <select
            id={`${idPrefix}-type`}
            name="type"
            className={fieldClass}
            defaultValue={agreement?.type ?? "framework"}
          >
            <option value="framework">Framework</option>
            <option value="blanket">Blanket order</option>
            <option value="service_level">Service-level agreement</option>
            <option value="rate_contract">Rate contract</option>
          </select>
        </Field>
        <Field id={`${idPrefix}-title`} label="Agreement title">
          <Input
            id={`${idPrefix}-title`}
            name="title"
            required
            defaultValue={agreement?.title ?? ""}
          />
        </Field>
        <Field id={`${idPrefix}-start`} label="Start date">
          <Input
            id={`${idPrefix}-start`}
            name="starts_on"
            type="date"
            defaultValue={dateInputValue(agreement?.starts_on) || today()}
            required
          />
        </Field>
        <Field id={`${idPrefix}-end`} label="End date">
          <Input
            id={`${idPrefix}-end`}
            name="ends_on"
            type="date"
            min={today()}
            defaultValue={dateInputValue(agreement?.ends_on)}
            required
          />
        </Field>
        <Field id={`${idPrefix}-ceiling`} label="Ceiling amount">
          <Input
            id={`${idPrefix}-ceiling`}
            name="ceiling_amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            defaultValue={
              agreement ? String(agreement.ceiling_amount) : ""
            }
          />
        </Field>
        {agreement ? (
          <input
            type="hidden"
            name="committed_amount"
            value={String(agreement.committed_amount ?? 0)}
          />
        ) : null}
        <div className="flex items-center gap-2 self-end pb-3">
          <Checkbox
            id={`${idPrefix}-auto-replenishment`}
            checked={autoReplenishment}
            onCheckedChange={(value) =>
              onAutoReplenishmentChange(value === true)
            }
          />
          <Label htmlFor={`${idPrefix}-auto-replenishment`}>
            Allow automatic replenishment call-offs
          </Label>
        </div>
      </Grid>
      <Field
        id={`${idPrefix}-service-levels`}
        label="Service levels"
        hint="Comma-separated commitments, for example delivery in 5 days, 98% fill rate."
      >
        <Input
          id={`${idPrefix}-service-levels`}
          name="service_levels"
          defaultValue={serviceLevelsText(agreement?.service_levels)}
        />
      </Field>
      <Field
        id={`${idPrefix}-documents`}
        label="Documents"
        hint="Comma-separated document names or references."
      >
        <Input
          id={`${idPrefix}-documents`}
          name="documents"
          defaultValue={joinList(agreement?.documents)}
        />
      </Field>
      <LineItemsEditor
        lines={lines}
        onChange={onLinesChange}
        references={references}
      />
    </>
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
      {lines.map((line, index) => {
        const selectedItem = references.inventory_items.find(
          (item) => item.id === line.inventory_item_id,
        );
        const selectedLabel = selectedItem
          ? `${selectedItem.sku} · ${selectedItem.name}`
          : "Unlinked";
        return (
        <div
          key={line.line_key}
          className="grid min-w-0 gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-12"
        >
          <div className="min-w-0 lg:col-span-4">
            <Label
              htmlFor={`line-${line.line_key}-description`}
              className="mb-1 block min-w-0 truncate"
              title="Description"
            >
              Description
            </Label>
            <Input
              id={`line-${line.line_key}-description`}
              value={line.description}
              onChange={(e) => update(index, "description", e.target.value)}
              required
            />
          </div>
          <div className="min-w-0 lg:col-span-3">
            <Label
              htmlFor={`line-${line.line_key}-item`}
              className="mb-1 block min-w-0 truncate"
              title="Inventory item"
            >Inventory item</Label>
            <select
              id={`line-${line.line_key}-item`}
              value={line.inventory_item_id ?? ""}
              title={selectedLabel}
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
              {references.inventory_items.map((item) => {
                const label = `${item.sku} · ${item.name}`;
                return (
                  <option key={item.id} value={item.id} title={label}>
                    {optionText(label)}
                </option>
                );
              })}
            </select>
          </div>
          <div className="min-w-0 lg:col-span-1">
            <Label
              htmlFor={`line-${line.line_key}-quantity`}
              className="mb-1 block min-w-0 truncate"
              title="Quantity"
            >Quantity</Label>
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
          <div className="min-w-0 lg:col-span-1">
            <Label
              htmlFor={`line-${line.line_key}-unit`}
              className="mb-1 block min-w-0 truncate"
              title="Unit"
            >Unit</Label>
            <Input
              id={`line-${line.line_key}-unit`}
              value={line.unit ?? "unit"}
              onChange={(e) => update(index, "unit", e.target.value)}
            />
          </div>
          <div className="min-w-0 lg:col-span-2">
            <Label
              htmlFor={`line-${line.line_key}-price`}
              className="mb-1 block min-w-0 truncate"
              title="Unit price"
            >Unit price</Label>
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
          <div className="flex items-end lg:col-span-1">
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
        );
      })}
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
    patch: Partial<ProcurementLine>,
  ) =>
    onChange(
      lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );
  if (!lines.length)
    return (
      <Alert>
        <Send aria-hidden="true" />
        <AlertTitle>Select a purchase order</AlertTitle>
        <AlertDescription>
          Ordered lines appear here so you can enter received and accepted
          quantities, lot or batch evidence, and Inventory links.
        </AlertDescription>
      </Alert>
    );
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">Delivered lines</legend>
      {lines.map((line, index) => {
        const received = Number(line.received_quantity ?? line.quantity ?? 0);
        const accepted = Number(line.accepted_quantity ?? received);
        return (
        <div
          key={line.line_key}
            className="grid gap-3 rounded-xl border p-3 md:grid-cols-3"
        >
            <div className="md:col-span-3">
            <span className="text-sm font-medium">{line.description}</span>
            <span className="block text-xs text-muted-foreground">
              Ordered {Number(line.quantity).toFixed(3)} {line.unit}
                {line.line_key ? ` · ${line.line_key}` : ""}
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
                onChange={(e) => {
                  const nextReceived = Number(e.target.value);
                  update(index, {
                    received_quantity: nextReceived,
                    rejected_quantity: Math.max(
                      0,
                      nextReceived - Number(line.accepted_quantity ?? nextReceived),
                    ),
                  });
                }}
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
                onChange={(e) => {
                  const nextAccepted = Number(e.target.value);
                  update(index, {
                    accepted_quantity: nextAccepted,
                    rejected_quantity: Math.max(0, received - nextAccepted),
                  });
                }}
              />
            </Field>
            <Field
              id={`receipt-${line.line_key}-rejected`}
              label="Rejected quantity"
            >
              <Input
                id={`receipt-${line.line_key}-rejected`}
                type="number"
                min="0"
                step="0.001"
                value={
                  line.rejected_quantity ??
                  Math.max(0, received - accepted)
                }
              onChange={(e) =>
                  update(index, {
                    rejected_quantity: Number(e.target.value),
                  })
              }
            />
          </Field>
          <Field id={`receipt-${line.line_key}-item`} label="Inventory item">
            <select
              id={`receipt-${line.line_key}-item`}
              value={line.inventory_item_id ?? ""}
              onChange={(e) =>
                  update(index, {
                    inventory_item_id: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
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
            <Field id={`receipt-${line.line_key}-lot`} label="Lot number">
              <Input
                id={`receipt-${line.line_key}-lot`}
                value={line.lot_number ?? ""}
                onChange={(e) => update(index, { lot_number: e.target.value })}
              />
            </Field>
            <Field id={`receipt-${line.line_key}-batch`} label="Batch number">
              <Input
                id={`receipt-${line.line_key}-batch`}
                value={line.batch_number ?? ""}
                onChange={(e) =>
                  update(index, { batch_number: e.target.value })
                }
              />
            </Field>
            <Field
              id={`receipt-${line.line_key}-serials`}
              label="Serial numbers"
              hint="Comma-separated"
            >
              <Input
                id={`receipt-${line.line_key}-serials`}
                value={joinList(line.serial_numbers)}
                onChange={(e) =>
                  update(index, {
                    serial_numbers: e.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Field>
            <Field id={`receipt-${line.line_key}-expiry`} label="Expiry date">
              <Input
                id={`receipt-${line.line_key}-expiry`}
                type="date"
                value={dateInputValue(line.expiry_date)}
                onChange={(e) =>
                  update(index, { expiry_date: e.target.value || null })
                }
              />
            </Field>
        </div>
        );
      })}
    </fieldset>
  );
}

export function ReportsPage() {
  const { hasAnyPermission } = usePermissions();
  const canView = hasAnyPermission([
    "view_procurement_reports",
    "manage_procurement",
  ]);
  const canExport = hasAnyPermission([
    "export_procurement_reports",
    "manage_procurement",
  ]);
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState<string | null>(null);
  const summary = useQuery({
    queryKey: ["procurement", "reports", "summary"],
    queryFn: procurementApi.reportSummary,
    enabled: canView,
  });
  const audit = useQuery({
    queryKey: ["procurement", "audit", entityType, entityId, eventFilter, page],
    queryFn: () =>
      procurementApi.auditEvents({
        per_page: 25,
        page,
        entity_type: entityType || undefined,
        entity_id: entityId ? Number(entityId) : undefined,
        event: eventFilter || undefined,
      }),
    enabled: canView,
  });
  const download = async (dataset: string, label: string) => {
    setExporting(dataset);
    try {
      const blob = await procurementApi.exportReport(dataset);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `procurement-${dataset}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`${label} export downloaded.`);
    } catch (error) {
      toast.error(getErrorMessage(error, `${label} export failed.`));
    } finally {
      setExporting(null);
    }
  };
  if (!canView) {
    return (
      <ProcurementShell
        title="Reports and audit"
        description="Export operational datasets and review the immutable procurement action trail."
      >
        <Alert>
          <Send aria-hidden="true" />
          <AlertTitle>Report permission required</AlertTitle>
          <AlertDescription>
            You need view or export report permission to access procurement
            reports and audit events.
          </AlertDescription>
        </Alert>
      </ProcurementShell>
    );
  }
  return (
    <ProcurementShell
      title="Reports and audit"
      description="Export operational datasets and review the immutable procurement action trail for management, Finance, and compliance assurance."
    >
      <div className="space-y-6">
        {summary.isPending || summary.data === undefined ? (
          <ProcurementLoading cards={4} />
        ) : summary.error ? (
          <ProcurementError error={summary.error} title="Summary unavailable" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Open orders"
              value={String(summary.data.metrics.open_orders)}
              description="Issued through received commitments."
            />
            <MetricCard
              title="Committed spend"
              value={formatMoney(summary.data.metrics.committed_spend)}
              description="Open purchase order value."
            />
            <MetricCard
              title="Match rate"
              value={`${summary.data.metrics.match_rate.toFixed(1)}%`}
              description="Matched or override-approved invoices."
            />
            <MetricCard
              title="Unmatched invoices"
              value={String(summary.data.metrics.unmatched_invoices)}
              description="Invoices with match exceptions."
            />
          </div>
        )}
      <Card>
        <CardHeader>
          <CardTitle>Export datasets</CardTitle>
          <CardDescription>
            CSV exports use the same tenant-scoped records shown in the
            workspace.
          </CardDescription>
        </CardHeader>
          <CardContent className="space-y-3">
            {canExport ? (
              <div className="flex flex-wrap gap-2">
                {[
                  ["purchase-orders", "Purchase orders"],
                  ["supplier-performance", "Supplier performance"],
                  ["invoice-matching", "Invoice matching"],
                ].map(([dataset, label]) => (
          <Button
                    key={dataset}
            variant="outline"
                    disabled={exporting !== null}
                    onClick={() => download(dataset, label)}
          >
            <Download aria-hidden="true" data-icon="inline-start" />
                    <BusyLabel busy={exporting === dataset}>{label}</BusyLabel>
          </Button>
                ))}
              </div>
            ) : (
              <Alert>
                <Send aria-hidden="true" />
                <AlertTitle>Export permission required</AlertTitle>
                <AlertDescription>
                  You can review the audit trail but cannot download CSV exports
                  with this role.
                </AlertDescription>
              </Alert>
            )}
        </CardContent>
      </Card>
      {audit.error ? (
        <ProcurementError error={audit.error} />
        ) : isProcurementListLoading(audit) ? (
          <ProcurementTableSkeleton rows={6} cols={5} />
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
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Field id="audit-entity-type" label="Record type">
                  <select
                    id="audit-entity-type"
                    value={entityType}
                    onChange={(event) => {
                      setEntityType(event.target.value);
                      setPage(1);
                    }}
                    className={fieldClass}
                  >
                    <option value="">All record types</option>
                    {AUDIT_ENTITY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="audit-entity-id" label="Record ID">
                  <Input
                    id="audit-entity-id"
                    type="number"
                    min="1"
                    value={entityId}
                    onChange={(event) => {
                      setEntityId(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Filter by numeric ID"
                  />
                </Field>
                <Field id="audit-event" label="Event">
                  <select
                    id="audit-event"
                    value={eventFilter}
                    onChange={(event) => {
                      setEventFilter(event.target.value);
                      setPage(1);
                    }}
                    className={fieldClass}
                  >
                    <option value="">All events</option>
                    {AUDIT_EVENT_TYPES.map((event) => (
                      <option key={event} value={event}>
                        {event.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <ProcurementTable<AuditEvent>
              caption="Procurement audit events in reverse chronological order."
              rows={audit.data?.data ?? []}
              getKey={(row) => row.id}
              columns={[
                {
                  key: "time",
                  label: "Occurred",
                    render: (row) =>
                      new Date(row.occurred_at).toLocaleString(),
                },
                {
                  key: "entity",
                  label: "Record",
                  render: (row) => `${row.entity_type} #${row.entity_id}`,
                },
                {
                  key: "event",
                  label: "Event",
                    render: (row) => (
                      <ProcurementStatus value={row.event} />
                    ),
                  },
                  {
                    key: "context",
                    label: "Context",
                    render: (row) => <AuditEventContext event={row} />,
                },
                {
                  key: "actor",
                  label: "Actor",
                  render: (row) =>
                    row.actor_id ? `User ${row.actor_id}` : "System",
                },
              ]}
            />
              <RequisitionPagination
                page={audit.data?.current_page ?? 1}
                lastPage={audit.data?.last_page ?? 1}
                onPageChange={setPage}
              />
          </CardContent>
        </Card>
      )}
      </div>
    </ProcurementShell>
  );
}

const AUDIT_ENTITY_TYPES = [
  "Requisition",
  "SourcingEvent",
  "SupplierBid",
  "PurchaseOrder",
  "GoodsReceipt",
  "SupplierInvoice",
  "Agreement",
] as const;

const AUDIT_EVENT_TYPES = [
  "created",
  "updated",
  "submitted",
  "approved",
  "issued",
  "confirmed",
  "received",
  "inspected",
  "stock_posted",
  "three_way_matched",
  "match",
  "override",
  "post",
  "reject",
  "award",
  "evaluated",
  "cancelled",
  "closed",
  "revise",
  "finance_bill_posted",
] as const;

function AuditEventContext({ event }: { event: AuditEvent }) {
  const context = event.context ?? {};
  const highlights = [
    context.purchase_order_id
      ? `PO ${context.purchase_order_id}`
      : null,
    context.finance_document_id
      ? `Finance doc ${context.finance_document_id}`
      : null,
    context.supplier_bid_id ? `Bid ${context.supplier_bid_id}` : null,
    event.after?.number ? `No. ${event.after.number}` : null,
    event.after?.status ? `Status ${event.after.status}` : null,
  ].filter(Boolean);
  if (!highlights.length) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span className="block max-w-56 space-y-0.5">
      {highlights.slice(0, 3).map((item) => (
        <span
          key={String(item)}
          className="block truncate text-xs text-muted-foreground"
          title={String(item)}
        >
          {item}
        </span>
      ))}
    </span>
  );
}
