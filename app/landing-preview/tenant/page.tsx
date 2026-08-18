"use client";

/**
 * Live preview for the tenant's own landing editor (Settings → Landing Page).
 *
 * Unlike /landing-preview/[slug], this route fetches nothing: the editor
 * already holds the JSON, so the content arrives entirely over postMessage.
 * That sidesteps tenant-context resolution during SSR and means the preview
 * updates as the tenant types.
 *
 * Renders through the SAME components the public homepage uses, so what a
 * tenant sees while editing is what their visitors get — the previous preview
 * was a generic HTML approximation that looked nothing like the real page.
 */

import * as React from "react";
import { useSearchParams } from "next/navigation";

import {
  resolveLandingTemplate,
  LANDING_PREVIEW_MESSAGE,
} from "@/modules/tenancy/landing-template";
import { RestaurantLandingTemplate } from "@/modules/tenancy/components/restaurant-landing-template";
import { TenantBusinessLanding } from "@/modules/tenancy/components/tenant-business-landing";
import LmsLandingTemplate from "@/modules/tenancy/components/lms-landing-template";
import B2BLandingTemplate from "@/modules/tenancy/components/b2b-landing-template";

export default function TenantLandingPreviewPage() {
  // useSearchParams must sit under a Suspense boundary or the production build
  // fails prerendering this route.
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-background" />}>
      <TenantLandingPreview />
    </React.Suspense>
  );
}

function TenantLandingPreview() {
  const params = useSearchParams();
  const businessType = params.get("type") ?? "";
  const tenantName = params.get("name") ?? "Preview";

  const [body, setBody] = React.useState<Record<string, unknown> | null>(null);

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; body?: Record<string, unknown> } | null;
      if (data?.type !== LANDING_PREVIEW_MESSAGE) return;
      setBody(data.body && typeof data.body === "object" ? data.body : null);
    };

    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ type: `${LANDING_PREVIEW_MESSAGE}:ready` }, window.location.origin);

    return () => window.removeEventListener("message", onMessage);
  }, []);

  const template = resolveLandingTemplate(body);
  const brandSettings = { app_title: tenantName };

  // The editor tells us the business type, since there is no body to infer it
  // from until the first message lands.
  const meta = body?.meta as { business_type?: string; business_label?: string } | undefined;
  const type = meta?.business_type ?? businessType;

  if (type === "restaurant" || type === "nightclub" || type === "lounge") {
    return (
      <RestaurantLandingTemplate brandSettings={brandSettings} template={template} tenantName={tenantName} />
    );
  }

  if (type === "b2b") {
    return <B2BLandingTemplate brandSettings={brandSettings} template={template} tenantName={tenantName} />;
  }

  if (type === "lms") {
    return <LmsLandingTemplate brandSettings={brandSettings} template={template} tenantName={tenantName} />;
  }

  return (
    <TenantBusinessLanding
      brandSettings={brandSettings}
      businessLabel={meta?.business_label ?? type ?? "Business"}
      template={template}
      tenantName={tenantName}
    />
  );
}
