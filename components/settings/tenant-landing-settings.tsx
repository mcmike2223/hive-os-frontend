"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  Building2,
  Code2,
  Droplets,
  Hotel,
  LayoutTemplate,
  Loader2,
  RefreshCcw,
  Save,
  Sparkles,
  Sprout,
  Stethoscope,
  Store,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeEditor, type VirtualFile } from "@/components/ui/code-editor";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getAuthHeaders, getBackendApiRoot, getWorkspaceScopeKey } from "@/lib/runtime-context";
import {
  buildTenantLandingPreviewHtml,
  FALLBACK_TENANT_BUSINESS_TYPES,
  formatLandingTemplateJson,
  mergeTenantEditableTemplateWithDesign,
  parseLandingTemplateJson,
  resolveBusinessTypeCatalog,
  resolveLandingTemplate,
  resolveTemplateVariant,
  stripTemplateCodeForTenantEditor,
  type TenantLandingPreviewBranding,
  type TenantBusinessTypeDefinition,
  type TenantLandingTemplate,
} from "@/modules/tenancy/landing-template";

const LANDING_TEMPLATE_FILE = "landing-template.json";

const createTemplateFiles = (content: string): VirtualFile[] => [
  {
    name: LANDING_TEMPLATE_FILE,
    language: "json",
    content,
  },
];

const iconMap = {
  "layout-dashboard": LayoutTemplate,
  store: Store,
  "utensils-crossed": Store, // Fallback
  hotel: Hotel,
  stethoscope: Stethoscope,
  truck: Truck,
  droplets: Droplets,
  sprout: Sprout,
  "code-2": Code2,
  sparkles: Sparkles,
  "building-2": Building2,
} as const;

function getErrorMessage(error: unknown, fallback = "Something went wrong.") {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return fallback;
}

async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${getBackendApiRoot()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const headers: HeadersInit = getAuthHeaders(
    options.body && typeof options.body === "string"
      ? { "Content-Type": "application/json" }
      : {},
  );

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || `Request failed with status ${response.status}.`);
  }

  return response.json();
}

export function TenantLandingSettings() {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const workspaceScope = getWorkspaceScopeKey();
  const [catalog, setCatalog] = React.useState<TenantBusinessTypeDefinition[]>([]);
  const [selectedBusinessTypeKey, setSelectedBusinessTypeKey] = React.useState("general");
  const [selectedTemplateKey, setSelectedTemplateKey] = React.useState("signature");
  const [templateFiles, setTemplateFiles] = React.useState<VirtualFile[]>([]);
  const [showPreview, setShowPreview] = React.useState(true);
  const [previewMode, setPreviewMode] = React.useState<"system" | "light" | "dark">("system");
  const [jsonError, setJsonError] = React.useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["tenant-landing-page-settings", workspaceScope],
    queryFn: () => apiFetch("/settings/landing"),
    throwOnError: false,
    retry: 1,
  });

  const { data: brandingData } = useQuery({
    queryKey: ["landing-template-preview-branding", workspaceScope],
    queryFn: () => apiFetch("/settings/brand/public"),
    throwOnError: false,
    retry: 1,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { business_type: string; landing_page_template: TenantLandingTemplate }) =>
      apiFetch("/settings/landing", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-landing-page-settings"] });
      queryClient.invalidateQueries({ queryKey: ["tenantPublicLanding"] });
      toast.success("Landing page template saved successfully.");
    },
    onError: (caught) => {
      toast.error(getErrorMessage(caught, "Failed to save landing template."));
    },
  });

  React.useEffect(() => {
    if (data?.data) {
      try {
        const nextCatalog = resolveBusinessTypeCatalog(
          data.data.business_types ?? FALLBACK_TENANT_BUSINESS_TYPES,
        );
        setCatalog(nextCatalog);

        const currentBusinessTypeKey = data.data.business_type || "general";
        setSelectedBusinessTypeKey(currentBusinessTypeKey);

        const activeTemplate = resolveLandingTemplate(data.data.landing_page_template);
        const templateKey = activeTemplate.meta?.template_key || "signature";
        setSelectedTemplateKey(templateKey);

        setTemplateFiles(createTemplateFiles(formatLandingTemplateJson(stripTemplateCodeForTenantEditor(activeTemplate))));
        setJsonError(null);
      } catch (caught) {
        console.error("[TenantLandingSettings] Initialization failed:", caught);
      }
    }
  }, [data]);

  const activeBusinessType = React.useMemo(() => {
    return catalog.find((item) => item.key === selectedBusinessTypeKey) ?? catalog[0] ?? FALLBACK_TENANT_BUSINESS_TYPES[0];
  }, [catalog, selectedBusinessTypeKey]);

  const templateVariants = React.useMemo(() => {
    return activeBusinessType?.templates ?? [];
  }, [activeBusinessType]);

  const activeTemplateVariant = React.useMemo(() => {
    return templateVariants.find((v) => v.key === selectedTemplateKey) ?? templateVariants[0];
  }, [templateVariants, selectedTemplateKey]);

  const previewColorMode = React.useMemo<"light" | "dark">(() => {
    if (previewMode === "light") return "light";
    if (previewMode === "dark") return "dark";
    return resolvedTheme === "light" ? "light" : "dark";
  }, [previewMode, resolvedTheme]);

  const previewBranding = React.useMemo<TenantLandingPreviewBranding | null>(() => {
    const payload = brandingData?.data;
    if (!payload || typeof payload !== "object") {
      return null;
    }
    return {
      app_title: typeof payload.app_title === "string" ? payload.app_title : undefined,
      footer_text: typeof payload.footer_text === "string" ? payload.footer_text : undefined,
      primary_color: typeof payload.primary_color === "string" ? payload.primary_color : undefined,
      font_family: typeof payload.font_family === "string" ? payload.font_family : undefined,
    };
  }, [brandingData]);

  const currentTemplateContent = templateFiles[0]?.content ?? "{}";

  const parsedTemplateState = React.useMemo(() => {
    try {
      return {
        template: parseLandingTemplateJson(
          currentTemplateContent,
          activeBusinessType?.default_template,
        ),
        error: null as string | null,
      };
    } catch (caught) {
      return {
        template: resolveLandingTemplate(
          activeTemplateVariant?.template ?? activeBusinessType?.default_template,
        ),
        error: getErrorMessage(caught, "Invalid JSON"),
      };
    }
  }, [activeBusinessType, activeTemplateVariant, currentTemplateContent]);

  const previewTemplate = React.useMemo(() => {
    return mergeTenantEditableTemplateWithDesign(
      activeTemplateVariant?.template ?? activeBusinessType.default_template,
      parsedTemplateState.template,
    );
  }, [activeBusinessType.default_template, activeTemplateVariant?.template, parsedTemplateState.template]);

  const previewHtml = React.useMemo(() => {
    try {
      return buildTenantLandingPreviewHtml(
        previewTemplate,
        previewBranding?.app_title || activeBusinessType?.label || "My Business",
        activeBusinessType?.label || "General Business",
        {
          colorMode: previewColorMode,
          branding: previewBranding,
        },
      );
    } catch (caught) {
      return `
        <div style="padding:16px;font-family:ui-sans-serif,system-ui,sans-serif;">
          <strong>Preview unavailable</strong>
          <p style="margin-top:8px;">${getErrorMessage(caught, "Could not render preview.")}</p>
        </div>
      `;
    }
  }, [activeBusinessType, previewTemplate, previewBranding, previewColorMode]);

  React.useEffect(() => {
    setJsonError(parsedTemplateState.error);
  }, [parsedTemplateState.error]);

  const handleBusinessTypeChange = (nextKey: string) => {
    const nextBusinessType = catalog.find((item) => item.key === nextKey);
    if (!nextBusinessType) return;

    setSelectedBusinessTypeKey(nextKey);
    const defaultTemplateKey = nextBusinessType.default_template_key || "signature";
    setSelectedTemplateKey(defaultTemplateKey);

    const variant = resolveTemplateVariant(nextBusinessType, defaultTemplateKey);
    setTemplateFiles(createTemplateFiles(formatLandingTemplateJson(stripTemplateCodeForTenantEditor(variant.template))));
    setJsonError(null);
  };

  const handleTemplateVariantChange = (nextKey: string) => {
    setSelectedTemplateKey(nextKey);
    const variant = resolveTemplateVariant(activeBusinessType, nextKey);
    setTemplateFiles(createTemplateFiles(formatLandingTemplateJson(stripTemplateCodeForTenantEditor(variant.template))));
    setJsonError(null);
  };

  const handleResetTemplate = () => {
    const variant = resolveTemplateVariant(activeBusinessType, selectedTemplateKey);
    setTemplateFiles(createTemplateFiles(formatLandingTemplateJson(stripTemplateCodeForTenantEditor(variant.template))));
    setJsonError(null);
    toast.info("Editor reset to the preset template.");
  };

  const handleSave = () => {
    if (jsonError) {
      toast.error("Please fix any JSON errors before saving.");
      return;
    }
    saveMutation.mutate({
      business_type: selectedBusinessTypeKey,
      landing_page_template: previewTemplate,
    });
  };

  if (isLoading) {
    return (
      <div className="rounded-[2rem] border border-border/50 bg-card/40 p-8">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading landing template settings...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="overflow-hidden rounded-[2rem] border border-destructive/30 bg-destructive/5 p-8">
        <h3 className="text-base font-black text-foreground">Failed to load landing settings</h3>
        <p className="mt-1 text-sm text-muted-foreground">{getErrorMessage(error)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-border/50 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.02),rgba(15,23,42,0.08))]">
        <div className="flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h3 className="text-xl font-black tracking-tight text-foreground">
              Customize Your Landing Page
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Select your business type and choose from our pre-designed responsive templates. Customize the colors, copy, and sections directly in JSON to match your brand.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="rounded-xl px-5 font-semibold">
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Commit Landing Settings
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <div className="space-y-4 rounded-[2rem] border border-border/50 bg-card/40 p-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary">
              Business Category
            </Label>
            <div className="mt-2">
              <Select value={selectedBusinessTypeKey} onValueChange={handleBusinessTypeChange}>
                <SelectTrigger className="h-11 w-full bg-background/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/60 shadow-xl">
                  {catalog.map((bt) => (
                    <SelectItem key={bt.key} value={bt.key}>
                      {bt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              {activeBusinessType?.description}
            </p>
          </div>

          <div className="border-t border-border/40 pt-4 space-y-4">
            <Label className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary">
              Template Variant
            </Label>
            <div className="space-y-2">
              {templateVariants.map((variant) => {
                const Icon = iconMap[activeBusinessType?.icon as keyof typeof iconMap] || LayoutTemplate;
                const isSelected = variant.key === selectedTemplateKey;

                return (
                  <button
                    key={variant.key}
                    type="button"
                    onClick={() => handleTemplateVariantChange(variant.key)}
                    className={cn(
                      "w-full rounded-[1rem] border px-3 py-3 text-left transition-all flex gap-3 items-center",
                      isSelected
                        ? "border-primary/30 bg-primary/5 text-primary shadow-sm"
                        : "border-border/40 bg-background/50 text-muted-foreground hover:border-border hover:bg-background",
                    )}
                  >
                    <div className={cn("p-2 rounded-lg shrink-0", isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{variant.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate leading-relaxed mt-0.5">{variant.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-border/50 bg-card/40 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary font-mono text-[10px] uppercase">
                  {selectedTemplateKey} Preset
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Business type: <span className="font-semibold text-foreground">{activeBusinessType?.label}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={previewMode}
                  onValueChange={(value: "system" | "light" | "dark") => setPreviewMode(value)}
                >
                  <SelectTrigger className="h-9 w-32 bg-background/70 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/60 shadow-xl">
                    <SelectItem value="system">System Mode</SelectItem>
                    <SelectItem value="light">Light Mode</SelectItem>
                    <SelectItem value="dark">Dark Mode</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="sm" onClick={handleResetTemplate} className="h-9 rounded-lg px-3">
                  <RefreshCcw className="mr-2 h-3.5 w-3.5" />
                  Reset to Preset
                </Button>
              </div>
            </div>

            {jsonError ? (
              <div className="mt-4 rounded-[1rem] border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive">
                Invalid JSON detected. Please resolve errors before saving your landing configurations.
              </div>
            ) : null}
          </div>

          <CodeEditor
            files={templateFiles}
            setFiles={(files) => setTemplateFiles(files.slice(0, 1))}
            showPreview={showPreview}
            setShowPreview={setShowPreview}
            previewHtml={previewHtml}
            className="min-h-[46rem]"
          />
        </div>
      </div>
    </div>
  );
}

export default TenantLandingSettings;
