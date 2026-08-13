"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, Home, Network, ShieldAlert } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { useTour } from "@/components/providers/tour-provider";
import { ModulePageSkeleton } from "@/components/ui/loading-states";
import { usePermissions } from "@/hooks/use-permissions";
import { isTenantSession } from "@/lib/runtime-context";
import { useTranslation } from "@/store/use-translation";
import { logFrontendAction } from "@/modules/core/api";
import { TenantsTableClient } from "@/modules/tenancy/components/tenants-table-client";

export default function TenantsPage() {
  const router = useRouter();
  const { hasAnyPermission, isLoaded } = usePermissions();
  const { t } = useTranslation();
  const { startTour } = useTour();
  const [accessStatus, setAccessStatus] = useState<"checking" | "granted" | "denied">("checking");

  const viewLogged = useRef(false);
  const canViewTenants = hasAnyPermission(["manage_tenants", "view_tenants"]);

  const tenantTourSteps = [
    {
      target: "#tour-tenant-header",
      title: t("tour.node_mgmt_title", "Node Management"),
      content: t("tour.node_mgmt_desc", "This is the master command center for all active tenant nodes on the HIVE.OS network."),
      placement: "bottom" as const,
      disableBeacon: true,
    },
    {
      target: "#tour-tenant-provision",
      title: t("tour.provision_title", "Provision a Node"),
      content: t("tour.provision_desc", "Click here to allocate new infrastructure. You will define the organization name, capacity plan, and establish super admin credentials."),
      placement: "left" as const,
      disableBeacon: true,
    },
    {
      target: "#tour-datatable-search",
      title: t("tour.matrix_search_title", "Matrix Search"),
      content: t("tour.matrix_search_desc", "Filter the active node list instantly by ID or Organization Name."),
      placement: "bottom" as const,
      disableBeacon: true,
    },
    {
      target: "#tour-datatable-copy",
      title: t("tour.copy_title", "Copy to Clipboard"),
      content: t("tour.copy_desc", "Quickly copy the current matrix view to your clipboard for sharing."),
      placement: "bottom" as const,
      disableBeacon: true,
    },
    {
      target: "#tour-datatable-export",
      title: t("tour.export_title", "Export Data"),
      content: t("tour.export_desc", "Download the complete matrix dataset in your preferred format (CSV, Excel)."),
      placement: "bottom" as const,
      disableBeacon: true,
    },
    {
      target: "#tour-datatable-print",
      title: t("tour.print_title", "Print Matrix"),
      content: t("tour.print_desc", "Send the current node configuration list to your PDF/Print processor."),
      placement: "bottom" as const,
      disableBeacon: true,
    },
    {
      target: "#tour-datatable-refresh",
      title: t("tour.refresh_title", "Force Sync"),
      content: t("tour.refresh_desc", "Manually refresh the datatable to pull the latest telemetry from the network."),
      placement: "bottom" as const,
      disableBeacon: true,
    },
    {
      target: "#tour-tenant-table",
      title: t("tour.matrix_title", "The Node Matrix"),
      content: t("tour.matrix_desc", "Monitor real-time network status."),
      placement: "top-start" as const,
      disableBeacon: true,
      floaterProps: { disableFlip: true },
    },
    {
      target: "#tour-action-view",
      title: t("tour.inspect_title", "Inspect Node"),
      content: t("tour.inspect_desc", "View deep metrics, routing domains, and active capacity plans for this specific node."),
      placement: "top" as const,
      disableBeacon: true,
    },
    {
      target: "#tour-action-status",
      title: t("tour.power_title", "Network Power"),
      content: t("tour.power_desc", "Instantly suspend or restore network access for this tenant database."),
      placement: "top" as const,
      disableBeacon: true,
    },
    {
      target: "#tour-action-admin",
      title: t("tour.clearance_title", "Operator Clearance"),
      content: t("tour.clearance_desc", "Enable or disable Super Admin login capabilities for this tenant."),
      placement: "top" as const,
      disableBeacon: true,
    },
    {
      target: "#tour-action-edit",
      title: t("tour.reconfig_title", "Reconfigure Node"),
      content: t("tour.reconfig_desc", "Update the organization name, adjust the capacity plan, or modify routing rules."),
      placement: "top" as const,
      disableBeacon: true,
    },
    {
      target: "#tour-action-purge",
      title: t("tour.purge_title", "Purge Protocol"),
      content: t("tour.purge_desc", "Permanently delete this node and destroy all associated telemetry data. Use with extreme caution."),
      placement: "top-end" as const,
      disableBeacon: true,
    },
  ];

  useEffect(() => {
    if (!isLoaded) {
      setAccessStatus("checking");
      return;
    }

    const isCentral = !isTenantSession();

    if (!isCentral || !canViewTenants) {
      setAccessStatus("denied");

      if (!viewLogged.current) {
        viewLogged.current = true;
        logFrontendAction({ module: "Tenant Management", action: "access_denied", description: "Operator blocked from accessing Master Node Management." }).catch(() => {});
      }

      const timer = setTimeout(() => router.replace("/dashboard"), 3000);
      return () => clearTimeout(timer);
    }

    setAccessStatus("granted");
    if (!viewLogged.current) {
      viewLogged.current = true;
      logFrontendAction({ module: "Tenant Management", action: "viewed", description: "Accessed Master Node Management module." }).catch(() => {});
    }
  }, [canViewTenants, isLoaded, router]);

  // Opt-in only — see the "Page Tour" control. Auto-starting meant a first-time
  // operator hit an unsolicited modal on each page in turn.

  if (accessStatus === "checking") {
    return <ModulePageSkeleton titleWidth="w-60" subtitleWidth="w-80" rows={7} cols={6} />;
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
            {t("global.lacks_permission", "Your current access token lacks the required")} <strong className="text-destructive">view_tenants</strong> {t("global.capability", "capability.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-4 flex w-full items-center justify-end gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => startTour(tenantTourSteps)}
          className="h-8 rounded-lg border-border/50 bg-background/50 text-muted-foreground shadow-sm backdrop-blur-md hover:text-foreground"
        >
          <HelpCircle className="mr-2 h-4 w-4" /> {t("global.page_tour", "Page Tour")}
        </Button>

        <Breadcrumbs
          items={[
            { label: "Hive.OS", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
            { label: t("nav.tenants", "Node Management") },
          ]}
        />
      </div>

      <div id="tour-tenant-header" className="mt-2 flex flex-col items-start justify-between gap-4 rounded-[2rem] border border-border/50 bg-card/40 p-6 shadow-sm backdrop-blur-md sm:flex-row sm:items-center">
        <div>
          {/* The page title is the document's h1 — this was an h2, so the route
              had no top-level heading for screen readers to announce. */}
          <h1 className="font-space flex items-center gap-2 text-2xl font-black tracking-tight">
            <Network className="h-6 w-6 text-primary" /> {t("tenants.title", "Node Management")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("tenants.subtitle", "Provision, monitor, and configure active tenant databases within the ecosystem.")}
          </p>
        </div>
      </div>

      <TenantsTableClient />
    </div>
  );
}
