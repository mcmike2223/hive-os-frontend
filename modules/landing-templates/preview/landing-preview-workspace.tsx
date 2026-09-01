"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Laptop,
  Loader2,
  Monitor,
  RefreshCw,
  Smartphone,
  Tablet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchBuilderData, type TemplateBuilderData } from "../lib/api";

type PreviewDevice = "desktop" | "laptop" | "tablet" | "mobile";

const devices: { id: PreviewDevice; label: string; width: number | null; icon: typeof Monitor }[] = [
  { id: "desktop", label: "Desktop", width: null, icon: Monitor },
  { id: "laptop", label: "Laptop", width: 1100, icon: Laptop },
  { id: "tablet", label: "Tablet", width: 768, icon: Tablet },
  { id: "mobile", label: "Mobile", width: 390, icon: Smartphone },
];

const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const buildPreviewDocument = (data: TemplateBuilderData) => {
  const html = data.code_files.find((file) => file.name === "index.html")?.content || "";
  const css = (data.code_files.find((file) => file.name === "styles.css")?.content || "").replaceAll("</style", "<\\/style");
  const js = (data.code_files.find((file) => file.name === "script.js")?.content || "").replaceAll("</script", "<\\/script");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data: blob:; media-src https: data: blob:; font-src https: data:; style-src 'unsafe-inline' https://fonts.googleapis.com; script-src 'unsafe-inline' https://cdn.tailwindcss.com; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'">
  <title>${escapeHtml(data.template.name)} preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>${css}</style>
</head>
<body class="min-h-screen bg-white text-slate-900 antialiased">
${html}
<script>try { ${js} } catch (error) { console.error("Preview script execution error", error); }</script>
</body>
</html>`;
};

export function LandingPreviewWorkspace({ templateId }: { templateId: number }) {
  const [data, setData] = useState<TemplateBuilderData | null>(null);
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const loadPreview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchBuilderData(templateId);
      setData(response.data);
      setReloadKey((key) => key + 1);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The preview could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    if (!isLoading) headingRef.current?.focus();
  }, [isLoading]);

  const activeDevice = devices.find((item) => item.id === device) ?? devices[0];
  const srcDoc = useMemo(() => (data ? buildPreviewDocument(data) : ""), [data]);

  return (
    <div className="flex h-dvh min-h-[640px] w-full flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="relative z-20 shrink-0 border-b border-slate-700 bg-slate-950/95 px-3 py-3 shadow-xl backdrop-blur sm:px-5">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" className="h-11 shrink-0 gap-2 text-slate-200 hover:bg-slate-800 hover:text-white focus-visible:ring-blue-400">
              <Link href="/dashboard/landing-library">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Back to library</span>
                <span className="sm:hidden">Back</span>
              </Link>
            </Button>
            <div className="min-w-0 border-l border-slate-700 pl-3">
              <div className="flex min-w-0 items-center gap-2">
                <h1 ref={headingRef} tabIndex={-1} className="truncate text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:text-base">
                  {data?.template.name || "Landing page preview"}
                </h1>
                {data?.has_draft && <Badge className="border-blue-400/40 bg-blue-400/15 text-blue-100">Saved draft</Badge>}
              </div>
              <p className="hidden text-xs text-slate-300 sm:block">Responsive, sandboxed review workspace</p>
            </div>
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none">
            <div className="flex items-center rounded-xl border border-slate-700 bg-slate-900 p-1" role="group" aria-label="Preview device width">
              {devices.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`${item.label} preview`}
                    aria-pressed={device === item.id}
                    onClick={() => setDevice(item.id)}
                    className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                      device === item.id ? "bg-blue-600 text-white shadow-md" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                    title={item.label}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReloadKey((key) => key + 1)}
              disabled={!data || isLoading}
              className="h-11 gap-2 border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white focus-visible:ring-blue-400"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span className="hidden lg:inline">Refresh</span>
            </Button>
            <Button asChild className="h-11 gap-2 bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700 focus-visible:ring-blue-400">
              <Link href={`/dashboard/landing-library/${templateId}/builder`}>
                Edit in builder
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_top,#1e3a5f_0%,#0f172a_38%,#020617_100%)] p-3 sm:p-6 lg:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.16)_1px,transparent_1px)] [background-size:32px_32px]" />
        <section aria-label={`${activeDevice.label} template canvas`} className="relative mx-auto flex min-h-full w-full items-start justify-center">
          {isLoading && (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-200" role="status">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400 motion-reduce:animate-none" aria-hidden="true" />
              <p className="text-sm font-medium">Preparing full-page preview…</p>
            </div>
          )}

          {!isLoading && error && (
            <div className="my-auto max-w-md rounded-2xl border border-red-400/40 bg-slate-900 p-6 text-center shadow-2xl">
              <AlertCircle className="mx-auto h-9 w-9 text-red-300" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-semibold text-white">Preview unavailable</h2>
              <p className="mt-2 text-sm text-slate-300">{error}</p>
              <Button onClick={() => void loadPreview()} className="mt-5 h-11 bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-400">Try again</Button>
            </div>
          )}

          {!isLoading && data && (
            <div
              className="h-[calc(100dvh-9.5rem)] min-h-[520px] overflow-hidden rounded-2xl border border-slate-500 bg-white shadow-[0_30px_100px_rgba(0,0,0,.55)] transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: activeDevice.width ? `min(100%, ${activeDevice.width}px)` : "100%" }}
            >
              <iframe
                key={reloadKey}
                title={`${data.template.name} sandbox preview`}
                srcDoc={srcDoc}
                sandbox="allow-scripts"
                className="h-full w-full border-0 bg-white"
              />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
