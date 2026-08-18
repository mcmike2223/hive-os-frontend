"use client";

import * as React from "react";

import {
  resolveLandingTemplate,
  LANDING_PREVIEW_MESSAGE,
} from "@/modules/tenancy/landing-template";
import { RestaurantLandingTemplate } from "@/modules/tenancy/components/restaurant-landing-template";
import { TenantBusinessLanding } from "@/modules/tenancy/components/tenant-business-landing";
import LmsLandingTemplate from "@/modules/tenancy/components/lms-landing-template";
import B2BLandingTemplate from "@/modules/tenancy/components/b2b-landing-template";

export type PreviewPayload = {
  slug: string;
  name: string;
  business_types: string[];
  body: Record<string, unknown> | null;
};

export function LandingPreviewClient({ payload }: { payload: PreviewPayload }) {
  // The Edit dialog embeds this route in an iframe and posts each keystroke's
  // parsed JSON, so the preview reflects unsaved edits. Same-origin only.
  const [override, setOverride] = React.useState<Record<string, unknown> | null>(null);

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; body?: Record<string, unknown> } | null;
      if (data?.type !== LANDING_PREVIEW_MESSAGE) return;
      setOverride(data.body && typeof data.body === "object" ? data.body : null);
    };

    window.addEventListener("message", onMessage);
    // Tell the opener the frame is ready for its first body.
    window.parent?.postMessage({ type: `${LANDING_PREVIEW_MESSAGE}:ready` }, window.location.origin);

    return () => window.removeEventListener("message", onMessage);
  }, []);

  const body = override ?? payload.body;
  const template = resolveLandingTemplate(body);
  const tenantName = payload.name;
  const brandSettings = { app_title: payload.name };

  // The body's own meta.business_type is authoritative — a template can be
  // assigned to several business types (Savory is nightclub + restaurant) and
  // only one of them describes how it should render.
  const meta = body?.meta as { business_type?: string; business_label?: string } | undefined;
  const businessType = meta?.business_type ?? payload.business_types[0] ?? "";

  if (businessType === "restaurant" || businessType === "nightclub" || businessType === "lounge") {
    return (
      <RestaurantLandingTemplate
        brandSettings={brandSettings}
        template={template}
        tenantName={tenantName}
      />
    );
  }

  if (businessType === "b2b") {
    return (
      <B2BLandingTemplate brandSettings={brandSettings} template={template} tenantName={tenantName} />
    );
  }

  if (businessType === "lms") {
    return (
      <LmsLandingTemplate brandSettings={brandSettings} template={template} tenantName={tenantName} />
    );
  }

  return (
    <TenantBusinessLanding
      brandSettings={brandSettings}
      businessLabel={meta?.business_label ?? businessType ?? "Business"}
      template={template}
      tenantName={tenantName}
    />
  );
}
