"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Server, PlusCircle, Pencil, Trash2, Loader2, Calendar, Globe, AlertCircle, Power, UserX, UserPlus, Mail, Eye, UserCheck, Layers, LayoutTemplate } from "lucide-react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type CompanySettingsInfo, type BrandingSettingsInfo } from "@/components/datatable/data-table";
import { useOfflineMutation } from "@/hooks/use-offline-mutation";
import { isOfflineMutationQueuedResult } from "@/lib/offline/mutation-queue";
import { logFrontendAction } from "@/modules/core/api";
import {
    createTenantOfflineMutationDefinition,
    deleteTenantOfflineMutationDefinition,
    toggleTenantAdminOfflineMutationDefinition,
    toggleTenantStatusOfflineMutationDefinition,
    type TenantCreateOfflinePayload,
    type TenantUpdateOfflinePayload,
    updateTenantOfflineMutationDefinition,
} from "@/modules/shared/offline-mutations";
import { fetchSubscriptionCatalog } from "@/modules/subscription/api";
import { ModuleSubscriptionSummary } from "@/modules/subscription/components/module-subscription-summary";
import type { TenantCustomModuleInput } from "@/modules/subscription/types";
import { type VirtualFile } from "@/components/ui/code-editor";
import { fetchTenants } from "@/modules/tenancy/api";
import { TenantDomainManager } from "@/modules/tenancy/components/tenant-domain-manager";
import { TenantLandingTemplateEditor } from "@/modules/tenancy/components/tenant-landing-template-editor";
import {
    applyLandingTemplateMeta,
    buildTenantLandingPreviewHtml,
    FALLBACK_TENANT_BUSINESS_TYPES,
    FALLBACK_TENANT_LANDING_TEMPLATE,
    formatLandingTemplateJson,
    parseLandingTemplateJson,
    resolveBusinessTypeCatalog,
    resolveLandingTemplate,
    resolveTemplateVariant,
    type TenantLandingPreviewBranding,
} from "@/modules/tenancy/landing-template";
import { getBackendApiRoot, getWorkspaceScopeKey } from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { usePermissions } from "@/hooks/use-permissions";
import { useTranslation } from "@/store/use-translation"; // 🚀 Added Translation Hook

type Props = {
    companySettings?: CompanySettingsInfo | null;
    brandingSettings?: BrandingSettingsInfo | null;
};

const globalActionLock: Record<string, number> = {};
const EMPTY_PLAN_DEFAULTS: Record<string, string[]> = {};
const EMPTY_STRING_LIST: string[] = [];
const DEFAULT_TENANT_ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost").trim();
const DEFAULT_TENANT_SERVER_IP = (process.env.NEXT_PUBLIC_SERVER_IP || "").trim();
const LANDING_TEMPLATE_FILE = "landing-template.json";

const createTemplateFiles = (content: string): VirtualFile[] => [
    {
        name: LANDING_TEMPLATE_FILE,
        language: "json",
        content,
    },
];

const sanitizeCustomModules = (modules: TenantCustomModuleInput[]): TenantCustomModuleInput[] =>
    modules
        .map((module) => ({
            slug: module.slug?.trim() || undefined,
            name: module.name.trim(),
            category: module.category?.trim() || "Custom",
            description: module.description?.trim() || "",
        }))
        .filter((module) => module.name.length > 0);

const areStringListsEqual = (left: string[], right: string[]): boolean =>
    left.length === right.length && left.every((value, index) => value === right[index]);

const sortStringList = (values: string[]): string[] =>
    [...values].sort((left, right) => left.localeCompare(right));

const normalizeCustomModulesForCompare = (modules: TenantCustomModuleInput[]) =>
    sanitizeCustomModules(modules)
        .map((module) => ({
            slug: module.slug ?? "",
            name: module.name,
            category: module.category ?? "Custom",
            description: module.description ?? "",
        }))
        .sort((left, right) =>
            `${left.slug}:${left.name}:${left.category}`.localeCompare(`${right.slug}:${right.name}:${right.category}`)
        );

export function TenantsTableClient({ companySettings, brandingSettings }: Props) {
    const queryClient = useQueryClient();
    const { resolvedTheme } = useTheme();
    const { hasAnyPermission } = usePermissions();
    const { t, locale } = useTranslation(); // 🚀 Grab translator AND locale
    const workspaceScope = getWorkspaceScopeKey();

    const canCreate = hasAnyPermission(["manage_tenants", "provision_tenants"]);
    const canEdit = hasAnyPermission(["manage_tenants", "edit_tenants"]);
    const canDelete = hasAnyPermission(["manage_tenants", "delete_tenants"]);
    const canSuspend = hasAnyPermission(["manage_tenants", "suspend_tenants"]);

    const [page, setPage] = React.useState(1);
    const [pageSize, setPageSize] = useLocalStorage<number>("tenants_table_page_size", 10);
    const [search, setSearch] = React.useState("");
    const [sortCol, setSortCol] = React.useState<string>("created_at"); 
    const [sortDir, setSortDir] = React.useState<string>("desc");
    const [tableKey, setTableKey] = React.useState(0);

    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editingTenant, setEditingTenant] = React.useState<any>(null);
    const isEdit = !!editingTenant;
    const [viewDialogOpen, setViewDialogOpen] = React.useState(false);
    const [viewTenant, setViewTenant] = React.useState<any>(null);

    const [formId, setFormId] = React.useState("");
    const [formName, setFormName] = React.useState("");
    const [formPlan, setFormPlan] = React.useState("business");
    const [formDomain, setFormDomain] = React.useState("");
    const [formAdminName, setFormAdminName] = React.useState("");
    const [formAdminEmail, setFormAdminEmail] = React.useState("");
    const [formAdminPassword, setFormAdminPassword] = React.useState("");
    const [formSelectedModules, setFormSelectedModules] = React.useState<string[]>([]);
    const [formCustomModules, setFormCustomModules] = React.useState<TenantCustomModuleInput[]>([]);
    const [formBusinessType, setFormBusinessType] = React.useState("general");
    const [landingTemplateFiles, setLandingTemplateFiles] = React.useState<VirtualFile[]>(
        createTemplateFiles(formatLandingTemplateJson(FALLBACK_TENANT_LANDING_TEMPLATE))
    );
    const [showLandingPreview, setShowLandingPreview] = React.useState(true);

    const triggerAudit = React.useCallback(async (action: string, description: string) => {
        if (typeof window === "undefined") return;
        const now = Date.now();
        const payloadKey = `${action}_${description}`;
        if (globalActionLock[payloadKey] && now - globalActionLock[payloadKey] < 500) return; 
        globalActionLock[payloadKey] = now;
        try { await logFrontendAction({ module: 'Tenant Management', action, description }); } catch (e) {}
    }, []);

    const { data: tenantsData, isLoading, isFetching } = useQuery({
        queryKey: ["tenants", page, pageSize, search, sortCol, sortDir],
        queryFn: async () => {
            const res = await fetchTenants({ page, pageSize, search: search.trim(), sort_by: sortCol, sort_direction: sortDir });
            return { rows: res?.data || [], total: res?.meta?.total || 0 };
        },
        placeholderData: (prev) => prev,
    });

const { data: subscriptionCatalogData } = useQuery({
        queryKey: ["tenant-subscription-catalog"],
        queryFn: fetchSubscriptionCatalog,
        enabled: canCreate || canEdit,
        staleTime: 300_000,
    });

    // Fetch business types from settings API (custom business types)
    const { data: settingsBusinessTypes } = useQuery({
        queryKey: ["settings", "landing-templates", workspaceScope],
        queryFn: async () => {
            const res = await fetch(`${getBackendApiRoot()}/settings/landing-templates`);
            const json = await res.json();
            return json?.data?.business_types ?? [];
        },
        enabled: canCreate || canEdit,
        staleTime: 60_000, // 1 minute cache
    });

    // Merge business types: custom from settings take priority, then fallback to subscription catalog
    const businessTypes = React.useMemo(() => {
        const customTypes = settingsBusinessTypes ?? [];
        const catalogTypes = subscriptionCatalogData?.data?.business_types ?? [];
        // Combine, removing duplicates (custom types override catalog ones)
        const combined = [...customTypes];
        catalogTypes.forEach((bt: any) => {
            if (!combined.find((c: any) => c.key === bt.key)) {
                combined.push(bt);
            }
        });
        return resolveBusinessTypeCatalog(combined.length > 0 ? combined : FALLBACK_TENANT_BUSINESS_TYPES);
    }, [settingsBusinessTypes, subscriptionCatalogData]);
    const businessTypeMap = React.useMemo(
        () => Object.fromEntries(businessTypes.map((option) => [option.key, option])),
        [businessTypes]
);
    const activeBusinessTypeDefinition = businessTypeMap[formBusinessType] ?? businessTypes[0] ?? FALLBACK_TENANT_BUSINESS_TYPES[0];

    // Also keep plan defaults for module defaults
    const subscriptionPlanDefaults = React.useMemo(
        () => subscriptionCatalogData?.data?.plan_defaults ?? EMPTY_PLAN_DEFAULTS,
        [subscriptionCatalogData]
    );
    const templateVariants = activeBusinessTypeDefinition.templates ?? [];
    const landingTemplateContent = landingTemplateFiles[0]?.content ?? formatLandingTemplateJson(activeBusinessTypeDefinition.default_template);
    const parsedLandingTemplateState = React.useMemo(() => {
        try {
            return {
                template: parseLandingTemplateJson(landingTemplateContent, activeBusinessTypeDefinition.default_template),
                error: null as string | null,
            };
        } catch (error) {
            return {
                template: resolveLandingTemplate(activeBusinessTypeDefinition.default_template),
                error: error instanceof Error ? error.message : "Invalid JSON",
            };
        }
    }, [activeBusinessTypeDefinition.default_template, landingTemplateContent]);
    const selectedTemplateVariant = React.useMemo(
        () => resolveTemplateVariant(
            activeBusinessTypeDefinition,
            parsedLandingTemplateState.template.meta?.template_key
        ),
        [activeBusinessTypeDefinition, parsedLandingTemplateState.template.meta?.template_key]
    );
    const selectedTemplateKey = parsedLandingTemplateState.template.meta?.template_key
        ?? activeBusinessTypeDefinition.default_template_key
        ?? selectedTemplateVariant.key;
    const isCustomTemplate = React.useMemo(
        () => formatLandingTemplateJson(parsedLandingTemplateState.template) !== formatLandingTemplateJson(selectedTemplateVariant.template),
        [parsedLandingTemplateState.template, selectedTemplateVariant.template]
    );
    const previewColorMode = resolvedTheme === "light" ? "light" : "dark";
    const previewBranding = React.useMemo<TenantLandingPreviewBranding>(() => ({
        app_title: formName || brandingSettings?.app_title || "Tenant Brand",
        footer_text: brandingSettings?.footer_text,
        primary_color: (brandingSettings as Record<string, any> | undefined)?.primary_color,
        font_family: (brandingSettings as Record<string, any> | undefined)?.font_family,
    }), [brandingSettings, formName]);
    const landingPreviewHtml = React.useMemo(
        () => buildTenantLandingPreviewHtml(
            parsedLandingTemplateState.template,
            previewBranding.app_title || "Tenant Brand",
            activeBusinessTypeDefinition.label,
            {
                colorMode: previewColorMode,
                branding: previewBranding,
            }
        ),
        [activeBusinessTypeDefinition.label, parsedLandingTemplateState.template, previewBranding, previewColorMode]
    );
    const initialEditSnapshot = React.useMemo(() => {
        if (!editingTenant) {
            return null;
        }

        const originalBusinessType =
            businessTypeMap[editingTenant.business_type] ?? businessTypes[0] ?? FALLBACK_TENANT_BUSINESS_TYPES[0];
        const originalTemplate = resolveLandingTemplate(
            editingTenant.landing_page_template,
            originalBusinessType.default_template
        );
        const originalVariant = resolveTemplateVariant(
            originalBusinessType,
            originalTemplate.meta?.template_key
        );

        return {
            name: String(editingTenant.name ?? ""),
            plan: String(editingTenant.plan ?? "business"),
            business_type: originalBusinessType.key,
            landing_template: formatLandingTemplateJson(
                applyLandingTemplateMeta(originalTemplate, {
                    business_type: originalBusinessType.key,
                    business_label: originalBusinessType.label,
                    template_key: originalTemplate.meta?.template_key ?? originalVariant.key,
                    template_label: originalTemplate.meta?.template_label ?? originalVariant.label,
                    template_description: originalTemplate.meta?.template_description ?? originalVariant.description,
                    is_custom: originalTemplate.meta?.is_custom
                        ?? (formatLandingTemplateJson(originalTemplate) !== formatLandingTemplateJson(originalVariant.template)),
                })
            ),
            admin_name: "",
            admin_email: String(editingTenant.admin_email ?? ""),
            admin_password: "",
            enabled_modules: sortStringList(editingTenant.module_subscriptions?.enabled_modules || []),
            custom_modules: normalizeCustomModulesForCompare(editingTenant.module_subscriptions?.custom_modules || []),
        };
    }, [businessTypeMap, businessTypes, editingTenant]);
    const currentEditSnapshot = React.useMemo(() => {
        if (!editingTenant) {
            return null;
        }

        return {
            name: formName,
            plan: formPlan,
            business_type: formBusinessType,
            landing_template: formatLandingTemplateJson(parsedLandingTemplateState.template),
            admin_name: formAdminName,
            admin_email: formAdminEmail,
            admin_password: formAdminPassword,
            enabled_modules: sortStringList(formSelectedModules),
            custom_modules: normalizeCustomModulesForCompare(formCustomModules),
        };
    }, [
        editingTenant,
        formAdminEmail,
        formAdminName,
        formAdminPassword,
        formBusinessType,
        formCustomModules,
        formName,
        formPlan,
        formSelectedModules,
        parsedLandingTemplateState.template,
    ]);
    const isEditDirty = React.useMemo(() => {
        if (!isEdit || !initialEditSnapshot || !currentEditSnapshot) {
            return false;
        }

        return JSON.stringify(initialEditSnapshot) !== JSON.stringify(currentEditSnapshot);
    }, [currentEditSnapshot, initialEditSnapshot, isEdit]);

    const buildPresetTemplate = React.useCallback((definition: typeof activeBusinessTypeDefinition, templateKey?: string | null) => {
        const variant = resolveTemplateVariant(definition, templateKey);

        return applyLandingTemplateMeta(variant.template, {
            business_type: definition.key,
            business_label: definition.label,
            template_key: variant.key,
            template_label: variant.label,
            template_description: variant.description,
            is_custom: false,
        });
    }, []);

    const writeLandingTemplate = React.useCallback((template: unknown, fallback?: typeof FALLBACK_TENANT_LANDING_TEMPLATE) => {
        setLandingTemplateFiles(
            createTemplateFiles(
                formatLandingTemplateJson(resolveLandingTemplate(template, fallback ?? FALLBACK_TENANT_LANDING_TEMPLATE))
            )
        );
    }, []);

    const handlePlanChange = React.useCallback((nextPlan: string) => {
        setFormPlan(nextPlan);

        if (isEdit) {
            return;
        }

        const nextDefaults = subscriptionPlanDefaults[nextPlan] ?? EMPTY_STRING_LIST;
        setFormSelectedModules((previous) =>
            areStringListsEqual(previous, nextDefaults) ? previous : [...nextDefaults]
        );
        setFormCustomModules([]);
    }, [isEdit, subscriptionPlanDefaults]);

    const handleBusinessTypeChange = React.useCallback((nextType: string) => {
        const definition = businessTypeMap[nextType] ?? businessTypes[0] ?? FALLBACK_TENANT_BUSINESS_TYPES[0];
        setFormBusinessType(definition.key);
        writeLandingTemplate(
            buildPresetTemplate(definition, definition.default_template_key),
            definition.default_template
        );
    }, [buildPresetTemplate, businessTypeMap, businessTypes, writeLandingTemplate]);

    const handleTemplateVariantChange = React.useCallback((nextTemplateKey: string) => {
        const definition = businessTypeMap[formBusinessType] ?? businessTypes[0] ?? FALLBACK_TENANT_BUSINESS_TYPES[0];
        writeLandingTemplate(buildPresetTemplate(definition, nextTemplateKey), definition.default_template);
    }, [buildPresetTemplate, businessTypeMap, businessTypes, formBusinessType, writeLandingTemplate]);

    const handleResetTemplate = React.useCallback(() => {
        writeLandingTemplate(
            buildPresetTemplate(activeBusinessTypeDefinition, selectedTemplateVariant.key),
            activeBusinessTypeDefinition.default_template
        );
    }, [activeBusinessTypeDefinition, buildPresetTemplate, selectedTemplateVariant.key, writeLandingTemplate]);

    React.useEffect(() => {
        if (!businessTypeMap[formBusinessType]) {
            const definition = businessTypes[0] ?? FALLBACK_TENANT_BUSINESS_TYPES[0];
            setFormBusinessType(definition.key);
            writeLandingTemplate(
                buildPresetTemplate(definition, definition.default_template_key),
                definition.default_template
            );
        }
    }, [buildPresetTemplate, businessTypeMap, businessTypes, formBusinessType, writeLandingTemplate]);

    const createTenantMut = useOfflineMutation<any, Error, TenantCreateOfflinePayload>({
        definition: createTenantOfflineMutationDefinition,
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["tenants"] });
            toast.success(t('tenants.provisioned', "Node provisioned."));
            triggerAudit('created', `Operator initialized new infrastructure provisioning sequence for Node ID: ${variables.id}`);
            setDialogOpen(false);
        },
        onQueued: (variables) => {
            toast.info(`Offline: node ${variables.id} has been queued and will provision automatically once you're back online.`);
            setDialogOpen(false);
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || t('global.operation_failed', "Operation failed.")),
    });

    const updateTenantMut = useOfflineMutation<any, Error, TenantUpdateOfflinePayload>({
        definition: updateTenantOfflineMutationDefinition,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tenants"] });
            toast.success(t('tenants.updated', "Node updated."));
            if (editingTenant?.id) {
                triggerAudit('updated', `Operator submitted reconfiguration parameters for Node ID: ${editingTenant.id}`);
            }
            setDialogOpen(false);
        },
        onQueued: () => {
            if (editingTenant?.id) {
                toast.info(`Offline: changes for node ${editingTenant.id} were queued and will sync automatically when the connection returns.`);
            } else {
                toast.info("Offline: tenant changes were queued and will sync automatically when the connection returns.");
            }
            setDialogOpen(false);
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || t('global.operation_failed', "Operation failed.")),
    });

    const deleteMut = useOfflineMutation<any, Error, string>({
        definition: deleteTenantOfflineMutationDefinition,
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ["tenants"] });
            triggerAudit('deleted', `Operator executed fatal purge command on Node ID: ${id}`);
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || t('global.operation_failed', "Operation failed.")),
    });

    const toggleStatusMut = useOfflineMutation<any, Error, string>({
        definition: toggleTenantStatusOfflineMutationDefinition,
        onSuccess: (data, id) => {
            queryClient.invalidateQueries({ queryKey: ["tenants"] });
            toast.success(data.message);
            triggerAudit('updated', `Operator toggled network status lock for Node ID: ${id}`);
        },
        onQueued: (id) => {
            toast.info(`Offline: node ${id} status change has been queued for sync.`);
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || t('global.operation_failed', "Operation failed.")),
    });

    const toggleAdminMut = useOfflineMutation<any, Error, string>({
        definition: toggleTenantAdminOfflineMutationDefinition,
        onSuccess: (data, id) => {
            queryClient.invalidateQueries({ queryKey: ["tenants"] });
            toast.success(data.message);
            triggerAudit('updated', `Operator modified Super Admin clearance state for Node ID: ${id}`);
        },
        onQueued: (id) => {
            toast.info(`Offline: Super Admin clearance changes for node ${id} were queued for sync.`);
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || t('global.operation_failed', "Operation failed.")),
    });

    const isSaving = createTenantMut.isPending || updateTenantMut.isPending;

    const handleQueryChange = React.useCallback((q: any) => {
        if (q.page !== undefined) setPage(q.page);
        if (q.pageSize !== undefined) setPageSize(q.pageSize);
        if (q.search !== undefined) {
            setSearch(prev => { 
                if (prev !== q.search) {
                    setPage(1);
                    if (q.search.length > 2) triggerAudit('filtered', `Executed matrix text search for parameter: "${q.search}"`);
                }
                return q.search; 
            });
        }
        if (q.sortCol) setSortCol(q.sortCol);
        if (q.sortDir) setSortDir(q.sortDir);
    }, [setPageSize, triggerAudit]);

    const handleRefresh = React.useCallback(() => {
        triggerAudit('viewed', 'Operator manually refreshed Node Matrix datatable');
        queryClient.invalidateQueries({ queryKey: ["tenants"] });
    }, [queryClient, triggerAudit]);
    
    const resetFilters = React.useCallback(() => { 
        setSearch(""); setSortCol("created_at"); setSortDir("desc"); setPage(1); setTableKey(prev => prev + 1); 
        triggerAudit('filtered', 'Operator reset all Node Matrix active filters');
    }, [triggerAudit]);

    const handleDeleteRows = React.useCallback(async (rows: any[]) => {
        try {
            const results = await Promise.all(rows.map((r) => deleteMut.mutateAsync(r.id)));
            const queuedCount = results.filter(isOfflineMutationQueuedResult).length;
            if (queuedCount === rows.length) {
                toast.info(`${rows.length} node deletion${rows.length === 1 ? "" : "s"} queued for sync.`);
            } else if (queuedCount === 0) {
                toast.success(`${rows.length} ${t('tenants.nodes_purged', 'nodes purged.')}`);
            } else {
                toast.info(`${queuedCount} node deletion${queuedCount === 1 ? "" : "s"} queued. The rest were processed immediately.`);
            }
            triggerAudit('deleted', `Operator executed destructive bulk purge sequence on ${rows.length} nodes`);
        } catch {
            // deleteMut.onError already surfaces a toast for non-offline failures.
        }
    }, [deleteMut, triggerAudit, t]);

    const openView = (tenant: any) => { 
        setViewTenant(tenant); setViewDialogOpen(true); 
        triggerAudit('viewed', `Operator performed deep metric inspection on Node ID: ${tenant.id}`);
    };
    
    const openCreate = () => {
        const defaultBusinessType = businessTypes[0] ?? FALLBACK_TENANT_BUSINESS_TYPES[0];
        setEditingTenant(null); setFormId(""); setFormName(""); setFormPlan("business"); setFormDomain("");
        setFormBusinessType(defaultBusinessType.key);
        writeLandingTemplate(
            buildPresetTemplate(defaultBusinessType, defaultBusinessType.default_template_key),
            defaultBusinessType.default_template
        );
        setFormAdminName(""); setFormAdminEmail(""); setFormAdminPassword("");
        setFormSelectedModules([...(subscriptionPlanDefaults.business ?? EMPTY_STRING_LIST)]);
        setFormCustomModules([]);
        setDialogOpen(true);
        triggerAudit('viewed', 'Operator accessed the Provisioning UI panel');
    };
    
    const openEdit = (tenant: any) => {
        const selectedBusinessType = businessTypeMap[tenant.business_type] ?? businessTypes[0] ?? FALLBACK_TENANT_BUSINESS_TYPES[0];
        const existingTemplate = resolveLandingTemplate(
            tenant.landing_page_template,
            selectedBusinessType.default_template
        );
        const sourceVariant = resolveTemplateVariant(
            selectedBusinessType,
            existingTemplate.meta?.template_key
        );
        const hydratedTemplate = applyLandingTemplateMeta(existingTemplate, {
            business_type: selectedBusinessType.key,
            business_label: selectedBusinessType.label,
            template_key: existingTemplate.meta?.template_key ?? sourceVariant.key,
            template_label: existingTemplate.meta?.template_label ?? sourceVariant.label,
            template_description: existingTemplate.meta?.template_description ?? sourceVariant.description,
            is_custom: existingTemplate.meta?.is_custom
                ?? (formatLandingTemplateJson(existingTemplate) !== formatLandingTemplateJson(sourceVariant.template)),
        });
        setEditingTenant(tenant); setFormId(tenant.id); setFormName(tenant.name); setFormPlan(tenant.plan); setFormDomain(tenant.domain);
        setFormBusinessType(selectedBusinessType.key);
        writeLandingTemplate(hydratedTemplate, selectedBusinessType.default_template);
        setFormAdminEmail(tenant.admin_email || ""); setFormAdminName(""); setFormAdminPassword("");
        setFormSelectedModules(tenant.module_subscriptions?.enabled_modules || []);
        setFormCustomModules(tenant.module_subscriptions?.custom_modules || []);
        setDialogOpen(true);
        triggerAudit('viewed', `Operator accessed Reconfiguration UI panel for Node ID: ${tenant.id}`);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (parsedLandingTemplateState.error) {
            toast.error("Fix the landing template JSON before saving.");
            return;
        }

        if (isEdit && editingTenant) {
            if (!isEditDirty) {
                toast.info("No changes to update yet.");
                return;
            }

            const payload: TenantUpdateOfflinePayload = {
                id: editingTenant.id,
                data: {
                    name: formName,
                    plan: formPlan,
                    business_type: formBusinessType,
                    landing_page_template: parsedLandingTemplateState.template,
                    admin_name: formAdminName,
                    admin_email: formAdminEmail,
                    admin_password: formAdminPassword,
                    module_subscriptions: {
                        enabled_modules: formSelectedModules,
                        custom_modules: sanitizeCustomModules(formCustomModules),
                    },
                },
            };
            updateTenantMut.mutate(payload);
            return;
        }

        const payload: TenantCreateOfflinePayload = {
            id: formId,
            name: formName,
            plan: formPlan,
            business_type: formBusinessType,
            landing_page_template: parsedLandingTemplateState.template,
            domain: formDomain,
            admin_name: formAdminName,
            admin_email: formAdminEmail,
            admin_password: formAdminPassword,
            module_subscriptions: {
                enabled_modules: formSelectedModules,
                custom_modules: sanitizeCustomModules(formCustomModules),
            },
        };
        createTenantMut.mutate(payload);
    };

    const handleIdChange = (val: string) => {
        const sanitized = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
        setFormId(sanitized);
        if (!isEdit) setFormDomain(sanitized ? `${sanitized}.${DEFAULT_TENANT_ROOT_DOMAIN}` : "");
    };

    const getPlanBadge = (plan: string) => {
        const p = plan?.toLowerCase();
        const colorClass = p === 'startup' ? "text-emerald-500 border-emerald-200" : p === 'business' ? "text-blue-500 border-blue-200" : "text-indigo-500 border-indigo-200";
        return <Badge variant="outline" className={cn("uppercase text-[9px]", colorClass)}>{plan}</Badge>;
    };

    const columns = React.useMemo<ColumnDef<any>[]>(() => [
        {
            id: "id", accessorKey: "id", header: t('tenants.col_id', "Node ID"),
            cell: ({ row }) => <div className="flex items-center gap-2 font-mono text-sm font-bold text-foreground"><Server className="h-4 w-4 text-primary" />{row.original.id}</div>,
        },
        { 
            id: "name", accessorFn: (row) => row.name || row.id, header: t('tenants.col_org', "Organization Name"), 
            cell: ({ row }) => <span className="font-semibold">{row.original.name || row.original.id}</span> 
        },
        { 
            id: "plan", accessorFn: (row) => row.plan, header: t('tenants.col_plan', "Capacity Plan"), 
            cell: ({ row }) => getPlanBadge(row.original.plan) 
        },
        {
            id: "business_type",
            accessorFn: (row) => row.business_type_meta?.label || row.business_type || "General Business",
            header: "Business Type",
            cell: ({ row }) => (
                <Badge variant="outline" className="border-primary/20 bg-primary/5 text-[10px] uppercase tracking-wider text-primary">
                    {row.original.business_type_meta?.label || row.original.business_type || "General Business"}
                </Badge>
            ),
        },
        {
            id: "modules",
            accessorFn: (row) => row.subscribed_modules_count,
            header: t('nav.subscriptions', "Module Subscriptions"),
            cell: ({ row }) => (
                <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Layers className="h-3.5 w-3.5 text-primary" />
                        {row.original.subscribed_modules_count || 0} active
                    </div>
                    <ModuleSubscriptionSummary
                        modules={row.original.subscribed_modules}
                        maxVisible={2}
                        emptyLabel="No modules"
                    />
                </div>
            ),
        },
        {
            id: "domain", accessorFn: (row) => row.domain, header: t('tenants.col_domain', "Routing Address"),
            cell: ({ row }) => <div className="flex items-center gap-1.5 text-muted-foreground font-mono text-xs"><Globe className="h-3.5 w-3.5" />{row.original.domain}</div>,
        },
        {
            id: "status", 
            // 🚀 THE FIX: Translate the accessor string for frontend Copy/Print
            accessorFn: (row) => row.is_active ? t('global.online', "Online") : t('global.suspended', "Suspended"), 
            header: t('tenants.col_status', "Node Status"),
            cell: ({ row }) => <Badge variant="outline" className={cn("uppercase text-[9px]", row.original.is_active ? "text-emerald-500 border-emerald-200 bg-emerald-50/50" : "text-destructive border-destructive/30 bg-destructive/10")}>{row.original.is_active ? t('global.online', "Online") : t('global.suspended', "Suspended")}</Badge>
        },
        {
            id: "created_at", accessorKey: "created_at", header: t('tenants.col_provisioned', "Provisioned"),
            cell: ({ row }) => <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-mono"><Calendar className="h-3.5 w-3.5" />{row.original.created_at ? new Date(row.original.created_at).toLocaleDateString() : "N/A"}</div>,
        },
        {
            id: "actions", header: t('tenants.col_actions', "Actions"), enableSorting: false, size: 180,
            cell: ({ row }) => {
                const tr = row.original;
                return (
                    <div className="flex items-center justify-end gap-1">
                        <Button id={row.index === 0 ? "tour-action-view" : undefined} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600" onClick={() => openView(tr)} title={t('tenants.view_title', "View Details")}>
                            <Eye className="h-4 w-4" />
                        </Button>
                        <div className="w-px h-4 bg-border mx-1" />
                        {canSuspend && (
                            <>
                                <Button id={row.index === 0 ? "tour-action-status" : undefined} variant="ghost" size="icon" disabled={toggleStatusMut.isPending} className="h-8 w-8" onClick={() => toggleStatusMut.mutate(tr.id)}>
                                    <Power className={cn("h-4 w-4", tr.is_active ? "text-emerald-500" : "text-destructive")} />
                                </Button>
                                <Button id={row.index === 0 ? "tour-action-admin" : undefined} variant="ghost" size="icon" disabled={toggleAdminMut.isPending} className="h-8 w-8" onClick={() => toggleAdminMut.mutate(tr.id)}>
                                    {tr.admin_active === false ? <UserX className="h-4 w-4 text-destructive" /> : <UserCheck className="h-4 w-4 text-emerald-500" />}
                                </Button>
                            </>
                        )}
                        <div className="w-px h-4 bg-border mx-1" />
                        {canEdit && (
                            <Button id={row.index === 0 ? "tour-action-edit" : undefined} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-indigo-600" onClick={() => openEdit(tr)}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                        )}
                        {canDelete && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button id={row.index === 0 ? "tour-action-purge" : undefined} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-[2rem] bg-background/95 backdrop-blur-xl">
                                    <AlertDialogHeader><AlertDialogTitle className="text-destructive flex items-center gap-2"><AlertCircle className="h-5 w-5" /> {t('tenants.purge_title', "Purge Node?")}</AlertDialogTitle><AlertDialogDescription>{t('tenants.purge_desc', "This will permanently delete")} <strong>{tr.name}</strong> {t('tenants.purge_desc2', "and all data.")}</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel className="rounded-xl">{t('global.cancel', "Cancel")}</AlertDialogCancel><AlertDialogAction className="rounded-xl bg-destructive" onClick={() => { void deleteMut.mutateAsync(tr.id).then((result) => { if (isOfflineMutationQueuedResult(result)) { toast.info(`Offline: node ${tr.id} deletion has been queued for sync.`); return; } toast.success(t('tenants.node_purged', "Node purged.")); }).catch(() => {}); }}>{t('tenants.purge_confirm', "Confirm Purge")}</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                );
            }
        }
    ], [canEdit, canDelete, canSuspend, toggleStatusMut.isPending, toggleAdminMut.isPending, openView, openEdit, t]);

    const exportUrl = `${getBackendApiRoot()}/tenants/export?search=${encodeURIComponent(search || "")}&sortCol=${sortCol}&sortDir=${sortDir}&locale=${locale}`;

    return (
        <div className="space-y-4 mt-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card/40 p-6 rounded-[2rem] border border-border/50 backdrop-blur-md shadow-sm gap-4 mt-2">
                {canCreate && (
                    <div id="tour-tenant-provision" className="w-full flex justify-end">
                        <Button onClick={openCreate} className="rounded-xl shadow-lg shadow-primary/20 h-11 px-6 font-bold tracking-wide"><PlusCircle className="mr-2 h-5 w-5" /> {t('tenants.provision_btn', 'Provision Node')}</Button>
                    </div>
                )}
            </div>

            <div id="tour-tenant-table">
                <DataTable
                    key={tableKey} columns={columns} data={tenantsData?.rows || []} totalEntries={tenantsData?.total || 0}
                    loading={isLoading || isFetching} exportEndpoint={exportUrl} resourceName="tenants" enableRowSelection={true}
                    pageIndex={page} pageSize={pageSize} onQueryChange={handleQueryChange} onRefresh={handleRefresh}
                    onResetFilters={resetFilters} onDeleteRows={canDelete ? handleDeleteRows : undefined}
                    searchPlaceholder={t('tenants.search_placeholder', "Filter nodes by ID or name...")} syncWithUrl={true}
                    
                    onCopy={() => triggerAudit('copied', 'Copied Node Matrix view to clipboard')} 
                    onPrint={() => triggerAudit('printed', 'Sent current Node Matrix view to PDF/Print processor')}
                    onExport={(format) => triggerAudit('exported', `Triggered automated Node list export in ${format} format`)} 
                    
                    companySettings={companySettings ?? undefined} brandingSettings={brandingSettings ?? undefined}
                />
            </div>

            {/* CREATE / EDIT DIALOG */}
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if(!open) triggerAudit('viewed', 'Closed Provisioning/Reconfiguration Matrix'); }}>
                <DialogContent className="sm:max-w-[1180px] p-0 overflow-hidden rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-xl max-h-[92vh] flex flex-col">
                    <div className="px-6 py-5 border-b border-border/40 bg-muted/20 shrink-0"><DialogHeader><DialogTitle className="text-xl font-space font-black">{isEdit ? t('tenants.reconfigure', "Reconfigure Node") : t('tenants.provision_new', "Provision New Node")}</DialogTitle></DialogHeader></div>
                    <div className="overflow-y-auto p-6 scrollbar-thin">
                        <form id="tenant-form" onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-2 gap-5">
                                <div className="col-span-2 space-y-4">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5 border-b border-border/40 pb-2"><Server className="h-3.5 w-3.5" /> {t('tenants.infra', "Node Infrastructure")}</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5 col-span-2"><Label className="text-xs uppercase tracking-widest text-muted-foreground">{t('tenants.org_name', "Organization Name")}</Label><Input required value={formName} onChange={e => setFormName(e.target.value)} placeholder="Acme Corp" className="h-11 bg-muted/30" /></div>
                                        <div className="space-y-1.5 col-span-2 sm:col-span-1"><Label className="text-xs uppercase tracking-widest text-muted-foreground">{t('tenants.node_id', "Node ID")}</Label><Input required disabled={isEdit} value={formId} onChange={e => handleIdChange(e.target.value)} placeholder="acme" className="h-11 font-mono bg-muted/30" /></div>
                                        <div className="space-y-1.5 col-span-2 sm:col-span-1">
                                            <Label className="text-xs uppercase tracking-widest text-muted-foreground">{t('tenants.plan', "Capacity Plan")}</Label>
                                            <Select value={formPlan} onValueChange={handlePlanChange}>
                                                <SelectTrigger className="h-11 bg-muted/30"><SelectValue /></SelectTrigger>
                                                <SelectContent className="rounded-xl border-border/50 shadow-xl"><SelectItem value="startup">Startup</SelectItem><SelectItem value="business">Business</SelectItem><SelectItem value="enterprise">Enterprise</SelectItem><SelectItem value="overlord">Overlord</SelectItem></SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5 col-span-2"><Label className="text-xs uppercase tracking-widest text-muted-foreground">{t('tenants.domain', "Routing Address")}</Label><div className="relative"><Globe className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input required disabled={isEdit} value={formDomain} onChange={e => setFormDomain(e.target.value)} placeholder={`acme.${DEFAULT_TENANT_ROOT_DOMAIN}`} className="h-11 pl-9 font-mono bg-muted/30" /></div></div>
                                        <div className="col-span-2 rounded-[1rem] border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                                            Generated tenant subdomains follow <span className="font-mono text-foreground">*.{DEFAULT_TENANT_ROOT_DOMAIN}</span>. {DEFAULT_TENANT_SERVER_IP ? <>Point that wildcard record to <span className="font-mono text-foreground">{DEFAULT_TENANT_SERVER_IP}</span>.</> : <>Point that wildcard record to your VPS public IP.</>} If the root domain or VPS changes later, update the production env and redeploy; generated fallback tenant domains will sync automatically.
                                        </div>
                                    </div>
                                    <div className="rounded-[1.25rem] border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                                        Module subscriptions are managed in the dedicated subscriptions workspace. New tenants will still inherit the defaults for the selected plan.
                                    </div>
                                </div>
                                <div className="col-span-2 space-y-4">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5 border-b border-border/40 pb-2"><LayoutTemplate className="h-3.5 w-3.5" /> Business Landing</h4>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Business Type</Label>
                                        <Select value={formBusinessType} onValueChange={handleBusinessTypeChange}>
                                            <SelectTrigger className="h-11 bg-muted/30">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-border/50 shadow-xl">
                                                {businessTypes.map((option) => (
                                                    <SelectItem key={option.key} value={option.key}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">
                                            {activeBusinessTypeDefinition.description}
                                        </p>
                                    </div>
                                    {parsedLandingTemplateState.error ? (
                                        <div className="rounded-[1rem] border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive">
                                            Preview is using the last valid preset because the JSON is invalid. Fix the editor content before saving.
                                        </div>
                                    ) : null}
                                    <TenantLandingTemplateEditor
                                        businessTypeLabel={activeBusinessTypeDefinition.label}
                                        businessTypeDescription={activeBusinessTypeDefinition.description}
                                        templateVariants={templateVariants}
                                        selectedTemplateKey={selectedTemplateKey}
                                        onTemplateVariantChange={handleTemplateVariantChange}
                                        onResetTemplate={handleResetTemplate}
                                        isCustomTemplate={isCustomTemplate}
                                        files={landingTemplateFiles}
                                        setFiles={(files) => setLandingTemplateFiles(files.slice(0, 1))}
                                        showPreview={showLandingPreview}
                                        setShowPreview={setShowLandingPreview}
                                        previewHtml={landingPreviewHtml}
                                    />
                                </div>
                                <div className="col-span-2 space-y-4 pt-2">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5 border-b border-border/40 pb-2"><UserPlus className="h-3.5 w-3.5" /> {t('tenants.super_admin', "Super Admin Settings")}</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5 col-span-2"><Label className="text-xs uppercase tracking-widest text-muted-foreground">{t('tenants.operator_name', "Operator Name")}</Label><Input required={!isEdit} value={formAdminName} onChange={e => setFormAdminName(e.target.value)} placeholder="Operator Name" className="h-11 bg-muted/30" /></div>
                                        <div className="space-y-1.5 col-span-2 sm:col-span-1"><Label className="text-xs uppercase tracking-widest text-muted-foreground">{t('tenants.email', "Email")}</Label><Input type="email" required={!isEdit} value={formAdminEmail} onChange={e => setFormAdminEmail(e.target.value)} placeholder="admin@acme.com" className="h-11 bg-muted/30" /></div>
                                        <div className="space-y-1.5 col-span-2 sm:col-span-1"><Label className="text-xs uppercase tracking-widest text-muted-foreground">{t('tenants.access_key', "Access Key")}</Label><Input type="password" required={!isEdit} value={formAdminPassword} onChange={e => setFormAdminPassword(e.target.value)} placeholder="********" className="h-11 bg-muted/30" /></div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div className="px-6 py-4 border-t border-border/40 bg-muted/20 flex flex-col gap-3 shrink-0 sm:flex-row sm:items-center">
                        <div className="text-xs text-muted-foreground sm:mr-auto">
                            {parsedLandingTemplateState.error
                                ? "Fix the landing template JSON before saving."
                                : isEdit
                                    ? (isEditDirty ? "Unsaved changes are ready to publish." : "No changes detected yet.")
                                    : "The landing preview updates live while you edit."}
                        </div>
                        <div className="flex justify-end gap-3">
                            <Button variant="ghost" type="button" onClick={() => setDialogOpen(false)}>{t('global.cancel', 'Cancel')}</Button>
                            <Button
                                type="submit"
                                form="tenant-form"
                                disabled={isSaving || !!parsedLandingTemplateState.error || (isEdit && !isEditDirty)}
                                className="rounded-xl px-8 font-bold"
                            >
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEdit ? t('global.update', "Update") : t('global.provision', "Provision")}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* VIEW MODAL */}
            <Dialog open={viewDialogOpen} onOpenChange={(open) => { setViewDialogOpen(open); if(!open) triggerAudit('viewed', 'Closed Deep Metric Inspection view'); }}>
                <DialogContent className="sm:max-w-[860px] p-0 overflow-hidden rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-xl max-h-[90vh] flex flex-col">
                    <div className="px-6 py-6 border-b border-border/40 bg-muted/20 flex items-center gap-4 shrink-0"><div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner shrink-0"><Server className="h-7 w-7 text-primary" /></div><div><DialogTitle className="text-2xl font-black font-space tracking-tight">{viewTenant?.name}</DialogTitle><DialogDescription className="font-mono text-[10px] uppercase tracking-widest mt-1">{t('tenants.view_identity', "Node Identity")}: <span className="font-bold">{viewTenant?.id}</span></DialogDescription></div></div>
                    <div className="px-6 py-6 space-y-6 overflow-y-auto scrollbar-thin">
                        <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">{t('tenants.view_status', "Network Status")}</p>
                                <Badge variant="outline" className={cn("uppercase text-[10px]", viewTenant?.is_active ? "text-emerald-500 bg-emerald-50/50" : "text-destructive bg-destructive/10")}>{viewTenant?.is_active ? t('global.online', "Online") : t('global.suspended', "Suspended")}</Badge>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">{t('tenants.view_plan', "Capacity Plan")}</p>
                                {viewTenant?.plan && getPlanBadge(viewTenant.plan)}
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Business Type</p>
                                <Badge variant="outline" className="border-primary/20 bg-primary/5 text-[10px] uppercase tracking-wider text-primary">
                                    {viewTenant?.business_type_meta?.label || viewTenant?.business_type || "General Business"}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Subscription</p>
                                <Badge variant="outline" className={cn("uppercase text-[10px]", viewTenant?.subscription?.status === "expired" ? "text-destructive bg-destructive/10" : viewTenant?.subscription?.needs_renewal ? "text-amber-600 bg-amber-500/10" : "text-emerald-500 bg-emerald-500/10")}>
                                    {String(viewTenant?.subscription?.status || "active").replaceAll("_", " ")}
                                </Badge>
                                <p className="mt-2 text-xs text-muted-foreground">
                                    {viewTenant?.subscription?.expires_at ? `Expires ${new Date(viewTenant.subscription.expires_at).toLocaleDateString()}` : "No expiry date available"}
                                </p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">{t('tenants.view_contact', "Super Admin Contact")}</p>
                                <div className="flex items-center gap-2 font-mono text-sm bg-muted/30 p-3 rounded-xl border border-border/50"><Mail className="h-4 w-4 text-muted-foreground" />{viewTenant?.admin_email || t('tenants.no_email', "No email registered")}{viewTenant?.admin_email && <Badge variant="outline" className={cn("ml-auto text-[9px] uppercase border-0", viewTenant?.admin_active === false ? "text-destructive bg-destructive/10" : "text-emerald-500 bg-emerald-500/10")}>{viewTenant?.admin_active === false ? t('global.suspended', "Suspended") : t('global.active', "Active")}</Badge>}</div>
                            </div>
                            <div className="col-span-2">
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">{t('nav.subscriptions', "Module Subscriptions")}</p>
                                <div className="space-y-3 rounded-xl border border-border/50 bg-muted/30 p-3">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                                        <Layers className="h-4 w-4 text-primary" />
                                        {viewTenant?.subscribed_modules_count || 0} active modules
                                    </div>
                                    <ModuleSubscriptionSummary
                                        modules={viewTenant?.subscribed_modules}
                                        maxVisible={8}
                                        emptyLabel="No modules enabled for this tenant."
                                    />
                                </div>
                            </div>
                            <div className="col-span-2">
                                {viewTenant?.id ? (
                                    <TenantDomainManager tenantId={viewTenant.id} onTenantUpdated={setViewTenant} />
                                ) : null}
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-4 border-t border-border/40 bg-muted/20 flex justify-end shrink-0"><Button variant="outline" onClick={() => setViewDialogOpen(false)} className="rounded-xl px-8 shadow-sm">{t('tenants.close_view', "Close Overview")}</Button></div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
