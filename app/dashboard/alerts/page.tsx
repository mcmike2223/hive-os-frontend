"use client";

import React, { useState } from 'react';
import {
    BellRing, Home, CheckCircle2,
    AlertTriangle, AlertCircle, Clock, Info, Filter, Trash2, Loader2, RefreshCcw, X
} from 'lucide-react';
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
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
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/store/use-translation";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertsFeedSkeleton } from "@/components/ui/loading-states";
import { usePermissions } from "@/hooks/use-permissions";
import { getErrorMessage } from "@/lib/errors";
import { getWorkspaceScopeKey } from "@/lib/runtime-context";
import api from "@/modules/shared/api/http";

// --- Types ---
interface SystemAlert {
    id: number | string;
    title: string;
    description: string;
    level: 'critical' | 'warning' | 'info';
    time_ago: string;
}

export default function SystemAlertsPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { hasPermission, isLoaded } = usePermissions();
    const canViewAlerts = hasPermission("view_alerts");
    const canManageAlerts = hasPermission("manage_alerts");
    const workspaceScope = getWorkspaceScopeKey();
    
    // State for filtering
    const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

    // FETCH REAL ALERTS FROM LARAVEL
    const alertsQuery = useQuery({
        queryKey: ['systemAlertsList', workspaceScope],
        queryFn: async () => (await api.get('/system/alerts')).data,
        enabled: isLoaded && canViewAlerts,
    });

    // MUTATION: Dismiss a single alert
    const dismissMut = useMutation({
        mutationFn: async (id: string | number) => (await api.delete(`/system/alerts/${id}`)).data,
        onSuccess: () => {
            toast.success(t('alerts.toast_dismissed', 'Alert dismissed.'));
            queryClient.invalidateQueries({ queryKey: ['systemAlertsList'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] }); // Update dashboard counters too!
        },
        onError: (err: unknown) => {
            toast.error(getErrorMessage(err, t('alerts.dismiss_failed', 'Failed to dismiss alert.')));
        },
    });

    // MUTATION: Dismiss ALL alerts
    const dismissAllMut = useMutation({
        mutationFn: async () => (await api.post('/system/alerts/clear-all')).data,
        onSuccess: () => {
            toast.success(t('alerts.toast_cleared', 'All alerts have been cleared.'));
            queryClient.invalidateQueries({ queryKey: ['systemAlertsList'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
        },
        onError: (err: unknown) => {
            toast.error(getErrorMessage(err, t('alerts.clear_failed', 'Failed to clear alerts.')));
        },
    });

    const alerts: SystemAlert[] = alertsQuery.data?.data || [];

    // Derived counts
    const criticalCount = alerts.filter(a => a.level === 'critical').length;
    const warningCount = alerts.filter(a => a.level === 'warning').length;
    const infoCount = alerts.filter(a => a.level === 'info').length;

    // Filtered list
    const filteredAlerts = alerts.filter(a => filter === 'all' || a.level === filter);

    if (!isLoaded) {
        return <AlertsFeedSkeleton />;
    }

    if (!canViewAlerts) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-[2rem] border border-border/50 bg-card/40 p-8 text-center">
                <BellRing className="h-10 w-10 text-destructive mb-4" />
                <h2 className="text-2xl font-black tracking-tight">{t('global.access_denied', 'Access Denied')}</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    {t('alerts.denied', 'Your current role does not have permission to view system alerts.')}
                </p>
            </div>
        );
    }

    const getAlertIcon = (level: string) => {
        switch (level) {
            case 'critical': return <AlertCircle className="h-5 w-5 text-red-500" />;
            case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-500" />;
            case 'info': return <Info className="h-5 w-5 text-blue-500" />;
            default: return <BellRing className="h-5 w-5 text-muted-foreground" />;
        }
    };

    const getAlertStyle = (level: string) => {
        switch (level) {
            case 'critical': return 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10';
            case 'warning': return 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10';
            case 'info': return 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10';
            default: return 'border-border/50 bg-card/40 hover:bg-card/60';
        }
    };

    return (
        <div className="space-y-6 pb-12 max-w-6xl mx-auto">
            
            {/* Top Navigation & Breadcrumbs */}
            <div className="flex w-full justify-end items-center gap-3 mb-4">
                <Breadcrumbs 
                    items={[
                        { label: "Hive.OS", href: "/", icon: <Home className="h-4 w-4" /> }, 
                        { label: t('nav.dashboard', 'Dashboard'), href: "/dashboard" },
                        { label: t('alerts.system_alerts', 'System Alerts') }
                    ]} 
                />
            </div>

            {/* Hero Header Section */}
            <div className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 shrink-0">
                            <BellRing className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-space font-black tracking-tight text-foreground">{t('alerts.page_title', 'System Alerts Log')}</h1>
                            <p className="text-sm text-muted-foreground mt-1">{t('alerts.page_desc', 'Review active warnings, critical anomalies, and system notifications.')}</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="rounded-full bg-background/50 backdrop-blur-md text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors ml-auto md:ml-0"
                                    disabled={alerts.length === 0 || dismissAllMut.isPending || !canManageAlerts}
                                >
                                    {dismissAllMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />} 
                                    {t('alerts.dismiss_all', 'Dismiss All')}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-[2rem] bg-background/95 backdrop-blur-xl border-border/50">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="text-destructive flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5" /> {t('alerts.clear_all_title', 'Clear All Alerts?')}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {t('alerts.clear_all_desc', 'Are you sure you want to permanently dismiss all active alerts? This action cannot be undone and will clear the system log for all operators.')}
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-xl">{t('global.cancel', 'Cancel')}</AlertDialogCancel>
                                    <AlertDialogAction 
                                        className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" 
                                        onClick={() => dismissAllMut.mutate()}
                                    >
                                        {t('alerts.confirm_purge', 'Confirm Purge')}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap items-center gap-2 mt-8 pt-6 border-t border-border/50">
                    <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-widest mr-2">
                        <Filter className="w-4 h-4" /> {t('alerts.filter', 'Filter:')}
                    </div>
                    
                    <Button 
                        variant={filter === 'all' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => setFilter('all')}
                        className="rounded-full font-bold tracking-wide"
                    >
                        {t('alerts.all_events', 'All Events')}
                        <Badge variant="secondary" className="ml-2 bg-background/20 text-current">{alerts.length}</Badge>
                    </Button>
                    
                    <Button 
                        variant={filter === 'critical' ? 'destructive' : 'outline'} 
                        size="sm" 
                        onClick={() => setFilter('critical')}
                        className={cn("rounded-full font-bold tracking-wide", filter !== 'critical' && "hover:text-red-500 hover:border-red-500/50")}
                    >
                        {t('alerts.critical', 'Critical')}
                        <Badge variant="secondary" className={cn("ml-2", filter === 'critical' ? "bg-white/20 text-white" : "bg-red-500/10 text-red-500")}>{criticalCount}</Badge>
                    </Button>
                    
                    <Button 
                        variant={filter === 'warning' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => setFilter('warning')}
                        className={cn("rounded-full font-bold tracking-wide", filter === 'warning' ? "bg-amber-500 hover:bg-amber-600 text-white" : "hover:text-amber-500 hover:border-amber-500/50")}
                    >
                        {t('alerts.warnings', 'Warnings')}
                        <Badge variant="secondary" className={cn("ml-2", filter === 'warning' ? "bg-white/20 text-white" : "bg-amber-500/10 text-amber-500")}>{warningCount}</Badge>
                    </Button>
                    
                    <Button 
                        variant={filter === 'info' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => setFilter('info')}
                        className={cn("rounded-full font-bold tracking-wide", filter === 'info' ? "bg-blue-500 hover:bg-blue-600 text-white" : "hover:text-blue-500 hover:border-blue-500/50")}
                    >
                        {t('alerts.info', 'Info')}
                        <Badge variant="secondary" className={cn("ml-2", filter === 'info' ? "bg-white/20 text-white" : "bg-blue-500/10 text-blue-500")}>{infoCount}</Badge>
                    </Button>
                </div>
            </div>

            {/* Alert Feed */}
            {alertsQuery.isLoading ? (
                <AlertsFeedSkeleton />
            ) : alertsQuery.isError ? (
                <div role="alert" className="flex flex-col gap-4 rounded-[2rem] border border-red-400 bg-red-950 p-6 text-red-50 sm:flex-row sm:items-center">
                    <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-900 text-red-100">
                        <AlertCircle className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-bold">{t('alerts.load_failed_title', 'Could not load system alerts')}</h2>
                        <p className="mt-1 text-sm leading-6 text-red-100">
                            {getErrorMessage(alertsQuery.error, t('alerts.load_failed', 'Check your connection and try loading the alerts again.'))}
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => alertsQuery.refetch()}
                        disabled={alertsQuery.isFetching}
                        className="min-h-11 shrink-0 border-red-200 bg-white text-red-950 hover:bg-red-50 hover:text-red-950 focus-visible:ring-red-200"
                    >
                        {alertsQuery.isFetching ? (
                            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCcw aria-hidden="true" className="h-4 w-4" />
                        )}
                        {alertsQuery.isFetching
                            ? t('alerts.retrying', 'Retrying...')
                            : t('alerts.try_again', 'Try Again')}
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredAlerts.map((alert) => (
                        <div 
                            key={alert.id} 
                            className={cn(
                                "p-5 sm:p-6 rounded-[1.5rem] border backdrop-blur-md flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between transition-all duration-200 animate-in fade-in slide-in-from-bottom-2",
                                getAlertStyle(alert.level)
                            )}
                        >
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                                <div className={cn(
                                    "mt-1 shrink-0 p-2 rounded-full",
                                    alert.level === 'critical' ? 'bg-red-500/10' : 
                                    alert.level === 'warning' ? 'bg-amber-500/10' : 'bg-blue-500/10'
                                )}>
                                    {getAlertIcon(alert.level)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                        {alert.title}
                                        {alert.level === 'critical' && <span className="flex h-2 w-2 relative"><span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative rounded-full h-2 w-2 bg-red-500"></span></span>}
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-3xl break-words">{alert.description}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3 shrink-0 sm:ml-auto w-full sm:w-auto justify-between sm:justify-end mt-4 sm:mt-0 border-t sm:border-0 border-border/50 pt-4 sm:pt-0">
                                <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground bg-background/50 px-3 py-1.5 rounded-lg border border-border/50">
                                    <Clock className="h-3 w-3" />
                                    {alert.time_ago}
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => dismissMut.mutate(alert.id)}
                                    disabled={dismissMut.isPending || !canManageAlerts}
                                    className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                                    title="Dismiss Alert"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}

                    {/* Empty State */}
                    {filteredAlerts.length === 0 && (
                        <div className="py-20 text-center flex flex-col items-center justify-center border border-dashed border-border/60 rounded-[2rem] bg-card/20 backdrop-blur-md animate-in fade-in zoom-in-95">
                            <div className="h-20 w-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
                                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground">{t('alerts.operational', 'All Systems Operational')}</h3>
                            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                                {filter === 'all' 
                                    ? t('alerts.no_active', 'There are currently no active alerts or anomalies detected across the infrastructure.') 
                                    : t('alerts.no_active_filter', 'There are no active {level} alerts at this time.').replace('{level}', filter)}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
