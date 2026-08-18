"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getBackendOrigin } from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import { Loader2, Lock, Maximize2, Minimize2, Sparkles } from "lucide-react";
import { buildTenantLandingPreviewHtml, type TenantLandingTemplate } from "../../tenancy/landing-template";
import type { TemplateLibraryCard } from "../lib/api";

const frameworkLabel: Record<string, string> = {
  "static-html": "Static HTML",
  "html-css-js": "HTML + CSS + JS",
  react: "React",
  nextjs: "Next.js",
};

type TemplatePreviewDialogProps = {
  template: TemplateLibraryCard | null;
  businessLabel: string;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (template: TemplateLibraryCard) => void;
};

export function TemplatePreviewDialog({
  template,
  businessLabel,
  busy,
  onOpenChange,
  onChoose,
}: TemplatePreviewDialogProps) {
  const [fullscreen, setFullscreen] = React.useState(true);
  const srcDoc = React.useMemo(() => {
    if (!template?.preview) return null;

    try {
      return buildTenantLandingPreviewHtml(
        template.preview as TenantLandingTemplate,
        "Your Business",
        businessLabel,
        { colorMode: "light" },
      );
    } catch {
      return null;
    }
  }, [businessLabel, template]);

  return (
    <Dialog open={template !== null} onOpenChange={(open) => onOpenChange(open)}>
      <DialogContent
        className={cn(
          "gap-0 overflow-hidden rounded-[1.75rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl",
          fullscreen
            ? "flex h-[100dvh] w-screen max-w-none flex-col rounded-none border-0 sm:max-w-none"
            : "max-h-[92vh] w-[min(1120px,95vw)] sm:max-w-[1120px]",
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border/50 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="font-space text-lg font-black tracking-tight text-foreground">
                {template?.name ?? "Template preview"}
              </DialogTitle>
              <DialogDescription className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {template?.description ?? "Live preview rendered from the master template."}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {template?.is_premium && (
                <Badge className="border-transparent bg-amber-500/90 text-white">
                  <Lock className="mr-1 h-3 w-3" /> Premium
                </Badge>
              )}
              {template?.source_framework && (
                <Badge variant="outline" className="border-border/60 text-muted-foreground">
                  {frameworkLabel[template.source_framework] ?? template.source_framework}
                </Badge>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setFullscreen((value) => !value)}
                className="h-8 w-8 rounded-lg border border-border/50 bg-background/70"
                title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className={cn("grid min-h-0 gap-0 md:grid-cols-[minmax(0,1fr)_280px]", fullscreen && "flex-1")}>
          {/* Live preview */}
          <div className={cn("relative min-h-0 overflow-hidden bg-[#eef2f7]", fullscreen ? "h-full" : "h-[58vh] md:h-[62vh]")}>
            {srcDoc ? (
              <iframe
                title={`${template?.name ?? "Template"} live preview`}
                srcDoc={srcDoc}
                sandbox="allow-scripts allow-popups allow-top-navigation-by-user-activation"
                className="h-full w-full border-0"
              />
            ) : template?.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${getBackendOrigin()}${template.thumbnail}`}
                alt={template.name}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No preview available for this template.
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/10 to-transparent" />
          </div>

          {/* Side panel */}
          <div className="flex flex-col justify-between gap-4 border-t border-border/50 p-5 md:border-l md:border-t-0">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Recommended for
                </p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{businessLabel}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {template?.business_types?.slice(0, 3).map((bt) => (
                  <Badge key={bt} variant="outline" className="border-border/60 bg-background/60 text-muted-foreground">
                    {bt}
                  </Badge>
                ))}
                <Badge variant="outline" className="border-border/60 bg-background/60 text-muted-foreground">
                  v{template?.current_version}
                </Badge>
                <Badge variant="outline" className="border-border/60 bg-background/60 text-muted-foreground">
                  {template?.compatibility_score}% compat
                </Badge>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Live preview is rendered in a sandboxed browser. After you choose it, open{" "}
                <span className="font-semibold text-foreground">Settings → Landing Page</span> to customize
                headlines, colors and sections, then publish.
              </p>
            </div>
            <div className={cn("space-y-2", !template && "pointer-events-none opacity-60")}>
              <Button
                className="h-10 w-full gap-2 rounded-xl"
                disabled={busy || !template}
                onClick={() => template && onChoose(template)}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Use this template
              </Button>
              <Button
                variant="ghost"
                className="h-9 w-full rounded-xl text-muted-foreground"
                onClick={() => onOpenChange(false)}
              >
                Keep browsing
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
