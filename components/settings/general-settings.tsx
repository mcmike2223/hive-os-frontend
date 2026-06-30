"use client";

import React, { useState, useEffect } from 'react';
import { 
    Loader2, CheckCircle2, Headset, Globe2, Sliders, AlertTriangle, 
    Clock, HardDrive, Mail, UserPlus, ShieldCheck, Activity 
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from '@/store/use-translation';
import { cn } from "@/lib/utils";
import { getAccessToken, getBackendApiRoot, getWorkspaceScopeKey, isTenantSession } from "@/lib/runtime-context";

// ==========================================
// 🚀 BULLETPROOF API ROUTING & FETCH WRAPPER
// ==========================================
const getApiUrl = () => {
    return getBackendApiRoot();
};

const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const token = getAccessToken();
    const url = `${getApiUrl()}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    const headers: HeadersInit = {
        'Accept': 'application/json',
        ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {})
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP Error ${res.status}`);
    }

    return res.json();
};

// ==========================================
// ⚙️ GENERAL SETTINGS COMPONENT
// ==========================================
export function GeneralSettings() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [isTenantNode, setIsTenantNode] = useState<boolean | null>(null);
    const workspaceScope = getWorkspaceScopeKey();

    const [formData, setFormData] = useState({
        support_email: '',
        support_phone: '',
        system_email_name: '',
        system_email_address: '',
        default_timezone: 'UTC',
        default_currency: 'USD',
        date_format: 'YYYY-MM-DD',
        time_format: '24h',
        max_upload_size: 10,
        max_upload_unit: 'MB',
        session_timeout_minutes: 120,
        maintenance_mode: false,
        maintenance_message: '', 
        enable_registration: false,
        require_2fa: false,
    });

    const { data: settingsData, isLoading: isFetching } = useQuery({
        queryKey: ['globalSystemSettings', workspaceScope],
        queryFn: () => apiFetch('/settings/general'),
    });

    useEffect(() => {
        if (settingsData?.data) {
            const sanitizedData = { ...settingsData.data };
            Object.keys(sanitizedData).forEach(key => { if (sanitizedData[key] === null) sanitizedData[key] = ''; });
            setFormData(prev => ({ ...prev, ...sanitizedData }));
        }
    }, [settingsData]);

    useEffect(() => {
        setIsTenantNode(isTenantSession());
    }, []);

    const saveSettingsMut = useMutation({
        mutationFn: () => {
            const { maintenance_mode, maintenance_message, ...tenantPayload } = formData;
            const payload = isTenantNode === true ? tenantPayload : formData;

            return apiFetch('/settings/general', { method: 'POST', body: JSON.stringify(payload) });
        },
        onSuccess: () => {
            toast.success(t('settings.general_updated', "System Configuration Updated Successfully!"));
            queryClient.invalidateQueries({ queryKey: ['globalSystemSettings'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    const handleToggle = (key: keyof typeof formData) => {
        setFormData(prev => ({ ...prev, [key]: !prev[key as keyof typeof formData] }));
    };

    if (isFetching) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <div className="pb-24 space-y-6">
            
            {/* 🎧 COMMUNICATION & SUPPORT */}
            <div id="tour-settings-general-contact" className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm transition-all animate-in fade-in slide-in-from-bottom-2">
                <div className="mb-8 flex items-center gap-3">
                    <div className="h-10 w-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500"><Headset className="h-5 w-5" /></div>
                    <div>
                        <h2 className="text-2xl font-space font-black tracking-tight text-foreground">{t('settings.communications', 'Communication & Support')}</h2>
                        <p className="text-sm text-muted-foreground mt-1">{t('settings.communications_desc', 'Publicly facing support details and system email sender configurations.')}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 pb-6 border-b border-border/50">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1 flex items-center gap-2"><Mail className="h-3 w-3"/> {t('settings.system_email_name', 'System Sender Name')}</Label>
                        <Input value={formData.system_email_name} onChange={(e) => setFormData(prev => ({...prev, system_email_name: e.target.value}))} placeholder="HIVE.OS Support" className="bg-muted/30 h-12 rounded-xl focus-visible:ring-primary" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">{t('settings.system_email_address', 'System Sender Address')}</Label>
                        <Input type="email" value={formData.system_email_address} onChange={(e) => setFormData(prev => ({...prev, system_email_address: e.target.value}))} placeholder="noreply@domain.com" className="bg-muted/30 h-12 rounded-xl focus-visible:ring-primary" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">{t('settings.support_email', 'Public Support Email')}</Label>
                        <Input type="email" value={formData.support_email} onChange={(e) => setFormData(prev => ({...prev, support_email: e.target.value}))} placeholder="support@domain.com" className="bg-muted/30 h-12 rounded-xl focus-visible:ring-primary" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">{t('settings.support_phone', 'Public Support Phone')}</Label>
                        <Input type="tel" value={formData.support_phone} onChange={(e) => setFormData(prev => ({...prev, support_phone: e.target.value}))} placeholder="+1 (555) 000-0000" className="bg-muted/30 h-12 rounded-xl focus-visible:ring-primary font-mono" />
                    </div>
                </div>
            </div>

            {/* 🌍 REGIONAL & LOCALE */}
            <div id="tour-settings-general-regional" className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm transition-all animate-in fade-in slide-in-from-bottom-4">
                <div className="mb-6 flex items-center gap-3">
                    <div className="h-10 w-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500"><Globe2 className="h-5 w-5" /></div>
                    <div>
                        <h2 className="text-2xl font-space font-black tracking-tight text-foreground">{t('settings.regional_defaults', 'Regional Defaults')}</h2>
                        <p className="text-sm text-muted-foreground mt-1">{t('settings.regional_defaults_desc', 'Establish the baseline timezones and financial formatting for this node.')}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 bg-muted/20 border border-border/50 rounded-2xl divide-y lg:divide-y-0 lg:divide-x divide-border/50 shadow-inner overflow-hidden mt-4">
                    <div className="p-3 py-2 flex flex-col gap-1 hover:bg-muted/30 transition-colors">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2 pt-1">{t('settings.timezone', 'System Timezone')}</Label>
                        <Select value={formData.default_timezone} onValueChange={(val) => setFormData(prev => ({...prev, default_timezone: val}))}>
                            <SelectTrigger className="border-none bg-transparent shadow-none h-9 focus:ring-0 focus:ring-offset-0 text-sm font-mono w-full"><SelectValue placeholder="Select timezone" /></SelectTrigger>
                            <SelectContent className="rounded-xl border-border/50">
                                <SelectItem value="UTC">UTC (Universal Time)</SelectItem>
                                <SelectItem value="Africa/Addis_Ababa">EAT (East Africa Time)</SelectItem>
                                <SelectItem value="America/New_York">EST/EDT (US East)</SelectItem>
                                <SelectItem value="Europe/London">GMT (London)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="p-3 py-2 flex flex-col gap-1 hover:bg-muted/30 transition-colors">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2 pt-1">{t('settings.currency', 'Default Currency')}</Label>
                        <Select value={formData.default_currency} onValueChange={(val) => setFormData(prev => ({...prev, default_currency: val}))}>
                            <SelectTrigger className="border-none bg-transparent shadow-none h-9 focus:ring-0 focus:ring-offset-0 text-sm font-mono w-full"><SelectValue placeholder="Select currency" /></SelectTrigger>
                            <SelectContent className="rounded-xl border-border/50">
                                <SelectItem value="USD">USD ($) - US Dollar</SelectItem>
                                <SelectItem value="ETB">ETB (Br) - Ethiopian Birr</SelectItem>
                                <SelectItem value="EUR">EUR (€) - Euro</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="p-3 py-2 flex flex-col gap-1 hover:bg-muted/30 transition-colors">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2 pt-1">{t('settings.date_format', 'Date Format')}</Label>
                        <Select value={formData.date_format} onValueChange={(val) => setFormData(prev => ({...prev, date_format: val}))}>
                            <SelectTrigger className="border-none bg-transparent shadow-none h-9 focus:ring-0 focus:ring-offset-0 text-sm font-mono w-full"><SelectValue placeholder="Select format" /></SelectTrigger>
                            <SelectContent className="rounded-xl border-border/50 font-mono">
                                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2025-12-31)</SelectItem>
                                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (31/12/2025)</SelectItem>
                                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (12/31/2025)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="p-3 py-2 flex flex-col gap-1 hover:bg-muted/30 transition-colors">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2 pt-1">{t('settings.time_format', 'Time Format')}</Label>
                        <Select value={formData.time_format} onValueChange={(val) => setFormData(prev => ({...prev, time_format: val}))}>
                            <SelectTrigger className="border-none bg-transparent shadow-none h-9 focus:ring-0 focus:ring-offset-0 text-sm font-mono w-full"><SelectValue placeholder="Select time format" /></SelectTrigger>
                            <SelectContent className="rounded-xl border-border/50 font-mono">
                                <SelectItem value="12h">12-Hour (02:30 PM)</SelectItem>
                                <SelectItem value="24h">24-Hour (14:30)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* 🛡️ ACCESS & SECURITY */}
            <div id="tour-settings-general-access" className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm transition-all animate-in fade-in slide-in-from-bottom-5">
                <div className="mb-8 flex items-center gap-3">
                    <div className="h-10 w-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500"><ShieldCheck className="h-5 w-5" /></div>
                    <div>
                        <h2 className="text-2xl font-space font-black tracking-tight text-foreground">{t('settings.access_control', 'Global Access Control')}</h2>
                        <p className="text-sm text-muted-foreground mt-1">{t('settings.access_control_desc', 'Manage how users register and authenticate to the system.')}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div onClick={() => handleToggle('enable_registration')} className={cn("flex items-center gap-4 p-4 rounded-xl border transition-colors duration-300 cursor-pointer select-none", formData.enable_registration ? "bg-purple-500/10 border-purple-500/30" : "bg-muted/30 border-border/50 hover:bg-muted/50")}>
                        <div className="h-10 w-10 bg-background rounded-lg flex items-center justify-center shrink-0 border border-border/50"><UserPlus className={cn("h-5 w-5 transition-colors", formData.enable_registration ? "text-purple-500" : "text-muted-foreground")} /></div>
                        <div className="flex-1 space-y-0.5">
                            <Label className="text-sm font-bold cursor-pointer block">{t('settings.enable_registration', 'Allow Public Registration')}</Label>
                            <p className="text-[10px] text-muted-foreground leading-tight">{t('settings.registration_desc', 'If enabled, users can create their own accounts from the login page.')}</p>
                        </div>
                        <Switch checked={formData.enable_registration} className="data-[state=checked]:bg-purple-500 pointer-events-none" />
                    </div>

                    <div onClick={() => handleToggle('require_2fa')} className={cn("flex items-center gap-4 p-4 rounded-xl border transition-colors duration-300 cursor-pointer select-none", formData.require_2fa ? "bg-amber-500/10 border-amber-500/30" : "bg-muted/30 border-border/50 hover:bg-muted/50")}>
                        <div className="h-10 w-10 bg-background rounded-lg flex items-center justify-center shrink-0 border border-border/50"><ShieldCheck className={cn("h-5 w-5 transition-colors", formData.require_2fa ? "text-amber-500" : "text-muted-foreground")} /></div>
                        <div className="flex-1 space-y-0.5">
                            <Label className="text-sm font-bold cursor-pointer block">{t('settings.require_2fa', 'Enforce Global 2FA')}</Label>
                            <p className="text-[10px] text-muted-foreground leading-tight">{t('settings.require_2fa_desc', 'Force all operators to configure Two-Factor Authentication.')}</p>
                        </div>
                        <Switch checked={formData.require_2fa} className="data-[state=checked]:bg-amber-500 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* ⚙️ OPERATIONAL CONSTRAINTS */}
            <div id="tour-settings-general-ops" className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm transition-all animate-in fade-in slide-in-from-bottom-6">
                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500"><Sliders className="h-5 w-5" /></div>
                        <div>
                            <h2 className="text-2xl font-space font-black tracking-tight text-foreground">{t('settings.operational_limits', 'Operational Limits')}</h2>
                            <p className="text-sm text-muted-foreground mt-1">{t('settings.operational_limits_desc', 'Define system boundaries, timeouts, and maintenance protocols.')}</p>
                        </div>
                    </div>

                    {isTenantNode === false && (
                        <div onClick={() => handleToggle('maintenance_mode')} className={cn("flex items-center gap-3 p-3 pl-4 rounded-xl border transition-colors duration-300 cursor-pointer select-none", formData.maintenance_mode ? "bg-destructive/10 border-destructive/30 hover:bg-destructive/20" : "bg-muted/50 border-border/50 hover:bg-muted/80")}>
                            <div className="space-y-0.5 pr-2">
                                <Label className="text-xs font-bold cursor-pointer flex items-center gap-2">
                                    {formData.maintenance_mode && <AlertTriangle className="h-3 w-3 text-destructive animate-pulse" />}
                                    {t('settings.maintenance_mode', 'Maintenance Mode')}
                                </Label>
                                <p className="text-[10px] text-muted-foreground">{t('settings.maintenance_desc', 'Lock out non-admin operators')}</p>
                            </div>
                            <Switch checked={formData.maintenance_mode} className="data-[state=checked]:bg-destructive pointer-events-none" />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1 flex items-center gap-2">
                            <HardDrive className="h-3 w-3" /> {t('settings.max_upload', 'Max Upload Size')}
                        </Label>
                        <div className="flex items-center gap-2">
                            <Input type="number" min="1" value={formData.max_upload_size} onChange={(e) => setFormData(prev => ({...prev, max_upload_size: parseInt(e.target.value) || 10}))} className="bg-muted/30 h-12 rounded-xl focus-visible:ring-primary font-mono flex-1" />
                            <Select value={formData.max_upload_unit} onValueChange={(val) => setFormData(prev => ({...prev, max_upload_unit: val}))}>
                                <SelectTrigger className="bg-muted/30 h-12 rounded-xl focus:ring-primary font-bold w-24 shrink-0"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-xl border-border/50">
                                    <SelectItem value="KB">KB</SelectItem>
                                    <SelectItem value="MB">MB</SelectItem>
                                    <SelectItem value="GB">GB</SelectItem>
                                    <SelectItem value="TB">TB</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <p className="text-[10px] text-muted-foreground pl-1">{t('settings.max_upload_hint', 'Hard limit for file manager uploads.')}</p>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1 flex items-center gap-2">
                            <Clock className="h-3 w-3" /> {t('settings.session_timeout', 'Session Timeout (Minutes)')}
                        </Label>
                        <Input type="number" min="1" max="1440" value={formData.session_timeout_minutes} onChange={(e) => setFormData(prev => ({...prev, session_timeout_minutes: parseInt(e.target.value) || 120}))} className="bg-muted/30 h-12 rounded-xl focus-visible:ring-primary font-mono" />
                        <p className="text-[10px] text-muted-foreground pl-1">{t('settings.session_timeout_hint', 'Auto-logout idle operators for security.')}</p>
                    </div>

                    {/* 🚀 CONDITIONAL: LIVE STATUS TICKER INPUT (Only shows when Maintenance Mode is ON) */}
                    {isTenantNode === false && formData.maintenance_mode && (
                        <div className="space-y-2 md:col-span-2 mt-4 pt-6 border-t border-border/50 animate-in fade-in slide-in-from-top-4 duration-500">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-destructive pl-1 flex items-center gap-2">
                                <Activity className="h-3 w-3 animate-pulse" /> {t('settings.maintenance_message', 'Live Status Ticker Message')}
                            </Label>
                            <Input 
                                value={formData.maintenance_message} 
                                onChange={(e) => setFormData(prev => ({...prev, maintenance_message: e.target.value}))} 
                                placeholder="E.g. Database migration in progress... 45% complete." 
                                className="bg-destructive/5 h-12 rounded-xl border-destructive/30 focus-visible:ring-destructive font-mono text-xs placeholder:text-destructive/40 text-destructive" 
                            />
                            <p className="text-[10px] text-muted-foreground pl-1 text-destructive/70">This message broadcasts live across the system to all locked-out users.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* 💾 FLOATING SAVE BUTTON */}
            <div id="tour-settings-save" className="fixed bottom-6 right-6 left-6 md:left-[320px] flex justify-end p-4 rounded-[2rem] bg-card/80 backdrop-blur-xl border border-border/50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 animate-in slide-in-from-bottom-12 duration-700">
                <Button onClick={() => saveSettingsMut.mutate()} disabled={saveSettingsMut.isPending} className="rounded-xl px-12 font-bold shadow-xl bg-primary text-primary-foreground hover:bg-primary/90 h-12 transition-all hover:scale-[1.02] text-base tracking-wide">
                    {saveSettingsMut.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                    {t('settings.commit_changes', 'Commit Configurations')}
                </Button>
            </div>
        </div>
    );
}
