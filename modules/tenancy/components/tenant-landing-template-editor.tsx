"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Code,
  Eye,
  LayoutTemplate,
  RefreshCcw,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeEditor, type VirtualFile } from "@/components/ui/code-editor";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getBackendOrigin } from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import type { TenantLandingTemplateVariant } from "@/modules/tenancy/landing-template";
import type { TemplateLibraryCard } from "@/modules/landing-templates/lib/api";

type TenantLandingTemplateEditorProps = {
  businessTypeLabel: string;
  businessTypeDescription: string;
  templateVariants: TenantLandingTemplateVariant[];
  selectedTemplateKey: string;
  onTemplateVariantChange: (value: string) => void;
  onResetTemplate: () => void;
  isCustomTemplate: boolean;
  files: VirtualFile[];
  setFiles: (files: VirtualFile[]) => void;
  showPreview: boolean;
  setShowPreview: (value: boolean) => void;
  previewHtml: string;
  selectedLibraryTemplate?: TemplateLibraryCard | null;
  selectedTemplateName?: string | null;
  selectedTemplateDescription?: string | null;
  onOpenLibraryPicker?: () => void;
  onLivePreview?: () => void;
};

export function TenantLandingTemplateEditor({
  businessTypeLabel,
  businessTypeDescription,
  templateVariants,
  selectedTemplateKey,
  onTemplateVariantChange,
  onResetTemplate,
  isCustomTemplate,
  files,
  setFiles,
  showPreview,
  setShowPreview,
  previewHtml,
  selectedLibraryTemplate,
  selectedTemplateName,
  selectedTemplateDescription,
  onOpenLibraryPicker,
  onLivePreview,
}: TenantLandingTemplateEditorProps) {
  const selectedVariant =
    templateVariants.find((variant) => variant.key === selectedTemplateKey) ?? templateVariants[0] ?? null;

  const displayThumbnail = selectedLibraryTemplate?.thumbnail
    ? `${getBackendOrigin()}${selectedLibraryTemplate.thumbnail}`
    : null;

  return (
    <div className="space-y-5">
      {/* Top Banner with Library CTA */}
      <div className="overflow-hidden rounded-[1.75rem] border border-border/50 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.02),rgba(15,23,42,0.08))]">
        <div className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="max-w-2xl">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.28em] text-primary flex items-center gap-1.5">
              <LayoutTemplate className="h-4 w-4" />
              Landing Template Selection
            </h4>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Select from master templates in the <span className="font-semibold text-foreground">Landing Library</span> for <span className="font-semibold text-foreground">{businessTypeLabel}</span>, or fine-tune content directly in the code editor below.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenLibraryPicker && (
              <Button
                type="button"
                onClick={onOpenLibraryPicker}
                className="rounded-xl px-4 font-bold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground gap-2 h-10"
              >
                <Sparkles className="h-4 w-4" />
                Choose from Library
              </Button>
            )}

            {onLivePreview && (
              <Button
                type="button"
                variant="outline"
                onClick={onLivePreview}
                className="rounded-xl border-border/60 bg-background/80 hover:bg-muted/40 text-foreground font-semibold gap-2 h-10"
              >
                <Eye className="h-4 w-4" />
                Popout Preview
              </Button>
            )}

            <Button asChild type="button" variant="ghost" size="sm" className="rounded-xl text-xs text-muted-foreground">
              <Link href="/dashboard/landing-library" target="_blank">
                Full Library
                <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Selected Template Info Bar & Mode Selector */}
      <div className="rounded-[1.75rem] border border-border/50 bg-card/40 p-4 sm:p-5 space-y-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Template Variant
                </Label>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] border-transparent",
                    isCustomTemplate
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  )}
                >
                  {isCustomTemplate ? "Modified Copy" : "Preset Master"}
                </Badge>
              </div>
              <Select value={selectedTemplateKey} onValueChange={onTemplateVariantChange}>
                <SelectTrigger className="h-11 bg-background/75">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/60 shadow-xl">
                  {templateVariants.map((variant) => (
                    <SelectItem key={variant.key} value={variant.key}>
                      {variant.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 rounded-[1.25rem] border border-border/50 bg-background/60 p-3">
              {displayThumbnail ? (
                <img
                  src={displayThumbnail}
                  alt={selectedLibraryTemplate?.name || "Template"}
                  className="h-12 w-16 rounded-lg object-cover object-top border border-border/40 shrink-0"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shrink-0">
                  <LayoutTemplate className="h-6 w-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {selectedLibraryTemplate?.name || selectedTemplateName || selectedVariant?.label || "Template"}
                  </p>
                  {selectedLibraryTemplate?.current_version && (
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                      v{selectedLibraryTemplate.current_version}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {selectedLibraryTemplate?.description || selectedTemplateDescription || selectedVariant?.description || businessTypeDescription}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onResetTemplate}
              className="h-11 rounded-xl border-border/60 bg-background/75 px-4 text-xs font-medium"
            >
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset Copy
            </Button>
          </div>
        </div>

        {/* View Mode Toggle: Code Editor vs Live Preview */}
        <div className="flex items-center justify-between border-t border-border/40 pt-3 gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl border border-border/40">
            <Button
              type="button"
              variant={!showPreview ? "default" : "ghost"}
              size="sm"
              onClick={() => setShowPreview(false)}
              className={cn(
                "h-8 px-3.5 rounded-lg text-xs font-semibold gap-1.5 transition-all",
                !showPreview ? "shadow-sm bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Code className="h-3.5 w-3.5" />
              Code Editor (JSON)
            </Button>
            <Button
              type="button"
              variant={showPreview ? "default" : "ghost"}
              size="sm"
              onClick={() => setShowPreview(true)}
              className={cn(
                "h-8 px-3.5 rounded-lg text-xs font-semibold gap-1.5 transition-all",
                showPreview ? "shadow-sm bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              Live Preview
            </Button>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {!showPreview ? "Editing raw JSON schema in Monaco" : "Rendering live sandboxed preview"}
          </span>
        </div>
      </div>

      <CodeEditor
        files={files}
        setFiles={setFiles}
        showPreview={showPreview}
        setShowPreview={setShowPreview}
        previewHtml={previewHtml}
        className="min-h-[34rem]"
      />
    </div>
  );
}

export default TenantLandingTemplateEditor;
