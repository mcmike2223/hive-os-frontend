"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, LayoutTemplate, ShieldAlert, Sparkles } from "lucide-react";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { ModulePageSkeleton } from "@/components/ui/loading-states";
import { usePermissions } from "@/hooks/use-permissions";
import { isTenantSession } from "@/lib/runtime-context";
import { useTranslation } from "@/store/use-translation";
import { TenantLandingTemplateSettings } from "@/components/settings/tenant-landing-template-settings";

const toErrorMessage = (error: unknown, fallback = "An unexpected error occurred.") => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
};

type LandingTemplateBoundaryProps = {
  children: React.ReactNode;
};

type LandingTemplateBoundaryState = {
  errorMessage: string | null;
};

class LandingTemplateBoundary extends React.Component<
  LandingTemplateBoundaryProps,
  LandingTemplateBoundaryState
> {
  state: LandingTemplateBoundaryState = { errorMessage: null };

  static getDerivedStateFromError(error: unknown): LandingTemplateBoundaryState {
    return { errorMessage: toErrorMessage(error) };
  }

  componentDidCatch(error: unknown) {
    console.error("[LandingTemplatesPage] Runtime error:", error);
  }

  render() {
    if (this.state.errorMessage) {
      return (
        <div className="rounded-[2rem] border border-destructive/30 bg-destructive/5 p-6">
          <h3 className="text-base font-black text-foreground">Landing templates could not load</h3>
          <p className="mt-2 text-sm text-muted-foreground">{this.state.errorMessage}</p>
          <div className="mt-4">
            <Button type="button" variant="outline" onClick={() => this.setState({ errorMessage: null })}>
              Try again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function LandingTemplatesPage() {
  const router = useRouter();
  const { hasAnyPermission, isLoaded } = usePermissions();
  const { t } = useTranslation();
  const [accessStatus, setAccessStatus] = React.useState<"checking" | "granted" | "denied">("checking");
  const accessChecked = React.useRef(false);

  const canManageLandingTemplates = hasAnyPermission(["manage_tenants", "provision_tenants"]);

  React.useEffect(() => {
    if (!isLoaded) {
      setAccessStatus("checking");
      return;
    }

    const isCentralNode = !isTenantSession();

    if (!isCentralNode || !canManageLandingTemplates) {
      setAccessStatus("denied");

      if (!accessChecked.current) {
        accessChecked.current = true;
        const timer = setTimeout(() => router.replace("/dashboard"), 3000);
        return () => clearTimeout(timer);
      }

      return;
    }

    setAccessStatus("granted");
    accessChecked.current = true;
  }, [canManageLandingTemplates, isLoaded, router]);

  if (accessStatus === "checking") {
    return <ModulePageSkeleton titleWidth="w-72" subtitleWidth="w-96" rows={8} cols={4} />;
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
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
            You need central-node access with tenant provisioning permissions to manage reusable landing templates.
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
            { label: t("nav.tenants", "Tenant Accounts"), href: "/dashboard/tenants" },
            { label: t("nav.landing_templates", "Landing Templates") },
          ]}
        />
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-border/50 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_32%),linear-gradient(145deg,rgba(15,23,42,0.02),rgba(15,23,42,0.09))] p-6 shadow-sm backdrop-blur-md">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-space font-black tracking-tight text-foreground">
              <LayoutTemplate className="h-6 w-6 text-primary" />
              {t("nav.landing_templates", "Landing Templates")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Build and manage polished template libraries by business type. Teams can now choose a scenario, then tailor content per tenant without starting from scratch.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Multi-template scenarios
            </span>
            <Button asChild variant="outline" className="rounded-xl border-border/60 bg-background/70">
              <Link href="/dashboard/settings/business-types">Manage Business Types</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl border-border/60 bg-background/70">
              <Link href="/dashboard/tenants">Open Tenant Manager</Link>
            </Button>
          </div>
        </div>
      </div>

      <LandingTemplateBoundary>
        <TenantLandingTemplateSettings />
      </LandingTemplateBoundary>
    </div>
  );
}
