"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  FileArchive,
  Loader2,
  Lock,
  Package,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { approveImport, importTemplateArchive, type TemplateImport } from "../lib/api";

type ImportTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
};

const frameworkLabel: Record<string, string> = {
  "static-html": "Static HTML",
  "html-css-js": "HTML + CSS + JS",
  react: "React",
  nextjs: "Next.js",
};

export function ImportTemplateDialog({ open, onOpenChange, onImported }: ImportTemplateDialogProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [approving, setApproving] = React.useState(false);
  const [result, setResult] = React.useState<TemplateImport | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setImporting(false);
    setApproving(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = (next: File | null) => {
    setFile(next);
    setResult(null);
    setError(null);
  };

  const runImport = async () => {
    if (!file) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await importTemplateArchive(file);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const runApprove = async () => {
    if (!result) return;
    setApproving(true);
    setError(null);
    try {
      await approveImport(result.id);
      onImported();
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed.");
    } finally {
      setApproving(false);
    }
  };

  const report = result?.report;
  const criticalFindings = (report?.findings ?? []).filter((f) => f.severity === "critical" || f.severity === "high");
  const blocked = result?.status === "failed";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[86vh] overflow-y-auto rounded-[1.75rem] border-border/60 bg-background/95 backdrop-blur-xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-space text-xl font-black uppercase tracking-tight">
            <UploadCloud className="h-5 w-5 text-primary" />
            Import Landing Template
          </DialogTitle>
          <DialogDescription>
            Upload a ZIP package — Hive detects the framework, runs the security scan, converts to Next.js-compatible
            markup, and produces a conversion report for your approval. Uploaded code is never executed.
          </DialogDescription>
        </DialogHeader>

        {/* step 1 — file pick */}
        {!result && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={cn(
                "group flex w-full flex-col items-center justify-center gap-3 rounded-[1.5rem] border-2 border-dashed px-6 py-10 transition-colors",
                file
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/70 bg-background/40 hover:border-primary/40 hover:bg-primary/[0.03]",
              )}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-background/80 shadow-sm">
                <FileArchive className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-1 text-center">
                <p className="text-sm font-semibold text-foreground">
                  {file ? file.name : "Drop your template ZIP here or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground">
                  index.html + css/ + js/ + assets/ · src/ · app/ · package.json — max 25 MB
                </p>
              </div>
              {file && (
                <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
                  {(file.size / 1024).toFixed(0)} KB
                </Badge>
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />

            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-4">
              <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Security scan</div>
              <div className="flex items-center gap-1.5"><ScanSearch className="h-3.5 w-3.5 text-sky-500" /> Framework detect</div>
              <div className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-amber-500" /> HTML → JSX</div>
              <div className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-rose-500" /> Never executed</div>
            </div>

            {error && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
            )}
          </div>
        )}

        {/* step 2 — pipeline result */}
        {result && report && (
          <div className="space-y-5">
            <div
              className={cn(
                "flex items-center justify-between rounded-2xl border p-4",
                blocked
                  ? "border-destructive/30 bg-destructive/10"
                  : result.status === "ready"
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-amber-500/30 bg-amber-500/10",
              )}
            >
              <div className="flex items-center gap-3">
                {blocked ? (
                  <XCircle className="h-6 w-6 text-destructive" />
                ) : result.status === "ready" ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                )}
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-foreground">
                    {blocked ? "Import blocked" : result.status === "ready" ? "Ready for approval" : result.status.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Detected: <span className="font-semibold text-foreground">{frameworkLabel[result.source_framework ?? "html-css-js"]}</span> →{" "}
                    <span className="font-semibold text-foreground">Next.js runtime</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-foreground">{result.compatibility_score}%</span>
                <span className="text-xs text-muted-foreground">compat</span>
              </div>
            </div>

            {/* pipeline summary */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Files analyzed" value={String(result.files_analyzed)} />
              <Stat label="Components" value={String(result.components_generated)} />
              <Stat label="Images" value={String(result.images_imported)} />
              <Stat label="CSS processed" value={String(result.css_processed)} />
            </div>

            {/* dependencies */}
            {report.dependencies.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Dependency analysis</p>
                <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-2xl border border-border/50 bg-background/50 p-3">
                  {report.dependencies.map((dep) => (
                    <div key={dep.name} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-foreground">{dep.name}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 border-transparent",
                          dep.status === "compatible" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                          dep.status === "review" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                          dep.status === "blocked" && "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {dep.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* warnings + findings */}
            {(report.warnings.length > 0 || criticalFindings.length > 0) && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Review notes</p>
                <div className="max-h-44 space-y-1.5 overflow-y-auto">
                  {criticalFindings.map((f, i) => (
                    <div key={`f-${i}`} className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/5 px-3 py-2 text-xs">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                      <span className="text-muted-foreground"><span className="font-semibold text-rose-600 dark:text-rose-400">{f.file}</span> — {f.message}</span>
                    </div>
                  ))}
                  {report.warnings.slice(0, 8).map((w, i) => (
                    <div key={`w-${i}`} className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span className="text-muted-foreground">{w}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {!result ? (
            <Button onClick={runImport} disabled={!file || importing} className="w-full gap-2 rounded-xl sm:w-auto">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              {importing ? "Running pipeline…" : "Analyze & Convert"}
            </Button>
          ) : blocked ? (
            <Button variant="outline" onClick={reset} className="gap-2 rounded-xl">
              <ArrowRight className="h-4 w-4" />
              Try another package
            </Button>
          ) : (
            <Button onClick={runApprove} disabled={approving} className="w-full gap-2 rounded-xl sm:w-auto">
              {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {approving ? "Publishing…" : "Approve & Publish"}
            </Button>
          )}
          {!blocked && (
            <Button variant="ghost" onClick={() => handleClose(false)} className="rounded-xl">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/50 px-3 py-3 text-center">
      <p className="text-xl font-black text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
