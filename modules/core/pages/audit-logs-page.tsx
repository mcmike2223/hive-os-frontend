"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, HelpCircle, Home, ShieldAlert } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { useTour } from "@/components/providers/tour-provider";
import { ModulePageSkeleton } from "@/components/ui/loading-states";
import { usePermissions } from "@/hooks/use-permissions";
import { isTenantSession } from "@/lib/runtime-context";
import { useTranslation } from "@/store/use-translation";
import { logFrontendAction } from "@/modules/core/api";
import { AuditLogsClient } from "@/modules/core/components/audit-logs-client";

export default function AuditLogsPage() {
  const router = useRouter();
  const { hasPermission, isLoaded } = usePermissions();
  const { t } = useTranslation();
  const { startTour } = useTour();
  const [accessStatus, setAccessStatus] = useState<"checking" | "granted" | "denied">("checking");

  const viewLogged = useRef(false);
  const canViewLogs = hasPermission("view_logs");

  const triggerPageTour = () => {
    const isTenant = typeof window !== "undefined" ? isTenantSession() : false;

    const steps: any[] = [
      {
        target: "#tour-audit-header",
        title: t("tour.audit_title", "System Audit Logs"),
        content: t("tour.audit_desc", "This immutable ledger cryptographically records every action taken across the network."),
        placement: "bottom",
      },
      {
        target: "#tour-audit-view-modes",
        title: t("tour.ledger_title", "Ledger Views"),
        content: t("tour.ledger_desc", "Switch between the fast-access Active Live Logs and the deep Cold Storage Vault."),
        placement: "bottom",
      },
      {
        target: "#tour-audit-filters-event",
        title: t("tour.matrix_title", "Event Matrices"),
        content: t("tour.matrix_desc", "Instantly filter records by the type of action performed."),
        placement: "bottom",
      },
    ];

    if (!isTenant) {
      steps.push({
        target: "#tour-audit-filters-node",
        title: t("tour.scope_title", "Node Scope"),
        content: t("tour.scope_desc", "Filter telemetry strictly from Central Command or specific Tenant Nodes."),
        placement: "bottom",
      });
    }

    steps.push(
      {
        target: "#tour-audit-filters-date",
        title: t("tour.time_title", "Time Dilations"),
        content: t("tour.time_desc", "Quickly jump to specific timeframes or set custom date boundaries to hunt for events."),
        placement: "bottom",
      },
      {
        target: "#tour-audit-actions-vault",
        title: t("tour.vault_title", "Vault Controls"),
        content: t("tour.vault_desc", "Configure automated retention policies or manually trigger a cold storage sweep to free up live memory."),
        placement: "left",
      },
      {
        target: "#tour-datatable-search",
        title: t("tour.deep_search_title", "Deep Search"),
        content: t("tour.deep_search_desc", "Search the ledger instantly by operator name, description, or module."),
        placement: "bottom",
      },
      {
        target: "#tour-datatable-copy",
        title: t("tour.copy_title", "Copy to Clipboard"),
        content: t("tour.copy_desc", "Copy the current log view directly to your clipboard for external reporting."),
        placement: "bottom",
      },
      {
        target: "#tour-datatable-export",
        title: t("tour.export_title", "Export Telemetry"),
        content: t("tour.export_desc", "Download the audit trail in CSV, Excel, or PDF format."),
        placement: "bottom",
      },
      {
        target: "#tour-datatable-print",
        title: t("tour.print_title", "Print Ledger"),
        content: t("tour.print_desc", "Generate a formatted, printable report of the current view."),
        placement: "bottom",
      },
      {
        target: "#tour-datatable-refresh",
        title: t("tour.refresh_title", "Force Sync"),
        content: t("tour.refresh_desc", "Manually fetch the latest telemetry pulses from the network."),
        placement: "bottom",
      },
      {
        target: ".tour-audit-action-view",
        title: t("tour.forensic_title", "Forensic Inspection"),
        content: t("tour.forensic_desc", "Inspect the raw JSON payload and exact metadata footprint of a specific event."),
        placement: "top",
      }
    );

    startTour(steps.map((step) => ({ ...step, disableBeacon: true })));
  };

  useEffect(() => {
    if (!isLoaded) {
      setAccessStatus("checking");
      return;
    }

    if (!canViewLogs) {
      setAccessStatus("denied");

      if (!viewLogged.current) {
        viewLogged.current = true;
        logFrontendAction({
          module: "System Audit",
          action: "access_denied",
          description: "Operator blocked from accessing System Audit Logs.",
        }).catch(() => {});
      }

      const timer = setTimeout(() => {
        router.replace("/dashboard");
      }, 3000);
      return () => clearTimeout(timer);
    }

    setAccessStatus("granted");
    if (!viewLogged.current) {
      viewLogged.current = true;
      logFrontendAction({
        module: "System Audit",
        action: "viewed",
        description: "Opened the System Audit Logs datatable module.",
      }).catch(() => {});
    }
  }, [canViewLogs, isLoaded, router]);

  // Opt-in only — see the "Page Tour" control. Auto-starting meant a first-time
  // operator hit an unsolicited modal on each page in turn.

  if (accessStatus === "checking") {
    return <ModulePageSkeleton titleWidth="w-64" subtitleWidth="w-96" rows={7} cols={6} />;
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
            {t("global.lacks_permission", "Your current access token lacks the required")} <strong className="text-destructive">view_logs</strong> {t("global.capability", "capability.")}
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
          onClick={triggerPageTour}
          className="h-8 rounded-lg border-border/50 bg-background/50 text-muted-foreground shadow-sm backdrop-blur-md hover:text-foreground"
        >
          <HelpCircle className="mr-2 h-4 w-4" /> {t("global.page_tour", "Page Tour")}
        </Button>

        <Breadcrumbs
          items={[
            { label: "Hive.OS", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
            { label: t("audit.title", "System Audit Logs") },
          ]}
        />
      </div>

      <div id="tour-audit-header" className="mt-2 flex flex-col items-start justify-between gap-4 rounded-[2rem] border border-border/50 bg-card/40 p-6 shadow-sm backdrop-blur-md sm:flex-row sm:items-center">
        <div>
          {/* The page title is the document's h1 — this was an h2, so the route
              had no top-level heading for screen readers to announce. */}
          <h1 className="font-space flex items-center gap-2 text-2xl font-black tracking-tight">
            <Activity className="h-6 w-6 text-primary" /> {t("audit.title", "System Audit Logs")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("audit.subtitle", "Cryptographically secure, immutable record of all network activity.")}
          </p>
        </div>
      </div>

      <AuditLogsClient />
    </div>
  );
}
