"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, Clock, Mail, Phone, Building2, Users,
  X, Check, XCircle, Eye, Bell, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchDemoRequests, updateDemoRequest } from "@/modules/subscription/api";
import { usePermissions } from "@/hooks/use-permissions";
import { isTenantSession } from "@/lib/runtime-context";

type DemoRequest = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string;
  company_size: string | null;
  interests: string[];
  message: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
};

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "bg-amber-500", icon: Clock },
  contacted: { label: "Contacted", color: "bg-blue-500", icon: Mail },
  scheduled: { label: "Scheduled", color: "bg-purple-500", icon: CheckCircle2 },
  completed: { label: "Completed", color: "bg-emerald-500", icon: Check },
  declined: { label: "Declined", color: "bg-destructive", icon: XCircle },
};

export default function DemoRequestsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasAnyPermission, isLoaded } = usePermissions();
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const canViewDemoRequests = hasAnyPermission([
    "view_demo_requests",
    "manage_demo_requests",
    "process_demo_requests",
    "manage_tenants",
  ]);

  React.useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (isTenantSession() || !canViewDemoRequests) {
      router.replace("/dashboard/subscriptions");
    }
  }, [canViewDemoRequests, isLoaded, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["demo-requests", statusFilter],
    queryFn: () => fetchDemoRequests(statusFilter === "all" ? undefined : statusFilter),
    enabled: isLoaded && canViewDemoRequests && !isTenantSession(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: number; status: string; notes?: string }) =>
      updateDemoRequest(id, { status, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demo-requests"] });
    },
  });

  const requests: DemoRequest[] = data?.data || [];
  const filteredRequests = statusFilter === "all" 
    ? requests 
    : requests.filter((r) => r.status === statusFilter);

  const statusCounts = requests.reduce((acc, req) => {
    acc[req.status] = (acc[req.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pendingCount = statusCounts["pending"] || 0;

  if (!isLoaded || !canViewDemoRequests || isTenantSession()) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/subscriptions">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Subscriptions
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Demo Requests</h1>
            {pendingCount > 0 && (
              <Badge className="bg-amber-500 text-white">
                {pendingCount} pending
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {Object.entries(STATUS_CONFIG).map(([status, config]) => {
            const Icon = config.icon;
            const count = statusCounts[status] || 0;
            return (
              <Card
                key={status}
                className={`cursor-pointer transition-all ${
                  statusFilter === status ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.color}/10`}>
                    <Icon className={`h-5 w-5 text-${config.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{config.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filter */}
        <div className="mb-6 flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Requests</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Requests List */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-8 text-center text-destructive">
              Failed to load demo requests
            </CardContent>
          </Card>
        ) : filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No demo requests found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <DemoRequestCard
                key={request.id}
                request={request}
                onUpdate={(status, notes) =>
                  updateMutation.mutate({ id: request.id, status, notes })
                }
                isUpdating={updateMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DemoRequestCard({
  request,
  onUpdate,
  isUpdating,
}: {
  request: DemoRequest;
  onUpdate: (status: string, notes?: string) => void;
  isUpdating: boolean;
}) {
  const [showDetails, setShowDetails] = React.useState(false);
  const [notes, setNotes] = React.useState(request.notes || "");
  const statusConfig = STATUS_CONFIG[request.status as keyof typeof STATUS_CONFIG];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <h3 className="font-semibold text-lg">
                {request.first_name} {request.last_name}
              </h3>
              <Badge className={`${statusConfig?.color} text-white`}>
                {statusConfig?.label}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${request.email}`} className="text-primary hover:underline">
                  {request.email}
                </a>
              </div>
              {request.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{request.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{request.company}</span>
              </div>
              {request.company_size && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{request.company_size}</span>
                </div>
              )}
            </div>

            {request.interests && request.interests.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {request.interests.map((interest) => (
                  <Badge key={interest} variant="outline">{interest}</Badge>
                ))}
              </div>
            )}

            {showDetails && (
              <div className="mt-4 space-y-3">
                {request.message && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-semibold mb-1">Message:</p>
                    <p className="text-sm text-muted-foreground">{request.message}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-semibold">Notes:</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full mt-1 p-2 border rounded-md text-sm"
                    rows={3}
                    placeholder="Add internal notes..."
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 ml-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            {request.status === "pending" && (
              <>
                <Button
                  size="sm"
                  onClick={() => onUpdate("contacted", notes)}
                  disabled={isUpdating}
                  className="gap-2"
                >
                  <Mail className="h-4 w-4" />
                  Mark Contacted
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUpdate("scheduled", notes)}
                  disabled={isUpdating}
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Schedule
                </Button>
              </>
            )}
            {request.status === "contacted" && (
              <Button
                size="sm"
                onClick={() => onUpdate("completed", notes)}
                disabled={isUpdating}
                className="gap-2"
              >
                <Check className="h-4 w-4" />
                Complete
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
