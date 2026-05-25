"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
    Activity, Users, Server, Home, HelpCircle, ShieldCheck, 
    Key, User as UserIcon, Plus, UserPlus, ShieldAlert,
    ActivitySquare, Layers, Clock, AlertOctagon,
    CreditCard, HardDrive, Globe, Zap, BellRing, Database, RefreshCw, VenetianMask, ChevronRight,
    LineChart as LineChartIcon, Settings, FileText
} from "lucide-react"; 
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, LineChart, Line
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
import { handleAuthFailureResponse } from "@/lib/auth-sync";
import {
    ALERTS_ROUTE_PERMISSIONS,
    AUDIT_LOG_ROUTE_PERMISSIONS,
    SECURITY_ROUTE_PERMISSIONS,
    TENANTS_ROUTE_PERMISSIONS,
} from "@/lib/route-permissions";

interface DashboardData {
    company: string;
    plan: string;
    stats: {
        total_users: number;
        active_users: number;
        total_roles: number;
        total_permissions: number;
        total_tenants?: number;
        active_tenants?: number;
    };
    recent_activity: any[];
    business?: {
        mrr: number;
        enterprise_pct: number;
        business_pct: number;
    };
    cluster?: {
        db_size: string;
        redis_hits: number;
        ws_connections: number;
    };
    alerts?: { title: string; description: string; level: string; time_ago: string }[];
    traffic_origins?: { city: string; flag: string; percent: number }[];
}

const COLORS = { identity: 'hsl(var(--primary))', tenancy: '#10b981', billing: '#f59e0b', core: '#6366f1' };

export default function DashboardHome() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { t } = useTranslation(); 
    const { startTour } = useTour(); 
    const { hasPermission, hasAnyPermission, isLoaded } = usePermissions();
    
    const [tenantName, setTenantName] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const [timeFilter, setTimeFilter] = useState<'live' | '1h' | '24h'>('live');
    const [moduleTab, setModuleTab] = useState<'traffic' | 'latency' | 'errors'>('traffic');

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

    // Central Telemetry State
    const [telemetry, setTelemetry] = useState(Array.from({ length: 10 }).map((_, i) => ({ time: `-${10 - i}s`, requests: Math.floor(Math.random() * 500) + 500 })));
    const [moduleTraffic, setModuleTraffic] = useState([{ name: 'Identity', value: 85, fill: COLORS.identity }, { name: 'Tenancy', value: 45, fill: COLORS.tenancy }, { name: 'Billing', value: 25, fill: COLORS.billing }, { name: 'Core', value: 60, fill: COLORS.core }]);
    const [moduleLatency, setModuleLatency] = useState([{ name: 'Identity', ms: 24, fill: COLORS.identity }, { name: 'Tenancy', ms: 45, fill: COLORS.tenancy }, { name: 'Billing', ms: 120, fill: COLORS.billing }, { name: 'Core', ms: 18, fill: COLORS.core }]);
    const [moduleErrors, setModuleErrors] = useState([{ name: 'Identity', count: 2, fill: COLORS.identity }, { name: 'Tenancy', count: 1, fill: COLORS.tenancy }, { name: 'Billing', count: 5, fill: COLORS.billing }, { name: 'Core', count: 0, fill: COLORS.core }]);

    // Tenant-Specific Chart State
    const [tenantActivity, setTenantActivity] = useState([
        { day: 'Mon', logins: 45, actions: 120 },
        { day: 'Tue', logins: 52, actions: 150 },
        { day: 'Wed', logins: 48, actions: 180 },
        { day: 'Thu', logins: 61, actions: 210 },
        { day: 'Fri', logins: 59, actions: 195 },
        { day: 'Sat', logins: 20, actions: 45 },
        { day: 'Sun', logins: 15, actions: 30 },
    ]);

    useEffect(() => {
        const host = window.location.hostname;
        const tenantId = getTenantId();

        if (tenantId) {
            setTenantName(tenantId.toUpperCase());
        } else {
            setTenantName('CENTRAL');
        }

        if (typeof window !== 'undefined' && localStorage.getItem('hive_original_token')) {
            setIsImpersonating(true);
        }
        
        setIsMounted(true);
    }, []);

    const handleLeaveImpersonation = () => {
        const originalToken = localStorage.getItem('hive_original_token');
        if (originalToken) {
            localStorage.setItem('hive_token', originalToken);
            localStorage.removeItem('hive_original_token');
            window.location.href = '/dashboard';
        }
    };

    const { data: dashboardPayload, error, isLoading } = useQuery({
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
        staleTime: Infinity, 
    });

    const data: DashboardData = dashboardPayload;

    useEffect(() => {
        if (!isMounted || timeFilter !== 'live' || tenantName !== 'CENTRAL') return;
        const pulse = setInterval(() => {
            const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setTelemetry(prev => [...prev.slice(1), { time: now, requests: Math.floor(Math.random() * 800) + 400 }]);
            setModuleTraffic(prev => prev.map(m => ({ ...m, value: Math.max(10, m.value + Math.floor(Math.random() * 15 - 7)) })));
            setModuleLatency(prev => prev.map(m => ({ ...m, ms: Math.max(10, m.ms + Math.floor(Math.random() * 6 - 3)) })));
        }, 3000);
        return () => clearInterval(pulse);
    }, [isMounted, timeFilter, tenantName]);

    useEffect(() => {
        if (!isMounted || !data || !tenantName) return;
        const token = getAccessToken(); 
        if (!token) return;

        try {
            const echo = initEcho(token);
            const channelName = `dashboard.${tenantName.toLowerCase()}`;
            const channel = echo.private(channelName);
            
            channel.listen('.activity.logged', (e: any) => {
                const activity = e.activity;
                
                // Set the correct operator name dynamically
                activity.causer = activity.properties?.causer_name || activity.causer?.name || activity.causer || 'System';

                const eventType = activity.event?.toLowerCase() || '';
                const description = activity.description?.toLowerCase() || '';
                const subjectType = activity.subject_type?.toLowerCase() || '';

                // REAL-TIME: Update Tenant Chart
                if (tenantName !== 'CENTRAL') {
                    setTenantActivity(prev => {
                        const updated = [...prev];
                        const lastIdx = updated.length - 1;
                        const isLogin = eventType.includes('login') || description.includes('logged in');

                        updated[lastIdx] = {
                            ...updated[lastIdx],
                            logins: updated[lastIdx].logins + (isLogin ? 1 : 0),
                            actions: updated[lastIdx].actions + (!isLogin ? 1 : 0)
                        };
                        return updated;
                    });
                }

                queryClient.setQueryData(['dashboardMetrics', tenantName], (oldData: any) => {
                    if (!oldData) return oldData;

                    let newStats = { ...oldData.stats };
                    let newBusiness = oldData.business ? { ...oldData.business } : undefined;

                    // ISOLATED: Only process these calculations if on Central
                    if (tenantName === 'CENTRAL') {
                        const isTenantAction = subjectType.includes('tenant') || description.includes('tenant') || description.includes('node');
                        const isUserAction = subjectType.includes('user') || description.includes('operator') || description.includes('admin');
                        const isRoleAction = subjectType.includes('role') || description.includes('role');
                        const isPermAction = subjectType.includes('permission') || description.includes('permission');

                        if (eventType === 'created' || description.includes('provisioned')) {
                            if (isTenantAction) { 
                                newStats.total_tenants++; newStats.active_tenants++; 
                                if (newBusiness) newBusiness.mrr += 199; 
                            }
                            if (isUserAction) { newStats.total_users++; newStats.active_users++; }
                            if (isRoleAction) { newStats.total_roles++; }
                            if (isPermAction) { newStats.total_permissions++; }
                        } 
                        else if (eventType === 'deleted' || description.includes('purged')) {
                            if (isTenantAction) { 
                                newStats.total_tenants--; newStats.active_tenants--; 
                                if (newBusiness) newBusiness.mrr -= 199; 
                            }
                            if (isUserAction) { newStats.total_users--; newStats.active_users--; }
                            if (isRoleAction) { newStats.total_roles--; }
                            if (isPermAction) { newStats.total_permissions--; }
                        } 
                        else if (eventType === 'updated') {
                            if (isTenantAction) {
                                if (description.includes('online')) newStats.active_tenants++;
                                if (description.includes('suspended')) newStats.active_tenants--;
                            }
                            if (isUserAction) {
                                if (description.includes('active')) newStats.active_users++;
                                if (description.includes('suspended') || description.includes('locked')) newStats.active_users--;
                            }
                        }

                        newStats.total_tenants = Math.max(0, newStats.total_tenants || 0);
                        newStats.active_tenants = Math.max(0, newStats.active_tenants || 0);
                        newStats.total_roles = Math.max(0, newStats.total_roles || 0);
                        if (newBusiness) newBusiness.mrr = Math.max(0, newBusiness.mrr);
                    }

                    newStats.total_users = Math.max(0, newStats.total_users || 0);
                    newStats.active_users = Math.max(0, newStats.active_users || 0);
                    
                    return {
                        ...oldData,
                        stats: newStats,
                        business: newBusiness,
                        recent_activity: [activity, ...(oldData.recent_activity || [])].slice(0, 6)
                    };
                });
            });

            return () => { echo.leaveChannel(channelName); };
        } catch (err) {
            console.error("WS-DEBUG: [ERROR] Echo crashed:", err);
        }
    }, [isMounted, !!data, tenantName, queryClient]);

    if (!isLoaded || !isMounted) {
        return <DashboardOverviewPlaceholder />;
    }

    if (!canViewDashboard) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-[2rem] border border-border/50 bg-card/40 p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10">
                    <ShieldAlert className="h-8 w-8 text-destructive" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-black tracking-tight">{t('global.access_denied', 'Access Denied')}</h2>
                    <p className="max-w-md text-sm text-muted-foreground">
                        {t('global.lacks_permission', 'Your current access token lacks the required')} <strong className="text-destructive">view_system_dashboard</strong> {t('global.capability', 'capability.')}
                    </p>
                </div>
            </div>
        );
    }

    if (!isMounted || isLoading || !tenantName) return <DashboardLoader />;
    if (error || !data) return <DashboardError message={(error as Error)?.message} />;

    const isCentral = data.stats.total_tenants !== undefined;


    const tooltipStyle = { 
        borderRadius: '12px', 
        backgroundColor: 'hsl(var(--background))', 
        border: '1px solid hsl(var(--border))',
        color: 'hsl(var(--foreground))' 
    };

    return (
        <div className="space-y-6 relative pb-10">

            {isImpersonating && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-500 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-md animate-in slide-in-from-top-4 shadow-lg shadow-amber-500/5">
                    <div className="flex items-center gap-3">
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

            <div className="flex w-full justify-end items-center gap-3 mb-4">
                <Button variant="outline" size="sm" onClick={() => startTour([])} className="h-8 rounded-lg border-border/50 bg-background/50 backdrop-blur-md">
                    <HelpCircle className="w-4 h-4 mr-2" /> {t('topbar.system_tour', 'System Tour')}
                </Button>
                <Breadcrumbs items={[{ label: "Hive.OS", href: "/", icon: <Home className="h-4 w-4" /> }, { label: t('nav.dashboard', 'Dashboard') }]} />
            </div>
            
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-4 mt-2">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">NODE: <strong className="text-foreground">{tenantName}</strong></span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-space font-extrabold tracking-tighter break-words max-w-full">{data.company}</h1>

                    
                    <div className="flex flex-wrap items-center gap-3 mt-6">
                        {isCentral && canProvisionTenants && (
                            <Button onClick={() => router.push('/dashboard/tenants')} size="sm" className="rounded-full shadow-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50" disabled={isImpersonating}>
                                <Plus className="w-4 h-4 mr-2" /> Provision Node
                            </Button>
                        )}
                        {isCentral && canProvisionTenants && (
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
                        {isCentral && canManageBackups && (
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
                    <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary px-3 sm:px-4 py-1.5 font-mono text-[10px] sm:text-xs uppercase tracking-widest">
                        {data.plan}
                    </Badge>
                    <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono text-muted-foreground">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" /> <span className="hidden sm:inline">{t('dashboard.system_encrypted', 'System Encrypted & Secured')}</span>
                    </div>
                </div>
            </div>

            {/* STAT CARDS */}
            <div id="tour-body-stats" className={cn("grid gap-4 mt-8", isCentral ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3")}>
                {isCentral && (
                    <StatCard title={t('dashboard.active_nodes', 'Active Nodes')} value={data.stats.active_tenants || 0} subtext={`${t('dashboard.provisioned', 'Provisioned')}: ${data.stats.total_tenants}`} icon={<Server className="text-indigo-500" />} bgClass="bg-indigo-500/10" href={canViewTenants ? "/dashboard/tenants" : undefined} trend="up" />
                )}
                <StatCard title={t('dashboard.active_users', 'Active Users')} value={data.stats.active_users} subtext={`${t('dashboard.total', 'Total')}: ${data.stats.total_users}`} icon={<Users className="text-emerald-500" />} bgClass="bg-emerald-500/10" href={canAccessSecurity ? (canViewUsers ? "/dashboard/security?tab=users" : "/dashboard/security") : undefined} trend="up" />
                <StatCard title={t('dashboard.security_roles', 'Security Roles')} value={data.stats.total_roles} subtext={t('dashboard.access_matrices', 'Access Matrices')} icon={<ShieldCheck className="text-amber-500" />} bgClass="bg-amber-500/10" href={canViewRoles ? "/dashboard/security?tab=roles" : undefined} trend="up" />
                <StatCard title={t('dashboard.permissions', 'Permissions')} value={data.stats.total_permissions} subtext={t('dashboard.permission_nodes', 'Permission Nodes')} icon={<Key className="text-blue-500" />} bgClass="bg-blue-500/10" href={canViewPermissions ? "/dashboard/security?tab=permissions" : undefined} />
            </div>

            {/* CENTRAL ONLY: Telemetry & Modules */}
            {isCentral && (
                <div className="grid gap-4 lg:grid-cols-12">
                    <div id="tour-body-telemetry" className="lg:col-span-7 xl:col-span-8 rounded-2xl md:rounded-[2.5rem] border border-border/50 bg-card/40 p-4 sm:p-6 backdrop-blur-md min-h-[300px] md:h-[400px] flex flex-col transition-all">
                        <div className="flex items-center justify-between mb-6">
                            <div className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                                <ActivitySquare className="h-4 w-4 text-primary" /> {t('dashboard.system_telemetry', 'System Telemetry')}
                            </div>
                            <div className="flex items-center gap-2 bg-background/50 rounded-full p-1 border border-border/50">
                                <Button variant={timeFilter === 'live' ? 'default' : 'ghost'} size="sm" className="h-6 text-[10px] rounded-full" onClick={() => setTimeFilter('live')}>Live</Button>
                                <Button variant={timeFilter === '1h' ? 'default' : 'ghost'} size="sm" className="h-6 text-[10px] rounded-full" onClick={() => setTimeFilter('1h')}>1H</Button>
                                <Button variant={timeFilter === '24h' ? 'default' : 'ghost'} size="sm" className="h-6 text-[10px] rounded-full" onClick={() => setTimeFilter('24h')}>24H</Button>
                            </div>
                        </div>
                        <div className="flex-1 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={telemetry}>
                                    <defs><linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/></linearGradient></defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fontSize: 10}} minTickGap={20} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} width={40} />
                                    <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'hsl(var(--foreground))' }} labelStyle={{ color: 'hsl(var(--muted-foreground))' }} />
                                    <Area type="monotone" dataKey="requests" stroke="hsl(var(--primary))" strokeWidth={2} isAnimationActive={true} fillOpacity={1} fill="url(#colorRequests)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div id="tour-body-modules" className="lg:col-span-5 xl:col-span-4 rounded-2xl md:rounded-[2.5rem] border border-border/50 bg-card/40 p-4 sm:p-6 backdrop-blur-md h-[350px] md:h-[400px] flex flex-col transition-all">
                        <div className="flex items-center justify-between mb-6">
                            <div className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                                <Layers className="h-4 w-4 text-emerald-500" /> {t('dashboard.modules.title', 'Modules')}
                            </div>
                            <div className="flex items-center gap-1 bg-background/50 rounded-full p-1 border border-border/50">
                                <Button variant={moduleTab === 'traffic' ? 'default' : 'ghost'} size="icon" className="h-6 w-6 rounded-full" onClick={() => setModuleTab('traffic')} title={t('dashboard.modules.traffic_volume', 'Traffic Volume')}><Activity className="h-3 w-3"/></Button>
                                <Button variant={moduleTab === 'latency' ? 'default' : 'ghost'} size="icon" className="h-6 w-6 rounded-full" onClick={() => setModuleTab('latency')} title={t('dashboard.modules.response_latency', 'Response Latency')}><Clock className="h-3 w-3"/></Button>
                                <Button variant={moduleTab === 'errors' ? 'default' : 'ghost'} size="icon" className="h-6 w-6 rounded-full" onClick={() => setModuleTab('errors')} title={t('dashboard.modules.anomalies', 'Anomalies')}><AlertOctagon className="h-3 w-3"/></Button>
                            </div>
                        </div>
                        <div className="flex-1 w-full relative">
                            {moduleTab === 'traffic' && (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={moduleTraffic.map(m => ({ ...m, name: t(`dashboard.modules.${m.name.toLowerCase()}`, m.name) }))} layout="vertical" margin={{ top: 0, right: 20, left: 50, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 'bold'}} />
                                        <Tooltip cursor={{fill: 'hsl(var(--muted))', opacity: 0.4}} contentStyle={tooltipStyle} itemStyle={{ color: 'hsl(var(--foreground))' }} labelStyle={{ color: 'hsl(var(--muted-foreground))' }} formatter={(val: any) => [`${val} ${t('dashboard.modules.req_per_sec', 'Req/s')}`, t('dashboard.modules.volume_label', 'Volume')]} />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24} isAnimationActive={false}>
                                            {moduleTraffic.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                            {moduleTab === 'latency' && (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={moduleLatency.map(m => ({ ...m, name: t(`dashboard.modules.${m.name.toLowerCase()}`, m.name) }))} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 'bold'}} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                                        <Tooltip cursor={{fill: 'hsl(var(--muted))', opacity: 0.4}} contentStyle={tooltipStyle} itemStyle={{ color: 'hsl(var(--foreground))' }} labelStyle={{ color: 'hsl(var(--muted-foreground))' }} formatter={(val: any) => [`${val}${t('dashboard.modules.ms', 'ms')}`, t('dashboard.modules.latency_label', 'Latency')]} />
                                        <Bar dataKey="ms" radius={[4, 4, 0, 0]} barSize={32} isAnimationActive={false}>
                                            {moduleLatency.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} opacity={0.8} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                            {moduleTab === 'errors' && (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'hsl(var(--foreground))' }} formatter={(val: any) => [`${val} ${t('dashboard.modules.events', 'Events')}`, t('dashboard.modules.anomalies', 'Anomalies')]} />
                                        <Pie data={moduleErrors.map(m => ({ ...m, name: t(`dashboard.modules.${m.name.toLowerCase()}`, m.name) }))} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="count" stroke="none" isAnimationActive={false}>
                                            {moduleErrors.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
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
                            <Badge variant="outline" className="font-mono text-[9px] bg-background">{t('dashboard.last_7_days', 'LAST 7 DAYS')}</Badge>
                        </div>
                        <div className="flex-1 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={tenantActivity} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                                    <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'hsl(var(--foreground))' }} labelStyle={{ color: 'hsl(var(--muted-foreground))' }} />
                                    <Line type="monotone" dataKey="actions" name="User Actions" stroke="hsl(var(--primary))" strokeWidth={3} activeDot={{ r: 6 }} />
                                    <Line type="monotone" dataKey="logins" name="Unique Logins" stroke="#10b981" strokeWidth={3} />
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
                                    <div className="flex items-center gap-2"><span className="text-lg">{origin.flag}</span> <span className="font-bold">{origin.city}</span></div>
                                    <span className="font-mono text-xs text-muted-foreground">{origin.percent}%</span>
                                </div>
                            ))}
                            {(!data.traffic_origins || data.traffic_origins.length === 0) && (
                                <div className="text-xs text-muted-foreground text-center py-4 flex flex-col items-center justify-center h-full">
                                    <Globe className="w-8 h-8 text-muted/30 mb-2" />
                                    {t('dashboard.no_external_data', 'No external origin data available')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CENTRAL ONLY: Revenue, Cluster & Origin Data Row */}
            {isCentral && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-2xl md:rounded-[2.5rem] border border-border/50 bg-card/40 p-4 sm:p-6 backdrop-blur-md flex flex-col justify-between transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                                <CreditCard className="h-4 w-4 text-amber-500" /> {t('dashboard.revenue_intel', 'Revenue Intel')}
                            </div>
                            <Badge variant="outline" className="font-mono text-[9px]">USD</Badge>
                        </div>
                        <div>
                            <h3 className="text-4xl font-space font-black tracking-tighter">${(data.business?.mrr || 0).toLocaleString()}</h3>
                            <p className="text-xs text-muted-foreground mt-1">{t('dashboard.mrr_label', 'Monthly Recurring Revenue (MRR)')}</p>
                        </div>
                        <div className="mt-6 space-y-3">
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] font-bold uppercase"><span>{t('dashboard.enterprise', 'Enterprise')}</span><span>{data.business?.enterprise_pct || 0}%</span></div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${data.business?.enterprise_pct || 0}%` }} /></div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] font-bold uppercase"><span>{t('dashboard.business', 'Business')}</span><span>{data.business?.business_pct || 0}%</span></div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${data.business?.business_pct || 0}%` }} /></div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl md:rounded-[2.5rem] border border-border/50 bg-card/40 p-4 sm:p-6 backdrop-blur-md transition-all">
                        <div className="flex items-center justify-between mb-6">
                            <div className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                                <HardDrive className="h-4 w-4 text-indigo-500" /> {t('dashboard.cluster_health', 'Cluster Health')}
                            </div>
                            <div className="flex items-center gap-3">
                                <a href="https://hive-monitor.gulfingot.com" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold font-mono uppercase tracking-wider text-muted-foreground hover:text-rose-500 transition-colors flex items-center gap-1">
                                    Metrics <ChevronRight className="w-3 h-3" />
                                </a>
                                <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative rounded-full h-2 w-2 bg-emerald-500"></span></span>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:gap-4">
                            <div className="flex flex-col items-center justify-center p-2 sm:p-3 bg-background/50 rounded-xl sm:rounded-2xl border border-border/40">
                                <Database className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 mb-1 sm:mb-2" />
                                <span className="text-sm sm:text-lg font-bold font-mono">{data.cluster?.db_size || 'N/A'}</span>
                                <span className="text-[8px] sm:text-[9px] uppercase text-muted-foreground tracking-widest text-center">PGSQL Data</span>
                            </div>
                            <div className="flex flex-col items-center justify-center p-2 sm:p-3 bg-background/50 rounded-xl sm:rounded-2xl border border-border/40">
                                <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mb-1 sm:mb-2" />
                                <span className="text-sm sm:text-lg font-bold font-mono">{data.cluster?.redis_hits || 0}%</span>
                                <span className="text-[8px] sm:text-[9px] uppercase text-muted-foreground tracking-widest text-center">Redis Hits</span>
                            </div>
                            <div className="flex flex-col items-center justify-center p-2 sm:p-3 bg-background/50 rounded-xl sm:rounded-2xl border border-border/40">
                                <ActivitySquare className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500 mb-1 sm:mb-2" />
                                <span className="text-sm sm:text-lg font-bold font-mono">{data.cluster?.ws_connections || 0}</span>
                                <span className="text-[8px] sm:text-[9px] uppercase text-muted-foreground tracking-widest text-center">WS Conns</span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl md:rounded-[2.5rem] border border-border/50 bg-card/40 p-4 sm:p-6 backdrop-blur-md flex flex-col transition-all">
                        <div className="flex items-center justify-between mb-6">
                            <div className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                                <Globe className="h-4 w-4 text-blue-400" /> {t('dashboard.traffic_origins', 'Traffic Origins')}
                            </div>
                        </div>
                        <div className="space-y-4 flex-1">
                            {(data.traffic_origins || []).slice(0, 5).map((origin, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2"><span className="text-lg">{origin.flag}</span> <span className="font-bold">{origin.city}</span></div>
                                    <span className="font-mono text-xs text-muted-foreground">{origin.percent}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            <div className="grid gap-4 lg:grid-cols-12 mt-4 pb-20 sm:pb-10">
                {isCentral && canViewAlerts && (
                    <div className="lg:col-span-4 rounded-2xl md:rounded-[2.5rem] border border-red-500/20 bg-gradient-to-br from-red-500/5 to-background p-4 sm:p-6 flex flex-col overflow-hidden transition-all">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-red-500">
                                    <BellRing className="h-4 w-4" /> {t('dashboard.alerts', 'Alerts')}
                                </div>
                                <Badge className="bg-red-500 text-white hover:bg-red-600">{data.alerts?.length || 0}</Badge>
                            </div>
                            <Link href="/dashboard/alerts">
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
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
                                            <p className="text-sm font-bold text-foreground truncate">{alert.title}</p>
                                            <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap mt-0.5">
                                                {alert.time_ago}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 break-all">{alert.description}</p> 
                                    </div>
                                </div>
                            ))}
                            {(!data.alerts || data.alerts.length === 0) && (
                                <div className="text-xs text-muted-foreground text-center py-8">{t('alerts.all_systems_operational', 'All systems operational. No active alerts.')}</div>
                            )}
                        </div>
                    </div>
                )}

                {!isCentral && (canInviteUsers || canViewRoles || canViewPermissions) && (
                     <div className="lg:col-span-4 rounded-2xl md:rounded-[2.5rem] border border-border/50 bg-card/40 p-4 sm:p-6 backdrop-blur-md flex flex-col transition-all">
                        <div className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground mb-6">
                            <Zap className="h-4 w-4 text-amber-500" /> {t('dashboard.quick_actions', 'Quick Actions')}
                        </div>
                        <div className="flex flex-col gap-3 flex-1">
                            {canInviteUsers && (
                                <Button onClick={() => router.push('/dashboard/security?tab=users')} variant="outline" className="h-14 w-full justify-start rounded-2xl bg-background/50 hover:bg-primary/5 hover:border-primary/30 transition-all group">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                                        <UserPlus className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="text-sm font-bold">Invite Operator</p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest mt-0.5">{t('dashboard.manage_access', 'Manage Access')}</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                </Button>
                            )}
                            
                            {canViewRoles && (
                                <Button onClick={() => router.push('/dashboard/security?tab=roles')} variant="outline" className="h-14 w-full justify-start rounded-2xl bg-background/50 hover:bg-emerald-500/5 hover:border-emerald-500/30 transition-all group">
                                    <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="text-sm font-bold">{t('dashboard.configure_roles', 'Configure Roles')}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest mt-0.5">{t('dashboard.access_matrices', 'Access Matrices')}</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                </Button>
                            )}

                            {canViewPermissions && (
                                <Button onClick={() => router.push('/dashboard/security?tab=permissions')} variant="outline" className="h-14 w-full justify-start rounded-2xl bg-background/50 hover:bg-blue-500/5 hover:border-blue-500/30 transition-all group">
                                    <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                                        <Key className="h-4 w-4 text-blue-500" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="text-sm font-bold">{t('dashboard.review_permissions', 'Review Permissions')}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest mt-0.5">{t('dashboard.capability_ledger', 'Capability Ledger')}</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                </Button>
                            )}
                        </div>
                     </div>
                )}

                {canViewLogs && (
                    <div id="tour-body-audit" className={cn("rounded-2xl md:rounded-[2.5rem] border border-border/50 bg-card/40 p-4 sm:p-6 backdrop-blur-md transition-all", (isCentral ? canViewAlerts : (canInviteUsers || canViewRoles || canViewPermissions)) ? "lg:col-span-8" : "lg:col-span-12")}>
                        <div className="flex items-center justify-between mb-6">
                            <div className="text-sm font-bold flex items-center gap-3 uppercase tracking-widest text-muted-foreground">
                                <Activity className="h-4 w-4 text-primary" /> 
                                {isCentral ? t('dashboard.live_system_audit', 'Live System Audit') : t('dashboard.live_node_audit', 'Live Node Audit')}
                            </div>
                            <Link href="/dashboard/audit-logs">
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
                                    {t('dashboard.show_more', 'Show More')} <ChevronRight className="w-3 h-3 ml-1" />
                                </Button>
                            </Link>
                        </div>
                        <div className="space-y-3">
                            {(data.recent_activity || []).slice(0, 5).map((log, index) => {
                                let causerName = log.properties?.causer_name || log.causer?.name || log.causer || 'System';
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
                                                <p className="text-[10px] font-mono text-muted-foreground uppercase flex items-center gap-1.5 mt-0.5">
                                                    {isCentral && (
                                                        <span className="bg-primary/20 text-primary px-1.5 rounded-sm font-bold tracking-widest">
                                                            [{nodeLabel}]
                                                        </span>
                                                    )}
                                                    {log.event} - {log.time || log.time_ago || 'Just now'}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="font-mono text-[10px] uppercase">
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
                {trend === 'up' && <Badge className="bg-emerald-500/10 text-emerald-500 border-none text-[10px] animate-pulse hidden sm:flex">+ {t('dashboard.live', 'LIVE')}</Badge>}
            </div>
            <div className="relative z-10">
                <h3 className="text-2xl sm:text-3xl font-space font-black tracking-tighter tabular-nums">{value}</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
                <p className="text-[10px] text-muted-foreground font-mono mt-1 opacity-80">{subtext}</p>
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

