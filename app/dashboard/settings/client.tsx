"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { 
    Loader2, Palette, Shield, Settings, Globe, Bell, Headset, 
    Globe2, Sliders, AlertTriangle, Clock, HardDrive, HelpCircle, 
    Image as ImageIcon, Upload, CheckCircle2, X, Activity, Mail, UserPlus, ShieldCheck,
    CreditCard, Database, Sparkles, LayoutTemplate, Search
} from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from '@/store/use-translation';
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import {
    extractStorageRelativePath,
    getAuthHeaders,
    getBackendApiRoot,
    getBackendStorageUrl,
    getWorkspaceScopeKey,
    isTenantSession,
} from "@/lib/runtime-context";
import { applyBrandRuntime, normalizeBrandHex, resolveBrandFontStack } from "@/lib/brand-theme";
import { SettingsPanelSkeleton, SettingsWorkspaceSkeleton } from "@/components/ui/loading-states";
import { Skeleton } from "@/components/ui/skeleton";

// Modules
import { LocalizationManager } from '@/components/settings/localization-manager';
import { FileManagerClient } from "@/components/dashboard/file-manager-client"; 
import { BackupSettings } from '@/components/settings/backup-settings'; 
import { EmailSettings } from '@/components/settings/email-settings';
import { PaymentSettings } from '@/components/settings/payment-settings';
import { PlanSettings } from '@/components/settings/plan-settings';
import { TenantLandingSettings } from '@/components/settings/tenant-landing-settings';
import SeoSettings from '@/components/settings/seo-settings';
import { useChatStore } from '@/store/chat-store';
import { useMailStore } from '@/store/mail-store';

const toErrorMessage = (value: unknown, fallback = "Something went wrong."): string => {
    if (value instanceof Error && typeof value.message === "string" && value.message.trim()) {
        return value.message;
    }

    if (typeof value === "string" && value.trim()) {
        return value;
    }

    if (typeof value === "object" && value !== null) {
        const candidate = value as { message?: unknown; error?: unknown };

        if (typeof candidate.message === "string" && candidate.message.trim()) {
            return candidate.message;
        }

        if (typeof candidate.error === "string" && candidate.error.trim()) {
            return candidate.error;
        }
    }

    return fallback;
};

// ==========================================
// 🚀 1. UTILITIES & FETCH HELPERS
// ==========================================
const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const url = `${getBackendApiRoot()}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: HeadersInit = getAuthHeaders(
        options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}
    );
    const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
    if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message = typeof payload?.message === "string" && payload.message.trim()
            ? payload.message
            : typeof payload?.error === "string" && payload.error.trim()
                ? payload.error
                : `API request failed with status ${res.status}.`;
        throw new Error(message);
    }
    return res.json();
};

const createInitialBrandForm = () => ({
    logo_light: '',
    logo_dark: '',
    favicon: '',
    sidebar_icon: '',
    app_title: '',
    footer_text: '',
    primary_color: '#10b981',
    auth_background_image: '',
    auth_welcome_message: '',
    font_family: 'Inter',
    meta_description: '',
    og_image: '',
    hide_watermark: false,
    document_header_color: '#1e293b',
    company_tax_id: '',
    pdf_logo: ''
});

type BrandFormData = ReturnType<typeof createInitialBrandForm>;

const BRAND_FONT_OPTIONS = [
    { value: 'Inter', label: 'Inter' },
    { value: 'Space Grotesk', label: 'Space Grotesk' },
    { value: 'JetBrains Mono', label: 'JetBrains Mono' },
    { value: 'System UI', label: 'System UI' },
];

const BRAND_THEME_PRESETS = [
    { label: 'Emerald Core', primary: '#10b981', document: '#1e293b', font: 'Inter' },
    { label: 'Solar Gold', primary: '#eab308', document: '#111827', font: 'Space Grotesk' },
    { label: 'Signal Blue', primary: '#2563eb', document: '#0f172a', font: 'Inter' },
    { label: 'Neon Rose', primary: '#ec4899', document: '#312e81', font: 'Space Grotesk' },
];

// ============================================================================
// 🚀 SECURE BRAND ASSET & MODAL (Brand Settings Helpers)
// ============================================================================
const SecureBrandAsset = ({ path, previewUrl, lastSaved, fallbackText, className, isWide }: any) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [isFetching, setIsFetching] = useState(true); 

    useEffect(() => {
        if (previewUrl) { setBlobUrl(previewUrl); setIsFetching(false); return; }
        if (!path) { setBlobUrl(null); setIsFetching(false); return; }

        const resolvedUrl = getBackendStorageUrl(path);
        if (!resolvedUrl) { setBlobUrl(null); setIsFetching(false); return; }

        let isMounted = true;
        const fetchSecureAsset = async () => {
            setIsFetching(true);
            try {
                const res = await fetch(`${resolvedUrl}?cb=${lastSaved}`, {
                    headers: getAuthHeaders()
                });
                if (!res.ok) throw new Error(`Backend returned ${res.status}`);
                
                const contentType = res.headers.get('content-type');
                if (!contentType?.startsWith('image/')) throw new Error(`Expected image`);

                const blob = await res.blob();
                if (isMounted) setBlobUrl(URL.createObjectURL(blob));
            } catch (err) {
                if (isMounted) setBlobUrl(`${resolvedUrl}?cb=${lastSaved}`);
            } finally {
                if (isMounted) setIsFetching(false);
            }
        };

        fetchSecureAsset();
        return () => { isMounted = false; };
    }, [path, previewUrl, lastSaved]);

    if (isFetching && !blobUrl) return <Skeleton className="h-full w-full rounded-xl bg-muted/60" />;
    if (blobUrl) return <img src={blobUrl} alt="Brand Asset" className={cn("transition-all duration-500 group-hover:scale-105", className, isWide ? "object-cover w-full h-full p-0" : "object-contain p-2")} />;
    return <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{fallbackText}</span>;
};

function BrandAssetPickerModal({ isOpen, onClose, onSelect, access }: { isOpen: boolean, onClose: () => void, onSelect: (url: string) => void, access: { canRead: boolean; canManage: boolean } }) {
    const { t } = useTranslation();
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-6xl w-[95vw] h-[85vh] p-0 overflow-hidden rounded-[2.5rem] bg-background border-border/50 shadow-2xl flex flex-col gap-0 z-[1000]">
                <DialogTitle className="sr-only">Select Brand Asset</DialogTitle>
                <div className="px-8 py-5 border-b border-border/50 bg-card/40 backdrop-blur-xl shrink-0 flex items-center justify-between z-10">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><ImageIcon className="h-5 w-5 text-primary" /></div>
                        <div>
                            <h2 className="text-lg font-black tracking-tight text-foreground">{t('settings.brand_asset_picker', 'Brand Asset Picker')}</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">{t('settings.brand_asset_picker_desc', 'Select or upload an image to update your identity matrix.')}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full"><X className="h-4 w-4" /></Button>
                </div>
                <div className="flex-1 overflow-hidden relative bg-muted/10 file-picker-wrapper p-4 sm:p-6">
                    <style dangerouslySetInnerHTML={{__html: `
                        .file-picker-wrapper > div > div:nth-child(1) { display: none !important; }
                        .file-picker-wrapper > div > div:nth-child(2) > div:nth-child(2) { display: none !important; }
                        .file-picker-wrapper > div { height: 100% !important; min-height: 100% !important; margin: 0 !important; }
                    `}} />
                    <FileManagerClient isPickerMode={true} access={access} onFileSelect={(file) => onSelect(file.media_details?.url || file.url || file.path)} />
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ==========================================
// 🎨 2. BRAND SETTINGS COMPONENT
// ==========================================
function BrandSettings() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { hasPermission, hasAnyPermission } = usePermissions();
    const canManageStorage = hasPermission("manage_storage");
    const canBrowseBrandLibrary = hasPermission("manage_brand_settings") || hasAnyPermission(["view_storage", "manage_storage"]);
    const workspaceScope = getWorkspaceScopeKey();

    const [formData, setFormData] = useState<BrandFormData>(createInitialBrandForm());
    const [savedSnapshot, setSavedSnapshot] = useState<BrandFormData>(createInitialBrandForm());

    const [previews, setPreviews] = useState<Record<string, string>>({});
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    
    // 🚀 THE FIX: Strongly type activeTarget so TS knows it maps to formData keys
    const [activeTarget, setActiveTarget] = useState<keyof BrandFormData | null>(null);
    const [lastSaved, setLastSaved] = useState(Date.now());
    const savedBrandRef = React.useRef({ primary_color: '#10b981', font_family: 'Inter' });

    const { data: settingsData, isLoading } = useQuery({
        queryKey: ['brandSettings', 'protected', workspaceScope],
        queryFn: () => apiFetch('/settings/brand'),
    });

    useEffect(() => {
        if (settingsData?.data) {
            const sanitizedData = { ...settingsData.data };
            Object.keys(sanitizedData).forEach((key) => {
                if (sanitizedData[key] === null) {
                    sanitizedData[key] = key === 'hide_watermark' ? false : '';
                }
            });

            const nextSnapshot = { ...createInitialBrandForm(), ...sanitizedData };
            setFormData(nextSnapshot);
            setSavedSnapshot(nextSnapshot);
            savedBrandRef.current = {
                primary_color: nextSnapshot.primary_color,
                font_family: nextSnapshot.font_family,
            };
        }
    }, [settingsData]);

    useEffect(() => {
        if (isLoading) return;

        applyBrandRuntime({
            primary_color: formData.primary_color,
            font_family: formData.font_family,
        });
    }, [formData.primary_color, formData.font_family, isLoading]);

    useEffect(() => {
        return () => {
            applyBrandRuntime(savedBrandRef.current);
        };
    }, []);

    const saveMut = useMutation({
        mutationFn: () => apiFetch('/settings/brand', { method: 'POST', body: JSON.stringify(formData) }),
        onSuccess: () => {
            toast.success(t('settings.matrix_updated', "Identity Matrix Synchronized!"));
            setPreviews({}); 
            setLastSaved(Date.now()); 
            setSavedSnapshot(formData);
            savedBrandRef.current = {
                primary_color: formData.primary_color,
                font_family: formData.font_family,
            };
            queryClient.invalidateQueries({ queryKey: ['brandSettings'] });
            queryClient.invalidateQueries({ queryKey: ['publicBrandSettings'] });
        },
        onError: (err: any) => {
            toast.error(err.message || t('settings.matrix_update_failed', 'Failed to save brand settings.'));
        }
    });

    const handleFileSelect = (rawUrl: string) => {
        if (!activeTarget) return;
        const relativePath = extractStorageRelativePath(rawUrl) || '';
        setFormData(p => ({ ...p, [activeTarget]: relativePath }));
        const fullPreviewUrl = getBackendStorageUrl(rawUrl);
        setPreviews(p => ({ ...p, [activeTarget]: fullPreviewUrl || '' }));
        
        setIsPickerOpen(false);
        setActiveTarget(null);
        toast.success(t('settings.asset_attached', "Asset attached! Click 'Commit Identity Changes'."));
    };

    const updateColorField = (key: 'primary_color' | 'document_header_color', value: string, normalize = false) => {
        const fallback = key === 'document_header_color' ? '#1e293b' : '#10b981';
        setFormData((prev) => ({
            ...prev,
            [key]: normalize ? normalizeBrandHex(value, fallback) : value,
        }));
    };

    const applyPreset = (preset: typeof BRAND_THEME_PRESETS[number]) => {
        setFormData((prev) => ({
            ...prev,
            primary_color: preset.primary,
            document_header_color: preset.document,
            font_family: preset.font,
        }));
        toast.success(`${preset.label} ${t('settings.preset_applied', 'preset applied.')}`);
    };

    const resetBrandDraft = () => {
        setFormData({ ...savedSnapshot });
        setPreviews({});
        setLastSaved(Date.now());
        applyBrandRuntime({
            primary_color: savedSnapshot.primary_color,
            font_family: savedSnapshot.font_family,
        });
        toast.success(t('settings.brand_reset', 'Brand draft reset to saved settings.'));
    };

    const hasUnsavedChanges = JSON.stringify(formData) !== JSON.stringify(savedSnapshot) || Object.keys(previews).length > 0;
    const previewPrimaryColor = normalizeBrandHex(formData.primary_color);
    const previewDocumentColor = normalizeBrandHex(formData.document_header_color, '#1e293b');
    const previewLogoPath = formData.logo_dark || formData.logo_light || formData.sidebar_icon;
    const previewLogoUrl = previews.logo_dark || previews.logo_light || previews.sidebar_icon;

    // 🚀 THE FIX: Strongly typed the targetKey prop to match formData keys
    const BrandImageSelector = ({ label, targetKey, fallback, wide = false }: { label: string, targetKey: keyof BrandFormData, fallback: string, wide?: boolean }) => (
        <div className={cn("flex flex-col gap-2", wide ? "col-span-1 sm:col-span-2 md:col-span-3" : "col-span-1")}>
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">{label}</Label>
            <div className="relative group p-1 rounded-2xl bg-card border-2 border-dashed border-border/50 hover:border-primary transition-all duration-300">
                <div className={cn("rounded-xl bg-muted/50 flex items-center justify-center overflow-hidden relative shadow-inner", wide ? "h-64" : "h-32")}>
                    <SecureBrandAsset path={formData[targetKey]} previewUrl={previews[targetKey]} lastSaved={lastSaved} fallbackText={fallback} isWide={wide} className="w-full h-full" />
                    <button type="button" onClick={() => { setActiveTarget(targetKey); setIsPickerOpen(true); }} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-all cursor-pointer z-10">
                        <Upload className="h-6 w-6 mb-1 animate-bounce" />
                        <span className="text-[10px] font-bold uppercase">{t('settings.change', 'Change')}</span>
                    </button>
                    {previews[targetKey] && <div className="absolute bottom-2 right-2 bg-emerald-500 text-white rounded-full p-1 shadow-lg ring-2 ring-background z-20"><CheckCircle2 className="h-4 w-4" /></div>}
                </div>
            </div>
            {previews[targetKey] && <p className="text-[9px] font-bold text-amber-500 animate-pulse text-center uppercase tracking-widest mt-1">Unsaved</p>}
        </div>
    );

    if (isLoading) return <SettingsPanelSkeleton />;

    return (
        <div className="pb-24 space-y-6">
            <div id="tour-settings-brand-visuals" className="p-8 border border-border/50 rounded-[2.5rem] bg-card/40 backdrop-blur-md shadow-sm transition-all animate-in fade-in slide-in-from-bottom-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    <BrandImageSelector label={t('settings.logo_light', 'Logo Light')} targetKey="logo_light" fallback="NO LOGO" />
                    <BrandImageSelector label={t('settings.logo_dark', 'Logo Dark')} targetKey="logo_dark" fallback="NO LOGO" />
                    <BrandImageSelector label={t('settings.favicon', 'Favicon')} targetKey="favicon" fallback="NO FAVICON" />
                    <BrandImageSelector label={t('settings.sidebar_icon', 'Sidebar')} targetKey="sidebar_icon" fallback="H" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-border/50">
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-muted-foreground">{t('settings.app_title', 'App Title')}</Label><Input value={formData.app_title} onChange={e => setFormData(p => ({...p, app_title: e.target.value}))} className="bg-muted/30 h-12 rounded-xl" /></div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">{t('settings.primary_color', 'Theme Color')}</Label>
                        <div className="flex gap-2 bg-muted/30 h-12 rounded-xl p-2 border border-input">
                            <input type="color" value={previewPrimaryColor} onChange={e => updateColorField('primary_color', e.target.value, true)} className="w-8 h-8 rounded cursor-pointer border-none p-0" />
                            <Input
                                value={formData.primary_color}
                                onChange={e => updateColorField('primary_color', e.target.value)}
                                onBlur={e => updateColorField('primary_color', e.target.value, true)}
                                className="border-none bg-transparent font-mono uppercase"
                            />
                        </div>
                    </div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-muted-foreground">{t('settings.footer', 'Footer Text')}</Label><Input value={formData.footer_text} onChange={e => setFormData(p => ({...p, footer_text: e.target.value}))} className="bg-muted/30 h-12 rounded-xl" /></div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">{t('settings.font_family', 'Interface Font')}</Label>
                        <Select value={formData.font_family || 'Inter'} onValueChange={(value) => setFormData((prev) => ({ ...prev, font_family: value }))}>
                            <SelectTrigger className="bg-muted/30 h-12 rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {BRAND_FONT_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">{t('settings.meta_description', 'Meta Description')}</Label>
                        <textarea value={formData.meta_description} onChange={e => setFormData(p => ({...p, meta_description: e.target.value}))} className="w-full bg-muted/30 min-h-24 rounded-xl p-3 text-sm border border-input focus:ring-1 focus:ring-primary" />
                    </div>
                </div>

                <div className="mt-8 grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
                    <div className="rounded-[2rem] border border-border/50 bg-background/60 p-6 shadow-inner" style={{ borderColor: `${previewPrimaryColor}40`, background: `linear-gradient(135deg, ${previewPrimaryColor}1f, transparent 65%)` }}>
                        <div className="flex items-start justify-between gap-4">
                            <div style={{ fontFamily: resolveBrandFontStack(formData.font_family) }}>
                                <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">{t('settings.live_preview', 'Live Preview')}</p>
                                <h3 className="mt-3 text-2xl font-black tracking-tight text-foreground">{formData.app_title || 'HIVE.OS'}</h3>
                                <p className="mt-2 max-w-xl text-sm text-muted-foreground">{formData.auth_welcome_message || t('settings.preview_copy', 'Your central cluster or tenant node will inherit this theme, title, and typography after save.')}</p>
                            </div>
                            <div className="h-10 w-10 rounded-xl border border-white/10 shadow-inner" style={{ backgroundColor: previewPrimaryColor }} />
                        </div>
                        <div className="mt-6 flex items-center gap-4 rounded-2xl border border-border/50 bg-card/60 px-4 py-4">
                            <div className="h-14 w-14 overflow-hidden rounded-2xl border border-border/50 bg-background/70 flex items-center justify-center">
                                <SecureBrandAsset path={previewLogoPath} previewUrl={previewLogoUrl} lastSaved={lastSaved} fallbackText="H" className="w-full h-full" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-black text-foreground truncate" style={{ fontFamily: resolveBrandFontStack(formData.font_family) }}>{formData.app_title || 'HIVE.OS Dashboard'}</p>
                                <p className="text-xs text-muted-foreground truncate">{formData.footer_text || 'Powered by HIVE.OS'}</p>
                            </div>
                            <div className="ml-auto flex items-center gap-2">
                                <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary-foreground" style={{ backgroundColor: previewPrimaryColor }}>{t('settings.primary', 'Primary')}</span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[2rem] border border-border/50 bg-background/60 p-6 shadow-inner">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Palette className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-base font-black tracking-tight">{t('settings.theme_presets', 'Theme Presets')}</h3>
                                <p className="text-xs text-muted-foreground">{t('settings.theme_presets_desc', 'Quick-start combinations for colors and typography.')}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {BRAND_THEME_PRESETS.map((preset) => (
                                <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => applyPreset(preset)}
                                    className="rounded-2xl border border-border/50 bg-card/60 p-4 text-left transition-all hover:border-primary/50 hover:bg-card"
                                >
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: preset.primary }} />
                                        <span className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: preset.document }} />
                                    </div>
                                    <p className="text-sm font-black">{preset.label}</p>
                                    <p className="text-[11px] text-muted-foreground mt-1">{preset.font}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div id="tour-settings-brand-auth" className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm transition-all animate-in fade-in slide-in-from-bottom-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <BrandImageSelector label={t('settings.login_bg', 'Auth Background')} targetKey="auth_background_image" fallback="NO BG" wide />
                    <div className="col-span-1 space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">{t('settings.welcome_msg', 'Auth Message')}</Label>
                        <textarea value={formData.auth_welcome_message} onChange={e => setFormData(p => ({...p, auth_welcome_message: e.target.value}))} className="w-full bg-muted/30 h-48 rounded-xl p-3 text-sm border border-input focus:ring-1 focus:ring-primary" />
                    </div>
                </div>
            </div>

            <div className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm transition-all animate-in fade-in slide-in-from-bottom-6">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <BrandImageSelector label={t('settings.og_image', 'Open Graph Image')} targetKey="og_image" fallback="OG" />
                    <BrandImageSelector label={t('settings.pdf_logo', 'PDF Logo')} targetKey="pdf_logo" fallback="PDF" />
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">{t('settings.pdf_header_color', 'PDF Header Color')}</Label>
                            <div className="flex gap-2 bg-muted/30 h-12 rounded-xl p-2 border border-input">
                                <input type="color" value={previewDocumentColor} onChange={e => updateColorField('document_header_color', e.target.value, true)} className="w-8 h-8 rounded cursor-pointer border-none p-0" />
                                <Input
                                    value={formData.document_header_color}
                                    onChange={e => updateColorField('document_header_color', e.target.value)}
                                    onBlur={e => updateColorField('document_header_color', e.target.value, true)}
                                    className="border-none bg-transparent font-mono uppercase"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">{t('settings.tax_id', 'Company Tax ID')}</Label>
                            <Input value={formData.company_tax_id} onChange={e => setFormData(p => ({...p, company_tax_id: e.target.value}))} className="bg-muted/30 h-12 rounded-xl" />
                        </div>
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setFormData((prev) => ({ ...prev, hide_watermark: !prev.hide_watermark }))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setFormData((prev) => ({ ...prev, hide_watermark: !prev.hide_watermark }));
                                }
                            }}
                            className={cn("w-full rounded-2xl border p-4 text-left transition-all cursor-pointer", formData.hide_watermark ? "border-primary/40 bg-primary/10" : "border-border/50 bg-muted/20")}
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-black">{t('settings.hide_watermark', 'Hide Watermark')}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{t('settings.hide_watermark_desc', 'Control whether branded document exports include the HIVE.OS watermark.')}</p>
                                </div>
                                <Switch checked={formData.hide_watermark} className="pointer-events-none" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="tour-settings-save" className="fixed bottom-6 right-6 left-6 md:left-[320px] flex justify-end p-4 rounded-[2rem] bg-card/80 backdrop-blur-xl border border-border/50 shadow-2xl z-50">
                <div className="flex flex-col md:flex-row items-center gap-3 w-full justify-between">
                    <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {hasUnsavedChanges ? t('settings.unsaved_brand_changes', 'Unsaved brand changes detected') : t('settings.brand_synced', 'Brand settings are synced')}
                    </div>
                    <div className="flex items-center gap-3">
                        <Button type="button" variant="outline" onClick={resetBrandDraft} disabled={!hasUnsavedChanges || saveMut.isPending} className="rounded-xl h-12 px-6 font-bold">
                            {t('settings.reset', 'Reset')}
                        </Button>
                        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="rounded-xl px-12 font-bold bg-primary text-primary-foreground h-12 hover:scale-105 transition-all">
                            {saveMut.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : t('settings.commit_changes', 'Commit Identity Changes')}
                        </Button>
                    </div>
                </div>
            </div>

            <BrandAssetPickerModal
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                onSelect={handleFileSelect}
                access={{ canRead: canBrowseBrandLibrary, canManage: canManageStorage }}
            />
        </div>
    );
}

// ==========================================
// ⚙️ 3. GENERAL SETTINGS COMPONENT
// ==========================================
function GeneralSettings() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { roles } = usePermissions();
    const [isTenantNode, setIsTenantNode] = useState<boolean | null>(null);
    const workspaceScope = getWorkspaceScopeKey();

    const [formData, setFormData] = useState({
        support_email: '', support_phone: '', system_email_name: '', system_email_address: '',
        default_timezone: 'UTC', default_currency: 'USD', date_format: 'YYYY-MM-DD', time_format: '24h',
        max_upload_size: 10, max_upload_unit: 'MB', session_timeout_minutes: 120, maintenance_mode: false,
        maintenance_message: '', enable_registration: false, require_2fa: false, enable_communication_encryption: false,
    });

    const { data: settingsData, isLoading } = useQuery({
        queryKey: ['globalSystemSettings', workspaceScope],
        queryFn: () => apiFetch('/settings/general'),
    });

    useEffect(() => {
        if (settingsData?.data) {
            const sanitizedData = { ...settingsData.data };
            Object.keys(sanitizedData).forEach(k => { if (sanitizedData[k] === null) sanitizedData[k] = ''; });
            setFormData(prev => ({ ...prev, ...sanitizedData }));
        }
    }, [settingsData]);

    useEffect(() => {
        setIsTenantNode(isTenantSession());
    }, []);

    const canManageCommunicationEncryption = isTenantNode === false
        && roles.some((role) => role.toLowerCase() === 'super admin');

    const saveMut = useMutation({
        mutationFn: () => {
            const {
                maintenance_mode,
                maintenance_message,
                enable_communication_encryption,
                ...basePayload
            } = formData;

            const payload = {
                ...basePayload,
                ...(isTenantNode === false ? {
                    maintenance_mode,
                    maintenance_message,
                } : {}),
                ...(canManageCommunicationEncryption ? {
                    enable_communication_encryption,
                } : {}),
            };

            return apiFetch('/settings/general', { method: 'POST', body: JSON.stringify(payload) });
        },
        onSuccess: () => {
            const nextEnabledState = Boolean(formData.enable_communication_encryption);
            const currentChatConfig = useChatStore.getState().encryptionConfig;
            const currentMailConfig = useMailStore.getState().encryptionConfig;
            useChatStore.getState().setEncryptionConfig({
                ...currentChatConfig,
                enabled: nextEnabledState,
            });
            useMailStore.getState().setEncryptionConfig({
                ...currentMailConfig,
                enabled: nextEnabledState,
            });
            toast.success(t('settings.general_updated', "System Configuration Updated Successfully!"));
            queryClient.invalidateQueries({ queryKey: ['globalSystemSettings'] });
        },
        onError: (err: any) => toast.error(toErrorMessage(err, "Failed to update general settings."))
    });

    if (isLoading) return <SettingsPanelSkeleton />;

    const handleToggle = (key: keyof typeof formData) => { setFormData(prev => ({ ...prev, [key]: !prev[key as keyof typeof formData] })); };

    return (
        <div className="pb-24 space-y-6 transition-all animate-in fade-in slide-in-from-bottom-2">
            
            {/* 🎧 COMMUNICATION & SUPPORT */}
            <div className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm">
                <div className="mb-8 flex items-center gap-3">
                    <div className="h-10 w-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500"><Headset className="h-5 w-5" /></div>
                    <div>
                        <h2 className="text-2xl font-space font-black tracking-tight text-foreground">{t('settings.communications', 'Communication & Support')}</h2>
                        <p className="text-sm text-muted-foreground mt-1">{t('settings.communications_desc', 'Publicly facing support details and system email sender configurations.')}</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 pb-6 border-b border-border/50">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground"><Mail className="inline h-3 w-3 mr-1"/> {t('settings.sys_sender_name', 'System Sender Name')}</Label><Input value={formData.system_email_name} onChange={e => setFormData(p => ({...p, system_email_name: e.target.value}))} className="bg-muted/30 h-12 rounded-xl" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">{t('settings.sys_sender_address', 'System Sender Address')}</Label><Input value={formData.system_email_address} onChange={e => setFormData(p => ({...p, system_email_address: e.target.value}))} className="bg-muted/30 h-12 rounded-xl" /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">{t('settings.pub_support_email', 'Public Support Email')}</Label><Input value={formData.support_email} onChange={e => setFormData(p => ({...p, support_email: e.target.value}))} className="bg-muted/30 h-12 rounded-xl" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">{t('settings.pub_support_phone', 'Public Support Phone')}</Label><Input value={formData.support_phone} onChange={e => setFormData(p => ({...p, support_phone: e.target.value}))} className="bg-muted/30 h-12 rounded-xl font-mono" /></div>
                </div>
            </div>

            {/* 🛡️ ACCESS & SECURITY */}
            <div className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm">
                <div className="mb-8 flex items-center gap-3">
                    <div className="h-10 w-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500"><ShieldCheck className="h-5 w-5" /></div>
                    <div><h2 className="text-2xl font-space font-black tracking-tight text-foreground">{t('settings.global_access', 'Global Access Control')}</h2></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div onClick={() => handleToggle('enable_registration')} className={cn("flex items-center gap-4 p-4 rounded-xl border cursor-pointer", formData.enable_registration ? "bg-purple-500/10 border-purple-500/30" : "bg-muted/30")}>
                        <div className="h-10 w-10 bg-background rounded-lg flex items-center justify-center shrink-0 border"><UserPlus className={cn("h-5 w-5", formData.enable_registration ? "text-purple-500" : "text-muted-foreground")} /></div>
                        <div className="flex-1"><Label className="text-sm font-bold cursor-pointer">{t('settings.allow_registration', 'Allow Public Registration')}</Label></div>
                        <Switch checked={formData.enable_registration} className="data-[state=checked]:bg-purple-500 pointer-events-none" />
                    </div>
                    <div onClick={() => handleToggle('require_2fa')} className={cn("flex items-center gap-4 p-4 rounded-xl border cursor-pointer", formData.require_2fa ? "bg-amber-500/10 border-amber-500/30" : "bg-muted/30")}>
                        <div className="h-10 w-10 bg-background rounded-lg flex items-center justify-center shrink-0 border"><ShieldCheck className={cn("h-5 w-5", formData.require_2fa ? "text-amber-500" : "text-muted-foreground")} /></div>
                        <div className="flex-1"><Label className="text-sm font-bold cursor-pointer">{t('settings.enforce_2fa', 'Enforce Global 2FA')}</Label></div>
                        <Switch checked={formData.require_2fa} className="data-[state=checked]:bg-amber-500 pointer-events-none" />
                    </div>
                    {canManageCommunicationEncryption ? (
                        <div onClick={() => handleToggle('enable_communication_encryption')} className={cn("flex items-start gap-4 p-4 rounded-xl border cursor-pointer", formData.enable_communication_encryption ? "bg-emerald-500/10 border-emerald-500/30" : "bg-muted/30")}>
                            <div className="h-10 w-10 bg-background rounded-lg flex items-center justify-center shrink-0 border"><Shield className={cn("h-5 w-5", formData.enable_communication_encryption ? "text-emerald-500" : "text-muted-foreground")} /></div>
                            <div className="flex-1">
                                <Label className="text-sm font-bold cursor-pointer">{t('settings.communication_encryption', 'Communication Encryption')}</Label>
                                <p className="mt-1 text-xs text-muted-foreground">{t('settings.communication_encryption_desc', 'Enable secure chat and mailbox encryption in the browser, plus protected communication storage for this workspace.')}</p>
                            </div>
                            <Switch checked={formData.enable_communication_encryption} className="data-[state=checked]:bg-emerald-500 pointer-events-none" />
                        </div>
                    ) : (
                        <div className={cn("flex items-start gap-4 p-4 rounded-xl border", formData.enable_communication_encryption ? "bg-emerald-500/10 border-emerald-500/30" : "bg-muted/30")}>
                            <div className="h-10 w-10 bg-background rounded-lg flex items-center justify-center shrink-0 border"><Shield className={cn("h-5 w-5", formData.enable_communication_encryption ? "text-emerald-500" : "text-muted-foreground")} /></div>
                            <div className="flex-1">
                                <Label className="text-sm font-bold">{t('settings.communication_encryption', 'Communication Encryption')}</Label>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {isTenantNode
                                        ? t('settings.communication_encryption_tenant_locked', 'This setting is controlled from the central system by the Super Admin.')
                                        : t('settings.communication_encryption_locked', 'Only the central Super Admin can enable or disable communication encryption.')}
                                </p>
                            </div>
                            <Switch checked={formData.enable_communication_encryption} disabled className="data-[state=checked]:bg-emerald-500" />
                        </div>
                    )}
                </div>
            </div>

            {/* ⚙️ OPERATIONAL CONSTRAINTS */}
            <div className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm">
                <div className="mb-8 flex flex-col md:flex-row justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500"><Sliders className="h-5 w-5" /></div>
                        <div><h2 className="text-2xl font-space font-black tracking-tight text-foreground">{t('settings.op_limits', 'Operational Limits')}</h2></div>
                    </div>
                    {isTenantNode === false && (
                        <div onClick={() => handleToggle('maintenance_mode')} className={cn("flex items-center gap-3 p-3 pl-4 rounded-xl border cursor-pointer", formData.maintenance_mode ? "bg-destructive/10 border-destructive/30" : "bg-muted/50")}>
                            <div className="pr-2"><Label className="text-xs font-bold cursor-pointer flex items-center gap-2">{formData.maintenance_mode && <AlertTriangle className="h-3 w-3 text-destructive animate-pulse" />}{t('settings.maintenance_mode', 'Maintenance Mode')}</Label></div>
                            <Switch checked={formData.maintenance_mode} className="data-[state=checked]:bg-destructive pointer-events-none" />
                        </div>
                    )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2"><HardDrive className="h-3 w-3"/> {t('settings.max_upload', 'Max Upload Size')}</Label>
                        <div className="flex items-center gap-2">
                            <Input type="number" min="1" value={formData.max_upload_size} onChange={e => setFormData(p => ({...p, max_upload_size: parseInt(e.target.value)||10}))} className="bg-muted/30 h-12 rounded-xl flex-1 font-mono" />
                            <Select value={formData.max_upload_unit} onValueChange={(v) => setFormData(p => ({...p, max_upload_unit: v}))}>
                                <SelectTrigger className="bg-muted/30 h-12 rounded-xl w-24"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="KB">KB</SelectItem><SelectItem value="MB">MB</SelectItem><SelectItem value="GB">GB</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2"><Clock className="h-3 w-3"/> {t('settings.session_timeout', 'Session Timeout (Minutes)')}</Label>
                        <Input type="number" min="1" max="1440" value={formData.session_timeout_minutes} onChange={e => setFormData(p => ({...p, session_timeout_minutes: parseInt(e.target.value)||120}))} className="bg-muted/30 h-12 rounded-xl font-mono" />
                    </div>

                    {isTenantNode === false && formData.maintenance_mode && (
                        <div className="space-y-2 md:col-span-2 mt-4 pt-6 border-t border-border/50 animate-in fade-in slide-in-from-top-4 duration-500">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-destructive pl-1 flex items-center gap-2">
                                <Activity className="h-3 w-3 animate-pulse" /> {t('settings.live_ticker', 'Live Status Ticker Message')}
                            </Label>
                            <Input 
                                value={formData.maintenance_message} 
                                onChange={(e) => setFormData(p => ({...p, maintenance_message: e.target.value}))} 
                                placeholder={t('settings.live_ticker_ph', 'E.g. Database migration in progress... 45% complete.')} 
                                className="bg-destructive/5 h-12 rounded-xl border-destructive/30 focus-visible:ring-destructive font-mono text-xs placeholder:text-destructive/40 text-destructive" 
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="fixed bottom-6 right-6 left-6 md:left-[320px] flex justify-end p-4 rounded-[2rem] bg-card/80 backdrop-blur-xl border border-border/50 shadow-2xl z-50">
                <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="rounded-xl px-12 font-bold bg-primary text-primary-foreground h-12 hover:scale-105 transition-all">
                    {saveMut.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : t('settings.commit_configs', 'Commit Configurations')}
                </Button>
            </div>
        </div>
    );
}

// ==========================================
// ⚙️ 4. TAB ROUTING LOGIC & MAIN EXPORT
// ==========================================
function SettingsTabs({
    canManageBrand,
    canManageGeneral,
    canManageLocalization,
    canAccessBackups,
    canManagePayments,
    canManagePlans,
    canManageSeo,
    isCentralNode,
}: {
    canManageBrand: boolean;
    canManageGeneral: boolean;
    canManageLocalization: boolean;
    canAccessBackups: boolean;
    canManagePayments: boolean;
    canManagePlans: boolean;
    canManageSeo: boolean;
    isCentralNode: boolean;
}) {
    const { t } = useTranslation();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState('brand'); 

    useEffect(() => {
        const urlTab = searchParams.get('tab');
        const savedTab = localStorage.getItem('hive_settings_tab');

        if (urlTab) {
            setActiveTab(urlTab);
            localStorage.setItem('hive_settings_tab', urlTab);
        } else if (savedTab) {
            setActiveTab(savedTab);
            const params = new URLSearchParams(searchParams.toString());
            params.set("tab", savedTab);
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
    }, [searchParams, pathname, router]);

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
        localStorage.setItem('hive_settings_tab', tabId);
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", tabId);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const TABS = [
        canManageBrand ? { id: 'brand', label: t('nav.settings_brand', 'Brand Settings'), icon: Palette } : null,
        (canManageBrand && !isCentralNode) ? { id: 'landing', label: 'Landing Page', icon: LayoutTemplate } : null,
        canManageGeneral ? { id: 'general', label: t('nav.settings_general', 'General'), icon: Settings } : null,
        canManageGeneral ? { id: 'email', label: t('nav.settings_email', 'Email Servers'), icon: Mail } : null,
        canManagePayments ? { id: 'payments', label: 'Payment Providers', icon: CreditCard } : null,
        canManageLocalization ? { id: 'localization', label: t('nav.settings_loc', 'Localization'), icon: Globe } : null,
        canAccessBackups ? { id: 'backup', label: t('nav.settings_backup', 'System Backups'), icon: Database } : null,
        canManagePlans ? { id: 'plans', label: 'Subscription Plans', icon: Sparkles } : null,
        canManageSeo ? { id: 'seo', label: 'SEO & Discovery', icon: Search } : null,
    ].filter(Boolean) as Array<{ id: string; label: string; icon: any }>;

    useEffect(() => {
        if (TABS.length === 0) return;

        if (!TABS.some((tab) => tab.id === activeTab)) {
            const nextTab = TABS[0].id;
            setActiveTab(nextTab);
            localStorage.setItem('hive_settings_tab', nextTab);
            const params = new URLSearchParams(searchParams.toString());
            params.set("tab", nextTab);
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
    }, [TABS, activeTab, pathname, router, searchParams]);

    return (
        <div className="flex flex-col xl:flex-row gap-6 pt-2">
            <Card id="tour-settings-tabs" className="w-full xl:w-64 shrink-0 p-3 rounded-[2rem] border-border/50 bg-card/40 h-fit transition-all animate-in fade-in slide-in-from-left-4">
                <nav className="flex flex-col space-y-1">
                    {TABS.map((tab) => (
                        <button key={tab.id} onClick={() => handleTabChange(tab.id)}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left group",
                                activeTab === tab.id ? "bg-primary/10 text-primary border border-primary/20 shadow-sm" : "text-muted-foreground hover:bg-muted/50 border border-transparent"
                            )}
                        >
                            <tab.icon className={cn("h-4 w-4 shrink-0 transition-transform", activeTab === tab.id ? "scale-110" : "group-hover:scale-110")} />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </Card>

            <div className="flex-1 min-w-0">
                {canManageBrand && activeTab === 'brand' && <BrandSettings />}
                {canManageBrand && activeTab === 'landing' && !isCentralNode && (
                    <div className="transition-all animate-in fade-in slide-in-from-bottom-2">
                        <TenantLandingSettings />
                    </div>
                )}
                {canManageGeneral && activeTab === 'general' && <GeneralSettings />}
                {canManageGeneral && activeTab === 'email' && <EmailSettings />}
                {canManagePayments && activeTab === 'payments' && (
                    <div className="transition-all animate-in fade-in slide-in-from-bottom-2">
                        <PaymentSettings />
                    </div>
                )}
                {canManageLocalization && activeTab === 'localization' && (
                    <div className="p-6 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-sm shadow-sm transition-all animate-in fade-in slide-in-from-bottom-2">
                        <LocalizationManager />
                    </div>
                )}
                {canAccessBackups && activeTab === 'backup' && (
                    <div id="tour-settings-backup" className="transition-all animate-in fade-in slide-in-from-bottom-2">
                        <BackupSettings isCentralNode={isCentralNode} />
                    </div>
                )}
                {canManageSeo && activeTab === 'seo' && (
                    <div className="transition-all animate-in fade-in slide-in-from-bottom-2">
                        <SeoSettings />
                    </div>
                )}
                {canManagePlans && activeTab === 'plans' && (
                    <div className="transition-all animate-in fade-in slide-in-from-bottom-2">
                        <PlanSettings />
                    </div>
                )}
            </div>
        </div>
    );
}

export default function SettingsClient() {
    const { t } = useTranslation();
    const { hasPermission, hasAnyPermission, isLoaded } = usePermissions();
    const [isCentralNode, setIsCentralNode] = useState<boolean | null>(null);

    useEffect(() => {
        setIsCentralNode(!isTenantSession());
    }, []);

    const canManageBrand = hasPermission("manage_brand_settings");
    const canManageGeneral = hasPermission("manage_general_settings");
    const canManageLocalization = hasPermission("manage_localization");
    const canAccessBackups = isCentralNode === true && hasAnyPermission(["view_backups", "manage_backups"]);
    const canManagePayments = isCentralNode === true && hasAnyPermission(["manage_payment_settings", "manage_general_settings", "manage_tenants"]);
    const canManagePlans = isCentralNode === true && hasAnyPermission(["manage_tenants", "provision_tenants"]);
    const canManageSeo = isCentralNode === true && hasAnyPermission(["manage_system_settings", "manage_general_settings", "manage_tenants"]);
    const hasAnySettingsAccess = canManageBrand || canManageGeneral || canManageLocalization || canAccessBackups || canManagePayments || canManagePlans || canManageSeo;

    if (!isLoaded || isCentralNode === null) {
        return <SettingsWorkspaceSkeleton />;
    }

    if (!hasAnySettingsAccess) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-[2rem] border border-border/50 bg-card/40 p-8 text-center">
                <Shield className="h-10 w-10 text-destructive mb-4" />
                <h3 className="text-xl font-black tracking-tight">{t('global.access_denied', 'Access Denied')}</h3>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    {t('settings.locked', 'Your current role does not have permission to access the settings workspace.')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4 mt-6">
            <div id="tour-settings-header" className="flex flex-col sm:flex-row justify-between items-center bg-card/40 p-6 rounded-[2rem] border border-border/50 backdrop-blur-md shadow-sm gap-4 mt-2">
                <h2 className="text-2xl font-black font-space flex items-center gap-2 tracking-tight">
                    <Settings className="h-6 w-6 text-primary" /> {t('nav.settings', 'System Preferences')}
                </h2>
            </div>
            <Suspense fallback={<SettingsWorkspaceSkeleton />}>
                <SettingsTabs
                    canManageBrand={canManageBrand}
                    canManageGeneral={canManageGeneral}
                    canManageLocalization={canManageLocalization}
                    canAccessBackups={canAccessBackups}
                    canManagePayments={canManagePayments}
                    canManagePlans={canManagePlans}
                    canManageSeo={canManageSeo}
                    isCentralNode={isCentralNode}
                />
            </Suspense>
        </div>
    );
}
