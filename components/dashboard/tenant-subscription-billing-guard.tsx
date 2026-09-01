"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, CreditCard, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Progress } from "@/components/ui/progress";
import { usePermissions } from "@/hooks/use-permissions";
import { isTenantSession } from "@/lib/runtime-context";
import {
  dismissCurrentTenantSubscriptionReminder,
  fetchCurrentTenantSubscriptions,
  recordCurrentTenantSubscriptionReminder,
} from "@/modules/subscription/api";
import type { TenantWorkspaceSubscription } from "@/modules/subscription/types";

const ACCESS_STATUSES = ["active", "trial", "grace_period"];

const formatCountdown = (totalSeconds: number | null) => {
  if (totalSeconds === null) return "Activation payment required";
  if (totalSeconds <= 0) return "Payment overdue";

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

export function TenantSubscriptionBillingGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { hasAnyPermission, isLoaded } = usePermissions();
  const tenantSession = typeof window !== "undefined" && isTenantSession();
  const canManage = isLoaded && hasAnyPermission(["manage_module_subscriptions"]);
  const [now, setNow] = React.useState(() => Date.now());
  const [reminderOpen, setReminderOpen] = React.useState(false);
  const recordedReminder = React.useRef<string | null>(null);

  const { data } = useQuery({
    queryKey: ["tenant-current-subscriptions"],
    queryFn: fetchCurrentTenantSubscriptions,
    enabled: tenantSession && canManage,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const subscription: TenantWorkspaceSubscription | undefined = data?.data?.subscription;
  const nextPaymentAt = subscription?.next_payment_at ?? subscription?.expires_at ?? null;
  const remainingSeconds = nextPaymentAt
    ? Math.max(0, Math.floor((new Date(nextPaymentAt).getTime() - now) / 1000))
    : null;
  const totalTermSeconds = Math.max(1, Number(subscription?.term_days ?? 30) * 86400);
  const runwayPercent = remainingSeconds === null ? 0 : Math.min(100, (remainingSeconds / totalTermSeconds) * 100);

  React.useEffect(() => {
    if (!tenantSession || !canManage) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [canManage, tenantSession]);

  React.useEffect(() => {
    if (!subscription || ACCESS_STATUSES.includes(subscription.status) || pathname === "/dashboard/subscriptions") return;
    router.replace("/dashboard/subscriptions");
  }, [pathname, router, subscription]);

  const shownMutation = useMutation({
    mutationFn: recordCurrentTenantSubscriptionReminder,
    onSuccess: (response) => {
      queryClient.setQueryData(["tenant-current-subscriptions"], (current: typeof data) => current ? {
        ...current,
        data: { ...current.data, subscription: { ...current.data.subscription, reminder: response?.data } },
      } : current);
    },
  });

  const dismissMutation = useMutation({
    mutationFn: dismissCurrentTenantSubscriptionReminder,
    onSettled: () => setReminderOpen(false),
  });

  React.useEffect(() => {
    const reminder = subscription?.reminder;
    const marker = reminder ? `${reminder.cycle_key}:${reminder.display_count}` : null;
    if (!reminder?.should_show || !marker || recordedReminder.current === marker) return;
    recordedReminder.current = marker;
    setReminderOpen(true);
    shownMutation.mutate();
  }, [shownMutation, subscription?.reminder]);

  if (!tenantSession || !canManage || !subscription) return null;

  const activationRequired = subscription.status === "pending_activation";
  const paymentDue = !ACCESS_STATUSES.includes(subscription.status);

  return (
    <>
      <Alert className="mb-5 border-primary/25 bg-primary/5">
        {paymentDue ? <AlertTriangle aria-hidden="true" /> : <CalendarClock aria-hidden="true" />}
        <AlertTitle className="flex flex-wrap items-center gap-2">
          <span>{activationRequired ? "Workspace awaiting activation" : "Subscription billing runway"}</span>
          <Badge variant={paymentDue ? "destructive" : "secondary"}>{subscription.billing_cycle}</Badge>
        </AlertTitle>
        <AlertDescription className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <strong className="font-mono text-base text-foreground" role="timer" aria-label={`Subscription time remaining: ${formatCountdown(remainingSeconds)}`}>{formatCountdown(remainingSeconds)}</strong>
              <p>{activationRequired ? "Pay by gateway or submit a direct transfer for central approval." : "Time remaining until the next subscription payment."}</p>
            </div>
            <Button type="button" size="sm" onClick={() => router.push("/dashboard/subscriptions")}>
              <CreditCard aria-hidden="true" /> {paymentDue ? "Pay to unlock" : "Manage billing"}
            </Button>
          </div>
          {!activationRequired ? <Progress value={runwayPercent} aria-label={`${Math.round(runwayPercent)} percent of billing term remains`} /> : null}
        </AlertDescription>
      </Alert>

      <Dialog open={reminderOpen} onOpenChange={(open) => { if (!open) dismissMutation.mutate(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{activationRequired ? "Complete workspace activation" : paymentDue ? "Subscription payment is overdue" : "Upcoming subscription payment"}</DialogTitle>
            <DialogDescription>
              {activationRequired
                ? "Your workspace is ready, but subscribed modules remain locked until payment is confirmed. Gateway payments activate automatically; direct transfers require central approval."
                : `Your next payment is ${formatCountdown(remainingSeconds)} away. Renew now to avoid losing module access.`}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time remaining</p>
            <p className="mt-2 font-mono text-2xl font-bold" role="timer" aria-label={`Subscription time remaining: ${formatCountdown(remainingSeconds)}`}>{formatCountdown(remainingSeconds)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This reminder may appear {subscription.reminder?.remaining_displays ?? 0} more time(s), following the central reminder schedule.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => dismissMutation.mutate()} disabled={dismissMutation.isPending}>
              {dismissMutation.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              Remind me later
            </Button>
            <Button type="button" onClick={() => { setReminderOpen(false); router.push("/dashboard/subscriptions"); }}>
              <CreditCard aria-hidden="true" /> Pay now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
