"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FileArchive,
  HardDrive,
  Layers,
  Loader2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsPanelSkeleton } from "@/components/ui/loading-states";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import { getAuthHeaders, getBackendApiRoot } from "@/lib/runtime-context";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/store/use-translation";

interface BackupFile {
  id: string;
  name: string;
  type: "db" | "files" | "all";
  trigger: "auto" | "manual";
  size: string;
  created_at: string;
}

interface BackupSchedule {
  backup_frequency: "daily" | "weekly" | "monthly";
  backup_time: string;
  backup_day: number;
}

interface BackupSettingsProps {
  isCentralNode: boolean;
}

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${getBackendApiRoot()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const headers: HeadersInit = getAuthHeaders(
    options.body && typeof options.body === "string" ? { "Content-Type": "application/json" } : {}
  );
  const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || "API Request Failed");
  }

  return res.json();
};

export function BackupSettings({ isCentralNode }: BackupSettingsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { hasAnyPermission, hasPermission } = usePermissions();

  const canViewBackups = isCentralNode && hasAnyPermission(["view_backups", "manage_backups"]);
  const canManageBackups = isCentralNode && hasPermission("manage_backups");

  const [formData, setFormData] = useState<BackupSchedule>({
    backup_frequency: "daily",
    backup_time: "02:00",
    backup_day: 1,
  });
  const [triggeringType, setTriggeringType] = useState<"db" | "files" | "all" | null>(null);

  const { data: scheduleData, isLoading: isScheduleLoading } = useQuery({
    queryKey: ["systemBackupSchedule"],
    queryFn: () => apiFetch("/system/backup/settings"),
    enabled: canViewBackups,
  });

  const { data: backupsData, isLoading: isBackupsLoading } = useQuery({
    queryKey: ["systemBackupsList"],
    queryFn: () => apiFetch("/system/backups"),
    enabled: canViewBackups,
    refetchInterval: canViewBackups ? 15000 : false,
  });

  useEffect(() => {
    if (!scheduleData?.data) {
      return;
    }

    setFormData({
      backup_frequency: scheduleData.data.backup_frequency || "daily",
      backup_time: scheduleData.data.backup_time || "02:00",
      backup_day: Number.parseInt(String(scheduleData.data.backup_day), 10) || 1,
    });
  }, [scheduleData]);

  const saveMut = useMutation({
    mutationFn: () =>
      apiFetch("/system/backup/schedule", {
        method: "POST",
        body: JSON.stringify({
          frequency: formData.backup_frequency,
          time: formData.backup_time,
          day: formData.backup_day,
        }),
      }),
    onSuccess: () => {
      toast.success(t("settings.backup_updated", "Backup automation updated successfully."));
      queryClient.invalidateQueries({ queryKey: ["systemBackupSchedule"] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const triggerMut = useMutation({
    mutationFn: (type: "db" | "files" | "all") =>
      apiFetch("/system/trigger-backup", {
        method: "POST",
        body: JSON.stringify({ type }),
      }),
    onMutate: (type) => setTriggeringType(type),
    onSuccess: () => {
      toast.success("Backup queued successfully. Watch System Alerts for completion.");
      queryClient.invalidateQueries({ queryKey: ["systemBackupsList"] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
    onSettled: () => window.setTimeout(() => setTriggeringType(null), 800),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/system/backups/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Backup archive deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["systemBackupsList"] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const backups: BackupFile[] = backupsData?.data || [];

  const scheduleSummary = useMemo(() => {
    if (formData.backup_frequency === "weekly") {
      const weekday = WEEKDAY_OPTIONS.find((option) => option.value === formData.backup_day)?.label || `Day ${formData.backup_day}`;
      return `Every ${weekday} at ${formData.backup_time}`;
    }

    if (formData.backup_frequency === "monthly") {
      return `Day ${formData.backup_day} of each month at ${formData.backup_time}`;
    }

    return `Every day at ${formData.backup_time}`;
  }, [formData.backup_day, formData.backup_frequency, formData.backup_time]);

  const handleDownload = (id: string) => {
    apiFetch(`/system/backups/${id}/signed-download-url`, { method: "POST" })
      .then((payload) => {
        const url = payload?.url;
        if (!url) {
          throw new Error("Failed to generate secure download link.");
        }
        window.open(url, "_blank", "noopener,noreferrer");
      })
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error, "Unable to start download."));
      });
  };

  if (!canViewBackups) {
    return (
      <div className="rounded-[2rem] border border-amber-500/20 bg-amber-500/5 p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-xl font-space font-black tracking-tight text-foreground">Central Admin Only</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          {isCentralNode
            ? t("settings.backup_locked", "Your role does not have access to the backup workspace.")
            : "System backups can only be accessed and managed from the central admin workspace."}
        </p>
      </div>
    );
  }

  if (isScheduleLoading) {
    return <SettingsPanelSkeleton />;
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex h-full flex-col rounded-[2rem] border border-border/50 bg-card/40 p-8 shadow-sm backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-space font-black tracking-tight text-foreground">Automation Policy</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Define when the central platform captures automated system backups.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-500/10 bg-indigo-500/5 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-indigo-500">Current Schedule</p>
            <p className="mt-2 text-lg font-bold text-foreground">{scheduleSummary}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Automatic runs always execute a full system snapshot with the database and file archive together.
            </p>
          </div>

          <div className="mt-6 space-y-5 border-t border-border/50 pt-6">
            <div className="space-y-2">
              <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Frequency</Label>
              <Select
                value={formData.backup_frequency}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, backup_frequency: value as BackupSchedule["backup_frequency"] }))
                }
              >
                <SelectTrigger className="h-12 rounded-xl bg-muted/30 font-bold focus:ring-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50">
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div
                className={cn(
                  "space-y-2 transition-all duration-300",
                  formData.backup_frequency === "daily" ? "opacity-40" : "opacity-100"
                )}
              >
                <Label className="flex items-center gap-1.5 pl-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formData.backup_frequency === "weekly" ? "Day Of Week" : "Day Of Month"}
                </Label>

                {formData.backup_frequency === "weekly" ? (
                  <Select
                    value={String(formData.backup_day)}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, backup_day: Number.parseInt(value, 10) || 1 }))}
                  >
                    <SelectTrigger className="h-12 rounded-xl bg-muted/30 font-bold focus:ring-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/50">
                      {WEEKDAY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.backup_day}
                    disabled={formData.backup_frequency === "daily"}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        backup_day: Number.parseInt(e.target.value, 10) || 1,
                      }))
                    }
                    className="h-12 rounded-xl bg-muted/30 font-mono text-lg"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 pl-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Time (24h)
                </Label>
                <Input
                  type="time"
                  value={formData.backup_time}
                  onChange={(e) => setFormData((prev) => ({ ...prev, backup_time: e.target.value }))}
                  className="h-12 rounded-xl bg-muted/30 font-mono text-lg"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex h-full flex-col rounded-[2rem] border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent p-8 shadow-sm backdrop-blur-md animate-in fade-in slide-in-from-bottom-4">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
              <HardDrive className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-space font-black tracking-tight text-foreground">Manual Backup</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Run an on-demand snapshot for the database, file archive, or the full system.
              </p>
            </div>
          </div>

          <div className="mt-auto space-y-3 border-t border-amber-500/10 pt-6">
            <Button
              onClick={() => triggerMut.mutate("db")}
              disabled={triggerMut.isPending || !canManageBackups}
              variant="outline"
              className="h-12 w-full justify-start rounded-xl bg-background/50 px-6 font-bold transition-all hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-500"
            >
              {triggeringType === "db" ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Database className="mr-3 h-5 w-5" />}
              Backup Database Only
            </Button>

            <Button
              onClick={() => triggerMut.mutate("files")}
              disabled={triggerMut.isPending || !canManageBackups}
              variant="outline"
              className="h-12 w-full justify-start rounded-xl bg-background/50 px-6 font-bold transition-all hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-500"
            >
              {triggeringType === "files" ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <FileArchive className="mr-3 h-5 w-5" />}
              Backup Files Only
            </Button>

            <Button
              onClick={() => triggerMut.mutate("all")}
              disabled={triggerMut.isPending || !canManageBackups}
              className="h-12 w-full justify-start rounded-xl bg-amber-500 px-6 font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-600"
            >
              {triggeringType === "all" ? <Loader2 className="mr-3 h-5 w-5 animate-spin text-white" /> : <Layers className="mr-3 h-5 w-5 text-white" />}
              Run Full System Backup
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-border/50 bg-card/40 p-8 shadow-sm backdrop-blur-md animate-in fade-in slide-in-from-bottom-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-space font-black tracking-tight text-foreground">Backup Ledger</h2>
              <p className="mt-1 text-xs text-muted-foreground">Central archive of recent automated and manual snapshots.</p>
            </div>
          </div>
          {isBackupsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="overflow-hidden rounded-xl border border-border/50 bg-background/50">
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="bg-muted/30 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Snapshot</th>
                  <th className="px-6 py-4">Payload</th>
                  <th className="px-6 py-4">Trigger</th>
                  <th className="px-6 py-4">Size</th>
                  <th className="px-6 py-4">Created</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {backups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      <HardDrive className="mx-auto mb-3 h-8 w-8 opacity-20" />
                      <p className="text-sm font-bold">No backup archives are currently available.</p>
                    </td>
                  </tr>
                ) : (
                  backups.map((file) => (
                    <tr key={file.id} className="transition-colors hover:bg-muted/20">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-foreground">{file.name}</td>
                      <td className="px-6 py-4">
                        {file.type === "db" && (
                          <Badge variant="outline" className="border-blue-500/20 bg-blue-500/10 text-blue-500">
                            <Database className="mr-1 h-3 w-3" /> Database
                          </Badge>
                        )}
                        {file.type === "files" && (
                          <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                            <FileArchive className="mr-1 h-3 w-3" /> Files
                          </Badge>
                        )}
                        {file.type === "all" && (
                          <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-500">
                            <Layers className="mr-1 h-3 w-3" /> Full System
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "rounded-md px-2 py-1 text-[11px] font-black uppercase tracking-widest",
                            file.trigger === "auto" ? "bg-indigo-500/10 text-indigo-500" : "bg-muted text-muted-foreground"
                          )}
                        >
                          {file.trigger === "auto" ? "Automated" : "Manual"}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{file.size}</td>
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                        {new Date(file.created_at).toLocaleString()}
                      </td>
                      <td className="flex items-center justify-end gap-2 px-6 py-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary"
                          title="Download Backup"
                          onClick={() => handleDownload(file.id)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Delete Backup"
                          disabled={!canManageBackups || deleteMut.isPending}
                          onClick={() => {
                            if (window.confirm("Delete this backup archive permanently?")) {
                              deleteMut.mutate(file.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 left-6 right-6 z-50 flex justify-end rounded-[2rem] border border-border/50 bg-card/80 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl md:left-[320px]">
        <Button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || !canManageBackups}
          className="h-12 rounded-xl bg-primary px-12 font-bold text-primary-foreground shadow-xl"
        >
          {saveMut.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
          Save Backup Policy
        </Button>
      </div>
    </div>
  );
}
