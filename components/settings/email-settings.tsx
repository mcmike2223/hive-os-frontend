"use client";

import React, { useState, useEffect } from 'react';
import { Mail, Server, Shield, Loader2, Send } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from '@/store/use-translation';
import { getBackendApiRoot, getAuthHeaders, getTenantId, getWorkspaceScopeKey } from "@/lib/runtime-context";
import { SettingsPanelSkeleton } from "@/components/ui/loading-states";

const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const url = `${getBackendApiRoot()}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: HeadersInit = getAuthHeaders(
        options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}
    );
    const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "API Request Failed");
    }
    return res.json();
};

export function EmailSettings() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const workspaceScope = getWorkspaceScopeKey();

    const [formData, setFormData] = useState({
        mail_driver: 'smtp',
        mail_host: '',
        mail_port: 587,
        mail_username: '',
        mail_password: '',
        mail_encryption: 'tls',
        mail_from_address: '',
        mail_from_name: '',
        mail_storage_quota_central_users: 1024,
        mail_storage_quota_tenant_default: 5120,
        mail_storage_quota_tenant_users: 1024,
    });

    const { data: settingsData, isLoading } = useQuery({
        queryKey: ['emailSettings', workspaceScope],
        queryFn: () => apiFetch('/settings/email'),
    });

    useEffect(() => {
        if (settingsData?.data) {
            const sanitizedData = { ...settingsData.data };
            Object.keys(sanitizedData).forEach(k => { 
                if (sanitizedData[k] === null) sanitizedData[k] = '';
                if (k === 'mail_port' && sanitizedData[k]) sanitizedData[k] = parseInt(sanitizedData[k], 10);
            });
            setFormData(prev => ({ ...prev, ...sanitizedData }));
        }
    }, [settingsData]);

    const saveMut = useMutation({
        mutationFn: () => apiFetch('/settings/email', { method: 'POST', body: JSON.stringify(formData) }),
        onSuccess: () => {
            toast.success(t('settings.email_updated', "Email Server Configurations Synchronized!"));
            queryClient.invalidateQueries({ queryKey: ['emailSettings'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    if (isLoading) return <SettingsPanelSkeleton />;

    return (
        <div className="pb-24 space-y-6 transition-all animate-in fade-in slide-in-from-bottom-2 duration-500">
            
            {/* 🌐 CONNECTION SETTINGS */}
            <div className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-xl shadow-sm hover:shadow-md hover:bg-card/60 transition-all duration-300">
                <div className="mb-8 flex items-center gap-3">
                    <div className="h-10 w-10 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl flex items-center justify-center text-indigo-500 shadow-inner"><Server className="h-5 w-5" /></div>
                    <div>
                        <h2 className="text-2xl font-space font-black tracking-tight text-foreground">{t('settings.email_server', 'Mail Server Profile')}</h2>
                        <p className="text-sm text-muted-foreground mt-1">{t('settings.email_server_desc', 'Determine the mail transfer protocol and connection details for system dispatchers.')}</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">{t('settings.mail_driver', 'Transport Driver')}</Label>
                        <Select value={formData.mail_driver} onValueChange={(v) => setFormData(p => ({...p, mail_driver: v}))}>
                            <SelectTrigger className="bg-muted/30 h-12 rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="smtp">SMTP</SelectItem>
                                <SelectItem value="sendmail">Sendmail</SelectItem>
                                <SelectItem value="mailgun">Mailgun</SelectItem>
                                <SelectItem value="postmark">Postmark</SelectItem>
                                <SelectItem value="ses">Amazon SES</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">{t('settings.mail_host', 'Mail Host')}</Label>
                        <Input value={formData.mail_host} onChange={e => setFormData(p => ({...p, mail_host: e.target.value}))} className="bg-muted/30 h-12 rounded-xl font-mono" placeholder="smtp.mailtrap.io" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">{t('settings.mail_port', 'Port')}</Label>
                        <Input type="number" value={formData.mail_port} onChange={e => setFormData(p => ({...p, mail_port: parseInt(e.target.value)||587}))} className="bg-muted/30 h-12 rounded-xl font-mono" placeholder="587" />
                    </div>
                </div>
            </div>

            {/* 🛡️ CREDENTIALS & SECURITY */}
            <div className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm hover:shadow-md hover:bg-card/60 transition-all duration-300">
                <div className="mb-8 flex items-center gap-3">
                    <div className="h-10 w-10 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl flex items-center justify-center text-amber-500 shadow-inner"><Shield className="h-5 w-5" /></div>
                    <div>
                        <h2 className="text-2xl font-space font-black tracking-tight text-foreground">{t('settings.email_auth', 'Authentication Nodes')}</h2>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">{t('settings.mail_username', 'Username')}</Label>
                        <Input value={formData.mail_username} onChange={e => setFormData(p => ({...p, mail_username: e.target.value}))} className="bg-muted/30 h-12 rounded-xl font-mono" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">{t('settings.mail_password', 'Password')}</Label>
                        <Input type="password" value={formData.mail_password} onChange={e => setFormData(p => ({...p, mail_password: e.target.value}))} className="bg-muted/30 h-12 rounded-xl font-mono" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">{t('settings.mail_encryption', 'Encryption')}</Label>
                        <Select value={formData.mail_encryption} onValueChange={(v) => setFormData(p => ({...p, mail_encryption: v}))}>
                            <SelectTrigger className="bg-muted/30 h-12 rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="tls">TLS</SelectItem>
                                <SelectItem value="ssl">SSL</SelectItem>
                                <SelectItem value="null">None</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* 📨 ENVELOPE SENDER */}
            <div className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm hover:shadow-md hover:bg-card/60 transition-all duration-300">
                <div className="mb-8 flex items-center gap-3">
                    <div className="h-10 w-10 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl flex items-center justify-center text-emerald-500 shadow-inner"><Send className="h-5 w-5" /></div>
                    <div>
                        <h2 className="text-2xl font-space font-black tracking-tight text-foreground">{t('settings.email_envelope', 'Envelope Addresses')}</h2>
                        <p className="text-sm text-muted-foreground mt-1">{t('settings.email_envelope_desc', 'Global fallback overrides for out-bound communications.')}</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">{t('settings.mail_from_address', 'From Address')}</Label>
                        <Input value={formData.mail_from_address} onChange={e => setFormData(p => ({...p, mail_from_address: e.target.value}))} className="bg-muted/30 h-12 rounded-xl" placeholder="noreply@hive-os.com" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">{t('settings.mail_from_name', 'From Name')}</Label>
                        <Input value={formData.mail_from_name} onChange={e => setFormData(p => ({...p, mail_from_name: e.target.value}))} className="bg-muted/30 h-12 rounded-xl" placeholder="HIVE.OS Mailer" />
                    </div>
                </div>
            </div>

            {/* 💾 STORAGE QUOTAS */}
            <div className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm hover:shadow-md hover:bg-card/60 transition-all duration-300">
                <div className="mb-8 flex items-center gap-3">
                    <div className="h-10 w-10 bg-gradient-to-br from-rose-500/20 to-pink-500/20 rounded-xl flex items-center justify-center text-rose-500 shadow-inner"><Server className="h-5 w-5 opacity-80" /></div>
                    <div>
                        <h2 className="text-2xl font-space font-black tracking-tight text-foreground">{t('settings.storage_quotas', 'Storage Quota Allocations')}</h2>
                        <p className="text-sm text-muted-foreground mt-1">{t('settings.storage_quotas_desc', 'Quotas are derived from subscription plan. Override any plan below (in MB). Leave blank to use plan defaults.')}</p>
                    </div>
                </div>

                {!getTenantId() ? (
                    /* ── Central Super Admin View ── */
                    <div className="space-y-6">
                        {/* Central user quota */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">{t('settings.mail_storage_quota_central_users', 'Central User Mailbox Quota (MB)')}</Label>
                            <Input type="number" value={formData.mail_storage_quota_central_users} onChange={e => setFormData(p => ({...p, mail_storage_quota_central_users: parseInt(e.target.value)||0}))} className="bg-muted/30 h-12 rounded-xl" placeholder="1024" />
                            <p className="text-xs text-muted-foreground">Per-user limit for users on the central node.</p>
                        </div>

                        {/* Per-plan tenant quota overrides */}
                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Tenant Org Quota by Plan (MB)</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[
                                    { key: 'mail_storage_quota_tenant_larva',      plan: 'Larva',      default: 512,    color: 'text-slate-500',   bg: 'bg-slate-500/10' },
                                    { key: 'mail_storage_quota_tenant_startup',    plan: 'Startup',    default: 2048,   color: 'text-sky-500',     bg: 'bg-sky-500/10' },
                                    { key: 'mail_storage_quota_tenant_business',   plan: 'Business',   default: 10240,  color: 'text-indigo-500',  bg: 'bg-indigo-500/10' },
                                    { key: 'mail_storage_quota_tenant_enterprise', plan: 'Enterprise', default: 51200,  color: 'text-violet-500',  bg: 'bg-violet-500/10' },
                                    { key: 'mail_storage_quota_tenant_overlord',   plan: 'Overlord',   default: 204800, color: 'text-amber-500',   bg: 'bg-amber-500/10' },
                                ].map(({ key, plan, default: def, color, bg }) => (
                                    <div key={key} className={`p-4 rounded-2xl border border-border/40 ${bg} space-y-2`}>
                                        <div className="flex items-center justify-between">
                                            <Label className={`text-[11px] font-black uppercase tracking-wide ${color}`}>{plan}</Label>
                                            <span className="text-[10px] text-muted-foreground/60">default: {def.toLocaleString()} MB</span>
                                        </div>
                                        <Input
                                            type="number"
                                            value={(formData as any)[key] || ''}
                                            onChange={e => setFormData(p => ({...p, [key]: parseInt(e.target.value)||0}))}
                                            className="bg-white/50 dark:bg-background/50 h-11 rounded-xl font-mono text-sm"
                                            placeholder={`${def} MB (plan default)`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── Tenant Admin View ── */
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">{t('settings.mail_storage_quota_tenant_users', 'Per-User Mailbox Quota (MB)')}</Label>
                        <Input type="number" value={formData.mail_storage_quota_tenant_users} onChange={e => setFormData(p => ({...p, mail_storage_quota_tenant_users: parseInt(e.target.value)||0}))} className="bg-muted/30 h-12 rounded-xl" placeholder="1024" />
                        <p className="text-xs text-muted-foreground">Maximum mailbox size per user in your organization. Cannot exceed your plan's total org quota.</p>
                    </div>
                )}
            </div>

            <div className="fixed bottom-6 right-6 left-6 md:left-[320px] flex justify-end p-4 rounded-[2rem] bg-card/80 backdrop-blur-xl border border-border/50 shadow-2xl z-50">
                <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="rounded-xl px-12 font-bold bg-primary text-primary-foreground h-12 hover:scale-105 transition-all">
                    {saveMut.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : t('settings.commit_configs', 'Commit Configurations')}
                </Button>
            </div>
        </div>
    );
}
