"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { 
    FileText, FileType, UploadCloud, Loader2, Download, 
    ArrowRight, CheckCircle2, FileCode2, Settings, 
    Image as ImageIcon, X, FolderSearch, Eye, HelpCircle, Save, Code2, Layers, LockKeyhole
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useTranslation } from '@/store/use-translation';
import { Breadcrumbs } from "@/components/ui/breadcrumbs"; 
import { Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { FileManagerClient } from "@/components/dashboard/file-manager-client";
import { useTour } from "@/components/providers/tour-provider"; 
import { PdfViewer } from '@/components/ui/pdf-viewer'; 
import { CodeEditor, type VirtualFile } from '@/components/ui/code-editor';
import { usePermissions } from "@/hooks/use-permissions";
import { useTenantModuleAccess } from "@/hooks/use-tenant-module-access";
import { fetchCurrentTenantSubscriptions } from "@/modules/subscription/api";
import { ModuleSubscriptionCheckoutDialog } from "@/modules/subscription/components/module-subscription-checkout-dialog";
import { getAccessToken, getBackendApiRoot, getTenantId } from "@/lib/runtime-context";

const getApiUrl = () => {
    return getBackendApiRoot();
};

type PickerMode = 'html' | 'asset';

type CloudFile = {
    id?: string | number;
    name?: string;
    media_details?: {
        name?: string;
    };
};

type CatalogModule = {
    slug: string;
};

type CloudFilePickerModalProps = {
    isOpen: boolean;
    mode: PickerMode | null;
    onClose: () => void;
    onSelect: (file: CloudFile) => void;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
    return error instanceof Error && error.message ? error.message : fallback;
};

function CloudFilePickerModal({ isOpen, mode, onClose, onSelect }: CloudFilePickerModalProps) {
    const { t } = useTranslation();
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-6xl w-[95vw] h-[85vh] p-0 overflow-hidden rounded-[2.5rem] bg-background border-border/50 shadow-2xl flex flex-col gap-0 z-[1000]">
                <DialogTitle className="sr-only">Cloud Picker</DialogTitle>
                <div className="px-8 py-5 border-b border-border/50 bg-card/40 backdrop-blur-xl shrink-0 flex items-center justify-between z-10">
                    <div className="flex items-center gap-4">
                        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", mode === 'html' ? "bg-indigo-500/10" : "bg-primary/10")}>
                            <FolderSearch className={cn("h-5 w-5", mode === 'html' ? "text-indigo-500" : "text-primary")} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black tracking-tight text-foreground">
                                {mode === 'html' ? t('tools.select_cloud_html', 'Select Cloud HTML') : t('tools.select_cloud_asset', 'Select Cloud Asset')}
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">{t('tools.pick_file_manager', 'Pick from File Manager')}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full"><X className="h-4 w-4" /></Button>
                </div>
                <div className="flex-1 overflow-hidden relative bg-muted/10 file-picker-wrapper p-4 sm:p-6">
                    <style dangerouslySetInnerHTML={{__html: `.file-picker-wrapper > div > div:nth-child(1), .file-picker-wrapper > div > div:nth-child(2) > div:nth-child(2) { display: none !important; } .file-picker-wrapper > div { height: 100% !important; min-height: 100% !important; margin: 0 !important; }`}} />
                    <FileManagerClient isPickerMode={true} onFileSelect={(file) => { onSelect(file); }} />
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function FileConverterPage() {
    const { t } = useTranslation();
    const { startTour } = useTour();
    const { hasAnyPermission, isLoaded } = usePermissions();
    const { hasModule } = useTenantModuleAccess();
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const canUseDocumentConverter = hasAnyPermission(["use_document_converter", "manage_storage"]);
    const canUseStorage = hasAnyPermission(["view_storage", "manage_storage"]);
    const tenantId = getTenantId();
    const isTenantWorkspace = Boolean(tenantId);
    const hasDocumentConverter = !isTenantWorkspace || hasModule("document_converter");

    const { data: subscriptionData } = useQuery({
        queryKey: ["tenant-current-subscriptions", "converter"],
        queryFn: fetchCurrentTenantSubscriptions,
        enabled: isTenantWorkspace && canUseDocumentConverter,
        staleTime: 300_000,
    });
    const converterModule =
        subscriptionData?.data?.module_subscriptions?.catalog_modules?.find(
            (module: CatalogModule) => module.slug === "document_converter"
        ) ?? null;
    const paymentMethods = subscriptionData?.data?.payment_methods ?? [];
    
    const [inputMethod, setInputMethod] = useState<'upload' | 'code'>('upload');
    const [showCodePreview, setShowCodePreview] = useState(false);

    // 🚀 NEW DEFAULT: Just index.html to start.
    const [virtualFiles, setVirtualFiles] = useState<VirtualFile[]>([
        { 
          name: 'index.html', 
          language: 'html', 
          content: "<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    /* Write CSS here, or create a style.css tab! */\n    body { font-family: sans-serif; }\n    .page { padding: 20px; }\n  </style>\n</head>\n<body>\n  <div class=\"page\">\n    <h1>Universal Converter</h1>\n    <p>Build your document here.</p>\n  </div>\n</body>\n</html>" 
        }
    ]);

    const [htmlFile, setHtmlFile] = useState<File | null>(null);
    const [htmlPreview, setHtmlPreview] = useState<string>("");
    const [assets, setAssets] = useState<File[]>([]);
    
    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
    const [pdfFilename, setPdfFilename] = useState<string>("");
    
    const [isDraggingHtml, setIsDraggingHtml] = useState(false);
    const [isDraggingAssets, setIsDraggingAssets] = useState(false);
    const [isConverting, setIsConverting] = useState(false);
    const [isSavingToCloud, setIsSavingToCloud] = useState(false);
    const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
    const [isFetchingServerAsset, setIsFetchingServerAsset] = useState(false);
    
    const htmlInputRef = useRef<HTMLInputElement>(null);
    const assetsInputRef = useRef<HTMLInputElement>(null);

    const [settings, setSettings] = useState({
        paper_size: 'a4',
        orientation: 'portrait',
        margins: 0,
        print_background: 'true'
    });

    useEffect(() => {
        if (htmlFile) {
            const reader = new FileReader();
            reader.onload = (e) => setHtmlPreview(e.target?.result as string);
            reader.readAsText(htmlFile);
            setPdfPreviewUrl(null);
            setPdfBlob(null);
        } else {
            setHtmlPreview("");
        }
    }, [htmlFile]);

    useEffect(() => {
        if (inputMethod === 'code' && pdfPreviewUrl) {
            setPdfPreviewUrl(null);
            setPdfBlob(null);
        }
    }, [virtualFiles, inputMethod]);

    useEffect(() => {
        return () => { if (pdfPreviewUrl) window.URL.revokeObjectURL(pdfPreviewUrl); };
    }, [pdfPreviewUrl]);

    if (!isLoaded) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center rounded-[2rem] border border-border/50 bg-card/40 p-8 text-sm text-muted-foreground">
                {t('global.loading', 'Loading...')}
            </div>
        );
    }

    if (!canUseDocumentConverter) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-[2rem] border border-border/50 bg-card/40 p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10">
                    <FileType className="h-8 w-8 text-destructive" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-black tracking-tight">{t('global.access_denied', 'Access Denied')}</h2>
                    <p className="max-w-md text-sm text-muted-foreground">
                        {t('tools.converter_denied', 'Your current role does not have permission to use the document converter workspace.')}
                    </p>
                </div>
            </div>
        );
    }

    if (!hasDocumentConverter) {
        return (
            <>
                <div className="flex min-h-[65vh] flex-col items-center justify-center gap-5 rounded-[2rem] border border-border/50 bg-card/40 p-8 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-primary/20 bg-primary/10">
                        <LockKeyhole className="h-9 w-9 text-primary" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-3xl font-black tracking-tight text-foreground">
                            Document Converter Locked
                        </h2>
                        <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted-foreground">
                            This tenant can only use the Universal Converter after the
                            `document_converter` module is activated. Subscribe here and the
                            workspace will unlock right after payment confirmation.
                        </p>
                    </div>
                    <Button onClick={() => setCheckoutOpen(true)} className="rounded-xl px-6 font-semibold">
                        <Layers className="mr-2 h-4 w-4" /> Unlock with Checkout
                    </Button>
                </div>

                {converterModule ? (
                    <ModuleSubscriptionCheckoutDialog
                        open={checkoutOpen}
                        onOpenChange={setCheckoutOpen}
                        modules={[converterModule]}
                        paymentMethods={paymentMethods}
                        title="Activate the Document Converter"
                        description="Complete the module checkout to unlock the HTML-to-PDF workspace for this tenant."
                    />
                ) : null}
            </>
        );
    }

    // INJECT VIRTUAL FILES INTO LIVE PREVIEW IFRAME
    const getCodePreviewHtml = () => {
        let combinedHtml = virtualFiles.find(f => f.name === 'index.html')?.content || "";
        
        virtualFiles.filter(f => f.language === 'css').forEach(css => {
            if (combinedHtml.includes('</head>')) {
                combinedHtml = combinedHtml.replace('</head>', `\n<style>\n${css.content}\n</style>\n</head>`);
            } else {
                combinedHtml = `<style>\n${css.content}\n</style>\n` + combinedHtml;
            }
        });

        virtualFiles.filter(f => f.language === 'javascript').forEach(js => {
            if (combinedHtml.includes('</body>')) {
                combinedHtml = combinedHtml.replace('</body>', `\n<script>\n${js.content}\n</script>\n</body>`);
            } else {
                combinedHtml += `\n<script>\n${js.content}\n</script>`;
            }
        });

        return combinedHtml;
    };

    const triggerMasterTour = () => {
        const possibleSteps = [
            { target: '#tour-converter-header', title: t('tools.tour_header_title', 'Universal Converter Engine'), content: t('tools.tour_header_desc', 'This tool utilizes headless Chromium to transpile HTML documents into pixel-perfect PDFs.'), placement: 'bottom' as const },
            { target: '#tour-converter-step1', title: t('tools.tour_step1_title', 'The Source Document'), content: t('tools.tour_step1_desc', 'Upload an HTML file, pull one securely from the cloud File Manager, or write HTML code directly into the built-in IDE.'), placement: 'right' as const },
            { target: '#tour-converter-step2', title: t('tools.tour_step2_title', 'Local Linked Assets'), content: t('tools.tour_step2_desc', 'If your HTML code references local files like "logo.png" or "style.css", upload them here so the engine can render them.'), placement: 'right' as const },
            { target: '#tour-converter-step3', title: t('tools.tour_step3_title', 'Engine Constraints'), content: t('tools.tour_step3_desc', 'Configure the paper size, orientation, and dictate whether the engine should print background colors.'), placement: 'left' as const },
            { target: '#tour-converter-generate', title: t('tools.tour_generate_title', 'Transpile & Generate'), content: t('tools.tour_generate_desc', 'Click this to package your HTML and assets, send them to the internal rendering engine, and generate the resulting PDF.'), placement: 'left' as const },
        ];
        const activeSteps = possibleSteps.filter(step => document.querySelector(step.target));
        startTour(activeSteps.map(step => ({ ...step, disableBeacon: true })));
    };

    const handleHtmlDrop = (e: React.DragEvent) => {
        e.preventDefault(); setIsDraggingHtml(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type === "text/html" || file.name.endsWith('.html')) setHtmlFile(file);
            else toast.error(t('tools.toast_invalid_html', "Please upload a valid .html file."));
        }
    };
    
    const handleAssetsDrop = (e: React.DragEvent) => {
        e.preventDefault(); setIsDraggingAssets(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) setAssets(prev => [...prev, ...Array.from(e.dataTransfer.files!)]);
    };
    
    const removeAsset = (index: number) => setAssets(prev => prev.filter((_, i) => i !== index));

    const handleCloudFileSelect = async (serverFile: CloudFile) => {
        const mode = pickerMode; setPickerMode(null);
        if (!serverFile || !serverFile.id) return toast.error(t('tools.toast_invalid_cloud', "Invalid file selected."));

        setIsFetchingServerAsset(true);
        const toastId = toast.loading(mode === 'html' ? t('tools.toast_downloading_html', "Downloading HTML...") : t('tools.toast_downloading_asset', "Downloading asset..."));

        try {
            const token = getAccessToken();
            const downloadUrl = `${getApiUrl()}/files/${serverFile.id}/download`;
            const res = await fetch(downloadUrl, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error(t('tools.toast_fetch_failed', "Fetch failed."));
            
            const blob = await res.blob();
            const fileName = serverFile.media_details?.name || serverFile.name || (mode === 'html' ? `document-${Date.now()}.html` : `asset-${Date.now()}`);
            const mimeType = blob.type || (mode === 'html' ? 'text/html' : 'image/png');
            const fileObj = new File([blob], fileName, { type: mimeType });
            
            if (mode === 'html') {
                if (mimeType !== 'text/html' && !fileName.endsWith('.html')) toast.warning(t('tools.toast_warning_html', "File might not be standard HTML."), { id: toastId });
                else toast.success(t('tools.toast_html_secure', "HTML loaded securely!"), { id: toastId });
                setHtmlFile(fileObj);
            } else {
                setAssets(prev => [...prev, fileObj]);
                toast.success(`${fileName} ${t('tools.toast_asset_secure', "attached!")}`, { id: toastId });
            }
        } catch {
            toast.error(t('tools.toast_import_failed', "Failed to import file."), { id: toastId });
        } finally {
            setIsFetchingServerAsset(false);
        }
    };

    const handleConvert = async () => {
        let finalHtmlFile: File | null = null;
        let originalName = "";
        const formData = new FormData();

        if (inputMethod === 'upload') {
            if (!htmlFile) return toast.error(t('tools.toast_invalid_html', "Please upload a valid .html file."));
            finalHtmlFile = htmlFile;
            originalName = htmlFile.name.replace(/\.html$/i, '');
        } else {
            const indexHtml = virtualFiles.find(f => f.name === 'index.html');
            if (!indexHtml || !indexHtml.content.trim()) return toast.error(t('tools.empty_code_err', "HTML code cannot be empty."));
            
            finalHtmlFile = new File([indexHtml.content], `index.html`, { type: 'text/html' });
            originalName = `document-${Date.now()}`;

            virtualFiles.filter(f => f.name !== 'index.html').forEach(f => {
                const mime = f.language === 'css' ? 'text/css' : (f.language === 'javascript' ? 'text/javascript' : 'text/plain');
                const virtualAsset = new File([f.content], f.name, { type: mime });
                formData.append('assets[]', virtualAsset);
            });
        }

        setIsConverting(true);
        const toastId = toast.loading(t('tools.toast_transpiling', "Gotenberg Engine is transpiling your document..."));

        try {
            const token = getAccessToken();
            const url = `${getApiUrl()}/convert/html-to-pdf`;

            formData.append('file', finalHtmlFile);
            formData.append('paper_size', settings.paper_size);
            formData.append('orientation', settings.orientation);
            formData.append('margins', settings.margins.toString());
            formData.append('print_background', settings.print_background);
            
            assets.forEach(asset => formData.append('assets[]', asset));

            const response = await fetch(url, {
                method: 'POST',
                headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                body: formData
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || t('tools.toast_convert_failed', "Failed to convert document."));
            }

            const blob = await response.blob();
            const objectUrl = window.URL.createObjectURL(blob);
            
            let filename = originalName + '.pdf';
            const disposition = response.headers.get('Content-Disposition');
            if (disposition && disposition.indexOf('filename=') !== -1) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
                if (matches != null && matches[1]) filename = matches[1].replace(/['"]/g, '');
            }

            setPdfBlob(blob);
            setPdfPreviewUrl(objectUrl);
            setPdfFilename(filename);

            toast.success(t('tools.toast_success', "Conversion successful! PDF Ready."), { id: toastId });
            setTimeout(() => { document.getElementById('tour-converter-output')?.scrollIntoView({ behavior: 'smooth' }); }, 100);

        } catch (error) {
            toast.error(getErrorMessage(error, t('tools.toast_unexpected', "An unexpected error occurred.")), { id: toastId });
        } finally {
            setIsConverting(false);
        }
    };

    const handleSaveToCloud = async () => {
        if (!pdfBlob) return;
        setIsSavingToCloud(true);
        const toastId = toast.loading(t('tools.toast_saving_cloud', "Saving to File Manager..."));
        
        try {
            const token = getAccessToken();
            const formData = new FormData();
            const fileObj = new File([pdfBlob], pdfFilename, { type: 'application/pdf' });
            
            formData.append("file", fileObj);
            formData.append("chunk_index", "0");
            formData.append("total_chunks", "1");
            formData.append("upload_id", `pdf_render_${Date.now()}`);
            formData.append("original_name", pdfFilename);

            const res = await fetch(`${getApiUrl()}/files/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!res.ok) throw new Error("Upload failed");
            toast.success(t('tools.toast_saved_cloud', "PDF securely saved to File Manager!"), { id: toastId });
        } catch (error) {
            toast.error(t('tools.toast_save_failed', "Failed to save PDF to the cloud."), { id: toastId });
        } finally {
            setIsSavingToCloud(false);
        }
    };

    const handleDiscard = () => { setPdfPreviewUrl(null); setPdfBlob(null); window.scrollTo({ top: 0, behavior: 'smooth' }); };

    const isSubmitDisabled = isConverting;

    return (
        <div className="space-y-6 pb-24">
            <div className="flex w-full justify-end items-center gap-3 mb-4">
                <Breadcrumbs items={[{ label: "Hive.OS", href: "/dashboard", icon: <Home className="h-4 w-4" /> }, { label: t('nav.apps_tools', "Apps & Tools") }, { label: t('tools.converter_title', "Universal Converter") }]} />
            </div>

            <div id="tour-converter-header" className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card/40 p-8 rounded-[2rem] border border-border/50 backdrop-blur-md shadow-sm gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500"><FileType className="h-5 w-5" /></div>
                        <h2 className="text-3xl font-space font-black tracking-tight text-foreground flex items-center gap-2">
                            {t('tools.converter_title', "Universal Converter")}
                        </h2>
                    </div>
                    <p className="text-sm text-muted-foreground ml-14">
                        {t('tools.converter_desc', "Powered by Gotenberg Chromium. Convert markup and documents with pixel-perfect accuracy.")}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={triggerMasterTour} className="h-10 px-4 rounded-full text-primary bg-primary/10 hover:bg-primary/20 font-bold transition-all"><HelpCircle className="h-4 w-4 mr-2" /> {t('tools.tour_btn', 'Tour')}</Button>
                    <Badge variant="outline" className="bg-indigo-500/5 text-indigo-500 border-indigo-500/20 px-4 py-1.5 rounded-full font-mono text-xs tracking-widest uppercase shadow-sm">{t('tools.engine_online', "Engine: Online")}</Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                
                {/* LEFT COLUMN */}
                <div className="xl:col-span-8 flex flex-col gap-6">
                    
                    <div id="tour-converter-step1" className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm flex flex-col min-h-[500px]">
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold font-space uppercase tracking-widest text-muted-foreground">{t('tools.step_1', "1. Main Document")}</h3>
                                <Badge variant="secondary">{t('tools.required', "Required")}</Badge>
                            </div>
                            
                            {/* Input Mode Toggle */}
                            <div className="flex bg-muted/50 p-1 rounded-xl w-fit border border-border/50 shadow-inner">
                                <button 
                                    onClick={() => setInputMethod('upload')} 
                                    className={cn("px-5 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 flex items-center gap-2", inputMethod === 'upload' ? "bg-background shadow-md text-foreground" : "text-muted-foreground hover:text-foreground")}
                                >
                                    <UploadCloud className="h-4 w-4" /> {t('tools.input_upload', 'Upload File')}
                                </button>
                                <button 
                                    onClick={() => setInputMethod('code')} 
                                    className={cn("px-5 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 flex items-center gap-2", inputMethod === 'code' ? "bg-[#2d2d2d] shadow-md text-white" : "text-muted-foreground hover:text-foreground")}
                                >
                                    <Code2 className="h-4 w-4" /> {t('tools.input_code', 'IDE Mode')}
                                </button>
                            </div>
                        </div>

                        {/* UPLOAD MODE */}
                        {inputMethod === 'upload' && (
                            <>
                                {!htmlFile ? (
                                    <div className="flex flex-col sm:flex-row gap-4 h-full min-h-[300px] animate-in fade-in">
                                        <div 
                                            onDragOver={(e) => { e.preventDefault(); setIsDraggingHtml(true); }}
                                            onDragLeave={(e) => { e.preventDefault(); setIsDraggingHtml(false); }}
                                            onDrop={handleHtmlDrop}
                                            onClick={() => htmlInputRef.current?.click()}
                                            className={cn("flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-3xl transition-all duration-200 cursor-pointer text-center", isDraggingHtml ? "border-primary bg-primary/10 scale-[0.99]" : "border-border/60 hover:border-primary/50 hover:bg-muted/30")}
                                        >
                                            <input type="file" ref={htmlInputRef} accept=".html,text/html" className="hidden" onChange={(e) => e.target.files && setHtmlFile(e.target.files[0])} />
                                            <UploadCloud className="h-8 w-8 mb-3 text-muted-foreground" />
                                            <h4 className="text-sm font-bold mb-1">{t('tools.upload_local_html', "Upload Local HTML")}</h4>
                                            <p className="text-xs text-muted-foreground">{t('tools.drag_drop_click', "Drag & drop or click")}</p>
                                        </div>
                                        {canUseStorage && (
                                            <div onClick={() => !isFetchingServerAsset && setPickerMode('html')} className="flex-1 p-8 border-2 border-dashed border-indigo-500/40 bg-indigo-500/5 hover:bg-indigo-500/10 rounded-3xl transition-all duration-200 cursor-pointer text-center flex flex-col items-center justify-center text-indigo-500">
                                                {isFetchingServerAsset && pickerMode === 'html' ? <Loader2 className="h-8 w-8 mb-3 animate-spin" /> : <FolderSearch className="h-8 w-8 mb-3" />}
                                                <h4 className="text-sm font-bold mb-1">{t('tools.select_cloud_html', "Select Cloud HTML")}</h4>
                                                <p className="text-xs opacity-70">{t('tools.pick_file_manager', "Pick from File Manager")}</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col flex-1 border rounded-3xl overflow-hidden bg-muted/30 relative group animate-in fade-in zoom-in-95 min-h-[350px]">
                                        <div className="absolute top-4 right-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Badge className="bg-background text-foreground shadow-sm pointer-events-none"><Eye className="w-3 h-3 mr-1"/> {t('tools.live_preview', "Live Preview")}</Badge>
                                            <Button variant="destructive" size="sm" onClick={() => setHtmlFile(null)} className="h-6 text-xs rounded-full shadow-md"><X className="w-3 h-3 mr-1"/> {t('tools.remove', "Remove")}</Button>
                                        </div>
                                        <div className="flex-1 w-full bg-white relative">
                                            <iframe srcDoc={htmlPreview} className="absolute inset-0 w-full h-full border-none pointer-events-none" sandbox="allow-same-origin" />
                                        </div>
                                        <div className="p-3 bg-background border-t text-xs font-mono text-muted-foreground flex justify-between">
                                            <span className="font-bold text-foreground truncate max-w-[200px]">{htmlFile.name}</span>
                                            <span>{(htmlFile.size / 1024).toFixed(2)} KB</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* CODE EDITOR MODE */}
                        {inputMethod === 'code' && (
                            <div className="flex flex-col flex-1 min-h-[450px] relative animate-in fade-in duration-500">
                                <CodeEditor 
                                    files={virtualFiles}
                                    setFiles={setVirtualFiles}
                                    showPreview={showCodePreview}
                                    setShowPreview={setShowCodePreview}
                                    previewHtml={getCodePreviewHtml()}
                                    className="absolute inset-0 h-full w-full" 
                                />
                            </div>
                        )}
                    </div>

                    <div id="tour-converter-step2" className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold font-space uppercase tracking-widest text-muted-foreground">{t('tools.step_2', "2. Extra Assets")}</h3>
                            <Badge variant="outline" className="bg-background">{t('tools.optional', "Optional")}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-4">{t('tools.assets_desc', "If your HTML references local images (e.g., logo.png), upload them here so the engine can link them.")}</p>

                        <div className="flex gap-4">
                            <div onClick={() => assetsInputRef.current?.click()} className={cn("flex-1 p-6 border-2 border-dashed rounded-2xl transition-all duration-200 cursor-pointer text-center flex flex-col items-center justify-center", isDraggingAssets ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/30 hover:bg-muted/30")}>
                                <input type="file" ref={assetsInputRef} multiple className="hidden" onChange={(e) => e.target.files && setAssets(prev => [...prev, ...Array.from(e.target.files as FileList)])} />
                                <UploadCloud className="h-5 w-5 mb-2 text-muted-foreground" />
                                <span className="text-sm font-bold">{t('tools.upload_local_file', "Upload Local File")}</span>
                            </div>
                            {canUseStorage && (
                                <div onClick={() => !isFetchingServerAsset && setPickerMode('asset')} className="flex-1 p-6 border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 rounded-2xl transition-all duration-200 cursor-pointer text-center flex flex-col items-center justify-center text-primary">
                                    {isFetchingServerAsset && pickerMode === 'asset' ? <Loader2 className="h-5 w-5 mb-2 animate-spin" /> : <FolderSearch className="h-5 w-5 mb-2" />}
                                    <span className="text-sm font-bold">{t('tools.select_cloud_asset', "Select Cloud Asset")}</span>
                                </div>
                            )}
                        </div>

                        {assets.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2 p-3 bg-muted/20 rounded-xl border border-border/50">
                                {assets.map((asset, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-background border border-border/50 rounded-lg px-3 py-1.5 text-xs font-mono shadow-sm">
                                        <ImageIcon className="h-3 w-3 text-indigo-500" />
                                        <span className="truncate max-w-[150px]">{asset.name}</span>
                                        <button onClick={() => removeAsset(idx)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: Settings & Action */}
                <div className="xl:col-span-4 flex flex-col gap-6">
                    
                    <div id="tour-converter-step3" className="p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm flex flex-col flex-1">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold font-space uppercase tracking-widest text-muted-foreground">{t('tools.step_3', "3. Engine Settings")}</h3>
                            <Settings className="h-4 w-4 text-muted-foreground" />
                        </div>

                        <div className="space-y-5 flex-1">
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">{t('tools.paper_size', "Paper Size")}</Label>
                                <Select value={settings.paper_size} onValueChange={(v) => setSettings({...settings, paper_size: v})}>
                                    <SelectTrigger className="bg-muted/30 rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl border-border/50">
                                        <SelectItem value="a4">{t('tools.a4_standard', "A4 Standard")}</SelectItem>
                                        <SelectItem value="letter">{t('tools.us_letter', "US Letter")}</SelectItem>
                                        <SelectItem value="legal">{t('tools.us_legal', "US Legal")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">{t('tools.orientation', "Orientation")}</Label>
                                <Select value={settings.orientation} onValueChange={(v) => setSettings({...settings, orientation: v})}>
                                    <SelectTrigger className="bg-muted/30 rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl border-border/50"><SelectItem value="portrait">{t('tools.portrait', "Portrait (Vertical)")}</SelectItem><SelectItem value="landscape">{t('tools.landscape', "Landscape (Horizontal)")}</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">{t('tools.print_backgrounds', "Print Backgrounds")}</Label>
                                <Select value={settings.print_background} onValueChange={(v) => setSettings({...settings, print_background: v})}>
                                    <SelectTrigger className="bg-muted/30 rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl border-border/50"><SelectItem value="true">{t('tools.yes_preserve', "Yes (Preserve Colors/Graphics)")}</SelectItem><SelectItem value="false">{t('tools.no_clean', "No (Clean White Document)")}</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">{t('tools.page_margins', "Page Margins (Inches)")}</Label>
                                <Input type="number" min="0" step="0.1" value={settings.margins} onChange={(e) => setSettings({...settings, margins: parseFloat(e.target.value) || 0})} className="bg-muted/30 rounded-xl font-mono" />
                                <p className="text-[11px] text-muted-foreground">{t('tools.margins_desc', "Set to 0 if your HTML already has internal padding.")}</p>
                            </div>
                        </div>
                    </div>

                    <div id="tour-converter-generate">
                        <Button onClick={handleConvert} disabled={isSubmitDisabled} className={cn("w-full h-16 rounded-[1.5rem] text-base font-bold tracking-wide shadow-lg transition-all duration-300", !isSubmitDisabled ? "bg-primary hover:bg-primary/90 hover:scale-[1.02] shadow-primary/25" : "bg-muted text-muted-foreground shadow-none")}>
                            {isConverting ? <><Loader2 className="h-5 w-5 mr-3 animate-spin" />{t('tools.transpiling', "Transpiling...")}</> : <><FileText className="h-5 w-5 mr-3" />{t('tools.generate_pdf', "Generate PDF")}</>}
                        </Button>
                    </div>
                </div>

                {pdfPreviewUrl && (
                    <div id="tour-converter-output" className="xl:col-span-12 p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm flex flex-col gap-6 animate-in slide-in-from-bottom-6 duration-500">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/50 pb-6">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500"><CheckCircle2 className="h-5 w-5" /></div>
                                <h3 className="text-xl font-bold font-space uppercase tracking-widest text-foreground">{t('tools.pdf_ready', "PDF Ready for Review")}</h3>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                {canUseStorage && (
                                    <Button onClick={handleSaveToCloud} disabled={isSavingToCloud} className="rounded-xl font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20">{isSavingToCloud ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} {t('tools.save_to_cloud', "Save to Cloud")}</Button>
                                )}
                                <Button onClick={handleDiscard} variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"><X className="h-4 w-4" /></Button>
                            </div>
                        </div>
                        <PdfViewer src={pdfPreviewUrl} title={pdfFilename} allowDownload={true} allowPrint={true} className="w-full h-[700px]" />
                    </div>
                )}
            </div>
            
            {canUseStorage && (
                <CloudFilePickerModal isOpen={pickerMode !== null} mode={pickerMode} onClose={() => setPickerMode(null)} onSelect={handleCloudFileSelect} />
            )}
        </div>
    );
}
