"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Search,
  RefreshCw,
  Filter,
  CheckCircle2,
  Info,
  Calendar,
  Layers,
  Sparkles,
  User,
  Shield,
  FileText,
  Building,
  Truck,
  Database,
  ArrowRight,
  ArchiveRestore,
  Settings2,
  Sliders,
  Check,
  Radio,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
import {
  fetchTrashItems,
  fetchTrashStats,
  fetchTrashSettings,
  updateTrashSettings,
  restoreTrashItem,
  forceDeleteTrashItem,
  restoreAllTrash,
  emptyTrash,
  purgeExpiredTrash,
} from "@/modules/core/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useTranslation } from "@/store/use-translation";
import { cn } from "@/lib/utils";
import { initEcho, getTrashChannelName } from "@/lib/echo";
import { getAccessToken } from "@/lib/runtime-context";

export interface TrashedItem {
  id: string;
  entity_key: string;
  entity_type: string;
  module: string;
  module_id: string;
  title: string;
  subtitle?: string | null;
  avatar?: string | null;
  deleted_at: string;
  deleted_at_human: string;
  purge_at: string;
  days_remaining: number;
  is_expiring_soon: boolean;
  meta?: {
    original_table?: string;
  };
}

const RETENTION_PRESETS = [
  { days: 7, label: "7 Days (1 Week)" },
  { days: 14, label: "14 Days (2 Weeks)" },
  { days: 30, label: "30 Days (1 Month)" },
  { days: 60, label: "60 Days (2 Months)" },
  { days: 90, label: "90 Days (Quarter)" },
  { days: 180, label: "180 Days (6 Months)" },
  { days: 365, label: "365 Days (1 Year)" },
];

export function TrashClient() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = useLocalStorage<number>("trash_table_page_size", 15);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [selectedModule, setSelectedModule] = React.useState<string>("all");
  const [selectedType, setSelectedType] = React.useState<string>("all");
  const [isRealtimeActive, setIsRealtimeActive] = React.useState(false);

  // Dialog states
  const [itemToRestore, setItemToRestore] = React.useState<TrashedItem | null>(null);
  const [itemToPurge, setItemToPurge] = React.useState<TrashedItem | null>(null);
  const [showEmptyConfirm, setShowEmptyConfirm] = React.useState(false);
  const [showRestoreAllConfirm, setShowRestoreAllConfirm] = React.useState(false);
  const [showRetentionModal, setShowRetentionModal] = React.useState(false);
  const [customRetentionDays, setCustomRetentionDays] = React.useState<number>(30);
  const [isActionInProgress, setIsActionInProgress] = React.useState(false);

  const handleQueryChange = React.useCallback(
    (q: DataTableQuery) => {
      if (q.page !== undefined) setPage(q.page);
      if (q.pageSize !== undefined) setPageSize(q.pageSize);
      if (q.search !== undefined) {
        setSearch((prev) => {
          if (prev !== q.search) setPage(1);
          return q.search ?? "";
        });
      }
    },
    [setPageSize]
  );

  // Debounce search
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  // Query trashed items
  const {
    data: trashResponse,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["trash-items", page, pageSize, debouncedSearch, selectedModule, selectedType],
    queryFn: () =>
      fetchTrashItems({
        page,
        per_page: pageSize,
        search: debouncedSearch,
        module: selectedModule === "all" ? undefined : selectedModule,
        entity_type: selectedType === "all" ? undefined : selectedType,
      }),
    staleTime: 10000,
  });

  // Query stats
  const { data: statsResponse } = useQuery({
    queryKey: ["trash-stats"],
    queryFn: () => fetchTrashStats(),
    staleTime: 15000,
  });

  // Query dynamic settings
  const { data: settingsResponse } = useQuery({
    queryKey: ["trash-settings"],
    queryFn: () => fetchTrashSettings(),
    staleTime: 60000,
  });

  const trashedItems: TrashedItem[] = trashResponse?.data || [];
  const meta = trashResponse?.meta || { total: 0, current_page: 1, last_page: 1, per_page: pageSize };
  const currentRetentionDays =
    settingsResponse?.retention_days ||
    statsResponse?.stats?.retention_days ||
    trashResponse?.stats?.retention_days ||
    30;

  const stats = statsResponse?.stats || trashResponse?.stats || {
    total_trashed: 0,
    expiring_soon: 0,
    retention_days: currentRetentionDays,
    by_module: {},
    by_type: {},
  };

  // Sync retention modal default when settings load
  React.useEffect(() => {
    if (currentRetentionDays) {
      setCustomRetentionDays(currentRetentionDays);
    }
  }, [currentRetentionDays]);

  // 🔴 REAL-TIME REVERB WEBSOCKET SUBSCRIPTION
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const token = getAccessToken();
    if (!token) return;

    const echo = initEcho(token);
    if (!echo) return;

    const channelName = getTrashChannelName();
    const channel = echo.private(channelName);
    setIsRealtimeActive(true);

    const handleTrashEvent = (event: any) => {
      // Invalidate queries to refresh table and stats in real time
      queryClient.invalidateQueries({ queryKey: ["trash-items"] });
      queryClient.invalidateQueries({ queryKey: ["trash-stats"] });
      queryClient.invalidateQueries({ queryKey: ["trash-settings"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });

      if (event?.message) {
        toast.info(event.message, {
          icon: <Radio className="h-4 w-4 text-emerald-500 animate-pulse" />,
        });
      }
    };

    channel.listen(".TrashUpdated", handleTrashEvent);
    channel.listen("TrashUpdated", handleTrashEvent);

    return () => {
      channel.stopListening(".TrashUpdated");
      channel.stopListening("TrashUpdated");
      setIsRealtimeActive(false);
    };
  }, [queryClient]);

  // Fast Optimistic Helper
  const removeOptimistically = (item: TrashedItem) => {
    // 1. Instantly update current page items cache
    queryClient.setQueriesData({ queryKey: ["trash-items"] }, (oldData: any) => {
      if (!oldData || !Array.isArray(oldData.data)) return oldData;
      return {
        ...oldData,
        data: oldData.data.filter((i: TrashedItem) => !(i.id === item.id && i.entity_key === item.entity_key)),
        meta: {
          ...oldData.meta,
          total: Math.max(0, (oldData.meta?.total || 1) - 1),
        },
      };
    });

    // 2. Instantly decrement stats
    queryClient.setQueriesData({ queryKey: ["trash-stats"] }, (oldStats: any) => {
      if (!oldStats || !oldStats.stats) return oldStats;
      return {
        ...oldStats,
        stats: {
          ...oldStats.stats,
          total_trashed: Math.max(0, (oldStats.stats.total_trashed || 1) - 1),
          expiring_soon: item.is_expiring_soon
            ? Math.max(0, (oldStats.stats.expiring_soon || 1) - 1)
            : oldStats.stats.expiring_soon,
        },
      };
    });
  };

  // Actions
  const handleRestore = async (item: TrashedItem) => {
    setItemToRestore(null);
    removeOptimistically(item);
    try {
      await restoreTrashItem(item.entity_key, item.id);
      toast.success(t("trash.restored_success", `Successfully restored '${item.title}'.`));
      queryClient.invalidateQueries({ queryKey: ["trash-items"] });
      queryClient.invalidateQueries({ queryKey: ["trash-stats"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("trash.restore_failed", "Failed to restore item."));
      queryClient.invalidateQueries({ queryKey: ["trash-items"] });
      queryClient.invalidateQueries({ queryKey: ["trash-stats"] });
    }
  };

  const handleForceDelete = async (item: TrashedItem) => {
    setItemToPurge(null);
    removeOptimistically(item);
    try {
      await forceDeleteTrashItem(item.entity_key, item.id);
      toast.success(t("trash.purged_success", `Permanently purged '${item.title}'.`));
      queryClient.invalidateQueries({ queryKey: ["trash-items"] });
      queryClient.invalidateQueries({ queryKey: ["trash-stats"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("trash.purge_failed", "Failed to permanently delete item."));
      queryClient.invalidateQueries({ queryKey: ["trash-items"] });
      queryClient.invalidateQueries({ queryKey: ["trash-stats"] });
    }
  };

  const handleRestoreAll = async () => {
    setIsActionInProgress(true);
    try {
      const res = await restoreAllTrash(selectedType === "all" ? undefined : selectedType);
      toast.success(res?.message || t("trash.restore_all_success", "All items restored."));
      queryClient.invalidateQueries({ queryKey: ["trash-items"] });
      queryClient.invalidateQueries({ queryKey: ["trash-stats"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("trash.restore_all_failed", "Failed to restore all items."));
    } finally {
      setIsActionInProgress(false);
      setShowRestoreAllConfirm(false);
    }
  };

  const handleEmptyTrash = async () => {
    setIsActionInProgress(true);
    try {
      const res = await emptyTrash(selectedType === "all" ? undefined : selectedType);
      toast.success(res?.message || t("trash.empty_success", "Trash bin emptied successfully."));
      queryClient.invalidateQueries({ queryKey: ["trash-items"] });
      queryClient.invalidateQueries({ queryKey: ["trash-stats"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("trash.empty_failed", "Failed to empty trash bin."));
    } finally {
      setIsActionInProgress(false);
      setShowEmptyConfirm(false);
    }
  };

  const handleSaveRetention = async () => {
    if (customRetentionDays < 1) {
      toast.error(t("trash.invalid_retention", "Retention window must be at least 1 day."));
      return;
    }
    setIsActionInProgress(true);
    try {
      const res = await updateTrashSettings(customRetentionDays);
      toast.success(
        res?.message ||
          t("trash.retention_saved", `Retention window successfully updated to ${customRetentionDays} days.`)
      );
      queryClient.invalidateQueries({ queryKey: ["trash-settings"] });
      queryClient.invalidateQueries({ queryKey: ["trash-stats"] });
      queryClient.invalidateQueries({ queryKey: ["trash-items"] });
      setShowRetentionModal(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("trash.retention_save_failed", "Failed to update retention window."));
    } finally {
      setIsActionInProgress(false);
    }
  };

  // Helper icon for entity types
  const getEntityIcon = (entityKey: string, module: string) => {
    if (entityKey === "user") return <User className="h-4 w-4 text-blue-500" />;
    if (entityKey === "role") return <Shield className="h-4 w-4 text-purple-500" />;
    if (entityKey === "employee") return <User className="h-4 w-4 text-emerald-500" />;
    if (entityKey === "file_entry") return <FileText className="h-4 w-4 text-amber-500" />;
    if (entityKey === "warehouse") return <Building className="h-4 w-4 text-cyan-500" />;
    if (entityKey === "fleet_vehicle") return <Truck className="h-4 w-4 text-rose-500" />;
    return <Layers className="h-4 w-4 text-primary" />;
  };

  // Columns definition
  const columns = React.useMemo<ColumnDef<TrashedItem>[]>(
    () => [
      {
        accessorKey: "title",
        header: t("trash.col_item", "Deleted Record"),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center gap-3 py-1">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-card/60 shadow-inner">
                {getEntityIcon(item.entity_key, item.module)}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground truncate max-w-[280px]">
                    {item.title}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-md font-mono border-border/60 bg-muted/30">
                    {item.entity_type}
                  </Badge>
                </div>
                {item.subtitle && (
                  <span className="text-xs text-muted-foreground font-mono truncate max-w-[320px]">
                    {item.subtitle}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "module",
        header: t("trash.col_module", "Origin Module"),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary border-primary/20 text-xs font-medium px-2.5 py-0.5 rounded-lg"
            >
              {item.module}
            </Badge>
          );
        },
      },
      {
        accessorKey: "deleted_at",
        header: t("trash.col_deleted_at", "Deleted Timestamp"),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex flex-col text-xs">
              <span className="font-medium text-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                {item.deleted_at_human}
              </span>
              <span className="text-muted-foreground font-mono text-[11px]">
                {new Date(item.deleted_at).toLocaleString()}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "days_remaining",
        header: t("trash.col_auto_purge", "Auto-Purge Countdown"),
        cell: ({ row }) => {
          const item = row.original;
          const days = item.days_remaining;
          const isUrgent = days <= 3;
          const isWarning = days > 3 && days <= Math.max(7, Math.ceil(currentRetentionDays * 0.25));

          return (
            <div className="flex items-center gap-2">
              <Badge
                className={cn(
                  "font-mono text-xs px-2.5 py-1 rounded-lg border transition-all",
                  isUrgent && "bg-destructive/15 text-destructive border-destructive/30 animate-pulse font-bold",
                  isWarning && "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold",
                  !isUrgent && !isWarning && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                )}
              >
                <Clock className="mr-1.5 h-3.5 w-3.5 inline" />
                {days === 0
                  ? t("trash.purging_today", "Purging Today")
                  : `${days} ${days === 1 ? t("trash.day_left", "day left") : t("trash.days_left", "days left")}`}
              </Badge>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: t("trash.col_actions", "Actions"),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setItemToRestore(item)}
                className="h-8 px-2.5 rounded-lg border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50 shadow-sm transition-colors"
                title={t("trash.restore_item", "Restore Record")}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                {t("trash.restore", "Restore")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setItemToPurge(item)}
                className="h-8 px-2.5 rounded-lg border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50 shadow-sm transition-colors"
                title={t("trash.purge_permanently", "Permanently Purge")}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {t("trash.purge", "Purge")}
              </Button>
            </div>
          );
        },
      },
    ],
    [t, currentRetentionDays]
  );

  return (
    <div className="space-y-6">
      {/* 📊 SUMMARY METRICS HEADER */}
      <div id="tour-trash-metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Trashed */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-5 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                  {t("trash.total_records", "Trashed Items")}
                </p>
                {isRealtimeActive && (
                  <span className="flex h-2 w-2 relative" title="Reverb Live Sync Active">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </div>
              <h3 className="mt-1 font-space text-3xl font-black tracking-tight text-foreground">
                {stats.total_trashed}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-inner">
              <Trash2 className="h-6 w-6" />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("trash.retained_policy", `Subject to dynamic ${currentRetentionDays}-day retention policy`)}
          </p>
        </div>

        {/* Expiring Soon */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-5 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                {t("trash.expiring_soon", "Expiring Soon")}
              </p>
              <h3 className="mt-1 font-space text-3xl font-black tracking-tight text-amber-500">
                {stats.expiring_soon}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-500 shadow-inner">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("trash.expiring_desc", "Items near automatic permanent purge cutoff")}
          </p>
        </div>

        {/* Dynamic Retention Window (Clickable to configure) */}
        <div
          onClick={() => setShowRetentionModal(true)}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-5 shadow-sm backdrop-blur-md transition-all hover:border-emerald-500/50 hover:bg-card/70 hover:shadow-md"
          title={t("trash.click_to_configure", "Click to customize retention window")}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                  {t("trash.retention_period", "Retention Window")}
                </p>
                <Badge variant="outline" className="text-[10px] px-1 py-0 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                  Dynamic
                </Badge>
              </div>
              <h3 className="mt-1 font-space text-3xl font-black tracking-tight text-emerald-500 flex items-center gap-2">
                {currentRetentionDays} {t("trash.days", "Days")}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 shadow-inner group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all">
              <Sliders className="h-6 w-6" />
            </div>
          </div>
          <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
            <Settings2 className="h-3.5 w-3.5" />
            {t("trash.click_to_edit", "Click to adjust retention duration")}
          </p>
        </div>

        {/* Modules Covered */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-5 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                {t("trash.subsystems", "Active Modules")}
              </p>
              <h3 className="mt-1 font-space text-3xl font-black tracking-tight text-primary">
                {Object.keys(stats.by_module || {}).length}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-inner">
              <Layers className="h-6 w-6" />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("trash.system_wide", "Global coverage across all system entities")}
          </p>
        </div>
      </div>

      {/* 🛡️ DYNAMIC POLICY INFORMATION BANNER */}
      <div className="flex items-start gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground shadow-sm">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Info className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="font-semibold text-primary font-space">
              {t("trash.banner_title", "Centralized Global Retention & Auto-Purge Protocol")}
            </p>
            <Badge className="bg-primary/15 text-primary border-primary/30 font-mono text-xs">
              {currentRetentionDays}-Day Policy Active
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t(
              "trash.banner_desc",
              `Deleted operators, security clearance roles, and entities from any connected module are safely placed in this global repository for ${currentRetentionDays} days. You can restore them instantly to active service or permanently purge them at any time. When the ${currentRetentionDays}-day countdown reaches zero, the background daemon automatically executes a secure cryptographic erasure.`
            )}
          </p>
        </div>
      </div>

      {/* 🔍 SEARCH, FILTERS & ACTIONS TOOLBAR */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border/50 bg-card/40 p-4 shadow-sm backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("trash.search_placeholder", "Search by title, email...")}
              className="h-9 pl-9 rounded-xl border-border/50 bg-background/50 text-xs"
            />
          </div>

          {/* Module Filter */}
          <Select value={selectedModule} onValueChange={(val) => { setSelectedModule(val); setPage(1); }}>
            <SelectTrigger className="h-9 w-full sm:w-48 rounded-xl border-border/50 bg-background/50 text-xs">
              <SelectValue placeholder={t("trash.filter_module", "All Modules")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("trash.all_modules", "All Modules")}</SelectItem>
              <SelectItem value="identity">{t("trash.mod_identity", "Identity & Security")}</SelectItem>
              <SelectItem value="humanresources">{t("trash.mod_hr", "Human Resources")}</SelectItem>
              <SelectItem value="projectmanagement">{t("trash.mod_pm", "Project Management")}</SelectItem>
              <SelectItem value="core">{t("trash.mod_core", "Core Storage")}</SelectItem>
              <SelectItem value="warehouse">{t("trash.mod_warehouse", "Warehouse")}</SelectItem>
              <SelectItem value="fleet">{t("trash.mod_fleet", "Fleet Logistics")}</SelectItem>
              <SelectItem value="crm">{t("trash.mod_crm", "CRM")}</SelectItem>
            </SelectContent>
          </Select>

          {/* Retention Settings Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRetentionModal(true)}
            className="h-9 rounded-xl border-border/50 bg-background/50 px-3 text-xs shadow-sm hover:border-emerald-500/40 hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            <Settings2 className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
            {t("trash.btn_retention", "Retention Policy")}
          </Button>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 rounded-xl border-border/50 bg-background/50 px-3 text-xs shadow-sm"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isFetching && "animate-spin")} />
            {t("trash.sync", "Sync")}
          </Button>
        </div>

        {/* Bulk Actions */}
        {trashedItems.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRestoreAllConfirm(true)}
              className="h-9 rounded-xl border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs shadow-sm"
            >
              <ArchiveRestore className="mr-1.5 h-4 w-4" />
              {t("trash.restore_all", "Restore All")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowEmptyConfirm(true)}
              className="h-9 rounded-xl text-xs shadow-sm font-semibold"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              {t("trash.empty_trash", "Empty Trash Bin")}
            </Button>
          </div>
        )}
      </div>

      {/* 📋 DATATABLE */}
      <div className="rounded-2xl border border-border/50 bg-card/40 p-1 shadow-sm backdrop-blur-md overflow-hidden">
        <DataTable
          columns={columns}
          data={trashedItems}
          loading={isLoading}
          totalEntries={meta.total}
          pageIndex={page}
          pageSize={pageSize}
          onQueryChange={handleQueryChange}
          syncWithUrl={false}
          emptyMessage={
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/50 bg-muted/20 text-muted-foreground shadow-inner">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <h4 className="font-space text-lg font-bold text-foreground">
                {t("trash.empty_title", "Global Trash Bin is Empty")}
              </h4>
              <p className="max-w-md text-xs text-muted-foreground font-mono leading-relaxed">
                {t(
                  "trash.empty_desc",
                  `No deleted records or soft-deleted entities are currently awaiting purge. Any deleted operators or records will appear here for ${currentRetentionDays} days before permanent deletion.`
                )}
              </p>
            </div>
          }
        />
      </div>

      {/* ⚙️ DYNAMIC RETENTION WINDOW CONFIGURATION DIALOG */}
      <Dialog open={showRetentionModal} onOpenChange={setShowRetentionModal}>
        <DialogContent className="rounded-2xl border-border/50 bg-card/95 backdrop-blur-xl sm:max-w-md">
          <DialogHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 mb-2">
              <Sliders className="h-6 w-6" />
            </div>
            <DialogTitle className="font-space text-xl font-bold">
              {t("trash.retention_modal_title", "Configure Dynamic Retention Window")}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
              {t(
                "trash.retention_modal_desc",
                "Choose how many days soft-deleted records remain in the Global Trash Bin before automated permanent cryptographic erasure. Changing this setting immediately recalculates all active countdown timers."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Quick Presets */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                {t("trash.quick_presets", "Standard Retention Presets")}
              </Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {RETENTION_PRESETS.map((preset) => {
                  const isSelected = customRetentionDays === preset.days;
                  return (
                    <Button
                      key={preset.days}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCustomRetentionDays(preset.days)}
                      className={cn(
                        "h-9 justify-start text-xs rounded-xl transition-all",
                        isSelected
                          ? "bg-emerald-600 text-white hover:bg-emerald-700 font-bold border-emerald-600"
                          : "border-border/50 bg-background/50 hover:border-emerald-500/40"
                      )}
                    >
                      {isSelected && <Check className="mr-1.5 h-3.5 w-3.5" />}
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Custom Input */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              <Label htmlFor="custom-days" className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>{t("trash.custom_duration", "Custom Duration (Days)")}</span>
                <span className="text-[11px] font-mono text-muted-foreground">1 to 3,650 Days</span>
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="custom-days"
                  type="number"
                  min={1}
                  max={3650}
                  value={customRetentionDays}
                  onChange={(e) => setCustomRetentionDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="h-10 rounded-xl border-border/50 bg-background/50 text-sm font-mono font-bold"
                />
                <span className="text-sm font-semibold text-muted-foreground whitespace-nowrap">
                  {customRetentionDays === 1 ? "Day" : "Days"}
                </span>
              </div>
            </div>

            {/* Protocol Notice */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {t("trash.live_sync_notice", "Active Policy Preview: ")}
              </span>
              Records deleted more than <strong className="text-foreground">{customRetentionDays} days ago</strong> will be purged during the next daily background maintenance sweep.
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRetentionModal(false)}
              disabled={isActionInProgress}
              className="rounded-xl text-xs"
            >
              {t("global.cancel", "Cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleSaveRetention}
              disabled={isActionInProgress}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
            >
              {isActionInProgress ? t("global.saving", "Saving...") : t("trash.save_retention_btn", "Apply Retention Policy")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🔄 RESTORE SINGLE ITEM DIALOG */}
      <AlertDialog open={!!itemToRestore} onOpenChange={(open) => !open && setItemToRestore(null)}>
        <AlertDialogContent className="rounded-2xl border-border/50 bg-card/90 backdrop-blur-xl">
          <AlertDialogHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 mb-2">
              <RotateCcw className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="font-space text-xl font-bold">
              {t("trash.confirm_restore_title", "Restore Record to Active Service?")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
              {t(
                "trash.confirm_restore_desc",
                "This action will restore '{name}' back to its original module ({module}) with all existing relationships, roles, and privileges intact."
              )
                .replace("{name}", itemToRestore?.title || "")
                .replace("{module}", itemToRestore?.module || "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-xs">
              {t("global.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => itemToRestore && handleRestore(itemToRestore)}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              {t("trash.restore_confirm_btn", "Confirm Restore")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ⚠️ PERMANENT PURGE SINGLE ITEM DIALOG */}
      <AlertDialog open={!!itemToPurge} onOpenChange={(open) => !open && setItemToPurge(null)}>
        <AlertDialogContent className="rounded-2xl border-destructive/30 bg-card/95 backdrop-blur-xl">
          <AlertDialogHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive mb-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="font-space text-xl font-bold text-destructive">
              {t("trash.confirm_purge_title", "Permanently Purge Record?")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
              {t(
                "trash.confirm_purge_desc",
                "CRITICAL WARNING: This action cannot be undone. '{name}' will be permanently wiped from the database and storage immediately without waiting for the retention period."
              ).replace("{name}", itemToPurge?.title || "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-xs">
              {t("global.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => itemToPurge && handleForceDelete(itemToPurge)}
              className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-bold"
            >
              {t("trash.purge_confirm_btn", "Permanently Purge Now")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ⚠️ EMPTY TRASH DIALOG */}
      <AlertDialog open={showEmptyConfirm} onOpenChange={setShowEmptyConfirm}>
        <AlertDialogContent className="rounded-2xl border-destructive/30 bg-card/95 backdrop-blur-xl">
          <AlertDialogHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive mb-2">
              <Trash2 className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="font-space text-xl font-bold text-destructive">
              {t("trash.empty_confirm_title", "Empty Global Trash Bin?")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
              {t(
                "trash.empty_confirm_desc",
                "You are about to permanently purge ALL records currently in the trash bin across all modules. This action is irreversible."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionInProgress} className="rounded-xl text-xs">
              {t("global.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEmptyTrash}
              disabled={isActionInProgress}
              className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-bold"
            >
              {isActionInProgress ? t("global.emptying", "Emptying...") : t("trash.empty_confirm_btn", "Purge All Records")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 🔄 RESTORE ALL DIALOG */}
      <AlertDialog open={showRestoreAllConfirm} onOpenChange={setShowRestoreAllConfirm}>
        <AlertDialogContent className="rounded-2xl border-border/50 bg-card/90 backdrop-blur-xl">
          <AlertDialogHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 mb-2">
              <ArchiveRestore className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="font-space text-xl font-bold">
              {t("trash.restore_all_title", "Restore All Trashed Records?")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
              {t(
                "trash.restore_all_desc",
                "This will restore all currently trashed items back to active status in their respective modules."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionInProgress} className="rounded-xl text-xs">
              {t("global.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestoreAll}
              disabled={isActionInProgress}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              {isActionInProgress ? t("global.restoring", "Restoring...") : t("trash.restore_all_confirm_btn", "Restore Everything")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
