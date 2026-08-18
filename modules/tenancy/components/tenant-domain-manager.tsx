"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  createTenantDomain,
  deleteTenantDomain,
  fetchTenant,
  makePrimaryTenantDomain,
  updateTenantDomain,
  verifyTenantDomain,
} from "@/modules/tenancy/api";

const PLATFORM_ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost").trim();
const PLATFORM_SERVER_IP = (process.env.NEXT_PUBLIC_SERVER_IP || "").trim();
const GENERATED_WILDCARD_DOMAIN =
  PLATFORM_ROOT_DOMAIN && PLATFORM_ROOT_DOMAIN !== "localhost"
    ? `*.${PLATFORM_ROOT_DOMAIN}`
    : "*.localhost";

type TenantDomain = {
  id: number;
  domain: string;
  is_primary: boolean;
  is_fallback: boolean;
  verification_status: string;
  verification_token: string | null;
  verified_at: string | null;
  verification_record_name: string;
  verification_record_value: string | null;
  routing_record_type: string;
  routing_target: string;
  is_apex: boolean;
};

type TenantPayload = {
  id: string;
  domain: string;
  primary_domain: string;
  fallback_domain: string;
  domains: TenantDomain[];
};

type Props = {
  tenantId: string;
  onTenantUpdated?: (tenant: TenantPayload) => void;
};

export function TenantDomainManager({ tenantId, onTenantUpdated }: Props) {
  const queryClient = useQueryClient();
  const [newDomain, setNewDomain] = React.useState("");
  const [editingDomainId, setEditingDomainId] = React.useState<number | null>(null);
  const [editingValue, setEditingValue] = React.useState("");

  const tenantQuery = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: () => fetchTenant(tenantId),
    enabled: Boolean(tenantId),
  });

  const tenant = tenantQuery.data?.data as TenantPayload | undefined;
  const domains = tenant?.domains ?? [];

  const syncTenant = React.useCallback((nextTenant?: TenantPayload) => {
    if (nextTenant) {
      queryClient.setQueryData(["tenant", tenantId], { data: nextTenant });
      onTenantUpdated?.(nextTenant);
    } else {
      queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] });
    }

    queryClient.invalidateQueries({ queryKey: ["tenants"] });
  }, [onTenantUpdated, queryClient, tenantId]);

  const createDomainMutation = useMutation({
    mutationFn: (domain: string) => createTenantDomain({ tenantId, domain }),
    onSuccess: (response) => {
      toast.success(response.message || "Custom domain added.");
      setNewDomain("");
      syncTenant(response.tenant);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to add custom domain.");
    },
  });

  const updateDomainMutation = useMutation({
    mutationFn: ({ domainId, domain }: { domainId: number; domain: string }) =>
      updateTenantDomain({ tenantId, domainId, domain }),
    onSuccess: (response) => {
      toast.success(response.message || "Custom domain updated.");
      setEditingDomainId(null);
      setEditingValue("");
      syncTenant(response.tenant);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to update custom domain.");
    },
  });

  const verifyDomainMutation = useMutation({
    mutationFn: (domainId: number) => verifyTenantDomain({ tenantId, domainId }),
    onSuccess: (response) => {
      toast.success(response.message || "Verification check completed.");
      syncTenant(response.tenant);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to verify custom domain.");
    },
  });

  const makePrimaryMutation = useMutation({
    mutationFn: (domainId: number) => makePrimaryTenantDomain({ tenantId, domainId }),
    onSuccess: (response) => {
      toast.success(response.message || "Primary domain updated.");
      syncTenant(response.tenant);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to change the primary domain.");
    },
  });

  const deleteDomainMutation = useMutation({
    mutationFn: (domainId: number) => deleteTenantDomain({ tenantId, domainId }),
    onSuccess: (response) => {
      toast.success(response.message || "Custom domain removed.");
      syncTenant(response.tenant);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to remove custom domain.");
    },
  });

  const isBusy =
    createDomainMutation.isPending ||
    updateDomainMutation.isPending ||
    verifyDomainMutation.isPending ||
    makePrimaryMutation.isPending ||
    deleteDomainMutation.isPending;

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!newDomain.trim()) {
      toast.error("Enter a hostname like app.customer.com.");
      return;
    }

    createDomainMutation.mutate(newDomain.trim());
  };

  const handleUpdate = (domainId: number) => {
    if (!editingValue.trim()) {
      toast.error("Enter a hostname like app.customer.com.");
      return;
    }

    updateDomainMutation.mutate({
      domainId,
      domain: editingValue.trim(),
    });
  };

  if (tenantQuery.isLoading) {
    return (
      <div className="rounded-[1.5rem] border border-border/50 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading custom domain settings...
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="rounded-[1.5rem] border border-destructive/20 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        We couldn&apos;t load this tenant&apos;s domain settings.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-[1.5rem] border border-border/50 bg-muted/20 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Globe className="h-4 w-4 text-primary" />
            Custom Domains
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Keep the generated fallback domain as a safety net, and attach verified customer-owned domains when they want a branded address.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Primary: <span className="font-mono text-foreground">{tenant.primary_domain}</span></span>
          <span>Fallback: <span className="font-mono text-foreground">{tenant.fallback_domain}</span></span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[1.25rem] border border-border/50 bg-background/70 p-4">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Generated Subdomain Pattern</p>
          <p className="mt-2 font-mono text-xs text-foreground">{GENERATED_WILDCARD_DOMAIN}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            New tenant fallback addresses follow this wildcard automatically. If the platform root domain changes later, the next production redeploy will sync those generated fallback domains for you.
          </p>
        </div>
        <div className="rounded-[1.25rem] border border-border/50 bg-background/70 p-4">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Wildcard DNS Target</p>
          <div className="mt-2 flex items-center gap-2 font-mono text-xs text-foreground">
            <Server className="h-3.5 w-3.5 text-primary" />
            <span>{PLATFORM_SERVER_IP || "Set SERVER_IP in production .env to surface the live VPS target here."}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Keep a wildcard record like <span className="font-mono">{GENERATED_WILDCARD_DOMAIN}</span> pointed at your VPS. If you ever move the server, update <span className="font-mono">SERVER_IP</span>, redeploy, and these routing hints will stay accurate.
          </p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="rounded-[1.25rem] border border-border/50 bg-background/70 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Add Custom Domain</Label>
            <Input
              value={newDomain}
              onChange={(event) => setNewDomain(event.target.value)}
              placeholder="app.customer.com"
              className="h-11 bg-muted/30 font-mono"
              disabled={isBusy}
            />
          </div>
          <Button type="submit" className="h-11 self-end rounded-xl" disabled={isBusy}>
            {createDomainMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Add Domain
          </Button>
        </div>
      </form>

      <div className="space-y-3">
        {domains.map((domain) => {
          const isEditing = editingDomainId === domain.id;
          const isVerified = domain.verification_status === "verified";

          return (
            <div key={domain.id} className="rounded-[1.25rem] border border-border/50 bg-background/80 p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {isEditing ? (
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <Input
                          value={editingValue}
                          onChange={(event) => setEditingValue(event.target.value)}
                          className="h-10 bg-muted/30 font-mono"
                          placeholder="app.customer.com"
                          disabled={isBusy}
                        />
                        <Button size="sm" className="rounded-xl" disabled={isBusy} onClick={() => handleUpdate(domain.id)}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl"
                          disabled={isBusy}
                          onClick={() => {
                            setEditingDomainId(null);
                            setEditingValue("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <span className="truncate font-mono text-sm font-semibold text-foreground">{domain.domain}</span>
                    )}

                    {domain.is_primary && (
                      <Badge variant="outline" className="border-primary/30 bg-primary/5 text-[11px] uppercase text-primary">
                        <Star className="mr-1 h-3 w-3" /> Primary
                      </Badge>
                    )}
                    {domain.is_fallback && (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[11px] uppercase text-emerald-600">
                        Fallback
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px] uppercase",
                        isVerified
                          ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      )}
                    >
                      {isVerified ? <ShieldCheck className="mr-1 h-3 w-3" /> : <ShieldAlert className="mr-1 h-3 w-3" />}
                      {isVerified ? "Verified" : "Awaiting Verification"}
                    </Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">TXT Verification</p>
                      <p className="mt-2 font-mono text-xs text-foreground">{domain.verification_record_name}</p>
                      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{domain.verification_record_value || "Not required"}</p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Routing Record</p>
                      <p className="mt-2 font-mono text-xs text-foreground">{domain.routing_record_type}</p>
                      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{domain.routing_target}</p>
                    </div>
                  </div>

                  {domain.is_apex && (
                    <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-xs text-amber-800">
                      Apex domains like <span className="font-mono">{domain.domain}</span> usually need an ALIAS, ANAME, or provider-specific A-record setup instead of a plain CNAME.
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:w-[210px] lg:justify-end">
                  {!domain.is_fallback && !isEditing && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      disabled={isBusy}
                      onClick={() => {
                        setEditingDomainId(domain.id);
                        setEditingValue(domain.domain);
                      }}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>
                  )}
                  {!isVerified && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      disabled={isBusy}
                      onClick={() => verifyDomainMutation.mutate(domain.id)}
                    >
                      {verifyDomainMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                      Verify
                    </Button>
                  )}
                  {isVerified && !domain.is_primary && (
                    <Button
                      size="sm"
                      className="rounded-xl"
                      disabled={isBusy}
                      onClick={() => makePrimaryMutation.mutate(domain.id)}
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      Make Primary
                    </Button>
                  )}
                  {!domain.is_fallback && !domain.is_primary && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl text-destructive hover:text-destructive"
                      disabled={isBusy}
                      onClick={() => deleteDomainMutation.mutate(domain.id)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-[1.25rem] border border-border/50 bg-background/70 p-4 text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">How this behaves</p>
            <p>
              The generated fallback domain always stays available. Once a custom domain is verified, we can promote it to primary and the tenant can still fall back to the generated address if their DNS ever drifts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
