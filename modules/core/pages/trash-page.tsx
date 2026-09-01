"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, HelpCircle, ShieldAlert, Home, RefreshCw } from "lucide-react";
import { TrashClient } from "@/app/dashboard/trash/_components/trash-client";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { ModulePageSkeleton } from "@/components/ui/loading-states";
import { useTour } from "@/components/providers/tour-provider";
import { usePermissions } from "@/hooks/use-permissions";
import { useTranslation } from "@/store/use-translation";
import { TRASH_ROUTE_PERMISSIONS } from "@/lib/route-permissions";
import { logFrontendAction } from "@/modules/core/api";

export default function TrashPage() {
  const router = useRouter();
  const { startTour } = useTour();
  const { t, locale } = useTranslation();
  const { hasAnyPermission, isLoaded } = usePermissions();

  const [accessStatus, setAccessStatus] = useState<"checking" | "granted" | "denied">("checking");
  const viewLogged = useRef(false);

  const canAccessTrash = hasAnyPermission([...TRASH_ROUTE_PERMISSIONS]);

  const triggerPageTour = () => {
    startTour([
      {
        target: "#tour-trash-header",
        title: t("tour.trash_title", "Global Trash Bin & Retention Protocol"),
        content: t(
          "tour.trash_desc",
          "Centralized repository for all soft-deleted records across system modules with a 30-day auto-purge policy."
        ),
        placement: "bottom",
        skipBeacon: true,
      },
      {
        target: "#tour-trash-metrics",
        title: t("tour.trash_metrics_title", "Trash Metrics & Countdown"),
        content: t(
          "tour.trash_metrics_desc",
          "Monitor total trashed entities, items expiring within 7 days, and active retention periods."
        ),
        placement: "bottom",
        skipBeacon: true,
      },
    ]);
  };

  useEffect(() => {
    if (!isLoaded) {
      setAccessStatus("checking");
      return;
    }

    if (!canAccessTrash) {
      setAccessStatus("denied");

      if (!viewLogged.current) {
        viewLogged.current = true;
        logFrontendAction({
          module: "Trash Bin",
          action: "access_denied",
          description: "Operator blocked from accessing Global Trash Bin.",
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
        module: "Trash Bin",
        action: "viewed",
        description: "Opened Global Trash Bin module.",
      }).catch(() => {});
    }
  }, [canAccessTrash, isLoaded, router]);

  if (accessStatus === "checking") {
    return <ModulePageSkeleton titleWidth="w-64" subtitleWidth="w-96" rows={7} cols={5} />;
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
            {t("global.lacks_permission", "Your current access token lacks required clearance for the Global Trash Bin.")}
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
          className="h-8 rounded-lg border-border/50 bg-background/50 text-muted-foreground shadow-sm backdrop-blur-md hover:text-foreground text-xs"
        >
          <HelpCircle className="mr-2 h-4 w-4" /> {t("global.page_tour", "Page Tour")}
        </Button>

        <Breadcrumbs
          items={[
            { label: "Hive.OS", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
            { label: t("nav.trash", "Trash Bin") },
          ]}
        />
      </div>

      <div
        id="tour-trash-header"
        className="mt-2 flex flex-col items-start justify-between gap-4 rounded-[2rem] border border-border/50 bg-card/40 p-6 shadow-sm backdrop-blur-md sm:flex-row sm:items-center"
      >
        <div>
          <h1 className="font-space flex items-center gap-2.5 text-2xl font-black tracking-tight">
            <Trash2 className="h-6 w-6 text-primary" /> {t("trash.title", "Global Trash Bin")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("trash.subtitle", "Central repository for soft-deleted records across all system modules with 30-day automated retention.")}
          </p>
        </div>
      </div>

      <TrashClient key={locale} />
    </div>
  );
}
