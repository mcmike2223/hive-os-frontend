"use client";

import React, { useState } from "react";
import { Monitor, Laptop, Tablet, Smartphone, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface LivePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compiledHtml: string;
  compiledCss: string;
  compiledJs: string;
  title: string;
}

export const LivePreviewModal: React.FC<LivePreviewModalProps> = ({
  open,
  onOpenChange,
  compiledHtml,
  compiledCss,
  compiledJs,
  title,
}) => {
  const [device, setDevice] = useState<"desktop" | "laptop" | "tablet" | "mobile">("desktop");
  const [key, setKey] = useState(0);
  const safeTitle = title
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  const getWidthClass = () => {
    switch (device) {
      case "mobile":
        return "w-[390px] h-[844px]";
      case "tablet":
        return "w-[768px] h-[1024px]";
      case "laptop":
        return "w-[1024px] h-[768px]";
      default:
        return "w-full h-full";
    }
  };

  const srcDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data: blob:; media-src https: data: blob:; font-src https: data:; style-src 'unsafe-inline' https://fonts.googleapis.com; script-src 'unsafe-inline' https://cdn.tailwindcss.com; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'">
  <title>${safeTitle}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${compiledCss}
  </style>
</head>
<body class="bg-white text-slate-900 antialiased min-h-screen">
  ${compiledHtml}
  <script>
    try {
      ${compiledJs}
    } catch(e) {
      console.error('Preview script execution error:', e);
    }
  </script>
</body>
</html>`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] p-0 flex flex-col rounded-2xl overflow-hidden bg-muted/40">
        <DialogHeader className="h-14 px-4 border-b border-border/60 bg-background flex flex-row items-center justify-between shrink-0 space-y-0">
          <div className="flex items-center gap-3">
            <div>
              <DialogTitle className="text-sm font-semibold">{title} — Live Preview</DialogTitle>
              <DialogDescription className="sr-only">Sandboxed draft preview with responsive device widths.</DialogDescription>
            </div>
            <div className="flex items-center bg-muted p-0.5 rounded-lg text-xs" role="group" aria-label="Preview device width">
              <button
                type="button"
                aria-label="Desktop preview"
                aria-pressed={device === "desktop"}
                onClick={() => setDevice("desktop")}
                className={`flex h-11 w-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${device === "desktop" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                title="Desktop"
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Laptop preview"
                aria-pressed={device === "laptop"}
                onClick={() => setDevice("laptop")}
                className={`flex h-11 w-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${device === "laptop" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                title="Laptop"
              >
                <Laptop className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Tablet preview"
                aria-pressed={device === "tablet"}
                onClick={() => setDevice("tablet")}
                className={`flex h-11 w-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${device === "tablet" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                title="Tablet"
              >
                <Tablet className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Mobile preview"
                aria-pressed={device === "mobile"}
                onClick={() => setDevice("mobile")}
                className={`flex h-11 w-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${device === "mobile" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                title="Mobile"
              >
                <Smartphone className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setKey((k) => k + 1)} aria-label="Reload preview">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => onOpenChange(false)} aria-label="Close preview">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
          <div className={`transition-all duration-300 shadow-2xl rounded-xl overflow-hidden border border-border/80 bg-white ${getWidthClass()}`}>
            <iframe
              key={key}
              title="Template Sandbox Preview"
              srcDoc={srcDoc}
              sandbox="allow-scripts"
              className="w-full h-full border-0"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
