"use client";

import React from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const LandingBuilderWorkspace = dynamic(
  () =>
    import("@/modules/landing-templates/builder/landing-builder-workspace").then(
      (m) => m.LandingBuilderWorkspace
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">Loading Visual & Code Builder...</p>
      </div>
    ),
  }
);

export default function TemplateBuilderRoute() {
  const params = useParams();
  const templateId = Number(params?.id);

  if (!templateId || isNaN(templateId)) {
    return (
      <div className="h-screen w-full flex items-center justify-center text-muted-foreground text-sm">
        Invalid template ID.
      </div>
    );
  }

  return <LandingBuilderWorkspace templateId={templateId} />;
}
