"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Layers, ShieldAlert } from "lucide-react";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ModulePageSkeleton } from "@/components/ui/loading-states";
import { usePermissions } from "@/hooks/use-permissions";
import { isTenantSession } from "@/lib/runtime-context";
import { logFrontendAction } from "@/modules/core/api";
import { TenantSubscriptionsClient } from "@/modules/subscription/components/tenant-subscriptions-client";
import { SubscriptionAdminClient } from "@/modules/subscription/components/subscription-admin-client";
import { useTranslation } from "@/store/use-translation";

export default function SubscriptionsPage() {
  const router = useRouter();
  const { hasAnyPermission, isLoaded } = usePermissions();
  const { t } = useTranslation();
  const [accessStatus, setAccessStatus] = useState<"checking" | "granted" | "denied">("checking");
  const viewLogged = useRef(false);

  const canViewSubscriptions = hasAnyPermission([
    "manage_module_subscriptions",
    "view_module_subscriptions",
  ]);
  const canViewCentralSubscriptions = hasAnyPermission([
    "view_tenants",
    "manage_tenants",
    "provision_tenants",
  ]);

  useEffect(() => {
    if (!isLoaded) {
      setAccessStatus("checking");
      return;
    }

    const isTenant = isTenantSession();

    if ((!isTenant && !canViewCentralSubscriptions) || (isTenant && !canViewSubscriptions)) {
      setAccessStatus("denied");

      if (!viewLogged.current) {
        viewLogged.current = true;
        logFrontendAction({
          module: "Module Subscriptions",
          action: "access_denied",
          description: "Operator was blocked from tenant module subscriptions.",
        }).catch(() => {});
      }

      const timer = setTimeout(() => router.replace("/dashboard"), 3000);
      return () => clearTimeout(timer);
    }

    setAccessStatus("granted");

    if (!viewLogged.current) {
      viewLogged.current = true;
      logFrontendAction({
        module: "Module Subscriptions",
        action: "viewed",
        description: "Tenant operator accessed the module subscriptions workspace.",
      }).catch(() => {});
    }
  }, [canViewCentralSubscriptions, canViewSubscriptions, isLoaded, router]);

  if (accessStatus === "checking") {
    return <ModulePageSkeleton titleWidth="w-60" subtitleWidth="w-80" rows={5} cols={3} />;
  }

  if (accessStatus === "denied") {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center space-y-5 text-center">
        <div className="relative">
          <div className="absolute inset-0 animate-pulse rounded-full bg-destructive/20 blur-xl" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 shadow-inner">
            <ShieldAlert className="h-12 w-12 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="font-space text-3xl font-black uppercase tracking-tight text-foreground">
            {t("global.clearance_denied", "Clearance Denied")}
          </h2>
          <p className="mx-auto max-w-md font-mono text-sm leading-relaxed text-muted-foreground">
            {t("subscriptions.clearance_message", "Tenant module subscriptions are only available inside a tenant workspace with the right clearance.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-4 flex w-full items-center justify-end gap-3">
        <Breadcrumbs
          items={[
            { label: "Hive.OS", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
            { label: isTenantSession() ? t("nav.subscriptions", "Module Subscriptions") : "Subscription Admin" },
          ]}
        />
      </div>

      <div className="mt-2 flex flex-col items-start justify-between gap-4 rounded-[2rem] border border-border/50 bg-card/40 p-6 shadow-sm backdrop-blur-md sm:flex-row sm:items-center">
        <div>
          <h2 className="font-space flex items-center gap-2 text-2xl font-black tracking-tight">
            <Layers className="h-6 w-6 text-primary" /> {t("nav.subscriptions", "Module Subscriptions")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("subscriptions.subtitle", "Activate the modules your tenant wants to use, from media tools to operational addons and custom capabilities.")}
          </p>
        </div>
      </div>

      {isTenantSession() ? <TenantSubscriptionsClient /> : <SubscriptionAdminClient />}
    </div>
  );
}

