"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Landmark,
  Loader2,
  Plus,
  Save,
  Settings2,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getAuthHeaders, getBackendApiRoot, getWorkspaceScopeKey } from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import type { TenantDirectTransferBankAccount } from "@/modules/subscription/types";

async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${getBackendApiRoot()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const headers: HeadersInit = getAuthHeaders(
    options.body && typeof options.body === "string" ? { "Content-Type": "application/json" } : {}
  );
  const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || "API Request Failed");
  }
  return res.json();
}

type PaymentField = {
  key: string;
  label: string;
  type: "toggle" | "text" | "password" | "number" | "csv";
  placeholder?: string;
  help?: string;
};

type ProviderState = Record<string, string | number | boolean | string[]>;

type PaymentProviderConfig = {
  key: string;
  label: string;
  description: string;
  implemented: boolean;
  configured: boolean;
  supports_payment_methods: boolean;
  requires_billing_phone: boolean;
  fields: PaymentField[];
  settings: ProviderState;
};

type PaymentSettingsData = {
  active_provider: string;
  providers: Record<string, PaymentProviderConfig>;
  direct_transfer: {
    enabled: boolean;
    configured: boolean;
    instructions: string;
    bank_accounts: TenantDirectTransferBankAccount[];
  };
};

const createEmptyBankAccount = (): TenantDirectTransferBankAccount => ({
  id: `draft-${Math.random().toString(36).slice(2, 10)}`,
  label: "",
  bank_name: "",
  account_name: "",
  account_number: "",
  branch: "",
  notes: "",
  is_active: true,
});

export function PaymentSettings() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PaymentSettingsData | null>(null);
  const [snapshot, setSnapshot] = useState<string>("");
  const workspaceScope = getWorkspaceScopeKey();

  const { data, isLoading, error } = useQuery<{ data: PaymentSettingsData }>({
    queryKey: ["payment-settings", workspaceScope],
    queryFn: () => apiFetch("/settings/payments"),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!data?.data) return;
    setDraft(data.data);
    setSnapshot(JSON.stringify(data.data));
  }, [data]);

  const providerEntries = useMemo(
    () => Object.values(draft?.providers ?? {}),
    [draft]
  );
  const dirty = draft ? JSON.stringify(draft) !== snapshot : false;

  const saveMutation = useMutation({
    mutationFn: () => apiFetch("/settings/payments", {
      method: "POST",
      body: JSON.stringify(toSettingsPayload(draft)),
    }),
    onSuccess: (response) => {
      toast.success(response?.message || "Payment settings saved.");
      if (response?.data) {
        setDraft(response.data);
        setSnapshot(JSON.stringify(response.data));
      }
      queryClient.invalidateQueries({ queryKey: ["payment-settings"] });
      queryClient.invalidateQueries({ queryKey: ["public-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-current-subscriptions"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save payment settings.");
    },
  });

  const updateProvider = (providerKey: string, fieldKey: string, value: string | number | boolean | string[]) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        providers: {
          ...prev.providers,
          [providerKey]: {
            ...prev.providers[providerKey],
            settings: {
              ...prev.providers[providerKey].settings,
              [fieldKey]: value,
            },
          },
        },
      };
    });
  };

  const updateDirectTransfer = (
    field: "enabled" | "instructions",
    value: string | boolean
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        direct_transfer: {
          ...prev.direct_transfer,
          [field]: value,
        },
      };
    });
  };

  const updateBankAccount = (
    accountId: string,
    field: keyof TenantDirectTransferBankAccount,
    value: string | boolean
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        direct_transfer: {
          ...prev.direct_transfer,
          bank_accounts: prev.direct_transfer.bank_accounts.map((account) =>
            account.id === accountId ? { ...account, [field]: value } : account
          ),
        },
      };
    });
  };

  const addBankAccount = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        direct_transfer: {
          ...prev.direct_transfer,
          bank_accounts: [...(prev.direct_transfer.bank_accounts ?? []), createEmptyBankAccount()],
        },
      };
    });
  };

  const removeBankAccount = (accountId: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        direct_transfer: {
          ...prev.direct_transfer,
          bank_accounts: prev.direct_transfer.bank_accounts.filter((account) => account.id !== accountId),
        },
      };
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !draft) {
    return (
      <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs font-mono">
          Could not load payment gateway settings. Make sure you are on the Central node.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-border/50 bg-card/40 p-6 shadow-sm backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black tracking-tight">
              <CreditCard className="h-5 w-5 text-primary" /> Payment Provider Settings
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Pick the active checkout provider for tenant signup, renewals, and add-on modules. ArifPay hosted checkout is ready, Chapa is queued next, and Telebirr is scaffolded for the next adapter.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select
              value={draft.active_provider}
              onValueChange={(value) => setDraft((prev) => prev ? ({ ...prev, active_provider: value }) : prev)}
            >
              <SelectTrigger className="w-[220px] rounded-xl bg-background">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {providerEntries.map((provider) => (
                  <SelectItem key={provider.key} value={provider.key} disabled={!provider.implemented}>
                    {provider.label}{provider.implemented ? "" : " (Adapter pending)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!dirty || saveMutation.isPending}
              className="rounded-full px-6 font-bold shadow-lg shadow-primary/20"
            >
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Providers
            </Button>
          </div>
        </div>

        {dirty ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            Changes are ready. Save to update the live checkout flow.
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {providerEntries.map((provider) => {
          const isActive = draft.active_provider === provider.key;
          const settings = provider.settings ?? {};

          return (
            <div
              key={provider.key}
              className={cn(
                "rounded-[2rem] border p-5 shadow-sm transition-all",
                isActive
                  ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border/50 bg-card/40 backdrop-blur-md"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black tracking-tight text-foreground">{provider.label}</h3>
                    {isActive ? (
                      <Badge className="bg-primary/10 text-primary border-none text-[10px] uppercase tracking-widest">
                        Active
                      </Badge>
                    ) : null}
                    {provider.configured ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[10px] uppercase tracking-widest">
                        Configured
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/10 text-amber-600 border-none text-[10px] uppercase tracking-widest">
                        Missing setup
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{provider.description}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setDraft((prev) => prev ? ({ ...prev, active_provider: provider.key }) : prev)}
                  disabled={!provider.implemented}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all",
                    isActive
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/60 bg-background text-muted-foreground hover:text-foreground",
                    !provider.implemented && "cursor-not-allowed opacity-50 hover:text-muted-foreground"
                  )}
                >
                  Use
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest">
                  {provider.requires_billing_phone ? "Phone required" : "Phone optional"}
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest">
                  {provider.supports_payment_methods ? "Method chooser" : "Hosted checkout"}
                </Badge>
                {!provider.implemented ? (
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest">
                    Adapter pending
                  </Badge>
                ) : null}
              </div>

              {!provider.implemented ? (
                <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                  Credentials can be stored now, but checkout remains disabled until the Telebirr adapter is completed.
                </div>
              ) : null}

              <div className="mt-5 space-y-4">
                {provider.fields.map((field) => {
                  const fieldValue = settings[field.key];

                  if (field.type === "toggle") {
                    return (
                      <div key={`${provider.key}-${field.key}`} className="flex items-center justify-between rounded-2xl border border-border/50 bg-background/60 px-4 py-3">
                        <div>
                          <p className="text-sm font-bold text-foreground">{field.label}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {field.key === "enabled"
                              ? "Turn this provider on or off without losing its credentials."
                              : "Use sandbox/test mode while verifying credentials and callbacks."}
                          </p>
                        </div>
                        <Switch
                          checked={Boolean(fieldValue)}
                          onCheckedChange={(checked) => updateProvider(provider.key, field.key, checked)}
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={`${provider.key}-${field.key}`} className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {field.label}
                      </Label>
                      <Input
                        type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
                        value={field.type === "csv" ? (Array.isArray(fieldValue) ? fieldValue.join(", ") : "") : String(fieldValue ?? "")}
                        placeholder={field.placeholder}
                        onChange={(event) => {
                          if (field.type === "number") {
                            updateProvider(provider.key, field.key, Number(event.target.value || 0));
                            return;
                          }

                          if (field.type === "csv") {
                            updateProvider(
                              provider.key,
                              field.key,
                              event.target.value
                                .split(",")
                                .map((value) => value.trim())
                                .filter(Boolean)
                            );
                            return;
                          }

                          updateProvider(provider.key, field.key, event.target.value);
                        }}
                        className="h-11 rounded-xl bg-background"
                      />
                      {field.help ? (
                        <p className="text-[11px] leading-relaxed text-muted-foreground">{field.help}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-[2rem] border border-border/50 bg-card/40 p-6 shadow-sm backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black tracking-tight text-foreground">
              <Landmark className="h-5 w-5 text-primary" /> Direct Bank Transfer
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Publish fallback bank accounts for customers who need to transfer funds manually and submit the bank transaction reference for admin verification.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {draft.direct_transfer.configured ? (
              <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[10px] uppercase tracking-widest">
                Ready
              </Badge>
            ) : (
              <Badge className="bg-amber-500/10 text-amber-600 border-none text-[10px] uppercase tracking-widest">
                Needs active account
              </Badge>
            )}
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Enabled</span>
              <Switch
                checked={draft.direct_transfer.enabled}
                onCheckedChange={(checked) => updateDirectTransfer("enabled", checked)}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Customer Instructions
            </Label>
            <textarea
              value={draft.direct_transfer.instructions}
              onChange={(event) => updateDirectTransfer("instructions", event.target.value)}
              className="min-h-[120px] w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
              placeholder="Tell customers which amount to transfer and how to submit the exact reference."
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">Bank Accounts</p>
              <p className="text-[11px] text-muted-foreground">
                Add as many accounts as needed. Editing is inline, and inactive accounts stay stored without being shown to customers.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={addBankAccount} className="rounded-full gap-2">
              <Plus className="h-4 w-4" /> Add Account
            </Button>
          </div>

          <div className="space-y-4">
            {draft.direct_transfer.bank_accounts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
                No direct-transfer bank accounts yet. Add one to enable the fallback payment route.
              </div>
            ) : draft.direct_transfer.bank_accounts.map((account, index) => (
              <div key={account.id} className="rounded-[1.5rem] border border-border/60 bg-background/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-foreground">Account {index + 1}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Customers will see the label, bank name, account name, and account number.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-full border border-border/60 px-3 py-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active</span>
                      <Switch
                        checked={Boolean(account.is_active)}
                        onCheckedChange={(checked) => updateBankAccount(account.id, "is_active", checked)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeBankAccount(account.id)}
                      className="rounded-full text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Display Label</Label>
                    <Input
                      value={account.label}
                      onChange={(event) => updateBankAccount(account.id, "label", event.target.value)}
                      placeholder="Main collections account"
                      className="h-11 rounded-xl bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bank Name</Label>
                    <Input
                      value={account.bank_name}
                      onChange={(event) => updateBankAccount(account.id, "bank_name", event.target.value)}
                      placeholder="Commercial Bank of Ethiopia"
                      className="h-11 rounded-xl bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Account Name</Label>
                    <Input
                      value={account.account_name}
                      onChange={(event) => updateBankAccount(account.id, "account_name", event.target.value)}
                      placeholder="Hive OS Central Collections"
                      className="h-11 rounded-xl bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Account Number</Label>
                    <Input
                      value={account.account_number}
                      onChange={(event) => updateBankAccount(account.id, "account_number", event.target.value)}
                      placeholder="1000000000000"
                      className="h-11 rounded-xl bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Branch</Label>
                    <Input
                      value={account.branch ?? ""}
                      onChange={(event) => updateBankAccount(account.id, "branch", event.target.value)}
                      placeholder="Head Office"
                      className="h-11 rounded-xl bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Internal Notes</Label>
                    <Input
                      value={account.notes ?? ""}
                      onChange={(event) => updateBankAccount(account.id, "notes", event.target.value)}
                      placeholder="Use this account for manual signup transfers"
                      className="h-11 rounded-xl bg-background"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-border/50 bg-card/40 p-6 shadow-sm backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black tracking-tight text-foreground">
              <CheckCircle2 className="h-5 w-5 text-primary" /> Direct Transfer Reviews
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Manual-transfer approvals, rejections, tenant emails, and review history now live on their own page so finance work stays separate from provider configuration.
            </p>
          </div>
          <Button asChild type="button" variant="outline" className="rounded-full gap-2">
            <Link href="/dashboard/direct-transfer-reviews">
              <Landmark className="h-4 w-4" />
              Open Review Ledger
            </Link>
          </Button>
        </div>


      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: CheckCircle2,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
            title: "Hosted Checkout",
            desc: "Keep one automated provider active for self-serve payments and subscriptions.",
          },
          {
            icon: Settings2,
            color: "text-sky-500",
            bg: "bg-sky-500/10",
            title: "Manual Fallback",
            desc: "Direct transfer stays available beside the active gateway, so signups are not blocked when the portal is down.",
          },
          {
            icon: Wrench,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
            title: "Human Review",
            desc: "Central admins can verify transaction references, activate accounts, and notify customers from one queue.",
          },
        ].map((item) => (
          <div key={item.title} className="rounded-[1.75rem] border border-border/50 bg-card/40 p-4 shadow-sm backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className={cn("rounded-2xl p-3", item.bg)}>
                <item.icon className={cn("h-5 w-5", item.color)} />
              </div>
              <div>
                <p className="text-sm font-black text-foreground">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function toSettingsPayload(draft: PaymentSettingsData | null) {
  return {
    active_provider: draft?.active_provider ?? "",
    providers: Object.fromEntries(
      Object.entries(draft?.providers ?? {}).map(([providerKey, provider]) => [
        providerKey,
        provider.settings ?? {},
      ])
    ),
    direct_transfer: {
      enabled: Boolean(draft?.direct_transfer?.enabled),
      instructions: draft?.direct_transfer?.instructions ?? "",
      bank_accounts: draft?.direct_transfer?.bank_accounts ?? [],
    },
  };
}
