"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
    Shield, Server, Clock, User as UserIcon, Filter, Eye, Activity, Zap,
    Archive, Hash, FileText, Fingerprint, Settings2, Database, DatabaseBackup, Trash2, Calendar, RotateCcw
} from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/datatable/data-table";
import api, { logFrontendAction } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogHeader, DialogFooter as DialogFooterUI } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useTour } from "@/components/providers/tour-provider";
import { useTranslation } from "@/store/use-translation";
import { getAccessToken, isTenantSession } from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const globalActionLock: Record<string, number> = {};

type FilterOption = {
    value: string;
    label: string;
};

type AuditLogRecord = {
    id: number;
    event: string;
    description: string;
    log_name: string;
    causer: string;
    created_at?: string;
    tenant_id?: string | null;
    properties?: Record<string, unknown>;
};

type LogQueryParams = Record<string, string>;

function buildFallbackOptions(values: Array<string | null | undefined>, formatLabel?: (value: string) => string): FilterOption[] {
    const uniqueValues = Array.from(
        new Map(
            values
                .map((value) => String(value ?? "").trim())
                .filter(Boolean)
                .map((value) => [value.toLowerCase(), value])
        ).values()
    );

    return uniqueValues
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
        .map((value) => ({
            value,
            label: formatLabel ? formatLabel(value) : value,
        }));
}

export function AuditLogsClient() {
    const queryClient = useQueryClient();
    const { isActive } = useTour();
    const { t, locale } = useTranslation();
    const { hasPermission, hasAnyPermission } = usePermissions();

    const [viewMode, setViewMode] = React.useState<"active" | "archived">("active");
    const [page, setPage] = React.useState(1);
    const [pageSize, setPageSize] = useLocalStorage<number>("logs_table_page_size", 15);
    const [search, setSearch] = React.useState("");
    const [sortCol, setSortCol] = React.useState<string | null>("created_at");
    const [sortDir, setSortDir] = React.useState<string | null>("desc");

    const [eventFilter, setEventFilter] = React.useState<"all" | "crud" | "telemetry" | "system">("all");
    const [nodeFilter, setNodeFilter] = React.useState<"all" | "central" | "tenant">("all");
    const [moduleFilter, setModuleFilter] = React.useState("all");
    const [operatorFilter, setOperatorFilter] = React.useState("all");
    const [nodeIdFilter, setNodeIdFilter] = React.useState("all");

    const [startDate, setStartDate] = React.useState<string>("");
    const [endDate, setEndDate] = React.useState<string>("");

    const [viewLog, setViewLog] = React.useState<AuditLogRecord | null>(null);
    const [isArchiving, setIsArchiving] = React.useState(false);

    const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
    const [retentionDays, setRetentionDays] = React.useState<number>(90);
    const [isTenant, setIsTenant] = React.useState(false);

    const [alertConfig, setAlertConfig] = React.useState({
        isOpen: false,
        title: "",
        description: "",
        confirmText: "Continue",
        variant: "default" as "default" | "destructive",
        action: () => {}
    });

    React.useEffect(() => {
        setIsTenant(isTenantSession());
    }, []);

    const canExportLogs = hasAnyPermission(["export_logs", "view_logs", "view_audit_log", "manage_audit_log"]);
    const canManageLogSettings = hasAnyPermission(["manage_log_settings", "manage_audit_retention", "manage_compliance_settings", "manage_audit_log"]);
    const canArchiveLogs = hasAnyPermission(["archive_logs", "manage_log_settings", "manage_audit_retention", "manage_audit_log"]);
    const canDeleteArchivedLogs = hasAnyPermission(["delete_archived_logs", "purge_audit_log", "manage_audit_log"]);

    const openAlert = (title: string, description: string, confirmText: string, variant: "default" | "destructive", action: () => void) => {
        setAlertConfig({ isOpen: true, title, description, confirmText, variant, action });
    };

    React.useEffect(() => { setSelectedIds([]); }, [viewMode]);

    const eventOptions = React.useMemo<FilterOption[]>(() => ([
        { value: "all", label: t('audit.filter_all', 'All Activity') },
        { value: "crud", label: t('audit.filter_crud', 'Modifications') },
        { value: "telemetry", label: t('audit.filter_telemetry', 'Telemetry') },
        { value: "system", label: t('audit.filter_system', 'System') },
    ]), [t, locale]);

    const nodeScopeOptions = React.useMemo<FilterOption[]>(() => ([
        { value: "all", label: t('audit.node_all', 'All Nodes') },
        { value: "central", label: t('audit.node_central', 'Central') },
        { value: "tenant", label: t('audit.node_tenant', 'Tenants') },
    ]), [t, locale]);

    const triggerAudit = React.useCallback(async (action: string, description: string) => {
        if (typeof window === "undefined") return;
        const now = Date.now();
        const payloadKey = `${action}_${description}`;

        if (globalActionLock[payloadKey] && now - globalActionLock[payloadKey] < 2000) return;
        globalActionLock[payloadKey] = now;

        try {
            const token = getAccessToken() || localStorage.getItem('token');
            if (!token) return;
            await logFrontendAction({ module: 'System Audit', action, description });
            if (!['filtered', 'copied', 'printed', 'exported', 'viewed'].includes(action)) {
                setTimeout(() => queryClient.invalidateQueries({ queryKey: ["logs"] }), 800);
            }
        } catch (e) {}
    }, [queryClient]);

    const { data: logsData, isLoading, isFetching } = useQuery({
        queryKey: ["logs", page, pageSize, search, sortCol, sortDir, eventFilter, nodeFilter, moduleFilter, operatorFilter, nodeIdFilter, viewMode, startDate, endDate],
        queryFn: async () => {
            const params: LogQueryParams = {
                page: page.toString(), pageSize: pageSize.toString(), search,
                sort_by: sortCol || "created_at", sort_direction: sortDir || "desc",
                event: eventFilter, node: nodeFilter
            };
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;
            if (moduleFilter !== "all") params.module = moduleFilter;
            if (operatorFilter !== "all") params.operator = operatorFilter;
            if (nodeIdFilter !== "all" && !isTenant) params.node_id = nodeIdFilter;

            const endpoint = viewMode === "archived" ? "/logs/archived" : "/logs";
            const { data: json } = await api.get(endpoint, { params });

            return {
                rows: json?.data || [],
                total: json?.meta?.total || 0,
                engine: json?.meta?.engine || 'database'
            };
        },
        placeholderData: (prev) => prev,
        staleTime: 15_000,
        refetchOnWindowFocus: false,
    });

    const { data: filterOptions, isFetching: isFilterOptionsFetching } = useQuery({
        queryKey: ["log-filter-options", viewMode, eventFilter, nodeFilter, startDate, endDate, isTenant],
        queryFn: async () => {
            const params: LogQueryParams = {
                mode: viewMode,
                event: eventFilter,
                node: nodeFilter,
            };

            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;

            const { data } = await api.get('/logs/filter-options', { params });

            return {
                modules: Array.isArray(data?.modules) ? data.modules : [],
                operators: Array.isArray(data?.operators) ? data.operators : [],
                nodes: Array.isArray(data?.nodes) ? data.nodes : [],
            } as {
                modules: FilterOption[];
                operators: FilterOption[];
                nodes: FilterOption[];
            };
        },
        placeholderData: (prev) => prev,
        staleTime: 15_000,
        refetchOnWindowFocus: false,
    });

    const moduleOptions = React.useMemo(
        () => (filterOptions?.modules?.length ? filterOptions.modules : buildFallbackOptions((logsData?.rows || []).map((row: AuditLogRecord) => row.log_name))),
        [filterOptions?.modules, logsData?.rows]
    );

    const operatorOptions = React.useMemo(() => {
        const raw = filterOptions?.operators?.length ? filterOptions.operators : buildFallbackOptions((logsData?.rows || []).map((row: AuditLogRecord) => row.causer));
        return raw.map((opt) => opt.value.toLowerCase() === 'system' ? { ...opt, label: t('audit.filter_system', 'System') } : opt);
    }, [filterOptions?.operators, logsData?.rows, t, locale]);

    const nodeOptions = React.useMemo(() => {
        const raw = filterOptions?.nodes?.length
            ? filterOptions.nodes
            : buildFallbackOptions(
                (logsData?.rows || []).map((row: AuditLogRecord) => row.tenant_id || "central"),
                (value) => value.toLowerCase() === "central" ? "Central Command" : value.toUpperCase()
            );
        return raw.map((opt) => opt.value.toLowerCase() === 'central' ? { ...opt, label: t('permissions.central', 'Central Command') } : opt);
    }, [filterOptions?.nodes, logsData?.rows, t, locale]);

    React.useEffect(() => {
        if (moduleFilter !== "all" && !moduleOptions.some((option) => option.value === moduleFilter)) {
            setModuleFilter("all");
        }
    }, [moduleOptions, moduleFilter]);

    React.useEffect(() => {
        if (operatorFilter !== "all" && !operatorOptions.some((option) => option.value === operatorFilter)) {
            setOperatorFilter("all");
        }
    }, [operatorOptions, operatorFilter]);

    React.useEffect(() => {
        if (nodeIdFilter !== "all" && !nodeOptions.some((option) => option.value === nodeIdFilter)) {
            setNodeIdFilter("all");
        }
    }, [nodeOptions, nodeIdFilter]);

    const openSettings = async () => {
        setIsSettingsOpen(true);
        try {
            const { data } = await api.get('/logs/settings');
            if (data.retention_days !== undefined) setRetentionDays(data.retention_days);
        } catch (e) {}
    };

    const saveSettings = async () => {
        try {
            await api.post('/logs/settings', { retention_days: retentionDays });
            toast.success(t('audit.policy_updated', `Policy updated. Logs older than ${retentionDays} days will be vaulted.`));
            triggerAudit('updated', `Changed archive retention policy to ${retentionDays} days`);
            setIsSettingsOpen(false);
        } catch (e) {
            toast.error(t('global.operation_failed', "Failed to update settings."));
        }
    };

    const handleTriggerArchive = () => {
        openAlert(
            t('audit.engage_archive_title', "Engage the Archiving Engine?"),
            t('audit.engage_archive_desc', "This will systematically move all eligible live logs to the cold storage Vault based on your retention settings. This action cannot be reversed."),
            t('audit.archive_btn', "Archive Logs"),
            "destructive",
            async () => {
                setIsArchiving(true);
                try {
                    await api.post('/logs/archive');
                    toast.success(t('audit.archive_success', "Archiving engine engaged. Check the Vault tab shortly."));
                    triggerAudit('archived', 'Manually triggered the mass WORM archival engine.');
                    setTimeout(() => queryClient.invalidateQueries({ queryKey: ["logs"] }), 2000);
                } catch (error) {
                    toast.error(t('global.operation_failed', "Network error triggering archive."));
                } finally {
                    setIsArchiving(false);
                }
            }
        );
    };

    const deleteIndividualLog = (id: number) => {
        openAlert(
            t('audit.delete_record_title', "Permanently Delete Record?"),
            t('audit.delete_record_desc', `You are about to permanently destroy WORM vaulted record #${id}. This action violates standard audit compliance and cannot be undone.`),
            t('global.delete', "Delete Record"),
            "destructive",
            async () => {
                try {
                    await api.delete(`/logs/archived/${id}`);
                    toast.success(t('audit.record_deleted', "Vaulted record permanently deleted."));
                    triggerAudit('deleted', `Destroyed vaulted record ID: ${id}`);
                    queryClient.invalidateQueries({ queryKey: ["logs"] });
                } catch (e) {
                    toast.error(t('global.operation_failed', "Deletion failed."));
                }
            }
        );
    };

    const deleteBulkLogs = () => {
        openAlert(
            t('audit.bulk_delete_title', "Bulk Delete Vaulted Records?"),
            t('audit.bulk_delete_desc', `You are about to permanently destroy ${selectedIds.length} vaulted records. This completely wipes them from the database and cannot be undone.`),
            t('audit.destroy_records', "Destroy Records"),
            "destructive",
            async () => {
                try {
                    await api.post('/logs/archived/bulk-delete', { ids: selectedIds });
                    toast.success(`${selectedIds.length} ${t('audit.records_deleted', 'vaulted records permanently deleted.')}`);
                    triggerAudit('deleted', `Destroyed ${selectedIds.length} vaulted records in bulk.`);
                    setSelectedIds([]);
                    queryClient.invalidateQueries({ queryKey: ["logs"] });
                } catch (e) {
                    toast.error(t('global.operation_failed', "Bulk deletion failed."));
                }
            }
        );
    };

    const handleEventFilterChange = React.useCallback((value: string) => {
        setEventFilter(value as "all" | "crud" | "telemetry" | "system");
        setPage(1);
        triggerAudit('filtered', `Applied MATRIX filter: ${value.toUpperCase()}`);
    }, [triggerAudit]);

    const handleNodeScopeChange = React.useCallback((value: string) => {
        setNodeFilter(value as "all" | "central" | "tenant");
        setNodeIdFilter("all");
        setPage(1);
        triggerAudit('filtered', `Applied NODE filter: ${value.toUpperCase()}`);
    }, [triggerAudit]);

    const applyDatePreset = (days: number) => {
        const today = new Date();
        const start = new Date();
        start.setDate(today.getDate() - days);

        const formatDate = (d: Date) => d.toISOString().split('T')[0];

        setEndDate(formatDate(today));
        setStartDate(formatDate(start));
        setPage(1);
        triggerAudit('filtered', `Applied quick date preset: Last ${days} Days`);
    };

    const getTranslatedEventString = React.useCallback((event: string) => {
        const ev = event?.toLowerCase() || 'unknown';
        if (ev.includes('login') || ev.includes('logged') || ev.includes('fail') || ev.includes('block')) return event;
        switch (ev) {
            case 'created': return t('global.created', 'Created');
            case 'updated': return t('global.updated', 'Updated');
            case 'deleted': return t('global.deleted', 'Deleted');
            case 'viewed': return t('global.viewed', 'Viewed');
            case 'exported': return t('global.exported', 'Exported');
            case 'copied': return t('global.copied', 'Copied');
            case 'printed': return t('global.printed', 'Printed');
            default: return event;
        }
    }, [t]);

    const getEventBadge = (event: string) => {
        const ev = event?.toLowerCase() || 'unknown';
        const base = "uppercase tracking-widest text-[11px] px-2 py-0.5 rounded-full border font-bold";
        if (ev.includes('login') || ev.includes('logged')) return <Badge variant="outline" className={`${base} text-blue-500 border-blue-200 bg-blue-50/50`}>{event}</Badge>;
        if (ev.includes('fail') || ev.includes('block')) return <Badge variant="outline" className={`${base} text-destructive border-destructive/30 bg-destructive/10`}>{event}</Badge>;
        switch (ev) {
            case 'created': return <Badge variant="outline" className={`${base} text-emerald-500 border-emerald-200 bg-emerald-50/50`}>{t('global.created', 'Created')}</Badge>;
            case 'updated': return <Badge variant="outline" className={`${base} text-blue-500 border-blue-200 bg-blue-50/50`}>{t('global.updated', 'Updated')}</Badge>;
            case 'deleted': return <Badge variant="outline" className={`${base} text-destructive border-destructive/30 bg-destructive/10`}>{t('global.deleted', 'Deleted')}</Badge>;
            case 'viewed': return <Badge variant="outline" className={`${base} text-purple-500 border-purple-200 bg-purple-50/50`}>{t('global.viewed', 'Viewed')}</Badge>;
            case 'exported': return <Badge variant="outline" className={`${base} text-amber-600 border-amber-200 bg-amber-50/50`}>{t('global.exported', 'Exported')}</Badge>;
            case 'copied': return <Badge variant="outline" className={`${base} text-slate-500 border-slate-200 bg-slate-50/50`}>{t('global.copied', 'Copied')}</Badge>;
            case 'printed': return <Badge variant="outline" className={`${base} text-pink-500 border-pink-200 bg-pink-50/50`}>{t('global.printed', 'Printed')}</Badge>;
            default: return <Badge variant="secondary" className={base}>{event}</Badge>;
        }
    };

    const columns = React.useMemo<ColumnDef<AuditLogRecord>[]>(() => {
        const baseCols: ColumnDef<AuditLogRecord>[] = [
            { id: "id", accessorKey: "id", header: t('audit.col_id', "ID"), size: 60, cell: ({ row }) => <span className="font-mono text-[11px] text-muted-foreground flex items-center gap-0.5"><Hash className="h-3 w-3" />{row.original.id}</span> },
            {
                id: "event",
                accessorFn: (row) => getTranslatedEventString(row.event),
                header: t('audit.col_action', "Action"),
                size: 100,
                cell: ({ row }) => getEventBadge(row.original.event)
            },
            { id: "description", accessorKey: "description", header: t('audit.col_desc', "Activity Description"), cell: ({ row }) => <span className="font-medium text-foreground truncate block max-w-[250px]">{row.original.description}</span> },
            { id: "log_name", accessorKey: "log_name", header: t('audit.col_module', "Module"), cell: ({ row }) => (<div className="flex items-center gap-1.5 text-muted-foreground font-mono text-xs"><Shield className="h-3.5 w-3.5" />{row.original.log_name}</div>) },
            { id: "causer", accessorKey: "causer", header: t('audit.col_operator', "Operator"), cell: ({ row }) => (<div className="flex items-center gap-1.5 font-semibold text-sm"><UserIcon className="h-4 w-4 text-muted-foreground" />{row.original.causer}</div>) },
            { id: "created_at", accessorKey: "created_at", header: t('audit.col_time', "Timestamp"), cell: ({ row }) => (<div className="flex items-center gap-1.5 text-muted-foreground text-xs font-mono"><Clock className="h-3.5 w-3.5" />{row.original.created_at ? new Date(row.original.created_at).toLocaleString() : ''}</div>) },
            {
                id: "actions", header: t('audit.col_actions', "Actions"), size: 80,
                cell: ({ row }) => (
                    <div className="flex items-center gap-1">
                        <span className="tour-audit-action-view flex">
                            <Button variant="ghost" size="icon" aria-label={t('audit.view_log', 'View log details') + ` (ID ${row.original.id})`} onClick={() => { setViewLog(row.original); triggerAudit('viewed', `Inspected Log ID: ${row.original.id}`); }}><Eye className="h-4 w-4 text-blue-500" /></Button>
                        </span>

                        {viewMode === 'archived' && canDeleteArchivedLogs && (
                            <span className="tour-audit-action-delete flex">
                                <Button variant="ghost" size="icon" onClick={() => deleteIndividualLog(row.original.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </span>
                        )}
                    </div>
                )
            }
        ];

        if (!isTenant) {
            baseCols.splice(5, 0, { id: "tenant_id", accessorKey: "tenant_id", header: t('audit.col_node', "Node"), cell: ({ row }) => (<div className="flex items-center gap-1.5 font-mono text-xs font-bold text-primary"><Server className="h-3.5 w-3.5" />{(row.original.tenant_id || 'CENTRAL').toUpperCase()}</div>) });
        }

        if (viewMode === 'archived') {
            baseCols.unshift({
                id: "select",
                header: () => (
                    <Checkbox
                        // 🚀 THE FIX: Safely check array length using optional chaining and nullish coalescing
                        checked={(logsData?.rows?.length ?? 0) > 0 && selectedIds.length === (logsData?.rows?.length ?? 0)}
                        onCheckedChange={(c) => c ? setSelectedIds(logsData?.rows?.map((r: AuditLogRecord) => r.id) || []) : setSelectedIds([])}
                    />
                ),
                size: 40,
                cell: ({ row }) => (
                    <Checkbox
                        checked={selectedIds.includes(row.original.id)}
                        onCheckedChange={(c) => c ? setSelectedIds(prev => [...prev, row.original.id]) : setSelectedIds(prev => prev.filter(id => id !== row.original.id))}
                    />
                )
            });
        }

        return baseCols;
    }, [triggerAudit, viewMode, selectedIds, logsData, isTenant, t, locale, getTranslatedEventString, canDeleteArchivedLogs]);

    const exportUrl = React.useMemo(() => {
        const params = new URLSearchParams({
            search: search || "",
            sortCol: sortCol || "",
            sortDir: sortDir || "",
            event: eventFilter,
            node: nodeFilter,
            mode: viewMode,
            start_date: startDate,
            end_date: endDate,
            locale,
        });
        if (moduleFilter !== "all") params.set("module", moduleFilter);
        if (operatorFilter !== "all") params.set("operator", operatorFilter);
        if (nodeIdFilter !== "all" && !isTenant) params.set("node_id", nodeIdFilter);

        return `/logs/export?${params.toString()}`;
    }, [search, sortCol, sortDir, eventFilter, nodeFilter, moduleFilter, operatorFilter, nodeIdFilter, viewMode, startDate, endDate, locale, isTenant]);

    return (
        <div className="space-y-4 mt-6">

            <div className="flex flex-col sm:flex-row justify-between items-end gap-4 mb-2">
                <div id="tour-audit-view-modes" className="flex items-center gap-3">
                    <div className="flex bg-muted/40 p-1.5 rounded-xl border border-border/50 w-max">
                        <Button variant={viewMode === "active" ? "default" : "ghost"} size="sm" className="rounded-lg text-xs font-bold" onClick={() => { setViewMode("active"); setPage(1); }}>
                            <Database className="w-4 h-4 mr-2" /> {t('audit.active_logs', 'Active Live Logs')}
                        </Button>
                        <Button variant={viewMode === "archived" ? "secondary" : "ghost"} size="sm" className={`rounded-lg text-xs font-bold ${viewMode === 'archived' && 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'}`} onClick={() => { setViewMode("archived"); setPage(1); triggerAudit('viewed', 'Accessed the Cold Storage Archive Vault'); }}>
                            <DatabaseBackup className="w-4 h-4 mr-2" /> {t('audit.vault', 'Cold Storage Vault')}
                        </Button>
                    </div>

                    {/* ENGINE INDICATOR: Visually confirms Meilisearch is Active */}
                    {logsData?.engine === 'meilisearch' && search.length > 0 && (
                        <Badge variant="outline" className="h-8 px-3 bg-emerald-500/10 text-emerald-500 border-emerald-500/30 font-bold gap-1.5 animate-in fade-in zoom-in">
                           <Zap className="h-4 w-4 fill-emerald-500 text-emerald-500" /> {t('audit.advanced_search_active', 'Advanced Search Active')}
                        </Badge>
                    )}
                </div>

                {viewMode === "archived" && canDeleteArchivedLogs && selectedIds.length > 0 && (
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])} className="text-muted-foreground">
                            {t('audit.clear_selection', 'Clear Selection')}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={deleteBulkLogs} className="shadow-md h-9 animate-in fade-in zoom-in rounded-xl">
                            <Trash2 className="w-4 h-4 mr-2" /> {t('audit.delete_selected', 'Permanently Delete Selected')} ({selectedIds.length})
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-2 bg-card/40 p-4 rounded-2xl border border-border/50 backdrop-blur-md">
                <div className="flex flex-col xl:flex-row gap-3 w-full">

                    <div className={cn("grid w-full gap-3 xl:grid-cols-4", !isActive && "overflow-x-auto")}>
                        <div id="tour-audit-filters-event" className="rounded-2xl border border-border/50 bg-background/50 p-3 shadow-sm">
                            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                                <Filter className="h-3.5 w-3.5" />
                                {t('audit.filter_event_label', 'Event Matrix')}
                            </div>
                            <Select value={eventFilter} onValueChange={handleEventFilterChange}>
                                <SelectTrigger className="h-10 w-full rounded-xl bg-muted/40">
                                    <SelectValue placeholder={t('audit.filter_all', 'All Activity')} />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border/50">
                                    {eventOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div id="tour-audit-filters-module" className="rounded-2xl border border-border/50 bg-background/50 p-3 shadow-sm">
                            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                                <Shield className="h-3.5 w-3.5" />
                                {t('audit.filter_module_label', 'Module')}
                            </div>
                            <Select
                                value={moduleFilter}
                                onValueChange={(value) => {
                                    setModuleFilter(value);
                                    setPage(1);
                                    triggerAudit('filtered', `Applied MODULE filter: ${value.toUpperCase()}`);
                                }}
                            >
                                <SelectTrigger className="h-10 w-full rounded-xl bg-muted/40" disabled={isFilterOptionsFetching}>
                                    <SelectValue placeholder={t('audit.filter_module_placeholder', 'Choose module')} />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border/50">
                                    <SelectItem value="all">{t('audit.filter_module_all', 'All Modules')}</SelectItem>
                                    {moduleOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div id="tour-audit-filters-operator" className="rounded-2xl border border-border/50 bg-background/50 p-3 shadow-sm">
                            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                                <UserIcon className="h-3.5 w-3.5" />
                                {t('audit.filter_operator', 'Operator')}
                            </div>
                            <Select
                                value={operatorFilter}
                                onValueChange={(value) => {
                                    setOperatorFilter(value);
                                    setPage(1);
                                    triggerAudit('filtered', `Applied OPERATOR filter: ${value.toUpperCase()}`);
                                }}
                            >
                                <SelectTrigger className="h-10 w-full rounded-xl bg-muted/40" disabled={isFilterOptionsFetching}>
                                    <SelectValue placeholder={t('audit.filter_operator_placeholder', 'Choose operator')} />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border/50">
                                    <SelectItem value="all">{t('audit.filter_operator_all', 'All Operators')}</SelectItem>
                                    {operatorOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {!isTenant && (
                            <div id="tour-audit-filters-node" className="rounded-2xl border border-border/50 bg-background/50 p-3 shadow-sm">
                                <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                                    <Server className="h-3.5 w-3.5" />
                                    {t('audit.filter_scope_label', 'Node Scope')}
                                </div>
                                <Select value={nodeFilter} onValueChange={handleNodeScopeChange}>
                                    <SelectTrigger className="h-10 w-full rounded-xl bg-muted/40">
                                        <SelectValue placeholder={t('audit.node_all', 'All Nodes')} />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border/50">
                                        {nodeScopeOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <div className={cn("flex items-center gap-2 pb-1 shrink-0", !isActive && "overflow-x-auto")}>
                        {(canManageLogSettings || canArchiveLogs) && (
                            <div id="tour-audit-actions-vault" className="flex items-center gap-2 shrink-0">
                                {canManageLogSettings && (
                                    <Button variant="outline" size="sm" onClick={openSettings} className="h-8 rounded-xl shadow-sm text-muted-foreground hover:text-foreground">
                                        <Settings2 className="h-4 w-4 mr-2" /> {t('audit.policy_settings', 'Policy Settings')}
                                    </Button>
                                )}
                                {canArchiveLogs && (
                                    <Button onClick={handleTriggerArchive} disabled={isArchiving} variant="destructive" size="sm" className="h-8 shadow-md rounded-xl font-bold tracking-wide">
                                        <Archive className="h-4 w-4 mr-2" />{isArchiving ? t('audit.archiving', 'Archiving...') : t('audit.trigger_vault', 'Trigger Vault')}
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className={cn("grid gap-3 rounded-2xl border border-border/50 bg-card/30 p-4 shadow-sm", !isTenant ? "md:grid-cols-[1fr_1fr_auto]" : "md:grid-cols-[1fr_1fr]")}>
                {!isTenant && (
                    <div id="tour-audit-filters-specific-node" className="rounded-2xl border border-border/40 bg-background/60 p-3">
                        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                            <Server className="h-3.5 w-3.5" />
                            {t('audit.filter_node_label', 'Specific Node')}
                        </div>
                        <Select
                            value={nodeIdFilter}
                            onValueChange={(value) => {
                                setNodeIdFilter(value);
                                setPage(1);
                                triggerAudit('filtered', `Applied SPECIFIC NODE filter: ${value.toUpperCase()}`);
                            }}
                        >
                            <SelectTrigger className="h-10 w-full rounded-xl bg-muted/40" disabled={isFilterOptionsFetching}>
                                <SelectValue placeholder={t('audit.filter_node_placeholder', 'Choose node')} />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/50">
                                <SelectItem value="all">{t('audit.filter_node_all', 'All Available Nodes')}</SelectItem>
                                {nodeOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="rounded-2xl border border-border/40 bg-background/60 p-3">
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {t('audit.filter_date_label', 'Date Window')}
                    </div>
                    <div id="tour-audit-filters-date" className="space-y-3">
                        <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-muted/40 p-1">
                            <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" onClick={() => applyDatePreset(0)}>{t('audit.today', 'Today')}</Button>
                            <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" onClick={() => applyDatePreset(7)}>{t('audit.7d', '7D')}</Button>
                            <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" onClick={() => applyDatePreset(30)}>{t('audit.30d', '30D')}</Button>
                            {(startDate || endDate) && (
                                <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 text-destructive" onClick={() => { setStartDate(""); setEndDate(""); setPage(1); triggerAudit('filtered', 'Cleared date filters'); }}>
                                    <RotateCcw className="w-3 h-3" />
                                </Button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground ml-1">{t('audit.start_date', 'From')}</span>
                                <Input
                                    type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); triggerAudit('filtered', 'Applied start date filter'); }}
                                    className="h-10 rounded-xl bg-muted/30"
                                />
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground ml-1">{t('audit.end_date', 'To')}</span>
                                <Input
                                    type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); triggerAudit('filtered', 'Applied end date filter'); }}
                                    className="h-10 rounded-xl bg-muted/30"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-end justify-end">
                    <Button
                        id="tour-audit-filters-reset"
                        variant="outline"
                        className="h-10 rounded-xl"
                        onClick={() => {
                            setEventFilter("all");
                            setNodeFilter("all");
                            setModuleFilter("all");
                            setOperatorFilter("all");
                            setNodeIdFilter("all");
                            setSearch("");
                            setStartDate("");
                            setEndDate("");
                            setPage(1);
                            triggerAudit('filtered', 'Reset all audit filters');
                        }}
                    >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        {t('audit.reset_filters', 'Reset Filters')}
                    </Button>
                </div>
            </div>

            <DataTable
                key={`${viewMode}-${locale}`}
                columns={columns}
                data={logsData?.rows || []}
                totalEntries={logsData?.total || 0}
                loading={isLoading || isFetching}
                resourceName={viewMode === "archived" ? t("audit.vaulted_logs_resource", "vaulted logs") : t("audit.logs_resource", "logs")}
                searchPlaceholder={t("audit.search_placeholder", "Search audit logs...")}
                pageIndex={page}
                pageSize={pageSize}
                onQueryChange={(q) => {
                    if (q.page) setPage(q.page);
                    if (q.pageSize) setPageSize(q.pageSize);
                    if (q.search !== undefined) setSearch(q.search);
                    if (q.sortCol !== undefined) setSortCol(q.sortCol ?? null);
                    if (q.sortDir !== undefined) setSortDir(q.sortDir ?? null);
                }}
                onRefresh={() => queryClient.invalidateQueries({ queryKey: ["logs"] })}
                onResetFilters={() => {
                    setSearch(""); setSortCol("created_at"); setSortDir("desc");
                    setEventFilter("all"); setNodeFilter("all"); setPage(1);
                    setModuleFilter("all"); setOperatorFilter("all"); setNodeIdFilter("all");
                    setStartDate(""); setEndDate("");
                }}
                onCopy={canExportLogs ? () => triggerAudit('copied', 'Copied datatable to clipboard') : undefined}
                onPrint={canExportLogs ? () => triggerAudit('printed', 'Printed datatable') : undefined}
                onExport={canExportLogs ? (format) => triggerAudit('exported', `Exported to ${format}`) : undefined}
                exportEndpoint={canExportLogs ? exportUrl : undefined}
                syncWithUrl={true}
            />

            {/* ALERT DIALOG COMPONENT */}
            <AlertDialog open={alertConfig.isOpen} onOpenChange={(open) => setAlertConfig(prev => ({ ...prev, isOpen: open }))}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{alertConfig.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {alertConfig.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">{t('global.cancel', 'Cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={alertConfig.action}
                            className={`rounded-xl ${alertConfig.variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`}
                        >
                            {alertConfig.confirmText}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* SETTINGS DIALOG */}
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-[1.5rem]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Settings2 className="w-5 h-5 text-primary" /> {t('audit.settings_title', 'Archive Policy Settings')}</DialogTitle>
                        <DialogDescription>{t('audit.settings_desc', 'Configure the threshold for the automated WORM Archival Engine.')}</DialogDescription>
                    </DialogHeader>
                    <div className="py-6">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 block">{t('audit.retention', 'Retention Threshold (Days)')}</label>
                        <div className="flex items-center gap-3">
                            <Input type="number" value={retentionDays} onChange={(e) => setRetentionDays(Number(e.target.value))} className="h-12 text-lg font-mono w-32" />
                            <span className="text-sm text-muted-foreground font-medium">{t('audit.retention_1', 'Logs older than')} <strong className="text-foreground">{retentionDays} {t('audit.retention_days', 'days')}</strong> {t('audit.retention_2', 'will be vaulted.')}</span>
                        </div>
                    </div>
                    <DialogFooterUI>
                        <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>{t('global.cancel', 'Cancel')}</Button>
                        <Button onClick={saveSettings}>{t('audit.save_policy', 'Save Policy')}</Button>
                    </DialogFooterUI>
                </DialogContent>
            </Dialog>

            {/* FORENSIC INSPECTION DIALOG */}
            <Dialog open={!!viewLog} onOpenChange={(open) => !open && setViewLog(null)}>
                <DialogContent className="sm:max-w-[750px] p-0 overflow-hidden rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl">
                    <div className="px-6 py-6 border-b border-border/40 bg-muted/30 flex items-start gap-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none"><Fingerprint className="w-40 h-40" /></div>
                        <div className="h-14 w-14 rounded-2xl flex items-center justify-center border shadow-inner shrink-0 bg-primary/10 border-primary/20 text-primary z-10"><Activity className="h-7 w-7" /></div>
                        <div className="flex-1 z-10">
                            <DialogTitle className="text-2xl font-black font-space tracking-tight flex items-center gap-3">{t('audit.inspection', 'Forensic Inspection')} {viewLog && getEventBadge(viewLog.event)}</DialogTitle>
                            <DialogDescription className="font-mono text-[11px] uppercase tracking-widest mt-1 text-muted-foreground">{t('audit.worm_id', 'WORM Record ID')}: <span className="font-bold text-foreground">#{viewLog?.id}</span></DialogDescription>
                        </div>
                    </div>
                    <div className="px-6 py-6 max-h-[60vh] overflow-y-auto space-y-6 scrollbar-thin">
                        <div className="bg-card p-5 rounded-2xl border border-border/50 shadow-sm space-y-4">
                            <div className="flex items-start gap-3">
                                <FileText className="w-5 h-5 text-primary mt-0.5" />
                                <div><p className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-1">{t('audit.exec_desc', 'Execution Description')}</p><p className="text-sm font-medium leading-relaxed">{viewLog?.description}</p></div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold ml-1">{t('audit.payload', 'Raw Payload Block')}</p>
                            <div className="bg-[hsl(var(--terminal-surface))] text-[hsl(var(--terminal-foreground))] p-4 rounded-xl font-mono text-[11px] overflow-x-auto border border-border shadow-inner">
                                <pre>{JSON.stringify(viewLog?.properties || {}, null, 2)}</pre>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-4 border-t border-border/40 bg-muted/30 flex justify-between items-center">
                        <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest flex items-center gap-1"><Shield className="w-3 h-3" /> {t('audit.verified', 'Integrity Verified')}</span>
                        <Button variant="outline" onClick={() => setViewLog(null)} className="rounded-xl px-8 shadow-sm">{t('audit.close_inspection', 'Close Inspection')}</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
