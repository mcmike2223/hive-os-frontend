//components/settings/brand-settings.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
    Loader2, Image as ImageIcon, CheckCircle2, Upload, Palette, Shield, 
    FileText, Share2, Settings, Globe, Bell, Headset, Globe2, Sliders, 
    AlertTriangle, Clock, HardDrive, HelpCircle, UploadCloud 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from '@/store/use-translation';
import { cn } from "@/lib/utils";
import { logFrontendAction } from "@/lib/api";
import { extractStorageRelativePath, getAuthHeaders, getBackendApiRoot, getBackendStorageUrl, getWorkspaceScopeKey } from "@/lib/runtime-context";

// 🚀 CRITICAL FIX: Bulletproof URL Helper forces port 8085 to prevent broken images on reload
const getStorageUrl = (url: string | null | undefined) => {
  return getBackendStorageUrl(url) || '';
};

// Strips out everything and leaves just "/storage/..." for the database
const extractRelativePath = (url: string | null | undefined) => {
    return extractStorageRelativePath(url);
};

// ============================================================================
// 🚀 DEDICATED BRAND ASSET PICKER MODAL (Sleek, Images-Only, Direct Upload)
// ============================================================================
function BrandAssetPickerModal({ isOpen, onClose, onSelect }: { isOpen: boolean, onClose: () => void, onSelect: (url: string) => void }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const workspaceScope = getWorkspaceScopeKey();

  // 1. Fetch ALL files from the File Manager API
  const { data, isLoading } = useQuery({
    queryKey: ["files", "all", workspaceScope],
    queryFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/files?filter=all`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch files");
      return res.json();
    },
    enabled: isOpen, 
  });

  // 2. Filter out ONLY images
  const images = (data?.data?.files || []).filter((file: any) => 
    file.media_details?.mime_type?.startsWith('image/')
  );

  // 3. Handle Direct Upload
  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("chunk_index", "0");
      formData.append("total_chunks", "1");
      formData.append("upload_id", `brand_${Date.now()}`);
      formData.append("original_name", file.name);

      const res = await fetch(`${getBackendApiRoot()}/files/upload`, {
        method: 'POST', headers: getAuthHeaders(), body: formData
      });

      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["files", "all"] });
      const newUrl = data.file?.media[0]?.url;
      if (newUrl) {
          onSelect(extractRelativePath(newUrl) || '');
          toast.success("Asset uploaded and selected!");
      }
    },
    onError: (err: any) => toast.error(err.message),
    onSettled: () => setIsUploading(false)
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setIsUploading(true);
          uploadMut.mutate(e.target.files[0]);
      }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl p-0 overflow-hidden rounded-[2rem] bg-background border-border/50 shadow-2xl flex flex-col max-h-[85vh] z-[1000]">
        
        <div className="px-6 py-5 border-b border-border/50 bg-card/40 backdrop-blur-xl shrink-0 flex items-center justify-between z-10">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <ImageIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                  <DialogTitle className="text-lg font-black tracking-tight text-foreground">Select Brand Asset</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5 font-medium">Upload a new image or pick from your File Manager.</p>
              </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-muted/10">
            <div 
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={cn(
                    "border-2 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer bg-background/50",
                    isUploading ? "border-primary bg-primary/10" : "border-border/50 hover:border-primary/50 hover:bg-muted/40"
                )}
            >
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} disabled={isUploading} />
                {isUploading ? (
                    <div className="flex flex-col items-center text-primary">
                        <Loader2 className="h-8 w-8 animate-spin mb-3" />
                        <p className="text-sm font-bold tracking-widest uppercase">Uploading to Storage...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center opacity-70 hover:opacity-100 transition-opacity">
                        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3 shadow-sm">
                            <UploadCloud className="h-7 w-7 text-primary" />
                        </div>
                        <p className="text-sm font-bold text-foreground">Click to upload a new asset</p>
                        <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP, SVG (Max 5MB)</p>
                    </div>
                )}
            </div>

            <div className="h-px bg-border/50 w-full relative">
                <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-muted/10 px-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Or Select Existing</span>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : images.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground text-sm">No images found in your File Manager.</div>
            ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                    {images.map((file: any) => {
                        const rawUrl = file.media_details?.url;
                        const displayUrl = getStorageUrl(rawUrl);
                        return (
                            <div 
                                key={file.id} 
                                onClick={() => { onSelect(extractRelativePath(rawUrl) || ''); }}
                                className="group relative aspect-square rounded-2xl overflow-hidden border border-border/50 cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background transition-all bg-muted/30 shadow-sm"
                            >
                                <img src={displayUrl} alt={file.media_details?.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                    <CheckCircle2 className="h-10 w-10 text-white drop-shadow-md" />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


// ==========================================
// 🎨 MAIN BRAND SETTINGS COMPONENT
// ==========================================
export function BrandSettings() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const workspaceScope = getWorkspaceScopeKey();

    const [formData, setFormData] = useState({
        logo_light: '', logo_dark: '', favicon: '', sidebar_icon: '', app_title: '', footer_text: '',
        primary_color: '#10b981', auth_background_image: '', auth_welcome_message: '', font_family: 'Inter',
        meta_description: '', og_image: '', hide_watermark: false, document_header_color: '#1e293b',
        company_tax_id: '', pdf_logo: ''
    });

    const [previews, setPreviews] = useState<Record<string, string>>({});
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [activeImageTarget, setActiveImageTarget] = useState<keyof typeof formData | null>(null);
    const [lastSaved, setLastSaved] = useState<number>(Date.now());

    // Fetch from Backend API
    const { data: settingsData, isLoading: isFetching } = useQuery({
        queryKey: ['brandSettings', 'protected', workspaceScope],
        queryFn: async () => {
            const res = await fetch(`${getBackendApiRoot()}/settings/brand`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error("Failed to fetch settings");
            return res.json();
        }
    });

    useEffect(() => {
        if (settingsData?.data) {
            const sanitizedData = { ...settingsData.data };
            Object.keys(sanitizedData).forEach(key => { if (sanitizedData[key] === null) sanitizedData[key] = ''; });
            setFormData(prev => ({ ...prev, ...sanitizedData }));
        }
    }, [settingsData]);

    const saveSettingsMut = useMutation({
        mutationFn: async () => {
            const res = await fetch(`${getBackendApiRoot()}/settings/brand`, {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(formData)
            });
            if (!res.ok) throw new Error("Failed to save settings");
            return res.json();
        },
        onSuccess: () => {
            toast.success(t('settings.matrix_updated', "Identity Matrix Updated!"));
            setPreviews({}); // Clear temporary previews so it fetches the real DB image
            setLastSaved(Date.now()); // Cache bust
            queryClient.invalidateQueries({ queryKey: ['brandSettings'] });
            logFrontendAction({ module: 'Brand Settings', action: 'updated', description: 'Updated global brand assets.' }).catch(()=>{});
        },
        onError: (err: any) => toast.error(err.message)
    });

    // Handle asset selection from picker
    const handleFileSelect = (rawUrl: string) => {
        if (!activeImageTarget) return;

        // 1. Extract relative path for DB
        const dbSafePath = extractRelativePath(rawUrl) || '';
        setFormData(prev => ({ ...prev, [activeImageTarget]: dbSafePath }));

        // 2. Build full preview URL
        const fullPreviewUrl = getStorageUrl(rawUrl);
        setPreviews(prev => ({ ...prev, [activeImageTarget]: fullPreviewUrl }));

        setIsPickerOpen(false);
        setActiveImageTarget(null);
        toast.success(t('settings.asset_attached', "Asset attached! Click 'Commit Changes' to save."));
    };

    // 🚀 Robust Sub-Component for rendering the image
    const BrandImageSelector = ({ label, targetKey, fallbackText, wide = false }: { label: string, targetKey: keyof typeof formData, fallbackText: string, wide?: boolean }) => {
        // Determine the display URL: Use preview if it exists, otherwise resolve the DB path
        const previewUrl = previews[targetKey];
        const savedPath = formData[targetKey];
        const displayUrl = previewUrl || (savedPath ? `${getStorageUrl(savedPath as string)}?cb=${lastSaved}` : null);

        return (
            <div className={cn("flex flex-col gap-2", wide ? "col-span-1 sm:col-span-2 md:col-span-3" : "col-span-1")}>
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">{label}</Label>
                <div className="relative group p-1 rounded-2xl bg-gradient-to-tr from-primary/10 via-primary/5 to-transparent hover:from-primary/30 transition-colors duration-500">
                    <div className={cn("rounded-xl border-4 border-background bg-muted flex items-center justify-center overflow-hidden relative shadow-inner", wide ? "h-64" : "h-32")}>
                        
                        {displayUrl ? (
                            <img src={displayUrl} alt={label} className={cn("max-h-full max-w-full transition-transform duration-500 group-hover:scale-105", wide ? "object-cover w-full h-full p-0" : "object-contain p-2")} />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full w-full opacity-50">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{fallbackText}</span>
                            </div>
                        )}

                        <button 
                            type="button" 
                            onClick={() => { setActiveImageTarget(targetKey); setIsPickerOpen(true); }} 
                            className="absolute inset-0 bg-black/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer z-10"
                        >
                            <Upload className="h-6 w-6 mb-1 animate-bounce" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{t('settings.change_img', 'Change')}</span>
                        </button>
                        
                        {previews[targetKey] && (
                            <div className="absolute bottom-2 right-2 bg-emerald-500 text-white rounded-full p-1 shadow-lg ring-4 ring-background animate-in zoom-in z-20">
                                <CheckCircle2 className="h-4 w-4" />
                            </div>
                        )}
                    </div>
                </div>
                {previews[targetKey] && <p className="text-[9px] font-bold text-amber-500 animate-pulse text-center uppercase tracking-widest mt-1">Unsaved</p>}
            </div>
        );
    };

    if (isFetching) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <div className="pb-24 space-y-6">
            <div id="tour-settings-brand-visuals" className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm transition-all animate-in fade-in slide-in-from-bottom-2">
                <div className="mb-8 flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary"><Palette className="h-5 w-5" /></div>
                    <div><h2 className="text-2xl font-space font-black tracking-tight text-foreground">{t('settings.visual_identity', 'Visual Identity')}</h2><p className="text-sm text-muted-foreground mt-1">{t('settings.visual_identity_desc', 'Configure your main application branding and theme colors.')}</p></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    <BrandImageSelector label={t('settings.logo_light', 'Logo (Light Mode)')} targetKey="logo_light" fallbackText={t('settings.no_logo', 'NO LOGO')} />
                    <BrandImageSelector label={t('settings.logo_dark', 'Logo (Dark Mode)')} targetKey="logo_dark" fallbackText={t('settings.no_logo', 'NO LOGO')} />
                    <BrandImageSelector label={t('settings.favicon', 'Browser Favicon')} targetKey="favicon" fallbackText={t('settings.no_favicon', 'NO FAVICON')} />
                    <BrandImageSelector label={t('settings.sidebar_icon', 'Sidebar Icon')} targetKey="sidebar_icon" fallbackText="H" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 pt-6 border-t border-border/50">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">{t('settings.app_title', 'App Title')}</Label><Input value={formData.app_title} onChange={(e) => setFormData(prev => ({...prev, app_title: e.target.value}))} className="bg-muted/30 h-12 rounded-xl focus-visible:ring-primary font-bold" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">{t('settings.primary_color', 'Primary Theme Color')}</Label><div className="flex items-center gap-3 bg-muted/30 h-12 rounded-xl p-2 border border-input focus-within:ring-1 focus-within:ring-primary"><input type="color" value={formData.primary_color} onChange={(e) => setFormData(prev => ({...prev, primary_color: e.target.value}))} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-none p-0" /><Input value={formData.primary_color} onChange={(e) => setFormData(prev => ({...prev, primary_color: e.target.value}))} className="border-none h-8 bg-transparent shadow-none font-mono uppercase" /></div></div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">{t('settings.typography', 'Typography Style')}</Label>
                        <Select value={formData.font_family} onValueChange={(val) => setFormData(prev => ({...prev, font_family: val}))}>
                            <SelectTrigger className="bg-muted/30 h-12 rounded-xl focus:ring-primary"><SelectValue placeholder="Select a font" /></SelectTrigger>
                            <SelectContent className="rounded-xl border-border/50">
                                <SelectItem value="Inter">{t('settings.font_inter', 'Inter (Modern)')}</SelectItem>
                                <SelectItem value="Space Grotesk">{t('settings.font_space', 'Space Grotesk (Tech)')}</SelectItem>
                                <SelectItem value="Roboto">{t('settings.font_roboto', 'Roboto (Corporate)')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div id="tour-settings-brand-auth" className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm transition-all animate-in fade-in slide-in-from-bottom-4">
                <div className="mb-8 flex items-center gap-3"><div className="h-10 w-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500"><Shield className="h-5 w-5" /></div><div><h2 className="text-2xl font-space font-black tracking-tight text-foreground">{t('settings.auth_portal', 'Authentication Portal')}</h2><p className="text-sm text-muted-foreground mt-1">{t('settings.auth_portal_desc', 'Customize the login experience for your employees.')}</p></div></div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <BrandImageSelector label={t('settings.login_bg', 'Login Background Image')} targetKey="auth_background_image" fallbackText={t('settings.no_bg', 'NO BACKGROUND')} wide />
                    <div className="space-y-6 col-span-1">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">{t('settings.welcome_msg', 'Welcome Message')}</Label>
                            <textarea value={formData.auth_welcome_message} onChange={(e) => setFormData(prev => ({...prev, auth_welcome_message: e.target.value}))} className="w-full bg-muted/30 h-48 rounded-xl focus-visible:ring-primary border border-input p-3 text-sm resize-none" placeholder={t('settings.welcome_placeholder', 'Sign in to access your secure control hub.')} />
                        </div>
                    </div>
                </div>
            </div>

            <div id="tour-settings-brand-docs" className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm transition-all animate-in fade-in slide-in-from-bottom-6">
                <div className="mb-8 flex items-center gap-3"><div className="h-10 w-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500"><FileText className="h-5 w-5" /></div><div><h2 className="text-2xl font-space font-black tracking-tight text-foreground">{t('settings.doc_branding', 'Document Branding')}</h2><p className="text-sm text-muted-foreground mt-1">{t('settings.doc_branding_desc', 'Headers and logos applied to exported Payslips and Waybills.')}</p></div></div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
                    <BrandImageSelector label={t('settings.pdf_logo', 'PDF Logo (High Contrast)')} targetKey="pdf_logo" fallbackText={t('settings.use_main_logo', 'USE MAIN LOGO')} />
                    <div className="col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">{t('settings.company_tin', 'Company TIN / Tax ID')}</Label><Input value={formData.company_tax_id} onChange={(e) => setFormData(prev => ({...prev, company_tax_id: e.target.value}))} placeholder="0001234567" className="bg-muted/30 h-12 rounded-xl focus-visible:ring-primary font-bold" /></div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">{t('settings.pdf_header_color', 'PDF Header Color')}</Label><div className="flex items-center gap-3 bg-muted/30 h-12 rounded-xl p-2 border border-input"><input type="color" value={formData.document_header_color} onChange={(e) => setFormData(prev => ({...prev, document_header_color: e.target.value}))} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-none p-0" /><Input value={formData.document_header_color} onChange={(e) => setFormData(prev => ({...prev, document_header_color: e.target.value}))} className="border-none h-8 bg-transparent shadow-none font-mono uppercase" /></div></div>
                    </div>
                </div>
            </div>

            <div id="tour-settings-save" className="fixed bottom-6 right-6 left-6 md:left-[320px] flex justify-end p-4 rounded-[2rem] bg-card/80 backdrop-blur-xl border border-border/50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 animate-in slide-in-from-bottom-12 duration-700">
                <Button onClick={() => saveSettingsMut.mutate()} disabled={saveSettingsMut.isPending} className="rounded-xl px-12 font-bold shadow-xl bg-primary text-primary-foreground h-12">
                    {saveSettingsMut.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}{t('settings.commit_changes', 'Commit Identity Changes')}
                </Button>
            </div>

            {/* 🚀 DEDICATED PICKER MODAL */}
            <BrandAssetPickerModal 
                isOpen={isPickerOpen} 
                onClose={() => setIsPickerOpen(false)} 
                onSelect={handleFileSelect} 
            />
        </div>
    );
}
