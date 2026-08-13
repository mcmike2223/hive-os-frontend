"use client";

import Link from "next/link";
import * as React from "react";
import { ArrowUpRight, LayoutTemplate, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeEditor, type VirtualFile } from "@/components/ui/code-editor";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TenantLandingTemplateVariant } from "@/modules/tenancy/landing-template";

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
}: TenantLandingTemplateEditorProps) {
  const selectedVariant =
    templateVariants.find((variant) => variant.key === selectedTemplateKey) ?? templateVariants[0] ?? null;

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[1.75rem] border border-border/50 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.02),rgba(15,23,42,0.08))]">
        <div className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-end lg:justify-between lg:px-6">
          <div className="max-w-3xl">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.28em] text-primary">
              Landing Template Selection
            </h4>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Choose one reusable template for <span className="font-semibold text-foreground">{businessTypeLabel}</span>, then tailor the tenant copy below. Global template creation now lives in Landing Templates so this dialog stays focused on the tenant itself.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
              {templateVariants.length} available
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "border-transparent",
                isCustomTemplate
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
              )}
            >
              {isCustomTemplate ? "Tenant copy edited" : "Preset copy"}
            </Badge>
            <Button asChild type="button" variant="outline" className="rounded-xl border-border/60 bg-background/75">
              <Link href="/dashboard/landing-templates">
                Manage Templates
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-border/50 bg-card/40 p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Template
              </Label>
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

            <div className="rounded-[1.25rem] border border-border/50 bg-background/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">
                  {selectedVariant?.label ?? "Template"}
                </p>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {selectedVariant?.description || businessTypeDescription}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={onResetTemplate}
            className="h-11 rounded-xl border-border/60 bg-background/75 px-4"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Reset to Selected Template
          </Button>
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
