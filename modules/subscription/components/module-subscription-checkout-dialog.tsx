"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { CreditCard, Landmark, Loader2, LockKeyhole, Phone, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import { syncUserSession } from "@/lib/auth-sync";
import { getAppOrigin } from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import {
  startCurrentTenantSubscriptionCheckout,
  startCurrentTenantSubscriptionRenewal,
} from "@/modules/subscription/api";
import type {
  TenantCatalogModule,
  TenantDirectTransferSettings,
  TenantPaymentMethod,
  TenantPaymentProvider,
  TenantSubscriptionOrder,
} from "@/modules/subscription/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modules: TenantCatalogModule[];
  paymentMethods?: TenantPaymentMethod[];
  paymentProvider?: TenantPaymentProvider | null;
  directTransfer?: TenantDirectTransferSettings | null;
  mode?: "upgrade" | "renewal";
  estimatedTotalOverride?: number;
  title?: string;
  description?: string;
  onOrderCreated?: (order: TenantSubscriptionOrder) => void;
};

type CheckoutError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

export function ModuleSubscriptionCheckoutDialog({
  open,
  onOpenChange,
  modules,
  paymentMethods = [
    { code: "TELEBIRR_USSD", label: "Telebirr" },
    { code: "CBE", label: "Commercial Bank of Ethiopia" },
    { code: "CARD", label: "Card" },
  ],
  paymentProvider,
  directTransfer,
  mode = "upgrade",
  estimatedTotalOverride,
  title = "Unlock Module Access",
  description = "Complete checkout to activate the selected tenant modules.",
  onOrderCreated,
}: Props) {
  const { hasAnyPermission } = usePermissions();
  const canManageSubscriptions = hasAnyPermission(["manage_module_subscriptions"]);
  const providerLabel = paymentProvider?.label ?? "Payment Provider";
  const providerMethods = React.useMemo(
    () => (paymentProvider?.payment_methods?.length ? paymentProvider.payment_methods : paymentMethods),
    [paymentMethods, paymentProvider?.payment_methods]
  );
  const supportsPaymentMethods = paymentProvider?.supports_payment_methods ?? providerMethods.length > 0;
  const requiresBillingPhone = paymentProvider?.requires_billing_phone ?? true;
  const directTransferEnabled = Boolean(
    directTransfer?.enabled && directTransfer?.configured && directTransfer.bank_accounts?.length
  );

  const [billingPhone, setBillingPhone] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState(providerMethods[0]?.code ?? "");
  const [checkoutChannel, setCheckoutChannel] = React.useState<"gateway" | "direct_transfer">("gateway");
  const [manualBankAccountId, setManualBankAccountId] = React.useState("");
  const [manualTransactionReference, setManualTransactionReference] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setBillingPhone("");
      setPaymentMethod(providerMethods[0]?.code ?? "");
      setCheckoutChannel("gateway");
      setManualBankAccountId("");
      setManualTransactionReference("");
    }
  }, [open, providerMethods]);

  React.useEffect(() => {
    if (!supportsPaymentMethods) {
      setPaymentMethod("");
      return;
    }

    if (!providerMethods.some((method) => method.code === paymentMethod)) {
      setPaymentMethod(providerMethods[0]?.code ?? "");
    }
  }, [paymentMethod, providerMethods, supportsPaymentMethods]);

  React.useEffect(() => {
    if (!directTransferEnabled && checkoutChannel === "direct_transfer") {
      setCheckoutChannel("gateway");
    }
  }, [checkoutChannel, directTransferEnabled]);

  const estimatedTotal = React.useMemo(
    () => estimatedTotalOverride ?? modules.reduce((sum, module) => {
      if (module.included_in_plan) {
        return sum;
      }

      return sum + Number(module.monthly_price_etb ?? 0);
    }, 0),
    [estimatedTotalOverride, modules]
  );

  const gatewaySelected = checkoutChannel === "gateway";
  const directTransferSelected = checkoutChannel === "direct_transfer";

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        billing_phone: gatewaySelected ? billingPhone.trim() || undefined : undefined,
        payment_method: gatewaySelected && supportsPaymentMethods ? paymentMethod || undefined : undefined,
        checkout_channel: directTransferSelected ? "direct_transfer" : "gateway",
        manual_bank_account_id: directTransferSelected ? manualBankAccountId || undefined : undefined,
        manual_transaction_reference: directTransferSelected ? manualTransactionReference.trim() || undefined : undefined,
        success_url_base: getAppOrigin(),
        cancel_url_base: getAppOrigin(),
      };

      if (mode === "renewal") {
        return startCurrentTenantSubscriptionRenewal(payload);
      }

      return startCurrentTenantSubscriptionCheckout({
        ...payload,
        modules: modules.map((module) => module.slug),
      });
    },
    onSuccess: async (response) => {
      const order = response?.data?.order as TenantSubscriptionOrder | undefined;

      if (!order) {
        toast.error("The checkout order payload was incomplete.");
        return;
      }

      onOrderCreated?.(order);

      if (order.provider_checkout_url) {
        window.location.href = order.provider_checkout_url;
        return;
      }

      if (order.status === "pending_manual_review") {
        toast.success(
          mode === "renewal"
            ? "Direct transfer submitted. The renewal will activate after admin verification."
            : "Direct transfer submitted. The selected modules will activate after admin verification."
        );
        onOpenChange(false);
        return;
      }

      await syncUserSession();
      toast.success(mode === "renewal" ? "The tenant subscription has been renewed." : "The requested modules are active now.");
      onOpenChange(false);
    },
    onError: (error: CheckoutError) => {
      toast.error(error?.response?.data?.message || "Unable to start checkout right now.");
    },
  });

  const checkoutDisabled = checkoutMutation.isPending
    || (gatewaySelected && requiresBillingPhone && billingPhone.trim().length < 9)
    || (gatewaySelected && supportsPaymentMethods && !paymentMethod)
    || (directTransferSelected && !manualBankAccountId)
    || (directTransferSelected && manualTransactionReference.trim().length < 4);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,760px)] flex-col overflow-hidden rounded-[2rem] border-border/60 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:max-w-lg">
        <div className="shrink-0 border-b border-border/50 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
              <LockKeyhole className="h-5 w-5 text-primary" /> {title}
            </DialogTitle>
            <DialogDescription className="pt-1 text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="space-y-3 rounded-[1.5rem] border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                {mode === "renewal" ? "Plan & Modules" : "Modules"}
              </p>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-widest">
                {modules.length} selected
              </Badge>
            </div>

            <div className="space-y-2">
              {modules.map((module) => (
                <div
                  key={module.slug}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-border/50 bg-background/80 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-foreground">{module.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {module.description}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 rounded-full px-3 py-1 text-[11px] uppercase tracking-widest">
                    {module.included_in_plan ? "Included" : `ETB ${Number(module.monthly_price_etb ?? 0).toFixed(0)}`}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {!canManageSubscriptions ? (
            <div className="rounded-[1.5rem] border border-amber-300/40 bg-amber-50/60 px-4 py-5 text-sm text-amber-800">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Your current role can view locked modules, but a tenant administrator with
                  `manage_module_subscriptions` permission must complete checkout.
                </p>
              </div>
            </div>
          ) : (
            <>
              {directTransferEnabled ? (
                <div className="space-y-3">
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                    Payment Path
                  </Label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setCheckoutChannel("gateway")}
                      className={cn(
                        "rounded-[1.5rem] border p-4 text-left transition-all",
                        gatewaySelected
                          ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                          : "border-border/60 bg-background/70"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
                          <CreditCard className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{providerLabel}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Use the live gateway for automatic confirmation.
                          </p>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckoutChannel("direct_transfer")}
                      className={cn(
                        "rounded-[1.5rem] border p-4 text-left transition-all",
                        directTransferSelected
                          ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                          : "border-border/60 bg-background/70"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
                          <Landmark className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground">Direct Bank Transfer</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Customer transfers manually, then submits the bank reference for review.
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              ) : null}

              {gatewaySelected ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                        {requiresBillingPhone ? "Billing Phone" : "Contact Phone"}
                      </Label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={billingPhone}
                          onChange={(event) => setBillingPhone(event.target.value)}
                          placeholder={requiresBillingPhone ? "2519XXXXXXXX" : "Optional"}
                          className="h-11 bg-background pl-9"
                        />
                      </div>
                    </div>

                    {supportsPaymentMethods ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                          Payment Method
                        </Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger className="h-11 bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border/60">
                            {providerMethods.map((method) => (
                              <SelectItem key={method.code} value={method.code}>
                                {method.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                          Checkout Provider
                        </Label>
                        <div className="flex h-11 items-center rounded-xl border border-border/60 bg-background px-3 text-sm font-medium text-foreground">
                          {providerLabel}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {directTransfer?.instructions ? (
                    <div className="rounded-[1.5rem] border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                      {directTransfer.instructions}
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                      Bank Account
                    </Label>
                    <Select value={manualBankAccountId} onValueChange={setManualBankAccountId}>
                      <SelectTrigger className="h-11 bg-background">
                        <SelectValue placeholder="Choose the account the customer used" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/60">
                        {(directTransfer?.bank_accounts ?? []).map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.label} · {account.bank_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {manualBankAccountId ? (
                    <div className="rounded-[1.5rem] border border-border/60 bg-background/70 px-4 py-3 text-sm">
                      {(() => {
                        const selectedAccount = (directTransfer?.bank_accounts ?? []).find((account) => account.id === manualBankAccountId);
                        if (!selectedAccount) {
                          return null;
                        }

                        return (
                          <>
                            <p className="font-bold text-foreground">{selectedAccount.label}</p>
                            <p className="mt-1 text-muted-foreground">
                              {selectedAccount.bank_name} · {selectedAccount.account_name} · {selectedAccount.account_number}
                            </p>
                            {selectedAccount.branch ? (
                              <p className="mt-1 text-xs text-muted-foreground">Branch: {selectedAccount.branch}</p>
                            ) : null}
                            {selectedAccount.notes ? (
                              <p className="mt-2 text-xs text-muted-foreground">{selectedAccount.notes}</p>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                      Transaction Reference
                    </Label>
                    <Input
                      value={manualTransactionReference}
                      onChange={(event) => setManualTransactionReference(event.target.value)}
                      placeholder="Paste the bank transfer ID exactly as it appears on the receipt"
                      className="h-11 bg-background"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between rounded-[1.5rem] border border-border/60 bg-background/70 px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
                    {directTransferSelected ? (
                      <Landmark className="h-5 w-5 text-primary" />
                    ) : (
                      <CreditCard className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                      {mode === "renewal" ? "Estimated Renewal Charge" : "Estimated Monthly Charge"}
                    </p>
                    <p className="mt-1 text-lg font-black tracking-tight text-foreground">
                      ETB {estimatedTotal.toFixed(0)}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-widest">
                  {directTransferSelected ? "Direct Transfer" : providerLabel}
                </Badge>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border/50 px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {canManageSubscriptions ? (
            <Button
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutDisabled}
              className="rounded-xl px-6 font-semibold"
            >
              {checkoutMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {directTransferSelected
                ? (mode === "renewal" ? "Submit Renewal Transfer" : "Submit Transfer Reference")
                : (mode === "renewal" ? `Renew with ${providerLabel}` : `Continue to ${providerLabel}`)}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
