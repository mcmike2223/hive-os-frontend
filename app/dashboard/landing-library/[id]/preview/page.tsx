"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

const LandingPreviewWorkspace = dynamic(
  () => import("@/modules/landing-templates/preview/landing-preview-workspace").then((module) => module.LandingPreviewWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-3 bg-slate-950 text-slate-100" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400 motion-reduce:animate-none" aria-hidden="true" />
        <p className="text-sm font-medium">Opening preview studio…</p>
      </div>
    ),
  },
);

export default function LandingPreviewRoute() {
  const params = useParams();
  const templateId = Number(params?.id);

  if (!Number.isInteger(templateId) || templateId <= 0) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center text-slate-100">
        <AlertCircle className="h-9 w-9 text-red-300" aria-hidden="true" />
        <h1 className="text-lg font-semibold">Invalid template preview</h1>
        <p className="text-sm text-slate-300">Return to the landing library and choose a template to preview.</p>
      </main>
    );
  }

  return <LandingPreviewWorkspace templateId={templateId} />;
}
