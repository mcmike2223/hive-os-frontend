"use client";

import Link from "next/link";
import { ArrowRight, CircleAlert, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { procurementApi } from "@/modules/procurement/api";
import type {
  PurchaseOrder,
  Requisition,
  SupplierInvoice,
  SupplierProfile,
} from "@/modules/procurement/types";
import { ProcurementCharts } from "@/modules/procurement/pages/components/procurement-charts";
import {
  formatMoney,
  MetricCard,
  ProcurementError,
  ProcurementLoading,
  ProcurementShell,
  ProcurementStatus,
  ProcurementTable,
  ProcurementTableSkeleton,
} from "@/modules/procurement/pages/components/procurement-shell";

export default function ProcurementOverviewPage() {
  const query = useQuery({
    queryKey: ["procurement", "dashboard"],
    queryFn: procurementApi.dashboard,
  });
  return (
    <ProcurementShell
      title="Procurement control tower"
      description="Follow every commitment from a budget-backed request through fair supplier competition, delivery quality, invoice matching, and the finance ledger."
      actions={
        <Button asChild>
          <Link href="/dashboard/procurement/requisitions#create">
            Create requisition
            <ArrowRight aria-hidden="true" data-icon="inline-end" />
          </Link>
        </Button>
      }
    >
      {query.isLoading ? (
        <>
          <ProcurementLoading />
          <div className="grid gap-6 xl:grid-cols-3">
            <ProcurementTableSkeleton rows={4} cols={3} />
            <ProcurementTableSkeleton rows={4} cols={3} />
            <ProcurementTableSkeleton rows={4} cols={3} />
          </div>
          <ProcurementTableSkeleton rows={5} cols={5} />
        </>
      ) : query.error || !query.data ? (
        <ProcurementError error={query.error} />
      ) : (
        <Dashboard data={query.data} />
      )}
    </ProcurementShell>
  );
}

function Dashboard({
  data,
}: {
  data: Awaited<ReturnType<typeof procurementApi.dashboard>>;
}) {
  const attention =
    data.metrics.requisitions_pending +
    data.metrics.overdue_deliveries +
    data.metrics.unmatched_invoices;
  return (
    <>
      <Alert>
        {attention ? (
          <CircleAlert aria-hidden="true" />
        ) : (
          <ShieldCheck aria-hidden="true" />
        )}
        <AlertTitle>
          {attention
            ? `${attention} control item${attention === 1 ? "" : "s"} need action`
            : "Source-to-pay controls are clear"}
        </AlertTitle>
        <AlertDescription>
          {data.metrics.requisitions_pending} requisitions await approval,{" "}
          {data.metrics.overdue_deliveries} deliveries are overdue, and{" "}
          {data.metrics.unmatched_invoices} supplier invoices have match
          exceptions.
        </AlertDescription>
      </Alert>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Committed spend"
          value={formatMoney(data.metrics.committed_spend)}
          description={`${data.metrics.open_orders} open purchase order(s).`}
          href="/dashboard/procurement/orders"
        />
        <MetricCard
          title="Three-way match rate"
          value={`${data.metrics.match_rate.toFixed(1)}%`}
          description="Matched or authorized supplier invoices."
          status={data.metrics.unmatched_invoices ? "exception" : "matched"}
          href="/dashboard/procurement/invoices"
        />
        <MetricCard
          title="Quality pass rate"
          value={`${data.metrics.quality_pass_rate.toFixed(1)}%`}
          description="Inspected receipts accepted by quality control."
          href="/dashboard/procurement/receiving"
        />
        <MetricCard
          title="Eligible suppliers"
          value={data.metrics.eligible_suppliers}
          description="Qualified suppliers available for sourcing."
          href="/dashboard/procurement/suppliers"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Active sourcing events"
          value={data.metrics.sourcing_active}
          description="Published or under bid evaluation."
          href="/dashboard/procurement/sourcing"
        />
        <MetricCard
          title="Overdue deliveries"
          value={data.metrics.overdue_deliveries}
          description="Expected dates passed on open orders."
          status={data.metrics.overdue_deliveries ? "overdue" : "clear"}
          href="/dashboard/procurement/orders"
        />
        <MetricCard
          title="Agreements expiring"
          value={data.metrics.agreements_expiring}
          description="Framework or blanket agreements ending within 60 days."
          href="/dashboard/procurement/agreements"
        />
      </div>
      <RequisitionPipeline rows={data.pipeline} />
      <ProcurementCharts data={data} />
      <section
        aria-label="Procurement attention queues"
        className="grid min-w-0 gap-6 xl:grid-cols-3"
      >
        <AttentionRequisitions rows={data.attention.requisitions} />
        <AttentionOrders rows={data.attention.orders} />
        <AttentionInvoices rows={data.attention.invoices} />
      </section>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>
              <h2>Supplier performance leaders</h2>
            </CardTitle>
            <CardDescription>
              Operational scores are recalculated from inspection outcomes,
              delivery timeliness, and invoice accuracy.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/procurement/suppliers">View suppliers</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <ProcurementTable<SupplierProfile>
            caption="Top suppliers ranked by composite procurement performance."
            rows={data.top_suppliers}
            getKey={(row) => row.id}
            columns={[
              {
                key: "supplier",
                label: "Supplier",
                render: (row) => (
                  <Link
                    href="/dashboard/procurement/suppliers"
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {row.supplier?.name ?? `Supplier ${row.supplier_id}`}
                  </Link>
                ),
              },
              {
                key: "quality",
                label: "Quality",
                align: "right",
                render: (row) => `${Number(row.quality_score).toFixed(0)}%`,
              },
              {
                key: "delivery",
                label: "Delivery",
                align: "right",
                render: (row) => `${Number(row.delivery_score).toFixed(0)}%`,
              },
              {
                key: "accuracy",
                label: "Invoice accuracy",
                align: "right",
                render: (row) =>
                  `${Number(row.invoice_accuracy_score).toFixed(0)}%`,
              },
              {
                key: "overall",
                label: "Overall",
                align: "right",
                render: (row) => (
                  <strong>{Number(row.overall_score).toFixed(1)}%</strong>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>
    </>
  );
}

function RequisitionPipeline({
  rows,
}: {
  rows: Array<{ status: string; count: number; value: number }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>
            <h2>Requisition pipeline</h2>
          </CardTitle>
          <CardDescription>
            Count and estimated value by requisition status across the tenant.
          </CardDescription>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/procurement/requisitions">View requisitions</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <ProcurementTable
          caption="Requisition pipeline by status."
          rows={rows}
          getKey={(row) => row.status}
          columns={[
            {
              key: "status",
              label: "Status",
              render: (row) => <ProcurementStatus value={row.status} />,
            },
            {
              key: "count",
              label: "Count",
              align: "right",
              render: (row) => row.count,
            },
            {
              key: "value",
              label: "Estimated value",
              align: "right",
              render: (row) => formatMoney(row.value),
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}

function AttentionRequisitions({ rows }: { rows: Requisition[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>
            <h2>Approval queue</h2>
          </CardTitle>
          <CardDescription>
            Requisitions waiting for management approval.
          </CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/procurement/requisitions">Open</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <ProcurementTable
          caption="Purchase requisitions requiring attention."
          rows={rows}
          getKey={(row) => row.id}
          columns={[
            {
              key: "request",
              label: "Request",
              render: (row) => (
                <Link
                  href="/dashboard/procurement/requisitions"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {row.number}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {row.title}
                  </span>
                </Link>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (row) => <ProcurementStatus value={row.status} />,
            },
            {
              key: "value",
              label: "Value",
              align: "right",
              render: (row) => formatMoney(row.estimated_total, row.currency),
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}

function AttentionOrders({ rows }: { rows: PurchaseOrder[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>
            <h2>Overdue deliveries</h2>
          </CardTitle>
          <CardDescription>
            Open orders past their expected delivery date.
          </CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/procurement/orders">Open</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <ProcurementTable
          caption="Purchase orders requiring receiving follow-up."
          rows={rows}
          getKey={(row) => row.id}
          columns={[
            {
              key: "order",
              label: "Order",
              render: (row) => (
                <Link
                  href="/dashboard/procurement/receiving"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {row.number}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {row.supplier?.name ?? "Supplier"}
                    {row.expected_on ? ` · due ${row.expected_on}` : ""}
                  </span>
                </Link>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (row) => <ProcurementStatus value={row.status} />,
            },
            {
              key: "received",
              label: "Received",
              align: "right",
              render: (row) => `${Number(row.received_percent).toFixed(0)}%`,
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}

function AttentionInvoices({ rows }: { rows: SupplierInvoice[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>
            <h2>Match exceptions</h2>
          </CardTitle>
          <CardDescription>
            Invoices waiting for goods receipt or discrepancy resolution.
          </CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/procurement/invoices">Open</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <ProcurementTable
          caption="Supplier invoices requiring matching action."
          rows={rows}
          getKey={(row) => row.id}
          columns={[
            {
              key: "invoice",
              label: "Invoice",
              render: (row) => (
                <Link
                  href="/dashboard/procurement/invoices"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {row.number}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {row.supplier_invoice_number}
                  </span>
                </Link>
              ),
            },
            {
              key: "match",
              label: "Match",
              render: (row) => <ProcurementStatus value={row.match_status} />,
            },
            {
              key: "value",
              label: "Value",
              align: "right",
              render: (row) => formatMoney(row.total, row.currency),
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}
