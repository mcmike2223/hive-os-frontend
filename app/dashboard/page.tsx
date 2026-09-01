"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Activity, Users, Server, Home, HelpCircle, ShieldCheck,
    Key, User as UserIcon, Plus, UserPlus, ShieldAlert,
    ActivitySquare, Layers, Clock,
    CreditCard, HardDrive, Globe, Zap, BellRing, Database, RefreshCw, VenetianMask, ChevronRight,
    LineChart as LineChartIcon, Settings, FileText, CheckCircle2
} from "lucide-react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, LineChart, Line
} from 'recharts';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import RetryButton from '@/components/RetryButton';
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { useTour } from "@/components/providers/tour-provider";
import { useTranslation } from "@/store/use-translation";
import { cn } from '@/lib/utils';
import { initEcho } from '@/lib/echo';
import { getAccessToken, getBackendApiRoot, getTenantHeaders, getTenantId, isTenantSession } from '@/lib/runtime-context';
import { DashboardOverviewPlaceholder } from "@/components/ui/loading-states";
import { usePermissions } from "@/hooks/use-permissions";
import { handleAuthFailureResponse, isImpersonatingSession, stopImpersonation } from "@/lib/auth-sync";
import {
    ALERTS_ROUTE_PERMISSIONS,
    AUDIT_LOG_ROUTE_PERMISSIONS,
    SECURITY_ROUTE_PERMISSIONS,
    TENANTS_ROUTE_PERMISSIONS,
} from "@/lib/route-permissions";

interface DashboardActivity {
    id?: number | string;
    event?: string;
    description?: string;
    causer?: string | { name?: string };
    subject_type?: string;
    properties?: { causer_name?: string };
    node?: string;
    tenant_id?: string;
    time?: string;
    time_ago?: string;
}

interface DashboardData {
    success?: boolean;
    generated_at?: string;
    refresh_interval_seconds?: number;
    dashboard_scope?: 'platform' | 'tenant' | 'personal';
    is_super_admin?: boolean;
    role_title?: string;
    user?: {
        id: number | null;
        name: string;
        email: string;
        role: string;
    };
    company: string;
    plan: string;
    stats: {
        total_users: number;
        active_users: number;
        total_roles: number;
        total_permissions: number;
        total_tenants?: number;
        active_tenants?: number;
        assigned_tasks?: number;
        my_actions_today?: number;
        role_capabilities?: number;
        operational_score?: number;
    };
    recent_activity: DashboardActivity[];
    business?: {
        currency: string;
        monthly_recurring_revenue: number;
        collected_this_month: number;
        lifetime_collected: number;
        outstanding: number;
        active_subscriptions: number;
        paying_subscriptions: number;
        plan_mix: { plan: string; name: string; count: number; percent: number }[];
    };
    cluster?: {
        db_size: string;
        redis_hits: number;
        ws_connections: number;
        cpu_load?: number;
        memory_usage?: number;
    };
    alerts?: { id?: number; title: string; description: string; level: string; time_ago: string }[];
    traffic_origins?: { city: string; code?: string; flag?: string; percent: number }[];
    hourly_activity?: { hour: string; actions: number; logins: number }[];
    resource_allocation?: { name: string; value: number; unit: string; fill: string }[];
    task_distribution?: { status: string; count: number; fill: string }[];
    module_traffic?: {
        slug: string;
        name: string;
        category: string;
        actions: number;
        subscribed_tenants: number | null;
        monthly_price_etb: number;
        registry_enabled: boolean;
        is_subscription_catalog: boolean;
        fill: string;
    }[];
}

export default function DashboardHome() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const { startTour } = useTour();
    const { hasPermission, hasAnyPermission, isLoaded } = usePermissions();

    const [tenantName, setTenantName] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const [isImpersonating, setIsImpersonating] = useState(false);
    const canViewDashboard = hasPermission("view_system_dashboard");
    const canProvisionTenants = hasAnyPermission(["manage_tenants", "provision_tenants"]);
    const canViewUsers = hasAnyPermission(["manage_users", "view_users"]);
    const canInviteUsers = hasPermission("manage_users") || (hasPermission("create_users") && canViewUsers);
    const canManageSystemSettings = hasPermission("manage_system_settings");
    const canManageBackups = hasPermission("manage_backups");
    const canAccessSecurity = hasAnyPermission([...SECURITY_ROUTE_PERMISSIONS]);
    const canViewRoles = hasAnyPermission(["manage_roles", "view_roles"]);
    const canViewPermissions = hasPermission("view_permissions");
    const canViewAlerts = hasAnyPermission([...ALERTS_ROUTE_PERMISSIONS]);
    const canViewLogs = hasAnyPermission([...AUDIT_LOG_ROUTE_PERMISSIONS]);
    const canViewTenants = hasAnyPermission([...TENANTS_ROUTE_PERMISSIONS]);

    useEffect(() => {
        const tenantId = getTenantId();

        if (tenantId) {
            setTenantName(tenantId.toUpperCase());
        } else {
            setTenantName('CENTRAL');
        }

        if (isImpersonatingSession()) {
            setIsImpersonating(true);
        }

        setIsMounted(true);
    }, []);

    const handleLeaveImpersonation = () => {
        stopImpersonation('/dashboard');
    };

    const { data: dashboardPayload, error, isLoading, isFetching } = useQuery({
        queryKey: ['dashboardMetrics', tenantName],
        queryFn: async () => {
            const token = getAccessToken();
            const endpoint = `${getBackendApiRoot()}${isTenantSession() ? '/tenant/dashboard' : '/dashboard'}`;

            const res = await fetch(endpoint, {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    ...getTenantHeaders(),
                }
            });
            if (await handleAuthFailureResponse(res)) {
                throw new Error('Session invalidated');
            }
            if (!res.ok) throw new Error(`Node Connection Failed: ${res.status}`);
            return res.json();
        },
        enabled: isMounted && tenantName !== null && isLoaded && canViewDashboard,
        staleTime: 10_000,
        refetchInterval: 15_000,
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: true,
    });

    const data: DashboardData = dashboardPayload;

    // WebSocket Real-time Echo Listener
    useEffect(() => {
        if (!isMounted) return;
        const token = getAccessToken(); if (!token) return; const echo = initEcho(token);
        if (!echo) return;

        const channel = echo.channel('admin-metrics');
        channel.listen('.metric.updated', (event: any) => {
            queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
        });

        return () => {
            echo.leaveChannel('admin-metrics');
        };
    }, [isMounted, queryClient]);

    if (!isMounted || !isLoaded || isLoading) return <DashboardLoader />;
    if (error || !data) return <DashboardError message={(error as Error)?.message} />;

    const isCentral = tenantName === 'CENTRAL';
    const isSuperAdmin = isCentral && (data.is_super_admin !== false);

    const tooltipStyle = {
        backgroundColor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: '1rem',
        fontSize: '12px',
        color: 'hsl(var(--foreground))',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(12px)',
    };

    const hourlyActivityData = data.hourly_activity ?? [];
    const telemetry = hourlyActivityData.map((point) => ({
        time: point.hour,
        requests: point.actions + point.logins,
    }));
    const tenantActivity = hourlyActivityData;
    const moduleTraffic = data.module_traffic ?? [];
    const resourceData = data.resource_allocation ?? [];
    const taskDistributionData = data.task_distribution ?? [];
    const taskDistributionMax = Math.max(1, ...taskDistributionData.map((item) => item.count));

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Impersonation Banner */}
            {isImpersonating && (
                <div className="bg-amber-500/10 border-2 border-amber-500/30 text-amber-600 dark:text-amber-400 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-md shadow-lg animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="h-10 w-10 bg-amber-500/20 rounded-full flex items-center justify-center shrink-0">
                            <VenetianMask className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm uppercase tracking-widest">{t('users.impersonation_active', 'Impersonation Active')}</h3>
                            <p className="text-xs font-medium opacity-80">{t('users.impersonation_warning', 'You are currently viewing the system through another operator\'s clearance level.')}</p>
                        </div>
                    </div>
                    <Button onClick={handleLeaveImpersonation} variant="destructive" className="w-full sm:w-auto shadow-md hover:bg-red-600 transition-all font-bold tracking-wide rounded-xl">
                        <ShieldAlert className="w-4 h-4 mr-2" /> {t('users.return_to_admin', 'Return to Admin')}
                    </Button>
                </div>
            )}

            {/* Breadcrumbs Row */}
            <div className="flex w-full justify-end items-center gap-3 mb-4">
                <Button variant="outline" size="sm" onClick={() => startTour([])} className="h-8 rounded-lg border-border/50 bg-background/50 backdrop-blur-md">
                    <HelpCircle className="w-4 h-4 mr-2" /> {t('topbar.system_tour', 'System Tour')}
                </Button>
                <Breadcrumbs items={[{ label: "Hive.OS", href: "/", icon: <Home className="h-4 w-4" /> }, { label: t('nav.dashboard', 'Dashboard') }]} />
            </div>

            {/* Header Title & System Actions */}
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-4 mt-2">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                        <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">NODE: <strong className="text-foreground">{tenantName}</strong></span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-space font-extrabold tracking-tighter break-words max-w-full">{data.company}</h1>

                    <div className="flex flex-wrap items-center gap-3 mt-6">
                        {isCentral && isSuperAdmin && canProvisionTenants && (
                            <Button onClick={() => router.push('/dashboard/tenants')} size="sm" className="rounded-full shadow-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50" disabled={isImpersonating}>
                                <Plus className="w-4 h-4 mr-2" /> Provision Node
                            </Button>
                        )}
                        {isCentral && (
                            <a href="https://hive-monitor.gulfingot.com" target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm" className="rounded-full bg-background/50 backdrop-blur-md text-muted-foreground hover:text-foreground">
                                    <Activity className="w-4 h-4 mr-2 text-rose-500" /> {t('dashboard.system_monitor', 'System Monitor')}
                                </Button>
                            </a>
                        )}
                        {canInviteUsers && (
                            <Button onClick={() => router.push('/dashboard/security')} variant="outline" size="sm" className="rounded-full bg-background/50 backdrop-blur-md disabled:opacity-50" disabled={isImpersonating}>
                                <UserPlus className="w-4 h-4 mr-2 text-emerald-500" /> {t('dashboard.invite_operator', 'Invite Operator')}
                            </Button>
                        )}
                        {((isCentral && canProvisionTenants) || canInviteUsers) && (canManageSystemSettings || canManageBackups) && (
                            <div className="h-6 w-px bg-border/50 mx-2 hidden sm:block" />
                        )}
                        {canManageSystemSettings && (
                            <Button variant="outline" size="sm" className="rounded-full bg-background/50 backdrop-blur-md text-muted-foreground hover:text-foreground">
                                <RefreshCw className="w-4 h-4 mr-2" /> {t('dashboard.flush_cache', 'Flush Cache')}
                            </Button>
                        )}
                        {isCentral && isSuperAdmin && canManageBackups && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full bg-background/50 backdrop-blur-md text-muted-foreground hover:text-foreground"
                                onClick={() => router.push('/dashboard/settings?tab=backup')}
                            >
                                <Database className="w-4 h-4 mr-2" /> Trigger Backup
                            </Button>
                        )}
                    </div>
                </div>
                <div className="flex flex-row md:flex-col items-center md:items-end gap-3 justify-between md:justify-end">
                    <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary px-3 sm:px-4 py-1.5 font-mono text-[11px] sm:text-xs uppercase tracking-widest">
                        {data.plan}
                    </Badge>
                    <div className="flex items-center gap-2 text-[11px] sm:text-xs font-mono text-muted-foreground">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" /> <span className="hidden sm:inline">{t('dashboard.system_encrypted', 'System Encrypted & Secured')}</span>
                    </div>
                </div>
            </div>

            {/* STAT CARDS (Role Differentiated) */}
            <div id="tour-body-stats" className={cn("grid gap-4 mt-8", isCentral ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3")}>
                {isCentral && isSuperAdmin && (
                    <StatCard title={t('dashboard.active_nodes', 'Active Nodes')} value={data.stats.active_tenants || 0} subtext={`${t('dashboard.provisioned', 'Provisioned')}: ${data.stats.total_tenants}`} icon={<Server className="text-indigo-500" />} bgClass="bg-indigo-500/10" href={canViewTenants ? "/dashboard/tenants" : undefined} trend="up" />
                )}
                {isCentral && !isSuperAdmin && (
                    <StatCard title={t('dashboard.assigned_tasks', 'Assigned Tasks')} value={data.stats.assigned_tasks ?? 0} subtext={t('dashboard.pending_queues', 'Active Task Queue')} icon={<Clock className="text-amber-500" />} bgClass="bg-amber-500/10" trend="up" />
                )}
                <StatCard
                    title={isCentral && !isSuperAdmin ? t('dashboard.my_actions', 'Actions Today') : t('dashboard.active_users', 'Active Users')}
                    value={isCentral && !isSuperAdmin ? (data.stats.my_actions_today ?? 0) : data.stats.active_users}
                    subtext={isCentral && !isSuperAdmin ? t('dashboard.executed_ops', 'Executed Operations') : `${t('dashboard.total', 'Total')}: ${data.stats.total_users}`}
                    icon={isCentral && !isSuperAdmin ? <ActivitySquare className="text-emerald-500" /> : <Users className="text-emerald-500" />}
                    bgClass="bg-emerald-500/10"
                    href={canAccessSecurity && isSuperAdmin ? (canViewUsers ? "/dashboard/security?tab=users" : "/dashboard/security") : undefined}
                    trend="up"
                />
                <StatCard
                    title={isCentral && !isSuperAdmin ? t('dashboard.clearance_caps', 'Capabilities') : t('dashboard.security_roles', 'Security Roles')}
                    value={isCentral && !isSuperAdmin ? (data.stats.role_capabilities ?? 0) : data.stats.total_roles}
                    subtext={isCentral && !isSuperAdmin ? t('dashboard.active_caps', 'Assigned Capabilities') : t('dashboard.access_matrices', 'Access Matrices')}
                    icon={<ShieldCheck className="text-amber-500" />}
                    bgClass="bg-amber-500/10"
                    href={canViewRoles && isSuperAdmin ? "/dashboard/security?tab=roles" : undefined}
                    trend="up"
                />
                <StatCard
                    title={isCentral && !isSuperAdmin ? t('dashboard.sla_compliance', 'SLA Compliance') : t('dashboard.permissions', 'Permissions')}
                    value={isCentral && !isSuperAdmin ? `${data.stats.operational_score ?? 0}%` : data.stats.total_permissions}
                    subtext={isCentral && !isSuperAdmin ? t('dashboard.on_time_perf', 'On-Time Performance') : t('dashboard.permission_nodes', 'Permission Nodes')}
                    icon={<Key className="text-blue-500" />}
                    bgClass="bg-blue-500/10"
                    href={canViewPermissions && isSuperAdmin ? "/dashboard/security?tab=permissions" : undefined}
                />
            </div>

            {/* CENTRAL CHART ROW 1: Telemetry & Modules */}
            {isCentral && (
                <div className="grid gap-4 lg:grid-cols-12">
                    <div id="tour-body-telemetry" className="lg:col-span-7 xl:col-span-8 rounded-2xl md:rounded-[2.5rem] border border-border/50 bg-card/40 p-4 sm:p-6 backdrop-blur-md min-h-[300px] md:h-[400px] flex flex-col transition-all">
                        <div className="flex items-center justify-between mb-6">
                            <div className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                                <ActivitySquare aria-hidden="true" className="h-4 w-4 text-primary" /> {isSuperAdmin ? t('dashboard.system_telemetry', 'Live platform activity') : t('dashboard.operator_velocity', 'My live activity')}
                            </div>
                            <span role="status" className="font-mono text-[11px] text-muted-foreground">
                                {isFetching ? 'Updating…' : `Updated ${data.generated_at ? new Date(data.generated_at).toLocaleTimeString() : 'now'} · every ${data.refresh_interval_seconds ?? 15}s`}
                            </span>
                        </div>
                        <div role="img" aria-label={isSuperAdmin ? 'Platform activity during the last 24 hours' : 'Your account activity during the last 24 hours'} aria-describedby="telemetry-chart-description" className="flex-1 w-full min-h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={telemetry} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fontSize: 11}} minTickGap={20} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} width={40} />
                                    <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'hsl(var(--foreground))' }} labelStyle={{ color: 'hsl(var(--muted-foreground))' }} formatter={(val: number | string) => [`${val} ${t('dashboard.requests', 'Requests')}`, t('dashboard.throughput', 'Throughput')]} />
                                    <Area type="monotone" dataKey="requests" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorRequests)" isAnimationActive={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <p id="telemetry-chart-description" className="sr-only">
                            {telemetry.length > 0
                                ? `${telemetry.map((point) => `${point.time}: ${point.requests} recorded events`).join('; ')}.`
                                : 'No activity has been recorded in the current 24-hour window.'}
                        </p>
                    </div>

                    <div id="tour-body-modules" className="lg:col-span-5 xl:col-span-4 rounded-2xl md:rounded-[2.5rem] border border-border/50 bg-card/40 p-4 sm:p-6 backdrop-blur-md min-h-[430px] md:h-[520px] flex flex-col transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <div className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                                    <Layers aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> {t('dashboard.modules_matrix', 'Modules Matrix')}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">Every registered module · entitlement and 30-day activity</p>
                            </div>
                            <Badge variant="outline" className="font-mono text-[11px]">{moduleTraffic.length} MODULES</Badge>
                        </div>
                        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground" aria-hidden="true">
                            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#047857]" />Subscribed tenants (catalog modules)</span>
                            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#0369a1]" />Actions (30 days)</span>
                        </div>
                        <div role="img" tabIndex={0} aria-label="Subscribed tenants and recorded activity for every registered Hive module. Scroll to review all modules." aria-describedby="module-chart-description" className="flex-1 min-h-0 w-full overflow-y-auto pr-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                            <div style={{ height: Math.max(360, moduleTraffic.length * 42) }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={moduleTraffic} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={132} axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: 'hsl(var(--foreground))'}} />
                                        <Tooltip cursor={{fill: 'hsl(var(--muted))', opacity: 0.4}} contentStyle={tooltipStyle} itemStyle={{ color: 'hsl(var(--foreground))' }} labelStyle={{ color: 'hsl(var(--muted-foreground))' }} />
                                        <Bar name="Subscribed tenants" dataKey="subscribed_tenants" fill="#047857" radius={[0, 4, 4, 0]} barSize={8} isAnimationActive={false} />
                                        <Bar name="Actions (30 days)" dataKey="actions" fill="#0369a1" radius={[0, 4, 4, 0]} barSize={8} isAnimationActive={false} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <p id="module-chart-description" className="sr-only">
                            {moduleTraffic.length > 0
                                ? `${moduleTraffic.map((item) => `${item.name}: ${item.subscribed_tenants === null ? 'platform module, not subscription-gated' : `${item.subscribed_tenants} subscribed tenants`}, ${item.actions} recorded actions in 30 days, registry ${item.registry_enabled ? 'enabled' : 'catalog only'}`).join('; ')}.`
                                : 'No modules are registered in the subscription catalog.'}
                        </p>
                    </div>
                </div>
            )}

            {/* NEW CENTRAL CHART ROW 2: Rich Activity Curves & Allocation / Task Status */}
            {isCentral && (
                <div className="grid gap-4 lg:grid-cols-12">
                    {/* Left: 24h Hourly Activity Flow */}
                    <div className="lg:col-span-7 xl:col-span-8 rounded-2xl md:rounded-[2.5rem] border border-border/50 bg-card/40 p-4 sm:p-6 backdrop-blur-md min-h-[300px] md:h-[360px] flex flex-col transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                                <LineChartIcon className="h-4 w-4 text-sky-500" /> {isSuperAdmin ? t('dashboard.hourly_throughput', '24H Activity & Throughput Flow') : t('dashboard.operator_hourly_flow', 'Daily Operational Activity Rate')}
                            </div>
                            <Badge variant="outline" className="font-mono text-[11px] bg-background">
                                {isSuperAdmin ? 'CLUSTER ACTIONS VS LOGINS' : 'MY OPS ACTIONS'}
                            </Badge>
                        </div>
                        <div className="flex-1 w-full min-h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={hourlyActivityData} margin={{ top: 10, right: 20, bottom: 5, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                                    <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'hsl(var(--foreground))' }} labelStyle={{ color: 'hsl(var(--muted-foreground))' }} />
                                    <Line type="monotone" dataKey="actions" name={isSuperAdmin ? "System Actions" : "My Executions"} stroke="hsl(var(--primary))" strokeWidth={2.5} activeDot={{ r: 6 }} isAnimationActive={false} />
                                    <Line type="monotone" dataKey="logins" name="Operator Sessions" stroke="#0284c7" strokeWidth={2} isAnimationActive={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Right: Storage Allocation (Superadmin) OR Task Status Distribution (Operator) */}
                    <div className="lg:col-span-5 xl:col-span-4 rounded-2xl md:rounded-[2.5rem] border border-border/50 bg-card/40 p-4 sm:p-6 backdrop-blur-md min-h-[300px] md:h-[360px] flex flex-col transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                                {isSuperAdmin ? <HardDrive className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                <span>{isSuperAdmin ? t('dashboard.resource_distribution', 'Storage & Cache Allocation') : t('dashboard.task_distribution', 'Task Queue Distribution')}</span>
                            </div>
                        </div>

                        <div className="flex-1 w-full relative">
                            {isSuperAdmin ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={resourceData} layout="vertical" margin={{ top: 0, right: 20, left: 60, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                                        <Tooltip cursor={{fill: 'hsl(var(--muted))', opacity: 0.4}} contentStyle={tooltipStyle} itemStyle={{ color: 'hsl(var(--foreground))' }} labelStyle={{ color: 'hsl(var(--muted-foreground))' }} formatter={(val: number | string) => [`${val} MB`, 'Allocated']} />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false}>
                                            {resourceData.map((entry, index) => <Cell key={`res-${index}`} fill={entry.fill} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="space-y-3 pt-2">
                                    {taskDistributionData.map((item, index) => (
                                        <div key={index} className="space-y-1.5">
                                            <div className="flex justify-between text-xs font-mono font-bold">
                                                <span className="text-foreground">{item.status}</span>
                                                <span className="text-muted-foreground">{item.count} Items</span>
                                            </div>
                                            <div className="h-2.5 bg-muted/60 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-700"
                                                    style={{ width: `${(item.count / taskDistributionMax) * 100}%`, backgroundColor: item.fill }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TENANT ONLY: Engagement Chart & Traffic */}
            {!isCentral && (
                <div className="grid gap-4 lg:grid-cols-12 mt-4">
                    <div className="lg:col-span-7 xl:col-span-8 rounded-2xl md:rounded-[2.5rem] border border-border/50 bg-card/40 p-4 sm:p-6 backdrop-blur-md min-h-[300px] md:h-[400px] flex flex-col transition-all">
                        <div className="flex items-center justify-between mb-6">
                            <div className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                                <LineChartIcon className="h-4 w-4 text-emerald-500" /> {t('dashboard.weekly_engagement', 'Weekly Engagement')}
                            </div>
                            <Badge variant="outline" className="font-mono text-[11px] bg-background">LAST 24 HOURS</Badge>
                        </div>
                        <div className="flex-1 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={tenantActivity} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                                    <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'hsl(var(--foreground))' }} labelStyle={{ color: 'hsl(var(--muted-foreground))' }} />
                                    <Line type="monotone" dataKey="actions" name="User Actions" stroke="var(--chart-1)" strokeWidth={2} activeDot={{ r: 6 }} />
                                    <Line type="monotone" dataKey="logins" name="Unique Logins" stroke="var(--chart-2)" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="md:col-span-4 rounded-[2rem] border border-border/50 bg-card/40 p-6 backdrop-blur-md flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <div className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                                <Globe className="h-4 w-4 text-blue-400" /> {t('dashboard.traffic_origins', 'Traffic Origins')}
                            </div>
                        </div>
                        <div className="space-y-4 flex-1">
                            {(data.traffic_origins || []).slice(0, 5).map((origin, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2"><span className="font-mono text-xs">{origin.code ?? origin.flag ?? '—'}</span> <span className="font-bold">{origin.city}</span></div>
                                    <span className="font-mono text-xs text-muted-foreground">{origin.percent}%</span>
                                </div>
                            ))}
                            {(data.traffic_origins ?? []).length === 0 && (
                                <p className="text-sm text-muted-foreground">No location data has been recorded in the last 30 days.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CENTRAL ROW 3: Financial Intel / Operational Intel, Cluster Health, Traffic Origins */}
            {isCentral && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
                    {/* Super Admin gets Revenue Intel; Operators get Operational Velocity Intel */}
                    {isSuperAdmin ? (
                        <div className="rounded-2xl md:rounded-[2.5rem] border border-border/50 bg-card/40 p-4 sm:p-6 backdrop-blur-md flex flex-col justify-between transition-all shadow-lg">
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                                    <CreditCard className="h-4 w-4 text-amber-500" /> {t('dashboard.revenue_intel', 'Revenue Intel')}
                                </div>
                                <Badge variant="outline" className="font-mono text-[11px]">{data.business?.currency ?? 'ETB'}</Badge>
                            </div>
                            <div>
                                <h3 className="text-3xl sm:text-4xl font-space font-black tracking-tighter">{Number(data.business?.monthly_recurring_revenue ?? 0).toLocaleString()} ETB</h3>
                                <p className="text-xs text-muted-foreground mt-1">Contracted monthly value from each tenant’s latest paid order</p>
                            </div>
                            <dl className="mt-6 grid grid-cols-2 gap-2 text-xs">
                                <div className="rounded-xl border border-border/60 bg-background/50 p-3"><dt className="text-muted-foreground">Collected this month</dt><dd className="mt-1 font-mono font-bold">{Number(data.business?.collected_this_month ?? 0).toLocaleString()} ETB</dd></div>
                                <div className="rounded-xl border border-border/60 bg-background/50 p-3"><dt className="text-muted-foreground">Outstanding orders</dt><dd className="mt-1 font-mono font-bold">{Number(data.business?.outstanding ?? 0).toLocaleString()} ETB</dd></div>
                                <div className="rounded-xl border border-border/60 bg-background/50 p-3"><dt className="text-muted-foreground">Lifetime collected</dt><dd className="mt-1 font-mono font-bold">{Number(data.business?.lifetime_collected ?? 0).toLocaleString()} ETB</dd></div>
                                <div className="rounded-xl border border-border/60 bg-background/50 p-3"><dt className="text-muted-foreground">Active / paying</dt><dd className="mt-1 font-mono font-bold">{data.business?.active_subscriptions ?? 0} / {data.business?.paying_subscriptions ?? 0}</dd></div>
                            </dl>
                            <div className="mt-4 space-y-2" aria-label="Active subscription plan mix">
                                {(data.business?.plan_mix ?? []).slice(0, 4).map((plan) => (
                                    <div key={plan.plan} className="flex items-center justify-between gap-3 text-[11px]">
                                        <span className="min-w-0 truncate font-bold uppercase">{plan.name}</span>
                                        <span className="shrink-0 font-mono text-muted-foreground">{plan.count} · {plan.percent}%</span>
                                    </div>
                                ))}
                                {(data.business?.plan_mix ?? []).length === 0 && <p className="text-xs text-muted-foreground">No active subscription contracts.</p>}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-2xl md:rounded-[2.5rem] border border-border/50 bg-card/40 p-4 sm:p-6 backdrop-blur-md flex flex-col justify-between transition-all shadow-lg">
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                                    <ActivitySquare className="h-4 w-4 text-emerald-500" /> {t('dashboard.op_index', 'Operational Index')}
                                </div>
                                <Badge variant="outline" className="font-mono text-[11px]">ACTIVITY {data.stats?.operational_score ?? 0}%</Badge>
                            </div>
                            <div>
                                <h3 className="text-3xl sm:text-4xl font-space font-black tracking-tighter">{data.stats?.operational_score ?? 0}%</h3>
                                <p className="text-xs text-muted-foreground mt-1">Share of your recorded actions completed today</p>
                            </div>
                            <div className="mt-6 space-y-3">
                                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-xs">
                                    <span>Assigned work</span><strong className="font-mono">{data.stats.assigned_tasks ?? 0}</strong>
                                </div>
                                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-xs">
                                    <span>Role capabilities</span><strong className="font-mono">{data.stats.role_capabilities ?? 0}</strong>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="rounded-2xl md:rounded-[2.5rem] border border-border/50 bg-card/40 p-4 sm:p-6 backdrop-blur-md transition-all shadow-lg">
                        <div className="flex items-center justify-between mb-6">
                            <div className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                                <HardDrive className="h-4 w-4 text-indigo-500" /> {t('dashboard.cluster_health', 'Cluster Health')}
                            </div>
                            <div className="flex items-center gap-3">
                                <a href="https://hive-monitor.gulfingot.com" target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold font-mono uppercase tracking-wider text-muted-foreground hover:text-rose-500 transition-colors flex items-center gap-1">
                                    Metrics <ChevronRight className="w-3 h-3" />
                                </a>
                                <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative rounded-full h-2 w-2 bg-emerald-500"></span></span>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:gap-4">
                            <div className="flex flex-col items-center justify-center p-2 sm:p-3 bg-background/50 rounded-xl sm:rounded-2xl border border-border/40">
                                <Database className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 mb-1 sm:mb-2" />
                                <span className="text-sm sm:text-lg font-bold font-mono">{data.cluster?.db_size ?? 'Unavailable'}</span>
                                <span className="text-[11px] sm:text-[11px] uppercase text-muted-foreground tracking-widest text-center">PGSQL Data</span>
                            </div>
                            <div className="flex flex-col items-center justify-center p-2 sm:p-3 bg-background/50 rounded-xl sm:rounded-2xl border border-border/40">
                                <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mb-1 sm:mb-2" />
                                <span className="text-sm sm:text-lg font-bold font-mono">{data.cluster?.redis_hits ?? 0}%</span>
                                <span className="text-[11px] sm:text-[11px] uppercase text-muted-foreground tracking-widest text-center">Redis Hits</span>
                            </div>
                            <div className="flex flex-col items-center justify-center p-2 sm:p-3 bg-background/50 rounded-xl sm:rounded-2xl border border-border/40">
                                <ActivitySquare className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500 mb-1 sm:mb-2" />
                                <span className="text-sm sm:text-lg font-bold font-mono">{data.cluster?.ws_connections ?? 0}</span>
                                <span className="text-[11px] sm:text-[11px] uppercase text-muted-foreground tracking-widest text-center">WS Conns</span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl md:rounded-[2.5rem] border border-border/50 bg-card/40 p-4 sm:p-6 backdrop-blur-md flex flex-col transition-all shadow-lg">
                        <div className="flex items-center justify-between mb-6">
                            <div className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                                <Globe className="h-4 w-4 text-blue-400" /> {t('dashboard.traffic_origins', 'Traffic Origins')}
                            </div>
                        </div>
                        <div className="space-y-4 flex-1">
                            {(data.traffic_origins || []).slice(0, 5).map((origin, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2"><span className="font-mono text-xs">{origin.code ?? origin.flag ?? '—'}</span> <span className="font-bold">{origin.city}</span></div>
                                    <span className="font-mono text-xs text-muted-foreground font-bold">{origin.percent}%</span>
                                </div>
                            ))}
                            {(data.traffic_origins ?? []).length === 0 && (
                                <p className="text-sm text-muted-foreground">No location data has been recorded in the last 30 days.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CENTRAL ROW 4: ALERTS & AUDIT LEDGER */}
            <div className="grid gap-4 lg:grid-cols-12 mt-4 pb-20 sm:pb-10">
                {isCentral && canViewAlerts && (
                    <div className="lg:col-span-4 rounded-2xl md:rounded-[2.5rem] border border-red-500/20 bg-gradient-to-br from-red-500/5 to-background p-4 sm:p-6 flex flex-col overflow-hidden transition-all shadow-lg">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-red-500">
                                    <BellRing className="h-4 w-4" /> {t('dashboard.alerts', 'Alerts')}
                                </div>
                                <Badge className="bg-red-500 text-white hover:bg-red-600">{data.alerts?.length || 0}</Badge>
                            </div>
                            <Link href="/dashboard/alerts">
                                <Button variant="ghost" size="sm" className="h-6 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
                                    {t('dashboard.show_more', 'Show More')} <ChevronRight className="w-3 h-3 ml-1" />
                                </Button>
                            </Link>
                        </div>

                        <div className="space-y-3 flex-1 overflow-hidden">
                            {(data.alerts || []).slice(0, 5).map((alert, i) => (
                                <div key={i} className={`p-3 bg-background/60 border rounded-xl flex gap-3 items-start overflow-hidden ${alert.level === 'critical' ? 'border-red-500/20' : 'border-amber-500/20'}`}>
                                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${alert.level === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-xs font-bold truncate">{alert.title}</p>
                                            <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">{alert.time_ago}</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{alert.description}</p>
                                    </div>
                                </div>
                            ))}
                            {(!data.alerts || data.alerts.length === 0) && (
                                <div className="text-xs text-muted-foreground text-center py-6">
                                    {t('dashboard.no_alerts', 'No active system anomalies.')}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {canViewLogs && (
                    <div id="tour-body-audit" className={cn("rounded-2xl md:rounded-[2.5rem] border border-border/50 bg-card/40 p-4 sm:p-6 backdrop-blur-md transition-all shadow-lg", (isCentral ? canViewAlerts : (canInviteUsers || canViewRoles || canViewPermissions)) ? "lg:col-span-8" : "lg:col-span-12")}>
                        <div className="flex items-center justify-between mb-6">
                            <div className="text-sm font-bold flex items-center gap-3 uppercase tracking-widest text-muted-foreground">
                                <Activity className="h-4 w-4 text-primary" />
                                {isCentral ? (isSuperAdmin ? t('dashboard.live_system_audit', 'Live System Audit') : t('dashboard.operator_audit', 'My Operational Audit Stream')) : t('dashboard.live_node_audit', 'Live Node Audit')}
                            </div>
                            <Link href="/dashboard/audit-logs">
                                <Button variant="ghost" size="sm" className="h-6 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
                                    {t('dashboard.show_more', 'Show More')} <ChevronRight className="w-3 h-3 ml-1" />
                                </Button>
                            </Link>
                        </div>
                        <div className="space-y-3">
                            {(data.recent_activity || []).slice(0, 5).map((log, index) => {
                                let causerName = log.properties?.causer_name || (typeof log.causer === 'object' ? log.causer?.name : log.causer) || 'System';
                                if (causerName === 'HIVE OVERLORD' && log.properties?.causer_name) {
                                    causerName = log.properties.causer_name;
                                }

                                const nodeLabel = log.node === 'Central' ? 'CENTRAL' : (log.node || log.tenant_id);

                                return (
                                    <div key={`log-${log.id}-${index}`} className="flex items-center justify-between p-4 rounded-2xl bg-background/40 border border-border/40 hover:bg-muted/30 transition-all animate-in fade-in slide-in-from-top-2 duration-500">
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><UserIcon className="w-4 h-4" /></div>
                                            <div>
                                                <p className="text-sm font-bold">{log.description}</p>
                                                <p className="text-[11px] font-mono text-muted-foreground uppercase flex items-center gap-1.5 mt-0.5">
                                                    {isCentral && (
                                                        <span className="bg-primary/20 text-primary px-1.5 rounded-sm font-bold tracking-widest">
                                                            [{nodeLabel}]
                                                        </span>
                                                    )}
                                                    {log.event} - {log.time || log.time_ago || 'Just now'}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="font-mono text-[11px] uppercase">
                                            {causerName}
                                        </Badge>
                                    </div>
                                );
                            })}

                            {(!data.recent_activity || data.recent_activity.length === 0) && (
                                <div className="text-xs text-muted-foreground text-center py-8 flex flex-col items-center">
                                    <FileText className="h-8 w-8 text-muted/30 mb-2" />
                                    {t('dashboard.no_audit_logs', 'No recent audit logs found for this node.')}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({
    title,
    value,
    subtext,
    icon,
    bgClass,
    href,
    trend,
}: {
    title: string;
    value: React.ReactNode;
    subtext: string;
    icon: React.ReactNode;
    bgClass: string;
    href?: string;
    trend?: string;
}) {
    const { t } = useTranslation();
    const content = (
        <>
            <div className={cn("absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl opacity-20", bgClass)} />
            <div className="flex justify-between mb-4 relative z-10">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", bgClass)}>{icon}</div>
                {trend === 'up' && <Badge className="bg-emerald-500/10 text-emerald-500 border-none text-[11px] animate-pulse hidden sm:flex">+ {t('dashboard.live', 'LIVE')}</Badge>}
            </div>
            <div className="relative z-10">
                <h3 className="text-2xl sm:text-3xl font-space font-black tracking-tighter tabular-nums">{value}</h3>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
                <p className="text-[11px] text-muted-foreground font-mono mt-1 opacity-80">{subtext}</p>
            </div>
        </>
    );

    if (!href) {
        return (
            <div className="p-4 sm:p-6 rounded-2xl md:rounded-[2rem] border border-border/50 bg-card/40 backdrop-blur-md relative overflow-hidden group block transition-all shadow-lg hover:bg-card/60">
                {content}
            </div>
        );
    }

    return (
        <Link href={href} className="p-4 sm:p-6 rounded-2xl md:rounded-[2rem] border border-border/50 bg-card/40 backdrop-blur-md relative overflow-hidden group hover:border-primary/30 transition-all block shadow-lg hover:bg-card/60 transform active:scale-[0.98]">
            {content}
        </Link>
    );
}

function DashboardLoader() {
    return <DashboardOverviewPlaceholder />;
}

function DashboardError({ message }: { message?: string }) {
    const { t } = useTranslation();
    return (
        <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center font-bold">!</div>
            <h1 className="text-xl font-space font-black">{t('dashboard.node_connection_failed', 'Node Connection Failed')}</h1>
            <p className="text-muted-foreground text-xs font-mono">{message}</p>
            <RetryButton />
        </div>
    );
}
