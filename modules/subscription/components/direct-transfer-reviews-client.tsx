"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  CheckCircle2,
  Clock3,
  Home,
  Landmark,
  Loader2,
  SearchX,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/datatable/data-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { usePermissions } from "@/hooks/use-permissions";
import { DIRECT_TRANSFER_REVIEW_ROUTE_PERMISSIONS } from "@/lib/route-permissions";
import { getAuthHeaders, getBackendApiRoot, isTenantSession } from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import type { TenantSubscriptionOrder } from "@/modules/subscription/types";

type DirectTransferReviewResponse = {
  data: {
    orders: TenantSubscriptionOrder[];
    history: TenantSubscriptionOrder[];
    counts: {
      total: number;
      pending: number;
      approved: number;
      rejected: number;
    };
  };
};

type ReviewDialogState = {
  action: "approve" | "reject";
  order: TenantSubscriptionOrder;
};

const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${getBackendApiRoot()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const headers: HeadersInit = getAuthHeaders(
    options.body && typeof options.body === "string" ? { "Content-Type": "application/json" } : {}
  );

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).message || "API request failed.");
  }

  return response.json();
};

const formatDate = (value?: string | null) => {
  if (!value) return "Pending";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const reviewBadge = (status?: string | null) => {
  switch (status) {
    case "approved":
      return "bg-emerald-500/10 text-emerald-600";
    case "rejected":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-amber-500/10 text-amber-600";
  }
};

const reviewLabel = (order: TenantSubscriptionOrder) => {
  if (order.manual_review_status === "approved") return "Approved";
  if (order.manual_review_status === "rejected") return "Rejected";
  return "Pending Review";
};

function orderMatchesSearch(order: TenantSubscriptionOrder, search: string) {
  if (!search) return true;

  const haystack = [
    order.id,
    order.tenant_name,
    order.tenant_id,
    order.admin_name,
    order.admin_email,
    order.manual_payment_reference,
    order.manual_review_notes,
    order.manual_reviewed_by,
    order.manual_payment_bank_account_snapshot?.bank_name,
    order.manual_payment_bank_account_snapshot?.account_name,
    order.manual_payment_bank_account_snapshot?.account_number,
    order.scope,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
}

function sortOrders(orders: TenantSubscriptionOrder[], sortCol: string, sortDir: string) {
  const direction = sortDir === "asc" ? 1 : -1;

  const valueFor = (order: TenantSubscriptionOrder) => {
    switch (sortCol) {
      case "tenant":
        return `${order.tenant_name ?? ""} ${order.tenant_id ?? ""}`.trim().toLowerCase();
      case "transaction":
        return (order.manual_payment_reference ?? "").toLowerCase();
      case "admin":
        return `${order.admin_name ?? ""} ${order.admin_email ?? ""}`.trim().toLowerCase();
      case "amount":
        return Number(order.total_amount_etb ?? 0);
      case "review":
        return `${order.manual_review_status ?? ""} ${order.manual_reviewed_at ?? ""}`.trim().toLowerCase();
      case "submitted":
      default:
        return new Date(order.manual_payment_submitted_at ?? order.created_at ?? 0).getTime();
    }
  };

  return [...orders].sort((left, right) => {
    const a = valueFor(left);
    const b = valueFor(right);

    if (typeof a === "number" && typeof b === "number") {
      return (a - b) * direction;
    }

    return String(a).localeCompare(String(b), undefined, { sensitivity: "base" }) * direction;
  });
}

export function DirectTransferReviewsClient() {
  const queryClient = useQueryClient();
  const { isLoaded, hasAnyPermission } = usePermissions();
  const canReview = !isTenantSession() && hasAnyPermission([...DIRECT_TRANSFER_REVIEW_ROUTE_PERMISSIONS]);

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = useLocalStorage<number>("direct_transfer_reviews_page_size", 10);
  const [search, setSearch] = React.useState("");
  const [sortCol, setSortCol] = React.useState("submitted");
  const [sortDir, setSortDir] = React.useState("desc");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "pending" | "approved" | "rejected">("all");
  const [dialogState, setDialogState] = React.useState<ReviewDialogState | null>(null);
  const [reviewMessage, setReviewMessage] = React.useState("");
  const hasMarkedReadRef = React.useRef(false);

  const reviewsQuery = useQuery<DirectTransferReviewResponse>({
    queryKey: ["direct-transfer-review-ledger"],
    queryFn: () => apiFetch("/settings/direct-transfer/reviews"),
    enabled: isLoaded && canReview,
    staleTime: 15_000,
  });

  const markNotificationsRead = useMutation({
    mutationFn: () => apiFetch("/notifications/read", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-notifications"] });
    },
  });

  React.useEffect(() => {
    if (!isLoaded || !canReview || hasMarkedReadRef.current) return;

    hasMarkedReadRef.current = true;
    markNotificationsRead.mutate();
  }, [canReview, isLoaded, markNotificationsRead]);

  const reviewMutation = useMutation({
    mutationFn: ({ orderId, action, notes }: { orderId: string; action: "approve" | "reject"; notes?: string }) =>
      apiFetch(`/settings/direct-transfer/reviews/${orderId}/${action}`, {
        method: "POST",
        body: JSON.stringify({ notes: notes?.trim() || undefined }),
      }),
    onSuccess: (response, variables) => {
      toast.success(
        response?.message ||
          (variables.action === "approve"
            ? "Transfer approved and workspace activated."
            : "Transfer rejected and tenant notified.")
      );
      setDialogState(null);
      setReviewMessage("");
      queryClient.invalidateQueries({ queryKey: ["direct-transfer-review-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-current-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["public-catalog"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "We could not update that review.");
    },
  });

  const counts = reviewsQuery.data?.data?.counts ?? {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  };

  const allOrders = React.useMemo(
    () => reviewsQuery.data?.data?.history ?? reviewsQuery.data?.data?.orders ?? [],
    [reviewsQuery.data]
  );

  const filteredOrders = React.useMemo(() => {
    const byStatus = allOrders.filter((order) => {
      if (statusFilter === "all") return true;
      return (order.manual_review_status ?? "pending") === statusFilter;
    });

    return sortOrders(
      byStatus.filter((order) => orderMatchesSearch(order, search)),
      sortCol,
      sortDir
    );
  }, [allOrders, search, sortCol, sortDir, statusFilter]);

  const pageRows = React.useMemo(() => {
    const offset = (page - 1) * pageSize;
    return filteredOrders.slice(offset, offset + pageSize);
  }, [filteredOrders, page, pageSize]);

  const handleQueryChange = React.useCallback(
    (query: { page?: number; pageSize?: number; search?: string; sortCol?: string | null; sortDir?: string | null }) => {
      if (query.page !== undefined) setPage(query.page);
      if (query.pageSize !== undefined) setPageSize(query.pageSize);
      if (query.search !== undefined) {
        setSearch(query.search);
        if (query.page === undefined) setPage(1);
      }
      if (query.sortCol) setSortCol(query.sortCol);
      if (query.sortDir) setSortDir(query.sortDir);
    },
    [setPageSize]
  );

  const openDialog = React.useCallback((order: TenantSubscriptionOrder, action: "approve" | "reject") => {
    setDialogState({ order, action });
    setReviewMessage(
      action === "reject"
        ? "The submitted transaction ID did not match the transfer received in our bank account. Please check the reference and submit it again."
        : ""
    );
  }, []);

  const columns = React.useMemo<ColumnDef<TenantSubscriptionOrder>[]>(
    () => [
      {
        id: "tenant",
        header: "Workspace",
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="font-bold text-foreground">{row.original.tenant_name || row.original.tenant_id || "Pending workspace"}</div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px] uppercase tracking-widest">
                {String(row.original.scope).replaceAll("_", " ")}
              </Badge>
              <Badge className={cn("border-none text-[11px] uppercase tracking-widest", reviewBadge(row.original.manual_review_status))}>
                {reviewLabel(row.original)}
              </Badge>
            </div>
          </div>
        ),
      },
      {
        id: "transaction",
        header: "Transaction ID",
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="font-mono text-sm font-semibold text-foreground">
              {row.original.manual_payment_reference || "Not submitted"}
            </div>
            <div className="text-xs text-muted-foreground">
              Submitted {formatDate(row.original.manual_payment_submitted_at || row.original.created_at)}
            </div>
          </div>
        ),
      },
      {
        id: "bank",
        header: "Bank Account",
        cell: ({ row }) => {
          const account = row.original.manual_payment_bank_account_snapshot;

          if (!account) {
            return <span className="text-sm text-muted-foreground">No account snapshot</span>;
          }

          return (
            <div className="space-y-1">
              <div className="font-semibold text-foreground">{account.bank_name}</div>
              <div className="text-xs text-muted-foreground">
                {account.account_name} - {account.account_number}
              </div>
              {account.branch ? <div className="text-xs text-muted-foreground">Branch: {account.branch}</div> : null}
            </div>
          );
        },
      },
      {
        id: "admin",
        header: "Tenant Contact",
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="font-semibold text-foreground">{row.original.admin_name || "Tenant admin"}</div>
            <div className="text-xs text-muted-foreground">{row.original.admin_email || "No email captured"}</div>
            <div className="text-xs text-muted-foreground">{row.original.billing_phone || "No billing phone"}</div>
          </div>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <div className="font-semibold text-foreground">ETB {Number(row.original.total_amount_etb || 0).toFixed(2)}</div>
        ),
      },
      {
        id: "review",
        header: "Review Notes",
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="text-sm text-foreground">{row.original.manual_review_notes || "No reviewer note yet."}</div>
            {row.original.manual_reviewed_by ? (
              <div className="text-xs text-muted-foreground">
                {row.original.manual_reviewed_by} - {formatDate(row.original.manual_reviewed_at)}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const order = row.original;
          const pending = (order.manual_review_status ?? "pending") === "pending";

          if (!pending) {
            return <span className="text-xs text-muted-foreground">Completed</span>;
          }

          return (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" className="rounded-full" onClick={() => openDialog(order, "approve")}>
                Approve
              </Button>
              <Button type="button" size="sm" variant="outline" className="rounded-full text-destructive hover:text-destructive" onClick={() => openDialog(order, "reject")}>
                Reject
              </Button>
            </div>
          );
        },
      },
    ],
    [openDialog]
  );

  if (!isLoaded) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canReview) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-[2rem] border border-border/50 bg-card/40 p-8 text-center">
        <ShieldAlert className="mb-4 h-10 w-10 text-destructive" />
        <h2 className="text-2xl font-black tracking-tight">Access Denied</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Your current role does not have permission to review direct-transfer subscriptions.
        </p>
      </div>
    );
  }

  if (reviewsQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex w-full items-center justify-end gap-3">
        <Breadcrumbs
          items={[
            { label: "Hive.OS", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
            { label: "Direct Transfer Reviews" },
          ]}
        />
      </div>

      <div className="rounded-[2rem] border border-border/50 bg-card/40 p-8 shadow-sm backdrop-blur-md">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-space font-black tracking-tight text-foreground">Direct Transfer Reviews</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Verify submitted transaction IDs, activate matching subscriptions, and keep the full review history in one place.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusPill icon={Clock3} label="Pending" value={counts.pending} tone="amber" active={statusFilter === "pending"} onClick={() => setStatusFilter("pending")} />
            <StatusPill icon={CheckCircle2} label="Approved" value={counts.approved} tone="emerald" active={statusFilter === "approved"} onClick={() => setStatusFilter("approved")} />
            <StatusPill icon={XCircle} label="Rejected" value={counts.rejected} tone="destructive" active={statusFilter === "rejected"} onClick={() => setStatusFilter("rejected")} />
            <StatusPill icon={BellRing} label="All" value={counts.total} tone="neutral" active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
          </div>
        </div>
      </div>

      {reviewsQuery.error ? (
        <div className="rounded-[2rem] border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
          {(reviewsQuery.error as Error).message || "We could not load the direct-transfer review ledger."}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-[2rem] border border-border/50 bg-card/40 p-10 text-center shadow-sm backdrop-blur-md">
          <SearchX className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="text-xl font-black tracking-tight">No matching transfer reviews</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Try another filter, or wait for the next tenant submission to arrive in the queue.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={pageRows}
          totalEntries={filteredOrders.length}
          loading={reviewsQuery.isFetching}
          pageIndex={page}
          pageSize={pageSize}
          onQueryChange={handleQueryChange}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ["direct-transfer-review-ledger"] })}
          canRefresh
          title="Direct transfer review ledger"
          description="Pending and completed manual-transfer reviews"
          searchPlaceholder="Search workspace, email, transaction ID..."
          resourceName="direct transfer reviews"
        />
      )}

      <Dialog open={Boolean(dialogState)} onOpenChange={(open) => !open && !reviewMutation.isPending && setDialogState(null)}>
        <DialogContent className="rounded-[2rem] border-border/50 bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>
              {dialogState?.action === "approve" ? "Approve direct transfer" : "Reject direct transfer"}
            </DialogTitle>
            <DialogDescription>
              {dialogState?.action === "approve"
                ? "This will activate the subscription and notify the tenant immediately."
                : "This will email the tenant with your message and ask them to submit the correct transaction ID."}
            </DialogDescription>
          </DialogHeader>

          {dialogState ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-card/50 p-4 text-sm">
                <div className="font-semibold text-foreground">
                  {dialogState.order.tenant_name || dialogState.order.tenant_id || "Pending workspace"}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {dialogState.order.admin_email || "No email captured"} - ETB {Number(dialogState.order.total_amount_etb || 0).toFixed(2)}
                </div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  Transaction ID: {dialogState.order.manual_payment_reference || "Not provided"}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  {dialogState.action === "approve" ? "Internal Note" : "Email Message To Tenant"}
                </Label>
                <Textarea
                  value={reviewMessage}
                  onChange={(event) => setReviewMessage(event.target.value)}
                  placeholder={
                    dialogState.action === "approve"
                      ? "Optional note for the review history."
                      : "Explain why the transaction ID did not match and what the tenant should check before resubmitting."
                  }
                  className="min-h-[140px] rounded-2xl bg-background"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => setDialogState(null)} disabled={reviewMutation.isPending}>
              Cancel
            </Button>
            <Button
              className="rounded-full"
              variant={dialogState?.action === "reject" ? "destructive" : "default"}
              disabled={reviewMutation.isPending || !dialogState}
              onClick={() => {
                if (!dialogState) return;
                reviewMutation.mutate({
                  orderId: dialogState.order.id,
                  action: dialogState.action,
                  notes: reviewMessage,
                });
              }}
            >
              {reviewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {dialogState?.action === "approve" ? "Approve & Activate" : "Reject & Email Tenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusPill({
  icon: Icon,
  label,
  value,
  tone,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "amber" | "emerald" | "destructive" | "neutral";
  active: boolean;
  onClick: () => void;
}) {
  const toneClass = {
    amber: active ? "bg-amber-500 text-white" : "bg-amber-500/10 text-amber-600",
    emerald: active ? "bg-emerald-500 text-white" : "bg-emerald-500/10 text-emerald-600",
    destructive: active ? "bg-destructive text-destructive-foreground" : "bg-destructive/10 text-destructive",
    neutral: active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors", toneClass)}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-black">{value}</span>
    </button>
  );
}
