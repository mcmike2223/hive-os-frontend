"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Clock, 
  Fingerprint, 
  LayoutDashboard, 
  ShieldCheck, 
  UserCheck, 
  XCircle,
  FileText,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { DataTable } from "@/components/datatable/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchWorkflowApprovals } from "../api";
import {
  WorkflowDecisionDialog,
  getWorkflowApprovalGate,
  type ProductQaStatus,
  type WorkflowApprovalDecisionStatus,
  type WorkflowDecisionApproval,
} from "../components/workflow-decision-dialog";

import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface WorkflowPerson {
  id?: number;
  name?: string;
}

interface WorkflowRole {
  id?: number;
  name?: string;
}

interface WorkflowSubject {
  name?: string;
  subtitle?: string;
  title?: string;
  document_number?: string;
  qa_status?: ProductQaStatus;
  workflow_gate?: {
    requires_qa?: boolean;
    qa_status?: ProductQaStatus;
    can_approve?: boolean;
    can_reject?: boolean;
    message?: string;
  };
}

interface WorkflowApprovalRow extends WorkflowDecisionApproval {
  approvable?: WorkflowSubject | null;
  department?: string | null;
  status: "pending" | "approved" | "rejected";
  sequence: number;
  user?: WorkflowPerson | null;
  role?: WorkflowRole | null;
  requester?: WorkflowPerson | null;
  created_at: string;
}

type DataTableRow<T> = {
  original: T;
};

export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "requested" ? "requested" : "inbox";
  const [activeTab, setActiveTab] = React.useState<"inbox" | "requested">(initialTab);
  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, status: "pending" });
  const [decision, setDecision] = React.useState<{ approval: WorkflowApprovalRow; status: WorkflowApprovalDecisionStatus } | null>(null);

  React.useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "requested" || tab === "inbox") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ["workflow", "approvals", activeTab, tableQuery],
    queryFn: async () => {
      const result = await fetchWorkflowApprovals({
        ...tableQuery,
        type: activeTab,
        per_page: tableQuery.pageSize
      });
      console.log(`Approvals (${activeTab}) response:`, result);
      return result;
    },
  });

  const openDecisionDialog = React.useCallback((approval: WorkflowApprovalRow, status: WorkflowApprovalDecisionStatus) => {
    setDecision({ approval, status });
  }, []);

  const closeDecisionDialog = React.useCallback(() => {
    setDecision(null);
  }, []);

  const columns = React.useMemo(() => [
    {
      accessorKey: "id",
      header: "Ref ID",
      cell: ({ row }: { row: DataTableRow<WorkflowApprovalRow> }) => <span className="font-mono text-xs font-bold opacity-50">#{row.original.id}</span>,
    },
    {
      id: "target",
      header: "Subject / Document",
      cell: ({ row }: { row: DataTableRow<WorkflowApprovalRow> }) => {
        const approvable = row.original.approvable;
        const type = row.original.approvable_type.split("\\").pop();
        const qaGate = getWorkflowApprovalGate(row.original);
        
        const displayName = approvable?.name || approvable?.document_number || approvable?.title || `${type} #${row.original.approvable_id ?? row.original.id}`;
        const contextLabel = approvable?.subtitle || type;
        
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-black tracking-tight">{displayName}</span>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{contextLabel}</span>
                {qaGate.isProduct ? (
                  <Badge variant="outline" className={`rounded-full px-2 py-0 text-[10px] ${qaGate.meta.className}`}>
                    {qaGate.meta.label}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "department",
      header: "Security Context",
      cell: ({ row }: { row: DataTableRow<WorkflowApprovalRow> }) => (
        <Badge variant="outline" className="rounded-lg border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-bold text-primary uppercase tracking-wider">
          {row.original.department || "General"}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: { row: DataTableRow<WorkflowApprovalRow> }) => {
        const status = row.original.status;
        if (status === "pending") return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 rounded-full px-3 gap-1">
            <Clock className="h-3 w-3" /> Pending Signature
          </Badge>
        );
        if (status === "approved") return (
          <Badge className="bg-emerald-500 text-white border-none rounded-full px-3 gap-1 shadow-sm">
            <ShieldCheck className="h-3 w-3" /> Cleared
          </Badge>
        );
        return (
          <Badge className="bg-rose-500 text-white border-none rounded-full px-3 gap-1 shadow-sm">
            <AlertCircle className="h-3 w-3" /> Denied
          </Badge>
        );
      },
    },
    {
      accessorKey: "sequence",
      header: "Step",
      cell: ({ row }: { row: DataTableRow<WorkflowApprovalRow> }) => (
        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-[10px] font-black">
          {row.original.sequence}
        </div>
      ),
    },
    {
      accessorKey: "approver",
      header: activeTab === "requested" ? "Assigned To" : "Originator",
      cell: ({ row }: { row: DataTableRow<WorkflowApprovalRow> }) => {
        const user = activeTab === "requested" ? row.original.user : row.original.requester;
        const role = row.original.role;
        
        if (activeTab === "requested" && role) {
          return (
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-indigo-500/10 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                <ShieldCheck className="h-3 w-3" />
              </div>
              <span className="text-xs font-medium">{role.name} (Role)</span>
            </div>
          );
        }

        return (
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
              {user?.name?.charAt(0) || "U"}
            </div>
            <span className="text-xs font-medium">{user?.name || "Unknown"}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "created_at",
      header: "Assigned",
      cell: ({ row }: { row: DataTableRow<WorkflowApprovalRow> }) => <span className="text-sm text-muted-foreground">{format(new Date(row.original.created_at), "PPP p")}</span>,
    },
    {
      id: "actions",
      header: "Authorize",
      cell: ({ row }: { row: DataTableRow<WorkflowApprovalRow> }) => {
        if (activeTab === "requested") return null;
        if (row.original.status !== "pending") return null;
        const qaGate = getWorkflowApprovalGate(row.original);
        const showApprove = qaGate.canApprove;
        const showReject = qaGate.canReject;
        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              {showApprove ? (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 rounded-lg border-emerald-500/30 text-emerald-600 hover:bg-emerald-500 hover:text-white"
                  onClick={() => openDecisionDialog(row.original, "approved")}
                >
                  <UserCheck className="h-3.5 w-3.5 mr-1" />
                  Approve
                </Button>
              ) : null}
              {showReject ? (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 rounded-lg border-rose-500/30 text-rose-600 hover:bg-rose-500 hover:text-white"
                  onClick={() => openDecisionDialog(row.original, "rejected")}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Reject
                </Button>
              ) : null}
            </div>
            {qaGate.isProduct && !showApprove ? (
              <span className="max-w-[220px] text-[10px] font-medium leading-snug text-muted-foreground">
                {qaGate.message}
              </span>
            ) : null}
          </div>
        );
      },
    },
  ], [activeTab, openDecisionDialog]);

  const handleQueryChange = React.useCallback((next: Partial<typeof tableQuery>) => {
    setTableQuery(prev => {
      const hasChanged = Object.keys(next).some((key) => next[key as keyof typeof tableQuery] !== prev[key as keyof typeof tableQuery]);
      if (!hasChanged) return prev;
      return { ...prev, ...next };
    });
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.5rem] bg-primary text-primary-foreground shadow-2xl shadow-primary/30">
              <Fingerprint className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight font-space">Universal Approvals</h1>
              <p className="text-sm text-muted-foreground font-medium">Authorized clearing center for cross-module operations.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="glass-panel border border-border/40 bg-card/40 p-6 rounded-[2rem] backdrop-blur-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock className="h-12 w-12" />
          </div>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
            {activeTab === "inbox" ? "Awaiting Action" : "Total Requests"}
          </p>
          <p className="text-4xl font-black mt-2 text-yellow-600">{data?.total ?? 0}</p>
          <div className="h-1 w-12 bg-yellow-500 mt-4 rounded-full" />
        </div>

        <div className="glass-panel border border-border/40 bg-card/40 p-6 rounded-[2rem] backdrop-blur-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ShieldCheck className="h-12 w-12" />
          </div>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Protocol Health</p>
          <p className="text-4xl font-black mt-2 text-primary">Active</p>
          <div className="h-1 w-12 bg-primary mt-4 rounded-full" />
        </div>

        <div className="glass-panel border border-border/40 bg-card/40 p-6 rounded-[2rem] backdrop-blur-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <LayoutDashboard className="h-12 w-12" />
          </div>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Global Reach</p>
          <p className="text-4xl font-black mt-2">Verified</p>
          <div className="h-1 w-12 bg-foreground/20 mt-4 rounded-full" />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "inbox" | "requested")} className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-2xl mb-6">
          <TabsTrigger value="inbox" className="rounded-xl px-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Inbox
          </TabsTrigger>
          <TabsTrigger value="requested" className="rounded-xl px-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            My Requests
          </TabsTrigger>
        </TabsList>

        <div className="rounded-[2.5rem] border border-border/40 bg-card/30 backdrop-blur-xl overflow-hidden shadow-2xl">
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            totalEntries={data?.total ?? 0}
            loading={isLoading}
            resourceName="approvals"
            searchPlaceholder="Search approvals by subject..."
            onQueryChange={handleQueryChange}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ["workflow", "approvals"] })}
          />
        </div>
      </Tabs>

      <WorkflowDecisionDialog
        open={Boolean(decision)}
        approval={decision?.approval ?? null}
        status={decision?.status ?? null}
        onOpenChange={(open) => !open && closeDecisionDialog()}
        onSubmitted={() => {
          queryClient.invalidateQueries({ queryKey: ["workflow", "approvals"] });
          queryClient.invalidateQueries({ queryKey: ["workflow-dashboard"] });
          closeDecisionDialog();
        }}
      />
    </div>
  );
}
