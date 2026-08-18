"use client";

import * as React from "react";
import { AlertTriangle, Loader2, Maximize2, Minimize2, RefreshCw, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CodeEditor, type VirtualFile } from "@/components/ui/code-editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  buildTenantLandingPreviewHtml,
  resolveLandingTemplate,
  LANDING_PREVIEW_MESSAGE,
} from "@/modules/tenancy/landing-template";
import {
  createTemplateVersion,
  fetchTemplate,
  type TemplateLibraryCard,
} from "../lib/api";

const LANDING_TEMPLATE_FILE = "landing-template.json";
const MARKUP_FILE = "index.html";
const STYLES_FILE = "styles.css";
const SCRIPT_FILE = "script.js";

/**
 * A template's editable page code lives in body.rendering. Structured
 * templates leave it empty — their markup is the shared React component, not
 * per-template code — so only templates that actually carry code get the
 * html/css/js tabs.
 */
const readRendering = (body: Record<string, unknown>) => {
  const rendering = (body.rendering ?? {}) as Record<string, unknown>;
  const str = (key: string) => (typeof rendering[key] === "string" ? (rendering[key] as string) : "");

  return {
    mode: typeof rendering.mode === "string" ? rendering.mode : "structured",
    html: str("html"),
    css: str("css"),
    js: str("js"),
  };
};

const hasEditableCode = (body: Record<string, unknown>): boolean => {
  const { mode, html, css, js } = readRendering(body);

  return mode === "custom_code" || mode === "raw_package" || !!(html || css || js);
};

type TemplateEditDialogProps = {
  template: TemplateLibraryCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function TemplateEditDialog({
  template,
  open,
  onOpenChange,
  onSaved,
}: TemplateEditDialogProps) {
  const [files, setFiles] = React.useState<VirtualFile[]>([]);
  const [label, setLabel] = React.useState("");
  const [changelog, setChangelog] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [jsonError, setJsonError] = React.useState<string | null>(null);
  const [fullscreen, setFullscreen] = React.useState(true);
  const [showPreview, setShowPreview] = React.useState(true);
  const previewFrame = React.useRef<HTMLIFrameElement | null>(null);
  const [frameReady, setFrameReady] = React.useState(false);

  // Load the full template (current version body) whenever the dialog opens.
  React.useEffect(() => {
    if (!open || !template) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setJsonError(null);
    setLabel("");
    setChangelog("");
    setFullscreen(true);
    // A fresh iframe mounts per template; wait for it to announce itself again
    // before posting edits, or the first message lands on a dead frame.
    setFrameReady(false);

    fetchTemplate(template.id)
      .then(({ data: raw }) => {
        if (cancelled) return;
        const data = raw as TemplateLibraryCard & {
          versions?: {
            id: number;
            version: string;
            label: string;
            changelog: string | null;
            schema: unknown;
            body: unknown;
            created_at: string | null;
          }[];
        };
        const current =
          Array.isArray(data.versions) && data.versions.length > 0
            ? data.versions[0]
            : null;
        // Raw body, NOT resolveLandingTemplate(): the resolver is a whitelist
        // that silently drops any key it does not know about, so editing the
        // normalized copy hid whole sections and saving them deleted the
        // original. The editor now round-trips the stored body verbatim.
        const body = (current?.body ?? data.preview ?? {}) as Record<string, unknown>;
        const code = readRendering(body);

        setFiles([
          {
            name: LANDING_TEMPLATE_FILE,
            language: "json",
            content: JSON.stringify(body, null, 2),
          },
          // Only templates carrying their own page code get code tabs.
          ...(hasEditableCode(body)
            ? [
                { name: MARKUP_FILE, language: "html", content: code.html },
                { name: STYLES_FILE, language: "css", content: code.css },
                { name: SCRIPT_FILE, language: "javascript", content: code.js },
              ]
            : []),
        ]);
        setLabel(current?.label ? `Edit: ${current.label}` : "Edited copy");
        setChangelog("");
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load the template content.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, template]);

  const fileContent = React.useCallback(
    (name: string) => files.find((file) => file.name === name)?.content ?? "",
    [files],
  );

  const currentContent = fileContent(LANDING_TEMPLATE_FILE);
  const markup = fileContent(MARKUP_FILE);
  const styles = fileContent(STYLES_FILE);
  const script = fileContent(SCRIPT_FILE);
  const codeTabsOpen = files.some((file) => file.name === MARKUP_FILE);

  // `body` is what gets SAVED — kept raw so nothing is lost. `preview` is the
  // same content run through the resolver, which fills in defaults the render
  // components expect. Only the preview may be normalized.
  const parsed = React.useMemo(() => {
    try {
      const raw = JSON.parse(currentContent) as Record<string, unknown>;

      // Fold the code tabs back into body.rendering so edits to index.html /
      // styles.css / script.js are what actually gets saved.
      if (codeTabsOpen) {
        raw.rendering = {
          ...((raw.rendering ?? {}) as Record<string, unknown>),
          html: markup,
          css: styles,
          js: script,
        };
      }

      return {
        body: raw,
        preview: resolveLandingTemplate(raw),
        error: null as string | null,
      };
    } catch (caught) {
      return {
        body: {} as Record<string, unknown>,
        preview: resolveLandingTemplate(undefined),
        error:
          caught instanceof Error ? caught.message : "Invalid JSON content.",
      };
    }
  }, [currentContent, codeTabsOpen, markup, styles, script]);

  React.useEffect(() => {
    setJsonError(parsed.error);
  }, [parsed.error]);

  // Published templates preview through the real Next.js component (same route
  // the library's Preview button uses), driven live by the edited JSON. Drafts
  // are not exposed on that public route, so they keep the generic HTML render.
  const useLivePreview = !!template?.is_published;

  const previewHtml = React.useMemo(() => {
    if (useLivePreview || jsonError || !template) return "";
    try {
      return buildTenantLandingPreviewHtml(
        parsed.preview,
        template.name,
        template.business_types?.[0] ?? "Business",
      );
    } catch {
      return "";
    }
  }, [useLivePreview, jsonError, parsed.preview, template]);

  React.useEffect(() => {
    if (!useLivePreview) return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string } | null)?.type === `${LANDING_PREVIEW_MESSAGE}:ready`) {
        setFrameReady(true);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [useLivePreview]);

  // Push edits into the frame, debounced so typing does not re-render per key.
  React.useEffect(() => {
    if (!useLivePreview || !frameReady || jsonError) return;

    const timer = setTimeout(() => {
      previewFrame.current?.contentWindow?.postMessage(
        { type: LANDING_PREVIEW_MESSAGE, body: parsed.body },
        window.location.origin,
      );
    }, 400);

    return () => clearTimeout(timer);
  }, [useLivePreview, frameReady, jsonError, parsed.body]);
  // The frame resolves defaults itself, so the raw body is what it wants.

  const previewNode = useLivePreview && template ? (
    <iframe
      ref={previewFrame}
      title={`${template.name} live preview`}
      src={`/landing-preview/${template.slug}`}
      className="h-full w-full border-0"
    />
  ) : undefined;

  const handleSave = async () => {
    if (!template) return;
    if (jsonError) {
      toast.error("Please fix the JSON errors before saving.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { message } = await createTemplateVersion(template.id, {
        body: parsed.body,
        label: label.trim() || "Edited template",
        changelog: changelog.trim() || "Content updated from the Landing Library.",
      });
      toast.success(message ?? "Template updated.");
      onSaved();
      onOpenChange(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to save the template.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onOpenChange(false)}>
      <DialogContent
        className={cn(
          "border-border/60 bg-background/95 p-0 backdrop-blur-xl",
          fullscreen
            ? "flex h-[100dvh] w-screen max-w-none flex-col overflow-hidden rounded-none border-0 sm:max-w-none"
            : "max-h-[94vh] w-[min(1400px,97vw)] overflow-y-auto rounded-[1.75rem] sm:max-w-[1400px]",
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border/40 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2 font-space text-lg font-black uppercase tracking-tight">
              <Sparkles className="h-5 w-5 text-primary" />
              Edit Template
              <span className="text-xs font-semibold normal-case tracking-normal text-muted-foreground">
                {template?.name} · v{template?.current_version}
              </span>
            </DialogTitle>
            <div className="flex shrink-0 items-center gap-2">
              {template?.is_published && (
                <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Published — saving creates a new version
                </span>
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
          <DialogDescription>
            Edit the structured landing-page JSON. Saving publishes a new
            version of this template; tenants assigned to it pick up the latest
            version when they customize.
          </DialogDescription>
        </DialogHeader>

        <div className={cn("space-y-4 p-5", fullscreen && "min-h-0 flex-1 overflow-y-auto")}>
          {error && (
            <div className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[30rem] items-center justify-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading template content…
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                    Version label
                  </Label>
                  <Input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Redesigned hero + new testimonials"
                    className="h-10 rounded-xl border-border/60 bg-background/70"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                    Changelog
                  </Label>
                  <Input
                    value={changelog}
                    onChange={(e) => setChangelog(e.target.value)}
                    placeholder="What changed in this version?"
                    className="h-10 rounded-xl border-border/60 bg-background/70"
                  />
                </div>
              </div>

              {jsonError ? (
                <div className="flex items-center gap-2 rounded-[1rem] border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Invalid JSON detected. Fix the errors before saving.
                </div>
              ) : null}

              <CodeEditor
                files={files}
                setFiles={setFiles}
                showPreview={showPreview}
                setShowPreview={setShowPreview}
                previewHtml={previewHtml}
                previewNode={previewNode}
                className={cn("min-h-[32rem]", fullscreen && "flex-1")}
              />
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/40 bg-background/60 px-5 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-border/60 bg-background/70"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setJsonError(null);
              setError(null);
            }}
            className="rounded-xl"
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset Errors
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loading || !!jsonError}
            className="rounded-xl px-5 font-semibold"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save New Version
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TemplateEditDialog;
