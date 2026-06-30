"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  ArrowUpRight,
  Building2,
  Copy,
  Hotel,
  LayoutTemplate,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Sparkles,
  Stethoscope,
  Store,
  Trash2,
  Truck,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeEditor, type VirtualFile } from "@/components/ui/code-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getAuthHeaders, getBackendApiRoot, getWorkspaceScopeKey } from "@/lib/runtime-context";
import {
  applyLandingTemplateMeta,
  buildTenantLandingPreviewHtml,
  FALLBACK_TENANT_BUSINESS_TYPES,
  formatLandingTemplateJson,
  parseLandingTemplateJson,
  resolveBusinessTypeCatalog,
  resolveLandingTemplate,
  resolveTemplateVariant,
  type TenantLandingPreviewBranding,
  type TenantBusinessTypeDefinition,
  type TenantLandingTemplateVariant,
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
  "utensils-crossed": UtensilsCrossed,
  hotel: Hotel,
  stethoscope: Stethoscope,
  truck: Truck,
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

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
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

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });
  } catch (networkError) {
    throw new Error(getErrorMessage(networkError, "Network error. Could not reach the server."));
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;

    try {
      const payload = await response.json();
      if (payload && typeof payload.message === "string" && payload.message) {
        message = payload.message;
      }
    } catch {
      // keep status-based fallback
    }

    throw new Error(message);
  }

  try {
    return await response.json();
  } catch {
    throw new Error("Server returned a non-JSON response.");
  }
}

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const createUniqueTemplateKey = (
  templates: TenantLandingTemplateVariant[],
  requestedKey: string,
) => {
  const existingKeys = new Set((templates ?? []).map((item) => item.key));
  let nextKey = requestedKey;
  let suffix = 2;

  while (existingKeys.has(nextKey)) {
    nextKey = `${requestedKey}-${suffix}`;
    suffix += 1;
  }

  return nextKey;
};

const updateBusinessTypeTemplate = (
  catalog: TenantBusinessTypeDefinition[],
  businessTypeKey: string,
  templateKey: string,
  updater: (
    variant: TenantLandingTemplateVariant,
    businessType: TenantBusinessTypeDefinition,
  ) => TenantLandingTemplateVariant,
): TenantBusinessTypeDefinition[] =>
  catalog.map((definition) => {
    if (definition.key !== businessTypeKey) {
      return definition;
    }

    const templates = (definition.templates ?? []).map((variant) =>
      variant.key === templateKey ? updater(variant, definition) : variant,
    );

    const defaultVariant = resolveTemplateVariant(
      {
        ...definition,
        templates,
      },
      definition.default_template_key,
    );

    return {
      ...definition,
      default_template: defaultVariant.template,
      templates,
    };
  });

export function TenantLandingTemplateSettings() {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const workspaceScope = getWorkspaceScopeKey();
  const [catalog, setCatalog] = React.useState<TenantBusinessTypeDefinition[]>([]);
  const [selectedBusinessTypeKey, setSelectedBusinessTypeKey] = React.useState("general");
  const [selectedTemplateKey, setSelectedTemplateKey] = React.useState("signature");
  const [templateFiles, setTemplateFiles] = React.useState<VirtualFile[]>([]);
  const [showPreview, setShowPreview] = React.useState(true);
  const [previewMode, setPreviewMode] = React.useState<"system" | "light" | "dark">("system");
  const [draftTemplateName, setDraftTemplateName] = React.useState("");
  const [showCodeComposer, setShowCodeComposer] = React.useState(false);
  const [codeTemplateName, setCodeTemplateName] = React.useState("");
  const [codeTemplateDescription, setCodeTemplateDescription] = React.useState("");
  const [codeTemplateBody, setCodeTemplateBody] = React.useState("");
  const [codeTemplateHtml, setCodeTemplateHtml] = React.useState("");
  const [codeTemplateCss, setCodeTemplateCss] = React.useState("");
  const [jsonError, setJsonError] = React.useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["landing-template-settings", workspaceScope],
    queryFn: () => apiFetch("/settings/landing-templates"),
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
    mutationFn: (payload: { business_types: TenantBusinessTypeDefinition[] }) =>
      apiFetch("/settings/landing-templates", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (response) => {
      const nextCatalog = resolveBusinessTypeCatalog(response?.data?.business_types ?? catalog);
      setCatalog(nextCatalog);
      queryClient.invalidateQueries({ queryKey: ["landing-template-settings"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-subscription-catalog"] });
      toast.success("Landing templates saved.");
    },
    onError: (caught) => {
      toast.error(getErrorMessage(caught, "Failed to save landing templates."));
    },
  });

  React.useEffect(() => {
    try {
      const nextCatalog = resolveBusinessTypeCatalog(
        data?.data?.business_types ?? FALLBACK_TENANT_BUSINESS_TYPES,
      );

      setCatalog(nextCatalog);

      const nextBusinessType =
        nextCatalog.find((item) => item.key === selectedBusinessTypeKey) ?? nextCatalog[0];

      if (!nextBusinessType) {
        return;
      }

      const nextVariant = resolveTemplateVariant(
        nextBusinessType,
        selectedTemplateKey || nextBusinessType.default_template_key,
      );

      setSelectedBusinessTypeKey(nextBusinessType.key);
      setSelectedTemplateKey(nextVariant.key);
      setTemplateFiles(createTemplateFiles(formatLandingTemplateJson(nextVariant.template)));
      setJsonError(null);
    } catch (caught) {
      console.error("[LandingTemplates] Failed to resolve catalog from API response:", caught);

      const fallbackCatalog = resolveBusinessTypeCatalog(FALLBACK_TENANT_BUSINESS_TYPES);
      setCatalog(fallbackCatalog);

      const firstBusinessType = fallbackCatalog[0];
      if (!firstBusinessType) {
        return;
      }

      const firstVariant = resolveTemplateVariant(
        firstBusinessType,
        selectedTemplateKey || firstBusinessType.default_template_key,
      );

      setSelectedBusinessTypeKey(firstBusinessType.key);
      setSelectedTemplateKey(firstVariant.key);
      setTemplateFiles(createTemplateFiles(formatLandingTemplateJson(firstVariant.template)));
      setJsonError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const businessTypeMap = React.useMemo(
    () => Object.fromEntries(catalog.map((item) => [item.key, item])),
    [catalog],
  );

  const activeBusinessType =
    businessTypeMap[selectedBusinessTypeKey] ?? catalog[0] ?? FALLBACK_TENANT_BUSINESS_TYPES[0];

  const fallbackVariant = React.useMemo(
    () => resolveTemplateVariant(activeBusinessType, activeBusinessType?.default_template_key),
    [activeBusinessType],
  );

  const templateVariants = React.useMemo(() => {
    const variants = activeBusinessType?.templates ?? [];
    return variants.length > 0 ? variants : [fallbackVariant];
  }, [activeBusinessType?.templates, fallbackVariant]);

  const activeTemplateVariant =
    templateVariants.find((variant) => variant.key === selectedTemplateKey) ??
    fallbackVariant;

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

  const safeTemplateFiles = React.useMemo(() => {
    if (templateFiles.length > 0) {
      return templateFiles;
    }

    return createTemplateFiles(
      formatLandingTemplateJson(
        activeTemplateVariant?.template ?? activeBusinessType.default_template,
      ),
    );
  }, [templateFiles, activeTemplateVariant?.template, activeBusinessType.default_template]);

  const currentTemplateContent = safeTemplateFiles[0]?.content ?? "{}";

  const parsedTemplateState = React.useMemo(() => {
    try {
      return {
        template: parseLandingTemplateJson(
          currentTemplateContent,
          activeBusinessType.default_template,
        ),
        error: null as string | null,
      };
    } catch (caught) {
      return {
        template: resolveLandingTemplate(
          activeTemplateVariant?.template ?? activeBusinessType.default_template,
        ),
        error: getErrorMessage(caught, "Invalid JSON"),
      };
    }
  }, [activeBusinessType.default_template, activeTemplateVariant?.template, currentTemplateContent]);

  const previewHtml = React.useMemo(() => {
    try {
      return buildTenantLandingPreviewHtml(
        parsedTemplateState.template,
        previewBranding?.app_title || activeTemplateVariant?.label || activeBusinessType.label,
        activeBusinessType.label,
        {
          colorMode: previewColorMode,
          branding: previewBranding,
        },
      );
    } catch (caught) {
      console.error("[LandingTemplates] Preview build failed:", caught);
      return `
        <div style="padding:16px;font-family:ui-sans-serif,system-ui,sans-serif;">
          <strong>Preview unavailable</strong>
          <p style="margin-top:8px;">${getErrorMessage(caught, "Could not render the template preview.")}</p>
        </div>
      `;
    }
  }, [
    activeBusinessType.label,
    activeTemplateVariant?.label,
    parsedTemplateState.template,
    previewBranding,
    previewColorMode,
  ]);

  React.useEffect(() => {
    setJsonError(parsedTemplateState.error);
  }, [parsedTemplateState.error]);

  const setEditorFromVariant = React.useCallback((variant: TenantLandingTemplateVariant) => {
    setTemplateFiles(createTemplateFiles(formatLandingTemplateJson(variant.template)));
    setJsonError(null);
  }, []);

  const commitCurrentTemplateToCatalog = React.useCallback(
    (sourceCatalog: TenantBusinessTypeDefinition[]) => {
      if (jsonError) {
        return sourceCatalog;
      }

      const businessType = sourceCatalog.find((item) => item.key === selectedBusinessTypeKey);
      const variant = businessType?.templates?.find((item) => item.key === selectedTemplateKey);

      if (!businessType || !variant) {
        return sourceCatalog;
      }

      const committedTemplate = applyLandingTemplateMeta(parsedTemplateState.template, {
        business_type: businessType.key,
        business_label: businessType.label,
        template_key: variant.key,
        template_label: variant.label,
        template_description: variant.description,
        is_custom: false,
      });

      return updateBusinessTypeTemplate(sourceCatalog, businessType.key, variant.key, () => ({
        ...variant,
        template: committedTemplate,
      }));
    },
    [jsonError, parsedTemplateState.template, selectedBusinessTypeKey, selectedTemplateKey],
  );

  const switchTemplateSelection = React.useCallback(
    (nextBusinessTypeKey: string, nextTemplateKey?: string) => {
      const committedCatalog = commitCurrentTemplateToCatalog(catalog);
      const nextBusinessType =
        committedCatalog.find((item) => item.key === nextBusinessTypeKey) ?? committedCatalog[0];

      if (!nextBusinessType) {
        return;
      }

      const nextVariant = resolveTemplateVariant(
        nextBusinessType,
        nextTemplateKey ?? nextBusinessType.default_template_key,
      );

      setCatalog(committedCatalog);
      setSelectedBusinessTypeKey(nextBusinessType.key);
      setSelectedTemplateKey(nextVariant.key);
      setEditorFromVariant(nextVariant);
    },
    [catalog, commitCurrentTemplateToCatalog, setEditorFromVariant],
  );

  const handleTemplateFilesChange = React.useCallback((files: VirtualFile[]) => {
    setTemplateFiles(files.length > 0 ? files.slice(0, 1) : []);
  }, []);

  const handleRenameSelectedTemplate = React.useCallback(
    (field: "label" | "description", value: string) => {
      const nextCatalog = updateBusinessTypeTemplate(
        commitCurrentTemplateToCatalog(catalog),
        selectedBusinessTypeKey,
        selectedTemplateKey,
        (variant, businessType) => {
          const nextLabel = field === "label" ? value : variant.label;
          const nextDescription = field === "description" ? value : variant.description;

          const nextTemplate = applyLandingTemplateMeta(parsedTemplateState.template, {
            business_type: businessType.key,
            business_label: businessType.label,
            template_key: variant.key,
            template_label: nextLabel,
            template_description: nextDescription,
            is_custom: false,
          });

          return {
            ...variant,
            label: nextLabel,
            description: nextDescription,
            template: nextTemplate,
          };
        },
      );

      setCatalog(nextCatalog);

      const nextBusinessType = nextCatalog.find((item) => item.key === selectedBusinessTypeKey);
      const nextVariant = nextBusinessType?.templates?.find(
        (item) => item.key === selectedTemplateKey,
      );

      if (nextVariant) {
        setEditorFromVariant(nextVariant);
      }
    },
    [
      catalog,
      commitCurrentTemplateToCatalog,
      parsedTemplateState.template,
      selectedBusinessTypeKey,
      selectedTemplateKey,
      setEditorFromVariant,
    ],
  );

  const handleCreateTemplate = React.useCallback(
    (duplicateCurrent: boolean) => {
      const baseCatalog = commitCurrentTemplateToCatalog(catalog);
      const targetBusinessType = baseCatalog.find(
        (item) => item.key === selectedBusinessTypeKey,
      );

      if (!targetBusinessType) {
        return;
      }

      const requestedName =
        draftTemplateName.trim() ||
        (duplicateCurrent ? `${activeTemplateVariant.label} Copy` : "New Template");

      const requestedKey = slugify(requestedName) || `template-${Date.now()}`;
      const nextKey = createUniqueTemplateKey(targetBusinessType.templates ?? [], requestedKey);

      const baseTemplate = duplicateCurrent
        ? parsedTemplateState.template
        : activeBusinessType.default_template;

      const description = duplicateCurrent
        ? `A duplicate of ${activeTemplateVariant.label}.`
        : `A reusable ${activeBusinessType.label.toLowerCase()} landing preset.`;

      const nextVariant: TenantLandingTemplateVariant = {
        key: nextKey,
        label: requestedName,
        description,
        template: applyLandingTemplateMeta(baseTemplate, {
          business_type: activeBusinessType.key,
          business_label: activeBusinessType.label,
          template_key: nextKey,
          template_label: requestedName,
          template_description: description,
          is_custom: false,
        }),
      };

      const nextCatalog = baseCatalog.map((definition) => {
        if (definition.key !== selectedBusinessTypeKey) {
          return definition;
        }

        return {
          ...definition,
          templates: [...(definition.templates ?? []), nextVariant],
        };
      });

      setCatalog(nextCatalog);
      setSelectedTemplateKey(nextVariant.key);
      setDraftTemplateName("");
      setEditorFromVariant(nextVariant);
    },
    [
      activeBusinessType.default_template,
      activeBusinessType.key,
      activeBusinessType.label,
      activeTemplateVariant.label,
      catalog,
      commitCurrentTemplateToCatalog,
      draftTemplateName,
      parsedTemplateState.template,
      selectedBusinessTypeKey,
      setEditorFromVariant,
    ],
  );

  const handleOpenCodeComposer = React.useCallback(() => {
    setCodeTemplateName(`${activeBusinessType.label} Custom`);
    setCodeTemplateDescription(`Code-authored template for ${activeBusinessType.label}.`);
    setCodeTemplateBody(currentTemplateContent);
    setCodeTemplateHtml(activeTemplateVariant.template.rendering.html || `<section class="tenant-code-hero">\n  <p>{{hero.eyebrow}}</p>\n  <h1>{{hero.title}}</h1>\n  <p>{{hero.description}}</p>\n  <a href="{{hero.primary_href}}">{{hero.primary_label}}</a>\n</section>`);
    setCodeTemplateCss(activeTemplateVariant.template.rendering.css || `.tenant-code-hero {\n  min-height: 100vh;\n  display: grid;\n  align-content: center;\n  gap: 18px;\n  padding: clamp(28px, 8vw, 96px);\n  color: #f8fafc;\n  background: linear-gradient(135deg, #020617, #0f172a);\n}\n.tenant-code-hero h1 {\n  max-width: 900px;\n  font-size: clamp(44px, 8vw, 88px);\n  line-height: .95;\n  letter-spacing: -.06em;\n}`);
    setShowCodeComposer(true);
  }, [activeBusinessType.label, activeTemplateVariant.template.rendering.css, activeTemplateVariant.template.rendering.html, currentTemplateContent]);

  const handleCreateTemplateFromCode = React.useCallback(() => {
    const baseCatalog = commitCurrentTemplateToCatalog(catalog);
    const targetBusinessType = baseCatalog.find((item) => item.key === selectedBusinessTypeKey);

    if (!targetBusinessType) {
      return;
    }

    const requestedName = codeTemplateName.trim() || `${activeBusinessType.label} Custom`;
    const requestedDescription =
      codeTemplateDescription.trim() ||
      `Code-authored template for ${activeBusinessType.label}.`;
    const requestedKey = slugify(requestedName) || `template-${Date.now()}`;
    const nextKey = createUniqueTemplateKey(targetBusinessType.templates ?? [], requestedKey);

    let parsedTemplate;
    try {
      parsedTemplate = parseLandingTemplateJson(codeTemplateBody, activeBusinessType.default_template);
    } catch (caught) {
      toast.error(getErrorMessage(caught, "Template code is not valid JSON."));
      return;
    }

    if (!codeTemplateHtml.trim()) {
      toast.error("Template HTML is required for a code-authored landing style.");
      return;
    }

    const nextVariant: TenantLandingTemplateVariant = {
      key: nextKey,
      label: requestedName,
      description: requestedDescription,
      template: applyLandingTemplateMeta(
        {
          ...parsedTemplate,
          rendering: {
            mode: "custom_code",
            html: codeTemplateHtml,
            css: codeTemplateCss,
            js: "",
            asset_base_url: "",
          },
        },
        {
          business_type: activeBusinessType.key,
          business_label: activeBusinessType.label,
          template_key: nextKey,
          template_label: requestedName,
          template_description: requestedDescription,
          is_custom: false,
        },
      ),
    };

    const nextCatalog = baseCatalog.map((definition) => {
      if (definition.key !== selectedBusinessTypeKey) {
        return definition;
      }

      return {
        ...definition,
        templates: [...(definition.templates ?? []), nextVariant],
      };
    });

    setCatalog(nextCatalog);
    setSelectedTemplateKey(nextVariant.key);
    setShowCodeComposer(false);
    setDraftTemplateName("");
    setEditorFromVariant(nextVariant);
    toast.success("Template created from your code.");
  }, [
    activeBusinessType.default_template,
    activeBusinessType.key,
    activeBusinessType.label,
    catalog,
    codeTemplateBody,
    codeTemplateDescription,
    codeTemplateCss,
    codeTemplateHtml,
    codeTemplateName,
    commitCurrentTemplateToCatalog,
    selectedBusinessTypeKey,
    setEditorFromVariant,
  ]);

  const handleDeleteTemplate = React.useCallback(() => {
    if ((activeBusinessType.templates?.length ?? 0) <= 1) {
      toast.info("Each business type needs at least one template.");
      return;
    }

    const nextCatalog = commitCurrentTemplateToCatalog(catalog).map((definition) => {
      if (definition.key !== selectedBusinessTypeKey) {
        return definition;
      }

      const templates = (definition.templates ?? []).filter(
        (variant) => variant.key !== selectedTemplateKey,
      );

      const nextDefaultKey =
        definition.default_template_key === selectedTemplateKey
          ? templates[0]?.key ?? definition.default_template_key
          : definition.default_template_key;

      const nextDefaultVariant = resolveTemplateVariant(
        {
          ...definition,
          templates,
          default_template_key: nextDefaultKey,
        },
        nextDefaultKey,
      );

      return {
        ...definition,
        default_template_key: nextDefaultKey,
        default_template: nextDefaultVariant.template,
        templates,
      };
    });

    setCatalog(nextCatalog);

    const nextBusinessType = nextCatalog.find((item) => item.key === selectedBusinessTypeKey);
    const nextVariant = resolveTemplateVariant(
      nextBusinessType ?? activeBusinessType,
      nextBusinessType?.default_template_key,
    );

    setSelectedTemplateKey(nextVariant.key);
    setEditorFromVariant(nextVariant);
  }, [
    activeBusinessType,
    catalog,
    commitCurrentTemplateToCatalog,
    selectedBusinessTypeKey,
    selectedTemplateKey,
    setEditorFromVariant,
  ]);

  const handleSetDefaultTemplate = React.useCallback(() => {
    const nextCatalog = commitCurrentTemplateToCatalog(catalog).map((definition) => {
      if (definition.key !== selectedBusinessTypeKey) {
        return definition;
      }

      const nextDefaultVariant = resolveTemplateVariant(
        {
          ...definition,
          default_template_key: selectedTemplateKey,
        },
        selectedTemplateKey,
      );

      return {
        ...definition,
        default_template_key: selectedTemplateKey,
        default_template: nextDefaultVariant.template,
      };
    });

    setCatalog(nextCatalog);
    toast.success("Default template updated for this business type.");
  }, [catalog, commitCurrentTemplateToCatalog, selectedBusinessTypeKey, selectedTemplateKey]);

  const handleResetTemplate = React.useCallback(() => {
    const latestBusinessType =
      catalog.find((item) => item.key === selectedBusinessTypeKey) ?? activeBusinessType;

    const latestVariant = resolveTemplateVariant(latestBusinessType, selectedTemplateKey);
    setEditorFromVariant(latestVariant);
  }, [activeBusinessType, catalog, selectedBusinessTypeKey, selectedTemplateKey, setEditorFromVariant]);

  const handleSave = React.useCallback(() => {
    if (jsonError) {
      toast.error("Fix the landing template JSON before saving.");
      return;
    }

    const committedCatalog = commitCurrentTemplateToCatalog(catalog);
    setCatalog(committedCatalog);
    saveMutation.mutate({ business_types: committedCatalog });
  }, [catalog, commitCurrentTemplateToCatalog, jsonError, saveMutation]);

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
    const errorMessage = getErrorMessage(
      error,
      "Could not load landing template settings.",
    );

    return (
      <div className="overflow-hidden rounded-[2rem] border border-destructive/30 bg-destructive/5 p-8">
        <div className="flex flex-col items-start gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-destructive/10">
              <LayoutTemplate className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-foreground">
                Failed to load Templates
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            The backend landing-template catalog could not be fetched. The editor will use
            the built-in fallback templates until the issue is resolved.
          </p>
          <button
            type="button"
            onClick={() => {
              const fallbackCatalog = resolveBusinessTypeCatalog(
                FALLBACK_TENANT_BUSINESS_TYPES,
              );
              setCatalog(fallbackCatalog);

              const firstBt = fallbackCatalog[0];
              if (!firstBt) {
                return;
              }

              const firstVariant = resolveTemplateVariant(
                firstBt,
                firstBt.default_template_key,
              );

              setSelectedBusinessTypeKey(firstBt.key);
              setSelectedTemplateKey(firstVariant.key);
              setTemplateFiles(createTemplateFiles(formatLandingTemplateJson(firstVariant.template)));
              setJsonError(null);
            }}
            className="rounded-xl border border-destructive/20 bg-background/80 px-4 py-2 text-xs font-semibold text-foreground hover:bg-background"
          >
            Continue with Built-in Templates
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-border/50 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.02),rgba(15,23,42,0.08))]">
        <div className="flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h3 className="text-xl font-black tracking-tight text-foreground">
              Landing Template Library
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Manage reusable landing templates per business type here. Tenant create and
              edit flows now stay focused on selecting one of these templates and tailoring
              the saved copy for that tenant.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
              {catalog.reduce((count, item) => count + (item.templates?.length ?? 0), 0)} templates
            </Badge>
            <Button asChild variant="outline" className="rounded-xl border-border/60 bg-background/70">
              <Link href="/dashboard/tenants">
                Tenant Manager
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="rounded-xl px-5 font-semibold">
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Templates
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-[2rem] border border-border/50 bg-card/40 p-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-8rem)] xl:overflow-hidden">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary">
              Business Types
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose which business group you want to manage templates for.
            </p>
          </div>

          <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.45)_transparent]">
            {catalog.map((businessType) => {
              const Icon = iconMap[businessType.icon as keyof typeof iconMap] || LayoutTemplate;
              const selected = businessType.key === selectedBusinessTypeKey;

              return (
                <button
                  key={businessType.key}
                  type="button"
                  onClick={() => switchTemplateSelection(businessType.key)}
                  className={cn(
                    "w-full rounded-[1.4rem] border px-4 py-4 text-left transition-all",
                    selected
                      ? "border-primary/30 bg-primary/5 shadow-lg shadow-primary/10"
                      : "border-border/50 bg-background/70 hover:border-primary/20 hover:bg-background",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-2xl",
                        selected ? "bg-primary text-primary-foreground" : "bg-muted text-primary",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{businessType.label}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {businessType.description}
                      </p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {businessType.templates?.length ?? 0} saved template
                        {(businessType.templates?.length ?? 0) === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-border/50 bg-card/40 p-5">
            <div className="grid gap-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_minmax(0,1fr)]">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Selected Template
                  </Label>
                  <Select
                    value={selectedTemplateKey}
                    onValueChange={(value) => switchTemplateSelection(selectedBusinessTypeKey, value)}
                  >
                    <SelectTrigger className="h-11 w-full bg-background/70">
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

                <div className="min-w-0 space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Preview Mode
                  </Label>
                  <Select
                    value={previewMode}
                    onValueChange={(value: "system" | "light" | "dark") => setPreviewMode(value)}
                  >
                    <SelectTrigger className="h-11 w-full bg-background/70">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/60 shadow-xl">
                      <SelectItem value="system">System</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0 space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    New Template Name
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={draftTemplateName}
                      onChange={(event) => setDraftTemplateName(event.target.value)}
                      placeholder="Weekend Escape"
                      className="h-11 min-w-0 flex-1 bg-background/70"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleCreateTemplate(false)}
                      className="h-11 shrink-0 rounded-xl px-4"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <Button type="button" variant="outline" onClick={() => handleCreateTemplate(true)} className="h-11 rounded-xl">
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </Button>
                <Button type="button" variant="outline" onClick={handleOpenCodeComposer} className="h-11 rounded-xl">
                  <LayoutTemplate className="mr-2 h-4 w-4" />
                  Add From Code
                </Button>
                <Button type="button" variant="outline" onClick={handleSetDefaultTemplate} className="h-11 rounded-xl">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Set Default
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDeleteTemplate}
                  className="h-11 rounded-xl border-destructive/20 text-destructive hover:bg-destructive/5"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Template Label
                </Label>
                <Input
                  value={activeTemplateVariant?.label ?? ""}
                  onChange={(event) => handleRenameSelectedTemplate("label", event.target.value)}
                  className="h-11 bg-background/70"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Template Description
                </Label>
                <Input
                  value={activeTemplateVariant?.description ?? ""}
                  onChange={(event) => handleRenameSelectedTemplate("description", event.target.value)}
                  className="h-11 bg-background/70"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                Default: {activeBusinessType.default_template_key === selectedTemplateKey ? "Yes" : "No"}
              </Badge>
              <span>
                Business type: <span className="font-semibold text-foreground">{activeBusinessType.label}</span>
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={handleResetTemplate} className="h-8 rounded-lg px-3">
                <RefreshCcw className="mr-2 h-3.5 w-3.5" />
                Reset editor to template
              </Button>
            </div>

            {showCodeComposer ? (
              <div className="mt-5 rounded-[1.3rem] border border-border/60 bg-background/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Create Template from Code</p>
                  <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                    HTML + CSS
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Paste central-admin authored HTML and scoped CSS. Tenants will only edit the content JSON and cannot change this raw code.
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Template Name
                    </Label>
                    <Input
                      value={codeTemplateName}
                      onChange={(event) => setCodeTemplateName(event.target.value)}
                      placeholder={`${activeBusinessType.label} Custom`}
                      className="h-10 bg-background/70"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Description
                    </Label>
                    <Input
                      value={codeTemplateDescription}
                      onChange={(event) => setCodeTemplateDescription(event.target.value)}
                      placeholder="Code-authored template"
                      className="h-10 bg-background/70"
                    />
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Editable Content JSON
                  </Label>
                  <textarea
                    value={codeTemplateBody}
                    onChange={(event) => setCodeTemplateBody(event.target.value)}
                    spellCheck={false}
                    className="min-h-[220px] w-full rounded-xl border border-border/60 bg-[#0b1220] px-4 py-3 font-mono text-xs leading-6 text-slate-100 outline-none ring-0 transition focus:border-primary/50"
                  />
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Template HTML
                    </Label>
                    <textarea
                      value={codeTemplateHtml}
                      onChange={(event) => setCodeTemplateHtml(event.target.value)}
                      spellCheck={false}
                      className="min-h-[260px] w-full rounded-xl border border-border/60 bg-[#0b1220] px-4 py-3 font-mono text-xs leading-6 text-slate-100 outline-none ring-0 transition focus:border-primary/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Scoped CSS
                    </Label>
                    <textarea
                      value={codeTemplateCss}
                      onChange={(event) => setCodeTemplateCss(event.target.value)}
                      spellCheck={false}
                      className="min-h-[260px] w-full rounded-xl border border-border/60 bg-[#0b1220] px-4 py-3 font-mono text-xs leading-6 text-slate-100 outline-none ring-0 transition focus:border-primary/50"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCodeTemplateBody(currentTemplateContent)}
                    className="h-9 rounded-lg px-3"
                  >
                    Load Current Content
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCodeComposer(false)}
                    className="h-9 rounded-lg px-3"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCreateTemplateFromCode}
                    className="h-9 rounded-lg px-4 font-semibold"
                  >
                    Create Template
                  </Button>
                </div>
              </div>
            ) : null}

            {jsonError ? (
              <div className="mt-4 rounded-[1rem] border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive">
                Fix the JSON before saving. The preview is still using the last valid version of this template.
              </div>
            ) : null}
          </div>

          <CodeEditor
            files={safeTemplateFiles}
            setFiles={handleTemplateFilesChange}
            showPreview={showPreview}
            setShowPreview={setShowPreview}
            previewHtml={previewHtml}
            className="min-h-[42rem]"
          />
        </div>
      </div>
    </div>
  );
}

export default TenantLandingTemplateSettings;
