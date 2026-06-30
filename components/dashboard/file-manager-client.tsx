"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient, onlineManager } from "@tanstack/react-query";
import { toast } from "sonner";
import { enqueueFileUpload } from "@/lib/offline/file-upload-queue";
import {
  Folder, Star, Share2, Trash2, Clock, Settings, Search, 
  Image as ImageIcon, Video, FileText, Music, Plus, UploadCloud, 
  File as FileIcon, Loader2, Download, Copy, CalendarDays, HardDrive, 
  ImagePlus, Type, Subtitles, ExternalLink, X, Info, Archive, ChevronDown, ChevronUp, Box,
  LayoutGrid, List, SortAsc, MoreVertical, Edit, FolderInput, RefreshCcw, AlertTriangle, Link as LinkIcon,
  Eraser, Wand2, Crop, Square, Monitor, FileImage, Sun, Contrast, Droplets, Palette, Save, RotateCw, FlipHorizontal, FlipVertical, ZoomOut, ZoomIn, Maximize, Minimize, Edit2, RotateCcw, DownloadCloud, Unlink, LockKeyhole, Layers
} from "lucide-react";
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

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getAuthHeaders, getBackendApiRoot, getBackendStorageUrl, getStoredHiveContextSignature, getTenantId, getStreamUrl, getStoredHiveContext, getWorkspaceScopeKey } from "@/lib/runtime-context";
import { authenticatedDownload } from "@/lib/authenticated-download";
import { useTranslation } from "@/store/use-translation";
import { usePermissions } from "@/hooks/use-permissions";
import { useTenantModuleAccess } from "@/hooks/use-tenant-module-access";
import { fetchCurrentTenantSubscriptions } from "@/modules/subscription/api";
import { ModuleSubscriptionCheckoutDialog } from "@/modules/subscription/components/module-subscription-checkout-dialog";

// Reusable Viewer Components
import { VideoPlayer } from "@/components/ui/video-player";
import { AudioPlayer } from "@/components/ui/audio-player";
import { PdfViewer } from "@/components/ui/pdf-viewer";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { Model3DViewer } from "@/components/ui/model-3d-viewer";
import { useGlobalAudio } from "@/context/global-audio-context";

// ============================================================================
// 🚀 SMART PORTAL MENU
// ============================================================================
const SimpleMenu = ({ children, trigger }: { children: React.ReactNode, trigger: React.ReactElement }) => {
    const [open, setOpen] = React.useState(false);
    const [coords, setCoords] = React.useState({ top: 0, left: 0 });
    const triggerRef = React.useRef<HTMLDivElement>(null);
    const menuRef = React.useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => setMounted(true), []);

    React.useEffect(() => {
        const handleOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node) && triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const handleScroll = () => setOpen(false);

        if (open) {
            document.addEventListener("mousedown", handleOutside);
            window.addEventListener("scroll", handleScroll, true); 
            window.addEventListener("resize", handleScroll);
        }
        return () => {
            document.removeEventListener("mousedown", handleOutside);
            window.removeEventListener("scroll", handleScroll, true);
            window.removeEventListener("resize", handleScroll);
        };
    }, [open]);

    const toggleMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (triggerRef.current && !open) {
            const rect = triggerRef.current.getBoundingClientRect();
            const menuWidth = 208; // 13rem = 208px
            const menuHeight = 260; // Estimated max height
            
            const isLeftHalf = rect.left < (window.innerWidth / 2);
            let leftPos = isLeftHalf ? rect.left : (rect.right - menuWidth);

            let topPos = rect.bottom + 8;
            if (topPos + menuHeight > window.innerHeight) {
                topPos = rect.top - menuHeight - 8;
            }

            setCoords({ top: topPos, left: leftPos });
        }
        setOpen(!open);
    };

    return (
        <>
           <div ref={triggerRef} onClick={toggleMenu} className="relative inline-block cursor-pointer z-50 overflow-visible">
                {/* 🚀 THE PERMANENT FIX: Cast 'trigger' to any inside the clone to unlock 'props' access */}
                {React.cloneElement(trigger as React.ReactElement<any>, {
                    className: cn(
                        (trigger as any).props?.className, 
                        open && "opacity-100 bg-background/80 ring-2 ring-emerald-500/50"
                    )
                })}
            </div>
            {mounted && open && createPortal(
              <div 
                  ref={menuRef}
                  onClick={(e) => { e.stopPropagation(); setOpen(false); }} 
                  className="fixed w-52 bg-background border border-border/50 rounded-xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)] z-[999999] flex flex-col py-1.5 animate-in fade-in zoom-in-95 duration-100"
                  style={{ top: coords.top, left: coords.left }}
              >
                {children}
              </div>,
              document.body
            )}
        </>
    )
}

const MenuItem = ({ icon, label, onClick, danger }: any) => (
    <button 
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick && onClick(e); }} 
        className={cn("flex items-center justify-start gap-3 w-full px-4 py-2.5 text-sm text-left hover:bg-muted/60 transition-colors font-medium", danger && "text-red-500 hover:bg-red-500/10")}
    >
        {React.cloneElement(icon, { className: "h-4 w-4 shrink-0" })} <span className="truncate">{label}</span>
    </button>
)

const CHUNK_SIZE = 5 * 1024 * 1024; 

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0 || !bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const getStorageUrl = (url: string | null | undefined) => {
  return getBackendStorageUrl(url) || '';
};

const extractFileIdFromServeUrl = (url: string | null | undefined): number | null => {
  if (!url) return null;
  const match = url.match(/\/api\/v1\/files\/(\d+)\/serve/);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
};

const toCollectionItems = <T,>(value: any): T[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

/**
 * Tenant media URLs need query credentials for native audio/video playback.
 * Central or plain storage URLs can be used as-is.
 */


/**
 * AuthImage – renders <img> tags that require Authorization headers.
 * For tenant sessions, the API returns /files/{id}/serve URLs which are protected.
 * This component fetches via fetch() with the full auth headers and passes a blob URL to <img>.
 * For central sessions or plain storage URLs, it falls back to a direct <img>.
 */
const AuthImage = ({ src, alt, className, style, onError }: { src: string; alt?: string; className?: string; style?: React.CSSProperties; onError?: () => void }) => {
  const isTenantUrl = src?.includes('/api/v1/files/') && src?.includes('/serve');
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!isTenantUrl || !src) return;
    let revoked = false;
    let currentBlob: string | null = null;

    (async () => {
      try {
        const res = await fetch(src, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('auth image failed');
        const blob = await res.blob();
        if (!revoked) {
          currentBlob = URL.createObjectURL(blob);
          setBlobUrl(currentBlob);
        }
      } catch {
        if (!revoked) {
          setFailed(true);
          onError?.();
        }
      }
    })();

    return () => {
      revoked = true;
      if (currentBlob) URL.revokeObjectURL(currentBlob);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  if (!isTenantUrl) {
    return <img src={src} alt={alt} className={className} style={style} onError={onError} />;
  }

  if (failed || (!blobUrl && !src)) {
    return <span className={className} style={style} />;
  }

  if (!blobUrl) {
    return <div className={className} style={style} />;
  }

  return <img src={blobUrl} alt={alt} className={className} style={style} onError={onError} />;
};


const getDownloadNameFromDisposition = (contentDisposition: string | null, fallback: string) => {
  if (!contentDisposition) return fallback;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const basicMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  return basicMatch?.[1] || fallback;
};

// ============================================================================
// 🚀 INLINE IMAGE VIEWER COMPONENT
// ============================================================================
type EditTab = 'transform' | 'adjust' | 'export' | 'ai';

const ColorSlider = ({ icon: Icon, value, onChange, min, max, label }: any) => (
  <div className="flex items-center gap-4 w-full">
    <div className="flex items-center gap-2 w-28 shrink-0 text-muted-foreground">
      <Icon className="h-4 w-4 text-yellow-500" />
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </div>
    <input 
      type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))}
      className="flex-1 h-1.5 bg-muted rounded-full appearance-none accent-yellow-500 cursor-pointer" 
    />
    <span className="text-xs font-mono w-10 text-right text-muted-foreground">{value}%</span>
  </div>
);

const TransformButton = ({ icon: Icon, label, onClick, style, active }: any) => (
  <Button 
    variant="outline" 
    onClick={onClick} 
    className={cn("flex-1 rounded-xl h-10 gap-2 font-medium border-border/50 transition-all", active ? "bg-yellow-500/20 text-yellow-500 border-yellow-500" : "bg-background/50 hover:bg-yellow-500/10 hover:text-yellow-500 hover:border-yellow-500/50")} 
    style={style}
  >
    <Icon className="h-4 w-4 shrink-0" />
    <span className="truncate text-xs font-bold">{label}</span>
  </Button>
);

export function ImageViewer({ src, fetchUrl, alt = "Image preview", className, onSaveEdited, onUpgradeRequested }: any) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const imageRef = React.useRef<HTMLImageElement>(null);
  const cropWrapperRef = React.useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<EditTab>('transform');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [aiLoadingText, setAiLoadingText] = React.useState("");
  
  const [blobSrc, setBlobSrc] = React.useState<string>(''); 
  const [isLoadingBlob, setIsLoadingBlob] = React.useState<boolean>(true);
  const [isIsolatedMode, setIsIsolatedMode] = React.useState<boolean>(false); 

  // Transform States
  const [zoom, setZoom] = React.useState(1);
  const [rotate, setRotate] = React.useState(0);
  const [flipH, setFlipH] = React.useState(false);
  const [flipV, setFlipV] = React.useState(false);
  
  // Color States
  const [brightness, setBrightness] = React.useState(100);
  const [contrast, setContrast] = React.useState(100);
  const [saturation, setSaturation] = React.useState(100);
  const [hue, setHue] = React.useState(0);

  // Export States
  const [resize, setResize] = React.useState({ w: 0, h: 0 });
  const [maintainAspect, setMaintainAspect] = React.useState(true);
  const [exportFormat, setExportFormat] = React.useState('image/jpeg');
  const [exportQuality, setExportQuality] = React.useState(90);

  // Crop States
  const [natSize, setNatSize] = React.useState({ w: 0, h: 0 }); 
  const [cropBox, setCropBox] = React.useState({ x: 0, y: 0, width: 0, height: 0 });
  const [activeHandle, setActiveHandle] = React.useState<string | null>(null); 
  const dragStartInfo = React.useRef<any>(null); 

  // Fetch secure Blob
  React.useEffect(() => {
    const fetchSecureBlob = async () => {
      if (!fetchUrl) {
        setBlobSrc(src);
        setIsLoadingBlob(false);
        return;
      }
      setIsLoadingBlob(true);
      try {
        const response = await fetch(fetchUrl, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error("Failed to secure image");
        const blob = await response.blob();
        setBlobSrc(URL.createObjectURL(blob));
      } catch (error) {
        setBlobSrc(src);
      } finally {
        setIsLoadingBlob(false);
      }
    };
    fetchSecureBlob();
  }, [src, fetchUrl]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditing) return;

      if (e.key === 'Escape') {
        setIsEditing(false);
        resetEdits();
      } else if (e.key === 'Enter') {
        exportEditedImage();
      } else if (activeTab === 'transform') {
        const step = e.shiftKey ? 10 : 1;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault(); 
          setCropBox(prev => {
            let { x, y, width, height } = prev;
            if (e.key === 'ArrowUp') y = Math.max(0, y - step);
            if (e.key === 'ArrowDown') y = Math.min(natSize.h - height, y + step);
            if (e.key === 'ArrowLeft') x = Math.max(0, x - step);
            if (e.key === 'ArrowRight') x = Math.min(natSize.w - width, x + step);
            return { x, y, width, height };
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, activeTab, natSize]);

  const resetEdits = React.useCallback(() => {
    setZoom(1); setRotate(0); setFlipH(false); setFlipV(false);
    setBrightness(100); setContrast(100); setSaturation(100); setHue(0);
    setExportFormat('image/jpeg'); setExportQuality(90);
    setIsIsolatedMode(false); 
    if (natSize.w > 0) {
      setCropBox({ x: 0, y: 0, width: natSize.w, height: natSize.h });
      setResize({ w: natSize.w, h: natSize.h });
    }
  }, [natSize]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNatSize({ w, h });
    setCropBox({ x: 0, y: 0, width: w, height: h });
    if (resize.w === 0) setResize({ w, h });
  };

  const applyCropRatio = (ratio: number | null) => {
    if (!natSize.w || !natSize.h) return;
    
    if (ratio === null) {
      setCropBox({ x: 0, y: 0, width: natSize.w, height: natSize.h });
      setResize({ w: natSize.w, h: natSize.h });
      setMaintainAspect(false);
      return;
    }

    let newW = natSize.w;
    let newH = natSize.w / ratio;

    if (newH > natSize.h) {
      newH = natSize.h;
      newW = natSize.h * ratio;
    }

    const newX = (natSize.w - newW) / 2;
    const newY = (natSize.h - newH) / 2;

    setCropBox({ x: newX, y: newY, width: newW, height: newH });
    setResize({ w: Math.round(newW), h: Math.round(newH) });
    setMaintainAspect(true);
  };

  const applyPreset = (preset: string) => {
    switch(preset) {
      case 'normal': setBrightness(100); setContrast(100); setSaturation(100); setHue(0); break;
      case 'bw': setBrightness(100); setContrast(120); setSaturation(0); setHue(0); break;
      case 'vintage': setBrightness(90); setContrast(110); setSaturation(70); setHue(15); break;
      case 'punch': setBrightness(105); setContrast(130); setSaturation(140); setHue(0); break;
    }
  };

  // 🚀 PHOTO AI BACKGROUND REMOVAL API CALL
  const removeBackgroundOnServer = async () => {
      if (!blobSrc) return;
      setIsProcessing(true);
      setAiLoadingText("Isolating Subject...");
      
      try {
          const response = await fetch(blobSrc);
          const blob = await response.blob();
          
          const formData = new FormData();
          formData.append('file', blob, 'image.png');

          const apiRes = await fetch(`${getBackendApiRoot()}/files/remove-background`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
          });

          if (!apiRes.ok) {
            const errData = await apiRes.json().catch(() => null);
            throw new Error(errData?.message || "Failed to process image on server. The model may still be downloading.");
          }

          const newBlob = await apiRes.blob();
          const newUrl = URL.createObjectURL(newBlob);
          
          setBlobSrc(newUrl);
          setExportFormat('image/png');
          setIsIsolatedMode(true); 
          toast.success("Background removed successfully!");

      } catch (error: any) {
          console.error(error);
          toast.error(error.message || "Failed to remove background. Your model download probably timed out. Try again.");
      } finally {
          setIsProcessing(false);
          setAiLoadingText("");
      }
  };

  // 🚀 LOGO MAGIC WAND API CALL
  const removeLogoBackground = async () => {
      if (!blobSrc) return;
      setIsProcessing(true);
      setAiLoadingText("Scanning Logo Colors...");
      
      try {
          const response = await fetch(blobSrc);
          const imageBlob = await response.blob();
          
          const formData = new FormData();
          formData.append('file', imageBlob, 'image.png');

          const apiRes = await fetch(`${getBackendApiRoot()}/files/remove-logo-background`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
          });

          if (!apiRes.ok) {
            const errData = await apiRes.json().catch(() => null);
            throw new Error(errData?.message || "Failed to process logo.");
          }

          const transparentBlob = await apiRes.blob();
          const newUrl = URL.createObjectURL(transparentBlob);
          
          setBlobSrc(newUrl);
          setExportFormat('image/png');
          setIsIsolatedMode(true);
          toast.success("Logo background punched out successfully!");

      } catch (error: any) {
          console.error(error);
          toast.error(error.message || "Failed to remove logo background.");
      } finally {
          setIsProcessing(false);
          setAiLoadingText("");
      }
  };

  const trimCanvasTransparency = (originalCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = originalCanvas.getContext('2d');
    if (!ctx) return originalCanvas;

    const w = originalCanvas.width;
    const h = originalCanvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const bytesPerRow = w * 4;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    let foundNonTransparent = false;

    for (let y = 0; y < h; y++) {
      const rowOffset = y * bytesPerRow;
      for (let x = 0; x < w; x++) {
        const alpha = data[rowOffset + (x * 4) + 3];
        if (alpha > 5) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          foundNonTransparent = true;
        }
      }
    }

    if (!foundNonTransparent) return originalCanvas; 

    const padding = 2;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(w, maxX + padding);
    maxY = Math.min(h, maxY + padding);

    const trimmedWidth = maxX - minX;
    const trimmedHeight = maxY - minY;

    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = trimmedWidth;
    trimmedCanvas.height = trimmedHeight;
    const trimmedCtx = trimmedCanvas.getContext('2d');
    if (!trimmedCtx) return originalCanvas;

    trimmedCtx.drawImage(originalCanvas, minX, minY, trimmedWidth, trimmedHeight, 0, 0, trimmedWidth, trimmedHeight);

    return trimmedCanvas;
  };

  const exportEditedImage = () => {
    const image = imageRef.current;
    if (!image) return;
    setIsProcessing(true);

    setTimeout(async () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context");

        let dWidth = resize.w || cropBox.width;
        let dHeight = resize.h || cropBox.height;
        const isRotated = rotate % 180 !== 0;

        canvas.width = isRotated ? dHeight : dWidth;
        canvas.height = isRotated ? dWidth : dHeight;

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotate * Math.PI) / 180);
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`;

        ctx.drawImage(image, cropBox.x, cropBox.y, cropBox.width, cropBox.height, -dWidth / 2, -dHeight / 2, dWidth, dHeight);

        if (isIsolatedMode) {
            const finalCanvas = trimCanvasTransparency(canvas);
            
            finalCanvas.toBlob((blob) => {
                if (!blob) {
                    toast.error("Trimming Failed.");
                    setIsProcessing(false); return;
                }
                const ext = 'png'; 
                if (onSaveEdited) {
                    const editedFile = new File([blob], `isolated_subject_${Date.now()}.${ext}`, { type: 'image/png' });
                    onSaveEdited(editedFile);
                    setIsProcessing(false);
                }
                resetEdits(); 
            }, 'image/png'); 
            return; 
        }

        const ext = exportFormat === 'image/jpeg' ? 'jpg' : exportFormat === 'image/png' ? 'png' : 'webp';

        canvas.toBlob((blob) => {
          if (!blob) {
            toast.error("Export Failed. Canvas could not process the image.");
            setIsProcessing(false); return;
          }
          if (onSaveEdited) {
            const editedFile = new File([blob], `edited_${Date.now()}.${ext}`, { type: exportFormat });
            onSaveEdited(editedFile);
            setIsProcessing(false);
          } else {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = `edited_${Date.now()}.${ext}`;
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
            URL.revokeObjectURL(url); setIsProcessing(false);
          }
        }, exportFormat, exportQuality / 100);
      } catch (error) {
        console.error("Canvas export failed:", error);
        toast.error("Security Warning: Canvas was tainted by a CORS rule. The backend must allow local fetches.");
        setIsProcessing(false);
      }
    }, 50);
  };

  const handleHandleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    if (!isEditing || !containerRef.current || !cropWrapperRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const wrapperRect = cropWrapperRef.current.getBoundingClientRect();
    const scaleFactor = natSize.w / wrapperRect.width;

    setActiveHandle(handle);
    dragStartInfo.current = { mouseX: (e.clientX - containerRect.left), mouseY: (e.clientY - containerRect.top), initialBox: { ...cropBox }, scaleFactor };
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!activeHandle || !isEditing || !containerRef.current || !dragStartInfo.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const scale = dragStartInfo.current.scaleFactor;
    const { mouseX, mouseY, initialBox } = dragStartInfo.current;
    
    const currentMouseX = (e.clientX - containerRect.left);
    const currentMouseY = (e.clientY - containerRect.top);
    
    const zoomAdjustedScale = scale / zoom;
    const dxNatural = (currentMouseX - mouseX) * zoomAdjustedScale;
    const dyNatural = (currentMouseY - mouseY) * zoomAdjustedScale;

    let { x, y, width, height } = initialBox;
    const minSize = 20 * scale; 

    switch (activeHandle) {
      case 'tl': x += dxNatural; y += dyNatural; width -= dxNatural; height -= dyNatural; break;
      case 'tr': y += dyNatural; width += dxNatural; height -= dyNatural; break;
      case 'bl': x += dxNatural; width -= dxNatural; height += dyNatural; break;
      case 'br': width += dxNatural; height += dyNatural; break;
      case 'n': y += dyNatural; height -= dyNatural; break;
      case 'e': width += dxNatural; break;
      case 's': height += dyNatural; break;
      case 'w': x += dxNatural; width -= dxNatural; break;
    }

    if (width < minSize) { if (activeHandle.includes('w')) { x -= (minSize - width); width = minSize; } else { width = minSize; } }
    if (height < minSize) { if (activeHandle.includes('n')) { y -= (minSize - height); height = minSize; } else { height = minSize; } }

    if (x < 0) { width += x; x = 0; }
    if (y < 0) { height += y; y = 0; }
    if (x + width > natSize.w) { width = natSize.w - x; }
    if (y + height > natSize.h) { height = natSize.h - y; }

    setCropBox({ x, y, width, height });
    setResize({ w: Math.round(width), h: Math.round(height) });
  }, [activeHandle, isEditing, natSize, zoom]);

  const handleMouseUp = React.useCallback(() => {
    setActiveHandle(null);
    dragStartInfo.current = null;
  }, []);

  React.useEffect(() => {
    if (activeHandle) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }
  }, [activeHandle, handleMouseMove, handleMouseUp]);

  const handleWidthChange = (val: number) => {
    if (val < 10) val = 10;
    if (maintainAspect && cropBox.width > 0) setResize({ w: val, h: Math.round(val * (cropBox.height / cropBox.width)) });
    else setResize(r => ({ ...r, w: val }));
  };

  const handleHeightChange = (val: number) => {
    if (val < 10) val = 10;
    if (maintainAspect && cropBox.height > 0) setResize({ w: Math.round(val * (cropBox.width / cropBox.height)), h: val });
    else setResize(r => ({ ...r, h: val }));
  };

  const renderHandle = (type: string, cssStyle: any) => (
    <div className="absolute h-4 w-4 bg-yellow-500 rounded-full shadow-lg z-20 cursor-move border-2 border-background hover:bg-yellow-400 hover:scale-125 transition-transform" style={cssStyle} onMouseDown={(e) => handleHandleMouseDown(e, type)} />
  );

  return (
    <div ref={containerRef} className={cn("flex flex-col w-full h-full overflow-hidden transition-all duration-300", isFullscreen ? "rounded-none fixed inset-0 z-[100] h-screen bg-background" : "rounded-2xl", className)}>
      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-background/50 backdrop-blur shrink-0 z-10">
        <div className="flex items-center gap-4 px-2 overflow-hidden">
          <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0 relative">
            <ImageIcon className="h-5 w-5 text-yellow-500" />
            {isEditing && <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500"></span></span>}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-base font-black tracking-tight truncate" title={alt}>{alt}</span>
            {natSize.w > 0 && <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{natSize.w} x {natSize.h}px Original</span>}
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {!isEditing ? (
            <>
              <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="h-10 w-10 text-muted-foreground hover:text-yellow-500 hidden sm:flex"><ZoomOut className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="h-10 w-10 text-muted-foreground hover:text-yellow-500 hidden sm:flex"><ZoomIn className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-10 w-10 text-muted-foreground hover:text-yellow-500">{isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}</Button>
              <div className="w-px h-6 bg-border/50 mx-2 hidden sm:block"></div>
              {onSaveEdited ? (
                <Button variant="outline" onClick={() => setIsEditing(true)} className="h-10 rounded-xl border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 transition-colors font-bold px-6"><Edit2 className="h-4 w-4 mr-2" /> Edit Image</Button>
              ) : null}
              {!onSaveEdited && onUpgradeRequested ? (
                <Button variant="outline" onClick={onUpgradeRequested} className="h-10 rounded-xl border-primary/30 text-primary hover:bg-primary/10 transition-colors font-bold px-6"><LockKeyhole className="h-4 w-4 mr-2" /> Subscribe to Edit</Button>
              ) : null}
            </>
          ) : (
            <>
              <div className="hidden md:flex items-center gap-2 mr-2">
                <Badge variant="outline" className="font-mono bg-background">ESC = Cancel</Badge>
                <Badge variant="outline" className="font-mono bg-background">ENTER = Save</Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={resetEdits} className="h-10 w-10 text-red-500 hover:bg-red-500/10" title="Reset All Edits"><RotateCcw className="h-4 w-4" /></Button>
              <Button variant="ghost" onClick={() => { setIsEditing(false); resetEdits(); }} className="h-10 text-muted-foreground hover:text-foreground rounded-xl px-4"><X className="h-4 w-4 mr-2" /> Cancel</Button>
              <Button onClick={exportEditedImage} disabled={isProcessing} className="h-10 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black shadow-md font-black px-6 transition-all">{isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}{isProcessing ? 'Saving...' : 'Save as New'}</Button>
            </>
          )}
        </div>
      </div>

      <div className="relative flex-1 min-h-0 w-full bg-black/40 overflow-hidden flex items-center justify-center p-6">
        {isLoadingBlob && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-yellow-500 z-50 bg-black/20 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <span className="text-xs font-bold font-mono tracking-widest uppercase">Fetching Secure File...</span>
            </div>
        )}

        <div className="transition-transform duration-200 ease-out origin-center flex items-center justify-center max-w-full max-h-full" style={{ transform: `scale(${zoom}) rotate(${rotate}deg)` }}>
          <div ref={cropWrapperRef} className={cn("relative shadow-2xl rounded-md flex items-center justify-center", activeTab === 'ai' ? "bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHUlEQVQ4jWNgYGAQIYAJ8B8E8P//D4cTzRgG/QEAP0Q/waVv2YgAAAAASUVORK5CYII=')] bg-repeat" : "")} style={{ aspectRatio: natSize.w && natSize.h ? `${natSize.w}/${natSize.h}` : 'auto', maxHeight: '60vh', maxWidth: '100%' }}>
            {blobSrc && (
                <img 
                  ref={imageRef} src={blobSrc} alt={alt} onLoad={handleImageLoad}
                  className={cn("max-h-[60vh] max-w-full object-contain transition-all duration-200 rounded-md block pointer-events-none", natSize.w ? "w-full h-full" : "")}
                  style={{ transform: `scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`, filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)` }}
                />
            )}

            {isEditing && natSize.w > 0 && activeTab !== 'ai' && (
                <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none rounded-md">
                    <div 
                      className="absolute bg-transparent border-[3px] border-dashed border-yellow-500 pointer-events-auto cursor-move transition-none shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]"
                      style={{ left: `${(cropBox.x / natSize.w) * 100}%`, top: `${(cropBox.y / natSize.h) * 100}%`, width: `${(cropBox.width / natSize.w) * 100}%`, height: `${(cropBox.height / natSize.h) * 100}%` }}
                    >
                        {renderHandle('tl', { left: '-8px', top: '-8px' })}
                        {renderHandle('tr', { right: '-8px', top: '-8px' })}
                        {renderHandle('bl', { left: '-8px', bottom: '-8px' })}
                        {renderHandle('br', { right: '-8px', bottom: '-8px' })}
                        {renderHandle('n', { left: 'calc(50% - 8px)', top: '-8px' })}
                        {renderHandle('e', { right: '-8px', top: 'calc(50% - 8px)' })}
                        {renderHandle('s', { left: 'calc(50% - 8px)', bottom: '-8px' })}
                        {renderHandle('w', { left: '-8px', top: 'calc(50% - 8px)' })}
                    </div>
                </div>
            )}
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="border-t border-border/50 bg-background/95 backdrop-blur shrink-0 animate-in slide-in-from-bottom-4 flex flex-col z-20">
          
          <div className="flex items-center justify-center gap-6 md:gap-8 px-4 border-b border-border/40 overflow-x-auto custom-scrollbar">
             <button onClick={() => setActiveTab('transform')} className={cn("py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap", activeTab === 'transform' ? "border-yellow-500 text-yellow-500" : "border-transparent text-muted-foreground hover:text-foreground")}>Crop & Rotate</button>
             <button onClick={() => setActiveTab('adjust')} className={cn("py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap", activeTab === 'adjust' ? "border-yellow-500 text-yellow-500" : "border-transparent text-muted-foreground hover:text-foreground")}>Filters</button>
             <button onClick={() => setActiveTab('ai')} className={cn("py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap flex items-center gap-2", activeTab === 'ai' ? "border-purple-500 text-purple-500" : "border-transparent text-muted-foreground hover:text-purple-400")}><Wand2 className="h-3.5 w-3.5" /> AI Magic</button>
             <button onClick={() => setActiveTab('export')} className={cn("py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap", activeTab === 'export' ? "border-yellow-500 text-yellow-500" : "border-transparent text-muted-foreground hover:text-foreground")}>Export Options</button>
          </div>

          <div className="p-6 w-full flex justify-center h-52 overflow-y-auto">
            
            {/* TRANSFORM & CROP TAB */}
            {activeTab === 'transform' && (
               <div className="flex flex-col items-center max-w-xl w-full space-y-5 pt-1">
                 
                 <div className="flex w-full gap-3">
                   <TransformButton icon={RotateCw} label="Rotate Left" onClick={() => setRotate(r => r - 90)} style={{'transform':'scaleX(-1)'}} />
                   <TransformButton icon={RotateCw} label="Rotate Right" onClick={() => setRotate(r => r + 90)} />
                   <Button variant="outline" size="icon" onClick={() => setFlipH(!flipH)} className={cn("w-12 h-10 shrink-0 rounded-xl border-border/50 hover:text-yellow-500 transition-colors", flipH && "bg-yellow-500/10 text-yellow-500 border-yellow-500/50")} title="Flip Horizontal"><FlipHorizontal className="h-4 w-4" /></Button>
                   <Button variant="outline" size="icon" onClick={() => setFlipV(!flipV)} className={cn("w-12 h-10 shrink-0 rounded-xl border-border/50 hover:text-yellow-500 transition-colors", flipV && "bg-yellow-500/10 text-yellow-500 border-yellow-500/50")} title="Flip Vertical"><FlipVertical className="h-4 w-4" /></Button>
                 </div>

                 <div className="w-full h-px bg-border/40 my-1"></div>
                 
                 <div className="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-20">Crop Ratio</span>
                    <div className="flex-1 flex gap-2 w-full">
                       <TransformButton icon={Crop} label="Free" onClick={() => applyCropRatio(null)} />
                       <TransformButton icon={Square} label="1:1" onClick={() => applyCropRatio(1)} />
                       <TransformButton icon={Monitor} label="16:9" onClick={() => applyCropRatio(16/9)} />
                       <TransformButton icon={FileImage} label="4:3" onClick={() => applyCropRatio(4/3)} />
                    </div>
                 </div>

               </div>
            )}

            {/* FILTERS & ADJUST TAB */}
            {activeTab === 'adjust' && (
              <div className="flex flex-col items-center max-w-4xl w-full">
                <div className="flex flex-wrap items-center gap-3 w-full justify-center mb-5">
                   <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-2">Presets</span>
                   <Button variant="outline" size="sm" onClick={() => applyPreset('normal')} className="h-8 text-xs rounded-lg">Normal</Button>
                   <Button variant="outline" size="sm" onClick={() => applyPreset('bw')} className="h-8 text-xs rounded-lg hover:text-white hover:bg-slate-800">B&W</Button>
                   <Button variant="outline" size="sm" onClick={() => applyPreset('vintage')} className="h-8 text-xs rounded-lg hover:text-amber-700 hover:bg-amber-100 border-amber-200">Vintage</Button>
                   <Button variant="outline" size="sm" onClick={() => applyPreset('punch')} className="h-8 text-xs rounded-lg hover:text-blue-500 hover:bg-blue-50 border-blue-200">Punch</Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4 w-full">
                  <ColorSlider label="Brightness" icon={Sun} value={brightness} onChange={setBrightness} min={0} max={200} />
                  <ColorSlider label="Contrast" icon={Contrast} value={contrast} onChange={setContrast} min={0} max={200} />
                  <ColorSlider label="Saturation" icon={Droplets} value={saturation} onChange={setSaturation} min={0} max={200} />
                  <ColorSlider label="Hue Tint" icon={Palette} value={hue} onChange={setHue} min={0} max={360} />
                </div>
              </div>
            )}

            {/* 🚀 NEW: AI MAGIC TAB (Dual Options) */}
            {activeTab === 'ai' && (
              <div className="flex flex-col items-center max-w-4xl w-full pt-2">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
                     
                     {/* Option 1: AI For Photos */}
                     <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-6 text-center w-full flex flex-col h-full">
                        <div className="h-10 w-10 bg-purple-500/20 text-purple-500 rounded-full flex items-center justify-center mx-auto mb-3 shrink-0">
                           <Eraser className="h-5 w-5" />
                        </div>
                        <h4 className="font-bold text-purple-500 mb-2 text-sm">AI Subject Isolation</h4>
                        <p className="text-xs text-muted-foreground mb-4 flex-1">Best for real photos (people, cars, products). Uses deep learning to guess organic boundaries.</p>
                        
                        <Button onClick={removeBackgroundOnServer} disabled={isProcessing} className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl h-10 mt-auto shrink-0">
                           {isProcessing && aiLoadingText.includes('Isolating') ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {aiLoadingText}</> : <><Wand2 className="h-4 w-4 mr-2" /> Photo AI</>}
                        </Button>
                     </div>

                     {/* Option 2: PHP Magic Wand for Logos */}
                     <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 text-center w-full flex flex-col h-full">
                        <div className="h-10 w-10 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-3 shrink-0">
                           <Crop className="h-5 w-5" />
                        </div>
                        <h4 className="font-bold text-blue-500 mb-2 text-sm">Logo "Magic Wand"</h4>
                        <p className="text-xs text-muted-foreground mb-4 flex-1">Best for flat graphics and logos. Detects the background color and punches it out everywhere.</p>
                        
                        <Button onClick={removeLogoBackground} disabled={isProcessing} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl h-10 mt-auto shrink-0">
                           {isProcessing && aiLoadingText.includes('Scanning') ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {aiLoadingText}</> : <><Square className="h-4 w-4 mr-2" /> Logo Cutout</>}
                        </Button>
                     </div>

                 </div>
              </div>
            )}

            {/* EXPORT SETTINGS TAB */}
            {activeTab === 'export' && (
              <div className="flex flex-col items-center max-w-2xl w-full space-y-6 pt-2">
                <div className="flex flex-col sm:flex-row items-center w-full gap-4 sm:gap-8">
                    
                    {/* Format Selector */}
                    <div className="flex-1 w-full space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1"><Settings className="h-3 w-3 inline mr-1 -mt-0.5" /> Export Format</label>
                        <select 
                            value={exportFormat} 
                            onChange={(e) => setExportFormat(e.target.value)}
                            className="w-full bg-background border border-border/50 h-12 rounded-xl text-sm px-4 focus:ring-2 focus:ring-yellow-500 font-bold"
                        >
                            <option value="image/jpeg">JPEG (.jpg) - Smallest Size</option>
                            <option value="image/png">PNG (.png) - Supports Transparency</option>
                            <option value="image/webp">WEBP (.webp) - Web Optimized</option>
                        </select>
                    </div>

                    {/* Compression Slider */}
                    <div className="flex-1 w-full space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1"><DownloadCloud className="h-3 w-3 inline mr-1 -mt-0.5" /> Compression Quality</label>
                        <div className="flex items-center gap-4 bg-muted/20 h-12 px-4 rounded-xl border border-border/50 w-full">
                            <input 
                                type="range" min="10" max="100" value={exportQuality} 
                                onChange={(e) => setExportQuality(Number(e.target.value))}
                                disabled={exportFormat === 'image/png'} // PNG is lossless
                                className="flex-1 h-1.5 bg-muted rounded-full appearance-none accent-yellow-500 cursor-pointer disabled:opacity-30" 
                            />
                            <span className={cn("text-xs font-mono font-bold w-10 text-right", exportFormat === 'image/png' ? 'text-muted-foreground/30' : 'text-foreground')}>{exportQuality}%</span>
                        </div>
                    </div>

                </div>

                <div className="flex items-center gap-4 bg-muted/20 p-4 rounded-2xl border border-border/50 w-full justify-center">
                  <div className="space-y-1.5 flex-1 max-w-[150px]">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Width (px)</label>
                    <Input type="number" value={resize.w} onChange={(e) => handleWidthChange(Number(e.target.value))} className="bg-background font-mono font-bold text-center rounded-xl h-10 w-full text-sm border-border/50 focus-visible:ring-yellow-500" />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setMaintainAspect(!maintainAspect)} className={cn("mt-6 shrink-0 rounded-xl h-10 w-10 transition-colors", maintainAspect ? "text-yellow-500 bg-yellow-500/10" : "text-muted-foreground bg-muted")} title={maintainAspect ? "Unlock Aspect Ratio" : "Lock Aspect Ratio"}>
                    {maintainAspect ? <LinkIcon className="h-5 w-5" /> : <Unlink className="h-5 w-5" />}
                  </Button>
                  <div className="space-y-1.5 flex-1 max-w-[150px]">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Height (px)</label>
                    <Input type="number" value={resize.h} onChange={(e) => handleHeightChange(Number(e.target.value))} className="bg-background font-mono font-bold text-center rounded-xl h-10 w-full text-sm border-border/50 focus-visible:ring-yellow-500" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function FileManagerClient({ tenantName, isPickerMode, onFileSelect, access }: { tenantName?: string, isPickerMode?: boolean, onFileSelect?: (file: any) => void, access?: { canRead: boolean; canManage: boolean } }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { playTrack, syncFavoriteStatus, currentTrack } = useGlobalAudio();
  const { hasAnyPermission, hasPermission } = usePermissions();
  const { hasModule } = useTenantModuleAccess();
  const tenantId = getTenantId();
  const isTenantWorkspace = Boolean(tenantId);
  
  const canRead = access?.canRead ?? hasAnyPermission(["view_storage", "manage_storage"]);
  const canManage = access?.canManage ?? hasPermission("manage_storage");
  const hasVideoPlayer = !isTenantWorkspace || hasModule("video_player");
  const hasAudioPlayer = !isTenantWorkspace || hasModule("audio_player");
  const hasImageEditor = hasModule("image_editor");

  const [checkoutModuleSlug, setCheckoutModuleSlug] = React.useState<"image_editor" | "video_player" | "audio_player" | null>(null);

  const { data: subscriptionData } = useQuery({
    queryKey: ["tenant-current-subscriptions", "file-manager"],
    queryFn: fetchCurrentTenantSubscriptions,
    enabled: isTenantWorkspace && canRead,
    staleTime: 300_000,
  });

  const paymentMethods = subscriptionData?.data?.payment_methods ?? [];
  const lockedModule = checkoutModuleSlug
    ? subscriptionData?.data?.module_subscriptions?.catalog_modules?.find(
        (module: any) => module.slug === checkoutModuleSlug
      ) ?? null
    : null;
  const workspaceScope = getWorkspaceScopeKey();

  // --- Brand settings for video watermark ---
  const { data: brandData } = useQuery({
    queryKey: ['publicBrandSettings', 'file-manager', workspaceScope],
    queryFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/settings/brand/public`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 600_000, // 10 minutes
  });
  const watermarkText: string | null = brandData?.data?.hide_watermark
    ? null
    : (brandData?.data?.app_title || 'HIVE.OS');

  // --- Download loading state ---
  const [downloadingFileId, setDownloadingFileId] = React.useState<number | null>(null);
  const [downloadProgress, setDownloadProgress] = React.useState<number>(0);
  const [downloadPhase, setDownloadPhase] = React.useState<"preparing" | "downloading" | null>(null);

  // --- Core State ---
  const { data: playlistsData } = useQuery({
    queryKey: ["playlists"],
    queryFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/playlists`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: canRead,
  });

  const playlists = playlistsData || [];
  const [activeFilter, setActiveFilter] = React.useState<"all" | "favorites" | "trash" | "recent">("all");
  const [activeTypeFilter, setActiveTypeFilter] = React.useState<"image" | "video" | "document" | "audio" | "model" | "archive" | "other" | null>(null);
  const [activePlaylistId, setActivePlaylistId] = React.useState<number | null>(null);
  const [currentFolderId, setCurrentFolderId] = React.useState<number | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  
  // --- Playlist Modal States ---
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = React.useState(false);
  const [itemToAddToPlaylist, setItemToAddToPlaylist] = React.useState<{id: number, type: 'file' | 'folder'} | null>(null);

  // ── Authenticated download helper ─────────────────────────────────────────
  // Uses fetch with auth headers so tenants also get the correct file.
  // ── Authenticated download helper ─────────────────────────────────────────
  // Uses two-stage approach: 1. Prepare (Async/Queue) 2. Trigger (Direct Browser Link)
  const downloadFile = React.useCallback(async (fileId: number, filename: string) => {
    if (downloadingFileId) return; // prevent double-click
    setDownloadingFileId(fileId);
    setDownloadPhase("preparing");
    setDownloadProgress(0);
    
    try {
      const apiRoot = getBackendApiRoot();
      const prepareUrl = `${apiRoot}/files/${fileId}/prepare-download`;
      let attempt = 0;
      let didShowPreparingToast = false;

      const pollPreparation = async (): Promise<string | null> => {
        const res = await fetch(prepareUrl, { headers: getAuthHeaders() });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.message || 'Download preparation failed.');
        }

        if (data.status === 'ready') {
          return `${apiRoot}/files/${fileId}/download`;
        }

          if (data.status === 'processing' && attempt < 120) { // Max 6 minutes
            if (!didShowPreparingToast) {
              didShowPreparingToast = true;
              toast.loading("Downloading your video...", { id: `download-${fileId}` });
            }
            
            // Update the UI progress state
            if (typeof data.progress === 'number') {
              setDownloadProgress(data.progress);
              toast.loading(`Preparing download: ${data.progress}%`, { id: `download-${fileId}` });
            }
            
            attempt++;
            const waitTime = (data.retry_after || 3) * 1000;
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return pollPreparation();
          }

        throw new Error('Preparation timed out. Please try again later.');
      };

      const finalDownloadUrl = await pollPreparation();
      
      if (finalDownloadUrl) {
        if (didShowPreparingToast) {
          toast.dismiss(`download-${fileId}`);
        }

        setDownloadPhase("downloading");
        setDownloadProgress(0);
        toast.loading("Downloading file...", { id: `download-${fileId}` });

        await authenticatedDownload(finalDownloadUrl, {
          filename,
          headers: getAuthHeaders(),
          onProgress: (progress) => {
            setDownloadProgress(progress);
            toast.loading(`Downloading file: ${progress}%`, { id: `download-${fileId}` });
          },
        });

        toast.success("Download complete.", { id: `download-${fileId}` });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Download failed. Please try again.');
      toast.dismiss(`download-${fileId}`);
    } finally {
      setDownloadingFileId(null);
      setDownloadPhase(null);
      setDownloadProgress(0);
    }
  }, [downloadingFileId]);

  const [showAllFiles, setShowAllFiles] = React.useState(false);

  // --- Advanced UI State ---
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = React.useState<"date" | "name" | "size">("date");
  const [selectedItems, setSelectedItems] = React.useState<{type: 'file'|'folder', id: number}[]>([]);
  
  // --- Action Modal States ---
  const [renameTarget, setRenameTarget] = React.useState<{type: 'file'|'folder', id: number, name: string} | null>(null);
  const [newName, setNewName] = React.useState("");
  const [isMoveModalOpen, setIsMoveModalOpen] = React.useState(false);
  const [moveTargetFolder, setMoveTargetFolder] = React.useState<string>("root");
  const [itemsToMove, setItemsToMove] = React.useState<{type: 'file'|'folder', id: number}[]>([]);

  // Automatically reset selections and views when navigating
  React.useEffect(() => {
    setShowAllFiles(false);
    setSelectedItems([]);
  }, [activeFilter, activeTypeFilter, currentFolderId, searchQuery]);

  React.useEffect(() => {
    if (canManage) {
      return;
    }

    setSelectedItems([]);
    setIsCreateFolderOpen(false);
    setIsUploadOpen(false);
    setIsMoveModalOpen(false);
    setRenameTarget(null);
    setSubtitleFile(null);
    setIsSubtitleModalOpen(false);
  }, [canManage]);

  React.useEffect(() => {
    if (!hasVideoPlayer) {
      setIsSubtitleModalOpen(false);
      setSubtitleFile(null);
    }
  }, [hasVideoPlayer]);

  // --- Creation & Upload States ---
  const [isCreateFolderOpen, setIsCreateFolderOpen] = React.useState(false);
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);

  // Log state changes for debugging
  React.useEffect(() => {
    console.log('isUploadOpen changed:', isUploadOpen);
  }, [isUploadOpen]);

  const [selectedFile, setSelectedFile] = React.useState<any | null>(null); 
  const [folderName, setFolderName] = React.useState("");
  const [uploadBaseName, setUploadBaseName] = React.useState("");
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [customThumbnail, setCustomThumbnail] = React.useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const [uploadTargetFolder, setUploadTargetFolder] = React.useState<string>("root");

  const [isSubtitleModalOpen, setIsSubtitleModalOpen] = React.useState(false);
  const [subtitleFile, setSubtitleFile] = React.useState<File | null>(null);
  const [subtitleLang, setSubtitleLang] = React.useState("en");
  const [subtitleLabel, setSubtitleLabel] = React.useState("English");

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const thumbInputRef = React.useRef<HTMLInputElement>(null);
  const subtitleInputRef = React.useRef<HTMLInputElement>(null);

  const MAX_STORAGE_BYTES = 5 * 1024 * 1024 * 1024; 

  const { data, isLoading } = useQuery({
    queryKey: ["files", currentFolderId, activeFilter, activePlaylistId],
    queryFn: async () => {
      const params = new URLSearchParams({ filter: activeFilter });
      if (currentFolderId) params.append('folder_id', currentFolderId.toString());
      if (activePlaylistId) params.append('playlist_id', activePlaylistId.toString());

      const res = await fetch(`${getBackendApiRoot()}/files?${params}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch files");
      return res.json();
    },
    enabled: canRead,
  });

  const folderItems = React.useMemo(() => toCollectionItems<any>(data?.data?.folders), [data?.data?.folders]);
  const fileItems = React.useMemo(() => toCollectionItems<any>(data?.data?.files), [data?.data?.files]);

  React.useEffect(() => {
    if (!selectedFile || fileItems.length === 0) {
      return;
    }

    const refreshedFile = fileItems.find((file: any) => file.id === selectedFile.id);
    if (!refreshedFile) {
      return;
    }

    const currentMedia = selectedFile.media_details ?? {};
    const nextMedia = refreshedFile.media_details ?? {};
    const didMediaStateChange =
      selectedFile.is_favorite !== refreshedFile.is_favorite ||
      currentMedia.hls_path !== nextMedia.hls_path ||
      currentMedia.url !== nextMedia.url ||
      currentMedia.thumbnail !== nextMedia.thumbnail ||
      currentMedia.title !== nextMedia.title ||
      (currentMedia.subtitles?.length ?? 0) !== (nextMedia.subtitles?.length ?? 0);

    if (didMediaStateChange) {
      setSelectedFile(refreshedFile);
    }
  }, [fileItems, selectedFile]);

  React.useEffect(() => {
    const waitingForAdaptiveQuality = Boolean(
      selectedFile?.media_details?.mime_type?.startsWith('video/') &&
      !selectedFile?.media_details?.hls_path
    );

    if (!waitingForAdaptiveQuality) {
      return;
    }

    const intervalId = window.setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [queryClient, selectedFile]);

  React.useEffect(() => {
    const selectedMime = selectedFile?.media_details?.mime_type || "";
    const shouldPrewarmDownload =
      selectedFile &&
      (selectedMime.startsWith("video/") || selectedMime.startsWith("audio/"));

    if (!shouldPrewarmDownload) {
      return;
    }

    const controller = new AbortController();

    fetch(`${getBackendApiRoot()}/files/${selectedFile.id}/prepare-download`, {
      headers: getAuthHeaders(),
      signal: controller.signal,
    }).catch(() => undefined);

    return () => controller.abort();
  }, [selectedFile]);

  // ==============================================================================
  // 🚀 ADVANCED MUTATIONS (Rename, Move, Trash Management)
  // ==============================================================================
  
  const renameMut = useMutation({
    mutationFn: async ({ type, id, name }: any) => {
        const res = await fetch(`${getBackendApiRoot()}/files/rename`, {
            method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ type, id, name })
        });
        if (!res.ok) throw new Error("Failed to rename item");
        return res.json();
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["files"] });
        toast.success("Renamed successfully");
        setRenameTarget(null);
        setNewName("");
    },
    onError: (err: any) => toast.error(err.message)
  });

  const moveItemsMut = useMutation({
      mutationFn: async () => {
          const destId = moveTargetFolder === "root" ? null : parseInt(moveTargetFolder);
          const res = await fetch(`${getBackendApiRoot()}/files/move`, {
              method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({ items: itemsToMove, destination_folder_id: destId })
          });
          if (!res.ok) throw new Error("Failed to move items");
          return res.json();
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["files"] });
          toast.success("Items moved successfully!");
          setIsMoveModalOpen(false);
          setSelectedItems([]);
      },
      onError: (err: any) => toast.error(err.message)
  });

  const emptyTrashMut = useMutation({
    mutationFn: async () => {
        const res = await fetch(`${getBackendApiRoot()}/files/trash/empty`, { method: 'POST', headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Failed to empty trash");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["files"] }); toast.success("Recycle bin emptied"); setSelectedItems([]); }
  });

  const restoreItemsMut = useMutation({
    mutationFn: async (items: any[]) => {
        const res = await fetch(`${getBackendApiRoot()}/files/trash/restore`, {
            method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ items })
        });
        if (!res.ok) throw new Error("Failed to restore items");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["files"] }); toast.success("Items restored successfully"); setSelectedItems([]); }
  });

  const forceDeleteItemsMut = useMutation({
    mutationFn: async (items: any[]) => {
        const res = await fetch(`${getBackendApiRoot()}/files/trash/force-delete`, {
            method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ items })
        });
        if (!res.ok) throw new Error("Failed to delete items permanently");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["files"] }); toast.success("Items permanently deleted"); setSelectedItems([]); }
  });

  const shareLinkMut = useMutation({
    mutationFn: async ({ type, id }: any) => {
        const res = await fetch(`${getBackendApiRoot()}/files/${type}/${id}/share`, { method: 'POST', headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Failed to generate link");
        return res.json();
    },
    onSuccess: (data) => {
        navigator.clipboard.writeText(data.link || "https://hive.os/share/mock-link-8x92a");
        toast.success("Secure sharing link copied to clipboard!");
    }
  });

  // ==============================================================================
  // Existing Base Mutations (Upload, Delete, Favorite)
  // ==============================================================================

  const saveEditedImageMut = useMutation({
    mutationFn: async ({ file, originalId }: { file: File, originalId: number }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('original_id', originalId.toString());

      const res = await fetch(`${getBackendApiRoot()}/files/save-edited`, {
        method: 'POST', headers: getAuthHeaders(), body: formData
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        if (res.status === 402 && payload?.module?.slug === "image_editor") {
          throw Object.assign(new Error(payload?.message || "Image Editor requires a subscription."), {
            module: "image_editor",
          });
        }
        throw new Error(payload?.message || "Failed to save edited image");
      }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["files"] }); toast.success("Edited image saved successfully!"); setSelectedFile(null); },
    onError: (error: any) => {
      if (error?.module === "image_editor") {
        setCheckoutModuleSlug("image_editor");
        return;
      }

      toast.error(error?.message || "Failed to save edited image");
    },
  });

  const deleteMut = useMutation({
    mutationFn: async ({ type, id }: { type: 'file' | 'folder', id: number }) => {
      const res = await fetch(`${getBackendApiRoot()}/files/${type}/${id}`, {
        method: 'DELETE', headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["files"] }); toast.success("Moved to recycle bin"); setSelectedFile(null); setSelectedItems([]); }
  });

  const toggleFavoriteMut = useMutation({
    mutationFn: async ({ type, id }: { type: 'file' | 'folder', id: number }) => {
      const res = await fetch(`${getBackendApiRoot()}/files/${type}/${id}/favorite`, {
        method: 'POST', headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to toggle favorite");
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });

      // Synchronize with Global Audio Context if this is an audio file
      if (variables.type === 'file' && currentTrack && currentTrack.id === variables.id) {
        // Update the internal state of the audio context to match the new backend state
        syncFavoriteStatus(variables.id, data.is_favorite); 
      }

      if (selectedFile && selectedFile.id === variables.id && variables.type === 'file') {
        const newStatus = !selectedFile.is_favorite;
        setSelectedFile({ ...selectedFile, is_favorite: newStatus });
        toast.success(newStatus ? "Added to favorites! ❤️" : "Removed from favorites 🤍");
      } else {
        toast.success("Favorite status updated");
      }
    }
  });

  const createFolderMut = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`${getBackendApiRoot()}/files/folder`, {
        method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name, parent_id: currentFolderId })
      });
      if (!res.ok) throw new Error("Failed to create folder");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["files"] }); toast.success("Folder created successfully"); setIsCreateFolderOpen(false); setFolderName(""); }
  });

  const addToPlaylistMut = useMutation({
    mutationFn: async ({ playlistId, fileId }: { playlistId: number, fileId: number }) => {
      const res = await fetch(`${getBackendApiRoot()}/playlists/${playlistId}/add`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ file_id: fileId })
      });
      if (!res.ok) throw new Error("Failed to add to playlist");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success("Added to playlist! 🎵");
      setIsAddToPlaylistOpen(false);
      setItemToAddToPlaylist(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add to playlist");
    }
  });

  const createPlaylistMut = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`${getBackendApiRoot()}/playlists`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error("Failed to create playlist");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      toast.success("Playlist created! 🎧");
    }
  });

  const deletePlaylistMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${getBackendApiRoot()}/playlists/${id}`, {
        method: 'DELETE', headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to delete playlist");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      toast.success("Playlist deleted");
      if (activePlaylistId) setActivePlaylistId(null);
    }
  });

  const uploadFileMut = useMutation({
    mutationFn: async (): Promise<{ queued: boolean }> => {
      if (!uploadFile) throw new Error("No file selected");

      const offlineFields: Record<string, string> = {};
      if (uploadTargetFolder !== "root") offlineFields.folder_id = uploadTargetFolder;
      if (uploadBaseName) offlineFields.base_name = uploadBaseName;

      const queueForLater = async () => {
        await enqueueFileUpload({
          file: uploadFile,
          fileName: uploadFile.name,
          fileType: uploadFile.type,
          fields: offlineFields,
          thumbnail: customThumbnail,
          label: `upload ${uploadFile.name}`,
        });
        return { queued: true };
      };

      // No connection: stash the whole file in IndexedDB and sync on reconnect.
      if (!onlineManager.isOnline()) {
        return queueForLater();
      }

      const uploadId = `${Date.now()}-${uploadFile.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const totalChunks = Math.ceil(uploadFile.size / CHUNK_SIZE);

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, uploadFile.size);
        const chunk = uploadFile.slice(start, end);

        const formData = new FormData();
        formData.append("file", chunk);
        formData.append("chunk_index", chunkIndex.toString());
        formData.append("total_chunks", totalChunks.toString());
        formData.append("upload_id", uploadId);
        formData.append("original_name", uploadFile.name);

        if (uploadTargetFolder !== "root") formData.append("folder_id", uploadTargetFolder);
        if (uploadBaseName) formData.append("base_name", uploadBaseName);
        if (chunkIndex === totalChunks - 1 && customThumbnail) formData.append("custom_thumbnail", customThumbnail);

        let res: Response;
        try {
          res = await fetch(`${getBackendApiRoot()}/files/upload`, {
            method: 'POST', headers: getAuthHeaders(), body: formData
          });
        } catch (networkErr) {
          // Connectivity dropped mid-upload — queue the whole file for retry.
          if (networkErr instanceof TypeError) {
            setUploadProgress(0);
            return queueForLater();
          }
          throw networkErr;
        }

        if (!res.ok) {
          const errText = await res.text();
          console.error("Upload 403/Error:", res.status, errText);
          let errMsg = `Upload failed (${res.status}).`;
          try {
            const data = JSON.parse(errText);
            if (data.message) errMsg = data.message;
            if (res.status === 402 && data.module) {
              throw Object.assign(new Error(data.message || "Subscription required."), { module: data.module });
            }
          } catch(e) {}
          setUploadProgress(0);
          throw new Error(errMsg);
        }
        setUploadProgress(Math.round(((chunkIndex + 1) / totalChunks) * 100));
      }
      return { queued: false };
    },
    onSuccess: (result) => {
      if (result?.queued) {
        toast.success("Upload queued — it'll sync automatically when you're back online", { duration: 6000 });
      } else {
        queryClient.invalidateQueries({ queryKey: ["files"] });
        toast.success("File uploaded successfully");
      }
      setIsUploadOpen(false); setUploadFile(null); setCustomThumbnail(null); setUploadBaseName(""); setUploadProgress(0);
    },
    onError: (err: any) => { toast.error(err.message, { duration: 8000 }); setUploadProgress(0); }
  });

  const uploadSubtitleMut = useMutation({
    mutationFn: async ({ fileId, file, lang, label }: any) => {
      const formData = new FormData();
      formData.append('subtitle', file);
      formData.append('language', lang);
      formData.append('label', label);

      const res = await fetch(`${getBackendApiRoot()}/files/upload-subtitle/${fileId}`, {
        method: 'POST', headers: getAuthHeaders(), body: formData
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        if (res.status === 402 && payload?.module?.slug === "video_player") {
          throw Object.assign(new Error(payload?.message || "Video Player requires a subscription."), {
            module: "video_player",
          });
        }
        throw new Error(payload?.message || "Failed to upload subtitle");
      }
      return res.json();
    },
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ["files"] }); toast.success("Subtitle track added successfully!"); setSelectedFile(data.file); setIsSubtitleModalOpen(false); setSubtitleFile(null); },
    onError: (error: any) => {
      if (error?.module === "video_player") {
        setCheckoutModuleSlug("video_player");
        return;
      }

      toast.error(error?.message || "Failed to upload subtitle");
    },
  });

  const deleteSubtitleMut = useMutation({
    mutationFn: async (subtitleUuid: string) => {
      const res = await fetch(`${getBackendApiRoot()}/files/subtitle/${subtitleUuid}`, {
        method: 'DELETE', headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to delete subtitle");
      return res.json();
    },
    onSuccess: (data, deletedUuid) => {
      queryClient.invalidateQueries({ queryKey: ["files"] }); toast.success("Subtitle removed successfully");
      if (selectedFile) { setSelectedFile({ ...selectedFile, media_details: { ...selectedFile.media_details, subtitles: selectedFile.media_details.subtitles.filter((s: any) => s.uuid !== deletedUuid) } }); }
    }
  });


  // --- UI Handlers ---
  const handleCreateFolder = (e: React.FormEvent) => { e.preventDefault(); if (!canManage || !folderName.trim()) return; createFolderMut.mutate(folderName); };
  const handleUploadFile = (e: React.FormEvent) => { e.preventDefault(); if (!canManage) return; if (!uploadFile) return toast.error("Please select a file"); uploadFileMut.mutate(); };
  const handleFileDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (!canManage) return; if (e.dataTransfer.files && e.dataTransfer.files[0]) setUploadFile(e.dataTransfer.files[0]); };
  const handleSubtitleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canManage) return;
    if (!hasVideoPlayer) {
      setCheckoutModuleSlug("video_player");
      if (subtitleInputRef.current) subtitleInputRef.current.value = '';
      return;
    }
    if (e.target.files && e.target.files[0]) { setSubtitleFile(e.target.files[0]); setIsSubtitleModalOpen(true); }
    if (subtitleInputRef.current) subtitleInputRef.current.value = '';
  };
  const submitSubtitle = () => { if (!canManage || !subtitleFile || !selectedFile) return; uploadSubtitleMut.mutate({ fileId: selectedFile.id, file: subtitleFile, lang: subtitleLang, label: subtitleLabel }); };

  const toggleSelection = (type: 'file' | 'folder', id: number) => {
    if (!canManage) return;
    setSelectedItems(prev => {
        const exists = prev.find(i => i.id === id && i.type === type);
        if (exists) return prev.filter(i => !(i.id === id && i.type === type));
        return [...prev, { type, id }];
    });
  };

  const openMoveModal = (items: {type: 'file'|'folder', id: number}[]) => {
      if (!canManage) return;
      setItemsToMove(items);
      setMoveTargetFolder(currentFolderId ? currentFolderId.toString() : "root");
      setIsMoveModalOpen(true);
  };

  // --- Rendering & Filtering Logic ---
  const metrics = data?.metrics || { total_used: 0 };
  let folders = [...folderItems];
  let allFiles = [...fileItems];

  // 🚀 Sorting Execution
  const sortData = (a: any, b: any) => {
      if (sortBy === 'name') {
          const nameA = (a.name || a.media_details?.title || a.media_details?.name || "").toLowerCase();
          const nameB = (b.name || b.media_details?.title || b.media_details?.name || "").toLowerCase();
          return nameA.localeCompare(nameB);
      }
      if (sortBy === 'size') return (b.media_details?.size || 0) - (a.media_details?.size || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); 
  };
  folders = folders.sort(sortData);
  allFiles = allFiles.sort(sortData);

  // Search Filter
  if (searchQuery) {
      const q = searchQuery.toLowerCase();
      folders = folders.filter((f: any) => f.name.toLowerCase().includes(q));
      allFiles = allFiles.filter((f: any) => (f.media_details?.title || f.media_details?.name || "").toLowerCase().includes(q));
  }

  // Type Filter
  const displayedFiles = allFiles.filter((file: any) => {
    if (!activeTypeFilter) return true;
    const mime = file.media_details?.mime_type || '';
    if (activeTypeFilter === 'image') return mime.startsWith('image/');
    if (activeTypeFilter === 'video') return mime.startsWith('video/');
    if (activeTypeFilter === 'audio') return mime.startsWith('audio/');
    if (activeTypeFilter === 'document') return /(document|pdf|text|msword|excel|spreadsheet|powerpoint|presentation|csv)/i.test(mime);
    if (activeTypeFilter === 'model') return mime.startsWith('model/') || (mime === 'application/octet-stream' && (file.media_details?.name?.toLowerCase().endsWith('.glb') || file.media_details?.name?.toLowerCase().endsWith('.gltf')));
    if (activeTypeFilter === 'archive') return /(zip|rar|tar|gzip|7z|compressed)/i.test(mime);
    return !mime.startsWith('image/') && !mime.startsWith('video/') && !mime.startsWith('audio/') && !/(document|pdf|text|msword|excel|spreadsheet|powerpoint|presentation|csv|zip|rar|tar|gzip|7z|compressed)/i.test(mime) && !mime.startsWith('model/');
  });

  const visibleFiles = showAllFiles ? displayedFiles : displayedFiles.slice(0, 5);

  const categoryStats = { image: { size: 0, count: 0 }, video: { size: 0, count: 0 }, document: { size: 0, count: 0 }, audio: { size: 0, count: 0 }, model: { size: 0, count: 0 }, archive: { size: 0, count: 0 }, other: { size: 0, count: 0 } };
  allFiles.forEach((file: any) => {
      const mime = file.media_details?.mime_type || '';
      const size = file.media_details?.size || 0;
      if (mime.startsWith('image/')) { categoryStats.image.size += size; categoryStats.image.count++; }
      else if (mime.startsWith('video/')) { categoryStats.video.size += size; categoryStats.video.count++; }
      else if (mime.startsWith('audio/')) { categoryStats.audio.size += size; categoryStats.audio.count++; }
      else if (/(document|pdf|text|msword|excel|spreadsheet|powerpoint|presentation|csv)/i.test(mime)) { categoryStats.document.size += size; categoryStats.document.count++; }
      else if (mime.startsWith('model/') || (mime === 'application/octet-stream' && (file.media_details?.name?.toLowerCase().endsWith('.glb') || file.media_details?.name?.toLowerCase().endsWith('.gltf')))) { categoryStats.model.size += size; categoryStats.model.count++; }
      else if (/(zip|rar|tar|gzip|7z|compressed)/i.test(mime)) { categoryStats.archive.size += size; categoryStats.archive.count++; }
      else { categoryStats.other.size += size; categoryStats.other.count++; }
  });

  const storagePercentage = (metrics.total_used / MAX_STORAGE_BYTES) * 100;

  if (!canRead) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-[2rem] border border-border/50 bg-card/40 p-8 text-center">
        <div className="max-w-md space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-black tracking-tight">Access Denied</h3>
          <p className="text-sm text-muted-foreground">Your current role does not have permission to view storage files.</p>
        </div>
      </div>
    );
  }

  const renderFilePreview = (file: any) => {
    if (!file || !file.media_details) return null;
    const media = file.media_details;
    const mediaTitle = media.title || media.name;
    const mime = media.mime_type || '';
    const safeUrl = getStorageUrl(media.url);
    // Detect if this is a tenant-served file (uses authenticated API URL)
    let hlsUrl = '';
    // Only use HLS on central — on tenant sessions the HLS endpoint cannot resolve
    // tenant tokens via auth:sanctum (tokens live in tenant DB, not central).
    // Tenant videos fall back to the authenticated /media/stream/{id}?token= URL.
    if (media.hls_path) {
        const cleanPath = media.hls_path.replace(/^\/?(storage\/)?/, '');
        hlsUrl = `${getBackendApiRoot()}/files/stream/${cleanPath.split('/')[0]}/playlist.m3u8`;
    }

    if (mime.startsWith('image/')) {
      return (
        <div className="w-full h-full flex flex-col rounded-2xl overflow-hidden min-h-[50vh]">
           <ImageViewer
             src={safeUrl}
             fetchUrl={media.url?.includes('/api/v1/files/') ? media.url : `${getBackendApiRoot()}/files/${file.id}/download`}
             alt={mediaTitle}
             onSaveEdited={canManage && hasImageEditor ? (f: any) => saveEditedImageMut.mutate({ file: f, originalId: file.id }) : undefined}
             onUpgradeRequested={canManage && !hasImageEditor ? () => setCheckoutModuleSlug("image_editor") : undefined}
           />
        </div>
      );
    }
    
    if (mime.startsWith('video/')) {
      const videoFiles = fileItems.filter((f: any) => f.media_details?.mime_type?.startsWith('video/'));
      const currentIndex = videoFiles.findIndex((f: any) => f.id === file.id);
      const handleNext = () => { if (currentIndex < videoFiles.length - 1) setSelectedFile(videoFiles[currentIndex + 1]); };
      const handlePrev = () => { if (currentIndex > 0) setSelectedFile(videoFiles[currentIndex - 1]); };
      const formattedSubtitles = (media.subtitles || []).map((sub: any) => ({ ...sub, src: sub.uuid ? `${getBackendApiRoot()}/files/subtitle/${sub.uuid}` : sub.src, srcLang: sub.srcLang || 'en', label: sub.label || 'Subtitle', default: sub.default || false }));
      const formattedVersions = (media.video_versions || []).map((v: any) => ({ label: v.label, url: getStreamUrl(getStorageUrl(v.url)) }));
      const nativeSrc = getStreamUrl(safeUrl);
      const adaptiveStreamingReady = Boolean(media.hls_path);

      if (!hasVideoPlayer) {
        return (
          <div className="flex min-h-[400px] w-full flex-col items-center justify-center rounded-2xl border border-border/50 bg-card/40 p-8 text-center shadow-inner">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
              <LockKeyhole className="h-7 w-7 text-primary" />
            </div>
            <h3 className="mt-5 text-2xl font-black tracking-tight text-foreground">Video Player Locked</h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              This tenant can keep the file in storage, but playback and subtitles require the `video_player` module.
            </p>
            {canManage ? (
              <Button onClick={() => setCheckoutModuleSlug("video_player")} className="mt-6 rounded-xl px-6 font-semibold">
                <Layers className="mr-2 h-4 w-4" /> Unlock with Checkout
              </Button>
            ) : null}
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center bg-black rounded-2xl h-full min-h-[400px] border border-border/50 overflow-hidden shadow-inner w-full relative">
          {!adaptiveStreamingReady && (
            <div className="absolute top-4 left-4 z-20 rounded-full border border-white/10 bg-black/65 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/70 backdrop-blur-xl">
              Adaptive quality preparing...
            </div>
          )}
          {hlsUrl || safeUrl ? (
             <VideoPlayer 
                src={hlsUrl || nativeSrc}
                nativeSrc={nativeSrc}
                poster={getStorageUrl(media.thumbnail)} 
                className="w-full h-full" 
                title={mediaTitle}
                authToken={typeof window !== 'undefined' ? localStorage.getItem('hive_token') : null} 
                watermark={watermarkText} 
                onNext={currentIndex < videoFiles.length - 1 ? handleNext : undefined} 
                onPrevious={currentIndex > 0 ? handlePrev : undefined} 
                subtitles={formattedSubtitles} 
                videoVersions={formattedVersions} 
                rememberProgress
                resumeKey={`file-entry:${file.id}`}
                playbackRates={[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]}
                adaptiveQualityPending={!adaptiveStreamingReady}
             />
          ) : (<div className="text-center p-6"><Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-4" /><p className="text-white font-bold text-sm">Processing Video...</p></div>)}
        </div>
      );
    }

    if (mime.startsWith('audio/')) {
      if (!hasAudioPlayer) {
        return (
          <div className="flex h-full min-h-[350px] w-full flex-col items-center justify-center rounded-2xl border border-border/50 bg-muted/10 p-8 text-center">
            <LockKeyhole className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-black text-foreground">Audio Player Subscription Required</p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              This tenant can store audio files, but playback and background queues require the `audio_player` module.
            </p>
            <Button onClick={() => setCheckoutModuleSlug("audio_player")} className="mt-6 rounded-xl px-6 font-semibold">
              Unlock Audio Player
            </Button>
          </div>
        );
      }

      const audioFiles = fileItems.filter((f: any) => f.media_details?.mime_type?.startsWith('audio/'));
      const currentIndex = audioFiles.findIndex((f: any) => f.id === file.id);
      const handleNext = () => { if (currentIndex < audioFiles.length - 1) setSelectedFile(audioFiles[currentIndex + 1]); };
      const handlePrev = () => { if (currentIndex > 0) setSelectedFile(audioFiles[currentIndex - 1]); };
      const currentPlaylist = audioFiles.map((f: any) => ({
        id: f.id,
     src: getStreamUrl(getStorageUrl(f.media_details?.url)),
        title: f.media_details?.title || f.media_details?.name || "Unknown Track",
        artist: f.media_details?.artist || "HIVE.OS Audio",
        coverArt: getStorageUrl(f.media_details?.thumbnail),
        isFavorite: f.is_favorite,
        downloadUrl: `${getBackendApiRoot()}/files/${f.id}/download`,
      }));
   const streamSrc = getStreamUrl(safeUrl);

      return (
        <div className="flex flex-col items-center justify-center rounded-2xl h-full min-h-[350px] border border-border/50 shadow-inner w-full overflow-hidden relative bg-muted/10">
          <div className="absolute top-4 right-4 z-[60]">
             <Button variant="outline" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur border-border/50 shadow-sm hover:bg-emerald-500 hover:border-emerald-500 hover:text-white transition-all rounded-xl group" onClick={() => { playTrack({ id: file.id, src: streamSrc, title: mediaTitle, artist: media.artist || "HIVE.OS Audio", coverArt: getStorageUrl(media.thumbnail), isFavorite: file.is_favorite, downloadUrl: `${getBackendApiRoot()}/files/${file.id}/download` }, currentPlaylist); setSelectedFile(null); }} title="Play in Background">
               <ExternalLink className="h-4 w-4 group-hover:scale-110 transition-transform" />
             </Button>
          </div>
          <AudioPlayer id={file.id} src={streamSrc} title={mediaTitle} artist={media.artist || "HIVE.OS Audio"} coverArt={getStorageUrl(media.thumbnail)} isFavorite={file.is_favorite} trackList={currentPlaylist} downloadUrl={`${getBackendApiRoot()}/files/${file.id}/download`} onNext={currentIndex < audioFiles.length - 1 ? handleNext : undefined} onPrevious={currentIndex > 0 ? handlePrev : undefined} className="shadow-2xl scale-105 z-10 w-[80%] max-w-[450px]" autoPlay={false} />
        </div>
      );
    }

    if (mime === 'application/pdf') return <div className="h-full w-full min-h-[60vh] rounded-2xl overflow-hidden border border-border/50"><PdfViewer src={getStreamUrl(safeUrl)} title={mediaTitle} /></div>;
    
    if (mime.startsWith('model/') || (mime === 'application/octet-stream' && (media.name?.toLowerCase().endsWith('.glb') || media.name?.toLowerCase().endsWith('.gltf')))) {
      return <div className="h-full w-full min-h-[75vh] rounded-2xl overflow-hidden border border-border/50"><Model3DViewer src={getStreamUrl(safeUrl)} alt={mediaTitle} /></div>;
    }
    if (/(document|msword|excel|spreadsheet|powerpoint|presentation|csv)/i.test(mime)) return <div className="h-full w-full min-h-[50vh] rounded-2xl overflow-hidden border border-border/50"><DocumentViewer url={getStreamUrl(safeUrl)} type="office" /></div>;
    return <div className="flex flex-col items-center justify-center bg-muted/20 rounded-2xl h-full min-h-[40vh] border border-dashed border-border/50 w-full"><FileIcon className="h-16 w-16 text-muted-foreground/40 mb-4" /><p className="text-base font-bold text-foreground mb-1">Preview Unavailable</p><Button onClick={() => window.open(getStreamUrl(safeUrl), '_blank')} className="mt-6 rounded-xl shadow-md px-8"><Download className="h-4 w-4 mr-2" /> Download to View</Button></div>;
  };

  return (
    <div className={cn(
      "flex flex-col lg:flex-row gap-4 lg:gap-6 w-full text-foreground",
      isPickerMode ? "h-full" : "min-h-[700px] lg:h-[calc(100vh-6rem)]"
    )}>
      
      {/* 🚀 SIDEBAR (Responsive) */}
      <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4 lg:gap-6 bg-card/40 border border-border/50 rounded-[2rem] p-4 lg:p-5 backdrop-blur-xl overflow-hidden">
        <div>
          <h2 className="text-xl font-black tracking-tight text-foreground">File Manager</h2>
          <p className="text-xs text-muted-foreground mt-1">Organize files for {tenantName || 'Central'}</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search files..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-background/50 border-border/50 h-10 rounded-xl text-sm" />
        </div>

        <nav className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 custom-scrollbar shrink-0">
          <button onClick={() => { setActiveFilter("all"); setCurrentFolderId(null); setActiveTypeFilter(null); setActivePlaylistId(null); }} className={cn("whitespace-nowrap flex-shrink-0 lg:w-full flex items-center px-4 lg:px-3 py-2.5 rounded-xl text-sm font-bold transition-all", activeFilter === "all" && !activePlaylistId ? "bg-emerald-500/10 text-emerald-500" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")}>
            <div className="flex items-center gap-3"><Folder className="h-4 w-4" /> My Files</div>
            {activeFilter === "all" && !currentFolderId && !activePlaylistId && <span className="hidden lg:inline-block ml-auto bg-emerald-500 text-emerald-950 text-[10px] px-2 py-0.5 rounded-full">{folders.length + allFiles.length}</span>}
          </button>
          <button onClick={() => { setActiveFilter("favorites"); setActiveTypeFilter(null); }} className={cn("whitespace-nowrap flex-shrink-0 lg:w-full flex items-center gap-3 px-4 lg:px-3 py-2.5 rounded-xl text-sm font-bold transition-all", activeFilter === "favorites" ? "bg-emerald-500/10 text-emerald-500" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")}>
            <Star className="h-4 w-4" /> Favourites
          </button>
          <button onClick={() => { setActiveFilter("recent"); setActiveTypeFilter(null); setActivePlaylistId(null); }} className={cn("whitespace-nowrap flex-shrink-0 lg:w-full flex items-center gap-3 px-4 lg:px-3 py-2.5 rounded-xl text-sm font-bold transition-all", activeFilter === "recent" ? "bg-emerald-500/10 text-emerald-500" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")}>
            <Clock className="h-4 w-4" /> Recent Files
          </button>
          
          <div className="hidden lg:block h-px bg-border/50 w-full my-2"></div>
          <p className="hidden lg:block text-[10px] font-black uppercase text-muted-foreground tracking-widest px-3 mb-1">Playlists</p>
          <div className="flex lg:flex-col gap-1">
            {playlists.map((pl: any) => (
              <div key={pl.id} className="group/pl relative w-full flex-shrink-0 lg:w-full">
                <div 
                  role="button"
                  tabIndex={0}
                  onClick={() => { setActiveFilter("all"); setActivePlaylistId(pl.id); setCurrentFolderId(null); setActiveTypeFilter(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setActiveFilter("all"); setActivePlaylistId(pl.id); setCurrentFolderId(null); setActiveTypeFilter(null); } }}
                  className={cn("whitespace-nowrap cursor-pointer flex-shrink-0 lg:w-full flex items-center justify-between px-4 lg:px-3 py-2 rounded-xl text-xs font-bold transition-all", activePlaylistId === pl.id ? "bg-pink-500/10 text-pink-500" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Music className="h-3.5 w-3.5" /> {pl.name}
                  </div>
                  {canManage && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); deletePlaylistMut.mutate(pl.id); }}
                      className="opacity-0 group-hover/pl:opacity-100 p-1 hover:bg-red-500/20 rounded-md text-red-500 transition-all ml-2"
                      title="Delete Playlist"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {playlists.length === 0 && <p className="hidden lg:block text-[10px] text-muted-foreground px-3 italic">No playlists yet</p>}
          </div>

          <div className="hidden lg:block h-px bg-border/50 w-full my-2"></div>
          <button onClick={() => { setActiveFilter("trash"); setActiveTypeFilter(null); }} className={cn("whitespace-nowrap flex-shrink-0 lg:w-full flex items-center gap-3 px-4 lg:px-3 py-2.5 rounded-xl text-sm font-bold transition-all", activeFilter === "trash" ? "bg-red-500/10 text-red-500" : "text-muted-foreground hover:bg-red-500/10 hover:text-red-500")}>
            <Trash2 className="h-4 w-4" /> Recycle Bin
          </button>
        </nav>

        <div className="bg-background/40 p-4 rounded-2xl border border-border/50 hidden lg:block mt-auto">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold tracking-wide">Storage</span>
            <span className="text-[10px] text-muted-foreground font-mono">{folders.length + allFiles.length} files</span>
          </div>
          <Progress value={storagePercentage} className="h-1.5 bg-muted mb-2 [&>div]:bg-emerald-500" />
          <p className="text-[10px] text-muted-foreground font-mono">{formatBytes(metrics.total_used)} used of {formatBytes(MAX_STORAGE_BYTES)}</p>
        </div>
      </div>

      {/* 🚀 MAIN CONTENT */}
      <div className="flex-1 flex flex-col gap-4 lg:gap-6 overflow-hidden">
        
        {/* 🚀 DYNAMIC TOP BAR (Bulk Actions vs Standard) */}
        {canManage && selectedItems.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center justify-between bg-emerald-500/10 border border-emerald-500/30 p-4 sm:px-6 rounded-[2rem] lg:rounded-[2.5rem] backdrop-blur-xl shadow-lg animate-in slide-in-from-top-4 gap-4 shrink-0">
                <div className="flex items-center gap-4">
                    <Badge className="bg-emerald-500 text-emerald-950 font-black px-3 py-1 text-sm rounded-lg">{selectedItems.length}</Badge>
                    <span className="font-bold text-emerald-500">Items Selected</span>
                </div>
                <div className="flex gap-2 w-full sm:w-auto overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedItems([])} className="text-emerald-500 hover:bg-emerald-500/20 whitespace-nowrap"><X className="h-4 w-4 mr-2"/> Clear</Button>
                    
                    {activeFilter === 'trash' ? (
                        <>
                            <Button size="sm" variant="outline" className="border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10 rounded-xl whitespace-nowrap" onClick={() => restoreItemsMut.mutate(selectedItems)}>
                                {restoreItemsMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2"/>} Restore
                            </Button>
                            <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold whitespace-nowrap" onClick={() => forceDeleteItemsMut.mutate(selectedItems)}>
                                {forceDeleteItemsMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2"/>} Delete Forever
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button size="sm" variant="outline" className="border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10 rounded-xl whitespace-nowrap" onClick={() => openMoveModal(selectedItems)}>
                                <FolderInput className="h-4 w-4 mr-2"/> Move To
                            </Button>
                            <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold whitespace-nowrap" onClick={() => selectedItems.forEach(item => deleteMut.mutate(item))}>
                                <Trash2 className="h-4 w-4 mr-2"/> Move to Trash
                            </Button>
                        </>
                    )}
                </div>
            </div>
        ) : (
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-card/40 border border-border/50 p-4 lg:p-5 px-6 rounded-[2rem] lg:rounded-[2.5rem] backdrop-blur-xl shrink-0 shadow-sm">
                <div>
                    <h1 className="text-xl lg:text-2xl font-black tracking-tight">{activeFilter === 'trash' ? 'Recycle Bin' : 'Cloud Drive'}</h1>
                    <p className="text-xs lg:text-sm text-muted-foreground mt-1 flex items-center gap-2">
                        {currentFolderId && <Button variant="link" size="sm" className="h-auto p-0 text-emerald-500" onClick={() => setCurrentFolderId(null)}>Root</Button>}
                        {currentFolderId && <span className="text-muted-foreground">/</span>}
                        {activeFilter === 'trash' ? "Items here will be permanently deleted after 30 days." : (activeTypeFilter ? `Filtering by ${activeTypeFilter}s` : "Quick access to your folders and files")}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:gap-3 w-full xl:w-auto">
                    {/* View Toggles */}
                    <div className="bg-background/50 rounded-xl p-1 border border-border/50 flex items-center hidden sm:flex">
                        <Button variant="ghost" size="icon" onClick={() => setViewMode('grid')} className={cn("h-8 w-8 rounded-lg", viewMode === 'grid' && "bg-background shadow-sm")}><LayoutGrid className="h-4 w-4"/></Button>
                        <Button variant="ghost" size="icon" onClick={() => setViewMode('list')} className={cn("h-8 w-8 rounded-lg", viewMode === 'list' && "bg-background shadow-sm")}><List className="h-4 w-4"/></Button>
                    </div>
                    {/* Sort Dropdown */}
                    <SimpleMenu trigger={<Button variant="outline" className="h-10 rounded-xl border-border/50 bg-background/50 hover:bg-muted text-xs font-bold px-4"><SortAsc className="h-4 w-4 mr-2"/> Sort By</Button>}>
                        <MenuItem icon={<Type />} label="Name (A-Z)" onClick={() => setSortBy('name')} />
                        <MenuItem icon={<CalendarDays />} label="Date Modified" onClick={() => setSortBy('date')} />
                        <MenuItem icon={<HardDrive />} label="File Size" onClick={() => setSortBy('size')} />
                    </SimpleMenu>
                    <div className="w-px h-6 bg-border/50 hidden sm:block mx-1"></div>
                    
                    {/* Action Buttons */}
                    {canManage && (activeFilter === 'trash' ? (
                        <Button onClick={() => emptyTrashMut.mutate()} disabled={folders.length === 0 && allFiles.length === 0} className="rounded-xl h-10 px-4 font-bold bg-red-500 text-white hover:bg-red-600 shadow-sm flex-1 sm:flex-none">
                            {emptyTrashMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />} Empty Trash
                        </Button>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => setIsCreateFolderOpen(true)} className="rounded-xl h-10 px-4 font-bold border-border/50 bg-background/50 hover:bg-muted shadow-sm flex-1 sm:flex-none"><Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">New Folder</span></Button>
                            <Button onClick={() => {
                              setUploadTargetFolder(currentFolderId ? currentFolderId.toString() : "root");
                              setIsUploadOpen(true);
                              console.log('Upload modal opened');
                            }} className="rounded-xl h-10 px-4 font-bold bg-emerald-500 text-emerald-950 hover:bg-emerald-400 shadow-sm flex-1 sm:flex-none"><UploadCloud className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Upload</span></Button>
                        </>
                    ))}
                </div>
            </div>
        )}

        {/* METRIC CARDS (Filters) - Hidden in Trash */}
        {activeFilter !== 'trash' && (
          <div className="shrink-0">
            <div className="flex justify-between items-center mb-3 px-1">
              <h3 className="text-sm font-bold tracking-wide">Filter by Type</h3>
              {activeTypeFilter && (
                  <Button variant="link" size="sm" className="h-auto p-0 text-[10px] uppercase tracking-widest text-emerald-500" onClick={() => setActiveTypeFilter(null)}>
                      Clear Filter <X className="h-3 w-3 ml-1" />
                  </Button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              <MetricCard isActive={activeTypeFilter === 'image'} onClick={() => setActiveTypeFilter(activeTypeFilter === 'image' ? null : 'image')} icon={<ImageIcon className="h-4 w-4 text-purple-400" />} title="Images" size={categoryStats.image.size} count={categoryStats.image.count} color="bg-purple-500/10 border-purple-500/20" />
              <MetricCard isActive={activeTypeFilter === 'video'} onClick={() => setActiveTypeFilter(activeTypeFilter === 'video' ? null : 'video')} icon={<Video className="h-4 w-4 text-blue-400" />} title="Videos" size={categoryStats.video.size} count={categoryStats.video.count} color="bg-blue-500/10 border-blue-500/20" />
              <MetricCard isActive={activeTypeFilter === 'document'} onClick={() => setActiveTypeFilter(activeTypeFilter === 'document' ? null : 'document')} icon={<FileText className="h-4 w-4 text-amber-400" />} title="Docs" size={categoryStats.document.size} count={categoryStats.document.count} color="bg-amber-500/10 border-amber-500/20" />
              <MetricCard isActive={activeTypeFilter === 'audio'} onClick={() => setActiveTypeFilter(activeTypeFilter === 'audio' ? null : 'audio')} icon={<Music className="h-4 w-4 text-pink-400" />} title="Audio" size={categoryStats.audio.size} count={categoryStats.audio.count} color="bg-pink-500/10 border-pink-500/20" />
              <MetricCard isActive={activeTypeFilter === 'model'} onClick={() => setActiveTypeFilter(activeTypeFilter === 'model' ? null : 'model')} icon={<Box className="h-4 w-4 text-cyan-400" />} title="3D Models" size={categoryStats.model.size} count={categoryStats.model.count} color="bg-cyan-500/10 border-cyan-500/20" />
              <MetricCard isActive={activeTypeFilter === 'archive'} onClick={() => setActiveTypeFilter(activeTypeFilter === 'archive' ? null : 'archive')} icon={<Archive className="h-4 w-4 text-orange-400" />} title="Archives" size={categoryStats.archive.size} count={categoryStats.archive.count} color="bg-orange-500/10 border-orange-500/20" />
              <MetricCard isActive={activeTypeFilter === 'other'} onClick={() => setActiveTypeFilter(activeTypeFilter === 'other' ? null : 'other')} icon={<FileIcon className="h-4 w-4 text-gray-400" />} title="Others" size={categoryStats.other.size} count={categoryStats.other.count} color="bg-gray-500/10 border-gray-500/20" />
            </div>
          </div>
        )}

        {/* FILES LISTING AREA */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-8 pb-10 custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-10 w-10 animate-spin text-emerald-500" /></div>
          ) : (
            <div className={cn(viewMode === 'list' && "space-y-4")}>
              
              {/* --- FOLDERS --- */}
              {activeFilter !== "recent" && !activeTypeFilter && folders.length > 0 && (
                <section className={cn(viewMode === 'list' && "bg-card/30 border border-border/50 rounded-[2rem] p-4")}>
                  {viewMode === 'grid' && <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-4 px-2">Folders</h3>}
                  <div className={cn(viewMode === 'grid' ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4" : "flex flex-col gap-1")}>
                    {folders.map((folder: any) => {
                        const isSelected = selectedItems.some(i => i.id === folder.id && i.type === 'folder');
                        return (
                        <div key={folder.id} onClick={() => setCurrentFolderId(folder.id)} 
                             className={cn("bg-card/40 border rounded-2xl cursor-pointer transition-all relative group flex", 
                             viewMode === 'grid' ? "flex-col p-4 hover:shadow-md hover:-translate-y-0.5" : "flex-row items-center gap-4 p-2 pr-4 hover:bg-muted/40",
                             isSelected ? "border-emerald-500 ring-1 ring-emerald-500/50 bg-emerald-500/5" : "border-border/40 hover:border-emerald-500/40")}>
                          
                          {/* Checkbox Overlay */}
                          {canManage && (
                            <div className={cn("absolute z-20 transition-opacity", viewMode === 'grid' ? "top-3 left-3" : "left-4 relative top-0", isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 lg:opacity-0")}>
                                <input type="checkbox" checked={isSelected} onChange={() => toggleSelection('folder', folder.id)} onClick={(e)=>e.stopPropagation()} className="h-4 w-4 rounded accent-emerald-500 cursor-pointer shadow-md" />
                            </div>
                          )}

                          <div className={cn("rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0", viewMode === 'grid' ? "h-10 w-10 mb-3 mx-auto relative z-10" : "h-10 w-10 ml-8")}>
                            <Folder className="h-5 w-5 fill-emerald-500/20" />
                          </div>
                          
                          <h4 className="font-bold text-sm truncate flex-1 text-center sm:text-left">{folder.name}</h4>
                          {viewMode === 'list' && <span className="text-xs text-muted-foreground font-mono w-32 hidden md:block text-right">{new Date(folder.created_at).toLocaleDateString()}</span>}

                          {/* Context Menu */}
                          {canManage && (
                            <div
                              className={cn("relative z-20", viewMode === "grid" ? "absolute top-2 right-2" : "")}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <SimpleMenu trigger={<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-background/80 lg:opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="h-4 w-4"/></Button>}>
                                <MenuItem icon={<Edit />} label="Rename" onClick={() => setRenameTarget({type: "folder", id: folder.id, name: folder.name})} />
                                <MenuItem icon={<FolderInput />} label="Move To..." onClick={() => openMoveModal([{type: "folder", id: folder.id}])} />
                                <div className="h-px bg-border/50 my-1"></div>
                                {activeFilter === "trash" ? (
                                  <>
                                    <MenuItem icon={<RefreshCcw />} label="Restore" onClick={() => restoreItemsMut.mutate([{type:"folder", id: folder.id}])} />
                                    <MenuItem danger icon={<AlertTriangle />} label="Delete Forever" onClick={() => forceDeleteItemsMut.mutate([{type:"folder", id: folder.id}])} />
                                  </>
                                ) : (
                                  <MenuItem danger icon={<Trash2 />} label="Move to Trash" onClick={() => deleteMut.mutate({type: "folder", id: folder.id})} />
                                )}
                              </SimpleMenu>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* --- FILES --- */}
              <section className={cn(viewMode === 'list' && "bg-card/30 border border-border/50 rounded-[2rem] p-4")}>
                {viewMode === 'grid' && (
                    <div className="flex justify-between items-center mb-4 px-1">
                      <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">Files</h3>
                      {displayedFiles.length > 5 && (
                        <Button variant="ghost" size="sm" className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 h-8 font-bold rounded-lg px-3" onClick={() => setShowAllFiles(!showAllFiles)}>
                            {showAllFiles ? <><ChevronUp className="h-4 w-4 mr-1" /> Show Less</> : <><ChevronDown className="h-4 w-4 mr-1" /> Show All {displayedFiles.length}</>}
                        </Button>
                      )}
                    </div>
                )}

                {/* List View Headers */}
                {viewMode === 'list' && displayedFiles.length > 0 && (
                    <div className="flex items-center gap-4 px-4 pb-2 mb-2 border-b border-border/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        <div className="w-8"></div> <div className="w-10"></div>
                        <span className="flex-1">File Name</span>
                        <span className="w-24 text-right hidden sm:block">Size</span>
                        <span className="w-32 text-right hidden md:block">Uploaded</span>
                        <div className="w-8"></div>
                    </div>
                )}

                {displayedFiles.length === 0 ? (
                  <div className="bg-card/30 border border-dashed border-border/50 rounded-2xl p-10 text-center">
                    <p className="text-sm text-muted-foreground font-medium">No files found matching the current filter.</p>
                  </div>
                ) : (
                  <>
                    <div className={cn(viewMode === 'grid' ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4" : "flex flex-col gap-1")}>
                      {/* Renders only the sliced array (either 5 or all) */}
                      {visibleFiles.map((file: any) => {
                        const media = file.media_details;
                        const safeUrl = getStorageUrl(media?.thumbnail || media?.url);
                        const isSelected = selectedItems.some(i => i.id === file.id && i.type === 'file');

                        return (
                          <div key={file.id} onClick={() => isPickerMode && onFileSelect ? onFileSelect(file) : setSelectedFile(file)}
                               className={cn("bg-card border rounded-2xl group cursor-pointer transition-all relative flex min-w-0", 
                               viewMode === 'grid' ? "flex-col p-3 hover:shadow-md hover:-translate-y-0.5" : "flex-row items-center gap-4 p-2 pr-4 hover:bg-muted/40",
                               isSelected ? "border-emerald-500 ring-1 ring-emerald-500/50 bg-emerald-500/5" : "border-border/50 hover:border-emerald-500/40")}>
                            
                            {/* Checkbox Overlay */}
                            {canManage && (
                              <div className={cn("absolute z-20 transition-opacity", viewMode === 'grid' ? "top-3 left-3" : "left-4 relative top-0", isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 lg:opacity-0")}>
                                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelection('file', file.id)} onClick={(e)=>e.stopPropagation()} className="h-4 w-4 rounded accent-emerald-500 cursor-pointer shadow-md" />
                              </div>
                            )}

                            {/* Thumbnail */}
                            <div className={cn("bg-muted/30 rounded-xl flex items-center justify-center overflow-hidden border border-border/50 relative z-10 shrink-0", viewMode === 'grid' ? "aspect-square mb-3 w-full" : "h-10 w-10 ml-8")}>
                              {media?.thumbnail ? (
                                <AuthImage src={safeUrl} alt={media.title || media.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                              ) : (
                                (media?.mime_type?.startsWith('model/') || (media?.name?.toLowerCase().endsWith('.glb') || media?.name?.toLowerCase().endsWith('.gltf'))) ? (
                                  <Box className="h-6 w-6 text-cyan-500 transition-transform duration-300 group-hover:scale-110" />
                                ) : (
                                  <FileIcon className="h-6 w-6 text-muted-foreground/40 transition-transform duration-300 group-hover:scale-110 group-hover:text-emerald-500/50" />
                                )
                              )}
                              {file.is_favorite && viewMode === 'grid' && (
                                <div className="absolute top-2 right-2 bg-background/80 backdrop-blur border border-border/50 p-1 rounded-lg"><Star className="h-3 w-3 text-yellow-500 fill-yellow-500" /></div>
                              )}
                            </div>

                            {/* File Info */}
                            <div className={cn("flex flex-col min-w-0", viewMode === 'grid' ? "w-full" : "flex-1")}>
                                <h4 className={cn("font-bold text-sm truncate", viewMode==='grid' && "px-1 text-center sm:text-left")} title={media?.title || media?.name}>{media?.title || media?.name || "Unknown File"}</h4>
                                {viewMode === 'grid' && (
                                    <div className="flex justify-between items-center px-1 mt-1">
                                        <span className="text-[10px] text-muted-foreground font-mono uppercase truncate max-w-[70%]">{media?.mime_type?.split('/')[1] || 'FILE'}</span>
                                        <span className="text-[10px] text-muted-foreground font-mono font-medium bg-muted/50 px-1.5 rounded shrink-0">{media?.human_size}</span>
                                    </div>
                                )}
                            </div>

                            {/* List View Columns */}
                            {viewMode === 'list' && (
                                <>
                                    <span className="text-[11px] font-mono font-bold bg-muted/50 px-2 py-1 rounded text-muted-foreground w-24 text-right hidden sm:block shrink-0">{media?.human_size}</span>
                                    <span className="text-[11px] text-muted-foreground font-mono w-32 hidden md:block shrink-0 text-right">{new Date(file.created_at).toLocaleDateString()}</span>
                                    {file.is_favorite && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 shrink-0" />}
                                </>
                            )}

                            {/* Context Menu */}
                            {canManage && (
                              <div
                                className={cn("relative z-20", viewMode === "grid" ? "absolute top-2 right-2" : "")}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <SimpleMenu trigger={<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-background/80 lg:opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="h-4 w-4"/></Button>}>
                                  <MenuItem icon={<LinkIcon />} label="Share Link" onClick={() => shareLinkMut.mutate({type: "file", id: file.id})} />
                                  <MenuItem icon={<Edit />} label="Rename" onClick={() => setRenameTarget({type: "file", id: file.id, name: media?.name})} />
                                  <MenuItem 
                                    icon={downloadingFileId === file.id ? <Loader2 className="h-4 w-4 animate-spin text-emerald-500" /> : <Download />} 
                                    label={downloadingFileId === file.id ? (downloadPhase === "downloading" ? (downloadProgress > 0 ? `Downloading: ${downloadProgress}%` : "Downloading...") : (downloadProgress > 0 ? `Preparing: ${downloadProgress}%` : "Preparing...")) : "Download"} 
                                    onClick={() => downloadFile(file.id, file.media_details?.download_name || file.media_details?.name || 'download')} 
                                  />
                                  <MenuItem icon={<Star className={cn(file.is_favorite && "fill-yellow-500 text-yellow-500")} />} label={file.is_favorite ? "Unfavorite" : "Favorite"} onClick={() => toggleFavoriteMut.mutate({ type: 'file', id: file.id })} />
                                  <MenuItem icon={<Music />} label="Add to Playlist" onClick={() => { setItemToAddToPlaylist({id: file.id, type: 'file'}); setIsAddToPlaylistOpen(true); }} />
                                  <MenuItem icon={<FolderInput />} label="Move To..." onClick={() => openMoveModal([{type: "file", id: file.id}])} />
                                  <div className="h-px bg-border/50 my-1"></div>
                                  {activeFilter === "trash" ? (
                                    <>
                                      <MenuItem icon={<RefreshCcw />} label="Restore" onClick={() => restoreItemsMut.mutate([{type:"file", id: file.id}])} />
                                      <MenuItem danger icon={<AlertTriangle />} label="Delete Forever" onClick={() => forceDeleteItemsMut.mutate([{type:"file", id: file.id}])} />
                                    </>
                                  ) : (
                                    <MenuItem danger icon={<Trash2 />} label="Move to Trash" onClick={() => deleteMut.mutate({type: "file", id: file.id})} />
                                  )}
                                </SimpleMenu>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    
                    {/* Big "Show All" bottom button if there are hidden files */}
                    {!showAllFiles && displayedFiles.length > 5 && viewMode === 'grid' && (
                        <div className="mt-6 flex justify-center">
                            <Button variant="outline" className="w-full max-w-sm rounded-xl border-dashed border-border/60 text-muted-foreground hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:text-emerald-500 transition-all font-bold tracking-wide" onClick={() => setShowAllFiles(true)}>
                                <ChevronDown className="h-4 w-4 mr-2" /> View Remaining {displayedFiles.length - 5} Files
                            </Button>
                        </div>
                    )}
                  </>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

      {/* --- 🚀 MODALS --- */}

      {/* 🚀 MOVE MODAL */}
      <Dialog open={isMoveModalOpen} onOpenChange={setIsMoveModalOpen}>
          <DialogContent className="sm:max-w-sm rounded-[2rem] bg-background border-border/50 shadow-2xl z-[9999]" overlayClassName="z-[9998]">
              <DialogHeader><DialogTitle>Move Items</DialogTitle></DialogHeader>
              <div className="py-4">
                  <label className="text-[10px] font-black tracking-widest uppercase text-muted-foreground block mb-2">Destination Folder</label>
                  <select 
                    value={moveTargetFolder} 
                    onChange={(e) => setMoveTargetFolder(e.target.value)}
                    className="w-full bg-muted/30 border border-border/50 h-12 rounded-xl text-sm px-3 focus:ring-2 focus:ring-emerald-500 outline-none truncate font-medium"
                  >
                    <option value="root">Root Directory</option>
                    {/* Ensure we aren't allowing a user to move a folder into itself */}
                {folderItems.map((f: any) => {
                        const isMovingSelf = itemsToMove.some(i => i.type === 'folder' && i.id === f.id);
                        return <option key={f.id} value={f.id.toString()} disabled={isMovingSelf}>{isMovingSelf ? `🚫 ` : `📁 `} {f.name}</option>
                    })}
                  </select>
                  <p className="text-xs text-muted-foreground mt-3">Moving {itemsToMove.length} item(s).</p>
              </div>
              <DialogFooter className="gap-2 sm:justify-end">
                  <Button variant="ghost" className="rounded-xl" onClick={() => setIsMoveModalOpen(false)}>Cancel</Button>
                  <Button disabled={moveItemsMut.isPending} onClick={() => moveItemsMut.mutate()} className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400 font-bold rounded-xl px-6">
                      {moveItemsMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Move Here"}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* RENAME MODAL */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
          <DialogContent className="sm:max-w-sm rounded-[2rem] bg-background border-border/50 shadow-2xl z-[9999]" overlayClassName="z-[9998]">
              <DialogHeader><DialogTitle>Rename Item</DialogTitle></DialogHeader>
              <div className="py-4">
                  <label className="text-[10px] font-black tracking-widest uppercase text-muted-foreground block mb-2">New Name</label>
                  <Input value={newName || renameTarget?.name || ""} onChange={(e) => setNewName(e.target.value)} className="h-12 rounded-xl bg-muted/30 border-border/50 focus-visible:ring-emerald-500 font-medium" autoFocus />
              </div>
              <DialogFooter className="gap-2 sm:justify-end">
                  <Button variant="ghost" className="rounded-xl" onClick={() => setRenameTarget(null)}>Cancel</Button>
                  <Button disabled={renameMut.isPending || !newName} onClick={() => renameMut.mutate({ ...renameTarget, name: newName })} className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400 font-bold rounded-xl px-6">
                      {renameMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Name"}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* CREATE FOLDER MODAL */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent className="sm:max-w-sm rounded-[2rem] bg-background border-border/50 shadow-2xl z-[9999]" overlayClassName="z-[9998]">
          <DialogHeader><DialogTitle>Create New Folder</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateFolder}>
            <div className="py-4">
              <label className="text-[10px] font-black tracking-widest uppercase text-muted-foreground block mb-2">Folder Name</label>
              <Input value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="e.g., Marketing Assets" className="h-12 rounded-xl bg-muted/30 border-border/50 focus-visible:ring-emerald-500 font-medium" autoFocus />
            </div>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="ghost" className="rounded-xl" onClick={() => setIsCreateFolderOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createFolderMut.isPending || !folderName.trim()} className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400 font-bold rounded-xl px-6">{createFolderMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {lockedModule ? (
        <ModuleSubscriptionCheckoutDialog
          open={checkoutModuleSlug !== null}
          onOpenChange={(open) => {
            if (!open) {
              setCheckoutModuleSlug(null);
            }
          }}
          modules={[lockedModule]}
          paymentMethods={paymentMethods}
          title={checkoutModuleSlug === "image_editor" ? "Unlock the Image Editor" : "Unlock the Video Player"}
          description={
            checkoutModuleSlug === "image_editor"
              ? "Activate image editing for this tenant so operators can crop, enhance, and save new media versions."
              : "Activate video playback for this tenant so operators can stream videos and manage subtitles."
          }
        />
      ) : null}

      {/* PREVIEW MODAL */}
      <Dialog open={!!selectedFile} onOpenChange={(open) => {
        if (!open) {
           setSelectedFile(null);
           setSubtitleFile(null);
        }
      }}>
        <DialogContent className="sm:max-w-5xl md:max-w-[1400px] lg:max-w-[1600px] w-[98vw] md:w-full p-0 overflow-hidden bg-background/95 backdrop-blur-2xl border-border/50 rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.4)] flex flex-col max-h-[95vh] z-[9999]" overlayClassName="z-[9998]">
          <DialogTitle className="sr-only">File Preview</DialogTitle>

          {selectedFile && (
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0 w-full">
              <div className="flex-1 bg-muted/5 p-4 md:p-6 flex items-center justify-center relative md:border-r border-border/50 overflow-hidden min-h-[40vh] w-full">
                {renderFilePreview(selectedFile)}
              </div>

              <div className="w-full md:w-80 lg:w-96 flex flex-col bg-card/40 shrink-0 overflow-y-auto scrollbar-thin border-t md:border-t-0 border-border/50 relative">
                <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)} className="absolute top-4 right-4 z-50 rounded-full h-8 w-8 hover:bg-destructive hover:text-white transition-colors" title="Close Preview"><X className="h-4 w-4" /></Button>

                <div className="p-6 border-b border-border/50 min-w-0 sticky top-0 bg-card/80 backdrop-blur-xl z-10">
                  <div className="flex justify-between items-start gap-4"><h3 className="font-bold text-lg leading-tight truncate w-full pr-8" title={selectedFile.media_details?.title || selectedFile.media_details?.name}>{selectedFile.media_details?.title || selectedFile.media_details?.name}</h3></div>
                  <div className="flex gap-2 mt-3">
                    <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-widest bg-muted/80">{selectedFile.media_details?.mime_type?.split('/')[1] || 'FILE'}</Badge>
                    <Badge variant="outline" className="font-mono text-[10px] border-emerald-500/30 text-emerald-500 bg-emerald-500/5">{selectedFile.media_details?.human_size}</Badge>
                  </div>
                </div>

                <div className="flex-1 p-6 space-y-8">
                  <div className="space-y-4">
                    <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><Info className="h-3.5 w-3.5" /> File Information</h4>
                    <div className="space-y-4 bg-muted/20 p-4 rounded-2xl border border-border/50">
                      <div className="flex items-center gap-3 min-w-0"><div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center border border-border/50 shrink-0"><CalendarDays className="h-4 w-4 text-muted-foreground" /></div><div className="min-w-0"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Uploaded On</p><p className="text-sm font-bold truncate">{new Date(selectedFile.created_at).toLocaleDateString()}</p></div></div>
                      <div className="flex items-center gap-3 min-w-0"><div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center border border-border/50 shrink-0"><HardDrive className="h-4 w-4 text-muted-foreground" /></div><div className="min-w-0"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Exact Size</p><p className="text-sm font-mono truncate">{selectedFile.media_details?.size?.toLocaleString()} bytes</p></div></div>
                    </div>
                  </div>

                  {selectedFile.media_details?.mime_type?.startsWith('video/') && hasVideoPlayer && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center"><h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><Subtitles className="h-3.5 w-3.5" /> Subtitles</h4><Badge variant="outline" className="text-[10px] bg-background">{selectedFile.media_details?.subtitles?.length || 0}</Badge></div>
                        <div className="space-y-2 min-w-0">
                            {selectedFile.media_details?.subtitles?.map((sub: any, i: number) => (
                                <div key={i} className="flex justify-between items-center bg-muted/20 p-2.5 rounded-xl border border-border/50 text-xs min-w-0 group hover:border-emerald-500/30 transition-colors">
                                    <span className="font-medium truncate mr-2 flex-1">{sub.label}</span>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <Badge variant="secondary" className="font-mono text-[10px] bg-background">{sub.srcLang}</Badge>
                                        {canManage && sub.uuid && (
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-[2rem] border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl">
                                              <AlertDialogHeader><AlertDialogTitle>Delete Subtitle?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                              <AlertDialogFooter><AlertDialogCancel className="rounded-xl border-border/50">Cancel</AlertDialogCancel><AlertDialogAction className="rounded-xl bg-red-500 hover:bg-red-600 text-white shadow-md font-bold" onClick={() => deleteSubtitleMut.mutate(sub.uuid)}>Yes, delete it</AlertDialogAction></AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {canManage && (
                          <>
                            <Button variant="outline" size="sm" className="w-full border-dashed shrink-0 rounded-xl h-10 hover:bg-muted/50 hover:border-emerald-500/50 hover:text-emerald-500 transition-all" onClick={() => subtitleInputRef.current?.click()}><Type className="h-4 w-4 mr-2" /> Attach .vtt File</Button>
                            <input type="file" accept=".vtt" className="hidden" ref={subtitleInputRef} onChange={handleSubtitleSelect} />
                          </>
                        )}
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-border/50 bg-background/40 space-y-3 shrink-0 mt-auto sticky bottom-0 z-10 backdrop-blur-xl">
                  <Button
                    className="w-full rounded-xl shadow-md font-bold h-11 bg-emerald-500 text-emerald-950 hover:bg-emerald-400 transition-all disabled:opacity-70"
                    disabled={downloadingFileId === selectedFile.id}
                    onClick={() => downloadFile(selectedFile.id, selectedFile.media_details?.download_name || selectedFile.media_details?.name || 'download')}
                  >
                    {downloadingFileId === selectedFile.id
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {downloadPhase === "downloading" ? (downloadProgress > 0 ? `Downloading: ${downloadProgress}%` : "Downloading...") : (downloadProgress > 0 ? `Preparing: ${downloadProgress}%` : "Preparing...")}</>
                      : <><Download className="h-4 w-4 mr-2" /> Download File</>}
                  </Button>
                  {downloadingFileId === selectedFile.id && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        <span>{downloadPhase === "downloading" ? "Downloading file" : "Preparing secure download"}</span>
                        <span>{downloadProgress}%</span>
                      </div>
                      <Progress value={downloadProgress} className="h-2 rounded-full bg-muted/40" />
                    </div>
                  )}
                  {canManage && <Button variant="outline" className={cn("w-full rounded-xl h-11 transition-all font-bold border-border/50 hover:bg-muted", selectedFile.is_favorite ? "border-yellow-500 text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20" : "")} onClick={() => toggleFavoriteMut.mutate({ type: 'file', id: selectedFile.id })}><Star className={cn("h-4 w-4 mr-2 shrink-0", selectedFile.is_favorite && "fill-yellow-500")} /> <span className="truncate">{selectedFile.is_favorite ? 'Unfavorite' : 'Favorite'}</span></Button>}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SUBTITLE UPLOAD MODAL */}
      <Dialog open={isSubtitleModalOpen} onOpenChange={(open) => { setIsSubtitleModalOpen(open); if (!open) setSubtitleFile(null); }}>
        <DialogContent className="sm:max-w-md w-11/12 rounded-[2rem] bg-background border-border/50 shadow-2xl p-0 overflow-hidden box-border z-[9999]" overlayClassName="z-[9998]">
          <div className="p-6 pb-0 shrink-0"><DialogHeader><div className="flex items-center gap-3 mb-2 min-w-0"><div className="h-10 w-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 shrink-0"><Subtitles className="h-5 w-5" /></div><div className="min-w-0 flex-1"><DialogTitle className="text-xl truncate">Configure Subtitle</DialogTitle><DialogDescription className="text-xs truncate">Set language and label for your caption track.</DialogDescription></div></div></DialogHeader></div>
          <div className="p-6 space-y-5 overflow-y-auto scrollbar-thin min-w-0"><div className="space-y-1.5 min-w-0"><label className="text-[10px] font-black tracking-widest uppercase text-muted-foreground block">Selected File</label><div className="flex items-center bg-muted/50 border border-border/50 h-10 rounded-xl px-3 text-sm font-mono min-w-0 w-full overflow-hidden"><FileText className="h-4 w-4 mr-2 shrink-0 text-emerald-500" /><span className="truncate block w-full">{subtitleFile?.name || "No file selected"}</span></div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0"><div className="space-y-1.5 min-w-0"><label className="text-[10px] font-black tracking-widest uppercase text-muted-foreground block">Language Code</label><select value={subtitleLang} onChange={(e) => setSubtitleLang(e.target.value)} className="w-full bg-background border border-border/50 h-10 rounded-xl text-sm px-3 focus:ring-2 focus:ring-emerald-500 outline-none"><option value="en">English (en)</option><option value="es">Spanish (es)</option><option value="fr">French (fr)</option><option value="de">German (de)</option><option value="am">Amharic (am)</option><option value="om">Oromo (om)</option></select></div><div className="space-y-1.5 min-w-0"><label className="text-[10px] font-black tracking-widest uppercase text-muted-foreground block">Display Label</label><Input value={subtitleLabel} onChange={(e) => setSubtitleLabel(e.target.value)} placeholder="e.g., English (US)" className="bg-background border-border/50 h-10 rounded-xl text-sm min-w-0 w-full" /></div></div></div>
          <DialogFooter className="p-6 pt-0 flex gap-2 sm:justify-end shrink-0 bg-background"><Button type="button" variant="outline" onClick={() => setIsSubtitleModalOpen(false)} className="rounded-xl flex-1 sm:flex-none">Cancel</Button><Button onClick={submitSubtitle} disabled={uploadSubtitleMut.isPending || !subtitleFile} className="rounded-xl bg-emerald-500 text-emerald-950 font-bold px-6 shadow-md hover:bg-emerald-400 flex-1 sm:flex-none">{uploadSubtitleMut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</> : 'Attach Subtitle'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UPLOAD FILE MODAL */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
       <DialogContent className="sm:max-w-md rounded-3xl bg-background border-border/50 overflow-hidden flex flex-col max-h-[90vh] shadow-2xl z-[9999]" overlayClassName="z-[9998]">
          <DialogHeader className="shrink-0 border-b border-border/50 pb-4"><DialogTitle className="flex items-center gap-2"><UploadCloud className="h-5 w-5 text-emerald-500" /> Upload File</DialogTitle></DialogHeader>
          <form id="upload-file-form" onSubmit={handleUploadFile} className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="space-y-5 py-4 px-1">
         <div className="grid grid-cols-2 gap-4 min-w-0"><div className="space-y-2 min-w-0"><label className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">Save in Folder</label><select value={uploadTargetFolder} onChange={(e) => setUploadTargetFolder(e.target.value)} className="w-full bg-muted/30 border border-border/50 h-10 rounded-xl text-sm px-3 focus:ring-2 focus:ring-emerald-500 outline-none truncate font-medium"><option value="root">Root Directory</option>{currentFolderId && <option value={currentFolderId.toString()}>Current Folder (ID: {currentFolderId})</option>}{folderItems.map((f: any) => (<option key={f.id} value={f.id.toString()}>Subfolder: {f.name}</option>))}</select></div><div className="space-y-2 min-w-0"><label className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">Base Name</label><Input value={uploadBaseName} onChange={e => setUploadBaseName(e.target.value)} placeholder="Optional" className="bg-muted/50 border-border/50 h-10 rounded-xl text-sm min-w-0" /></div></div>
              <div className="pt-2 min-w-0 w-full"><div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleFileDrop} onClick={() => !uploadFileMut.isPending && fileInputRef.current?.click()} className={cn("border-2 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center text-center transition-all overflow-hidden w-full relative min-h-[160px]", isDragging ? "border-emerald-500 bg-emerald-500/10 scale-[1.02]" : "border-border/50 bg-muted/20", !uploadFileMut.isPending && "cursor-pointer hover:bg-muted/40 hover:border-emerald-500/50")}><input type="file" className="hidden" ref={fileInputRef} onChange={(e) => e.target.files && setUploadFile(e.target.files[0])} disabled={uploadFileMut.isPending} />{uploadFile ? (<div className="flex flex-col items-center w-full min-w-0 overflow-hidden relative z-10"><div className="relative"><FileIcon className={cn("h-12 w-12 text-emerald-500 mb-3 shrink-0 transition-transform duration-500", uploadProgress > 0 && "scale-110 animate-bounce")} /></div><p className="text-sm font-bold text-foreground truncate w-full text-center px-2 max-w-full drop-shadow-sm">{uploadFile.name}</p><p className="text-[10px] text-muted-foreground font-mono mt-1">{formatBytes(uploadFile.size)}</p>{uploadProgress > 0 && (<div className="w-full mt-6 space-y-2 px-2 shrink-0 animate-in fade-in zoom-in duration-300"><div className="flex justify-between items-end mb-1"><span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80 animate-pulse">Processing Chunk</span><span className="text-xl font-black text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">{uploadProgress}%</span></div><div className="relative h-3 w-full bg-background rounded-full overflow-hidden shadow-inner border border-border/50"><div className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 rounded-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(52,211,153,0.8)]" style={{ width: `${uploadProgress}%` }}><div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite] bg-[length:200%_100%]" /></div></div></div>)}</div>) : (<div className="flex flex-col items-center opacity-70 group-hover:opacity-100 transition-opacity"><div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4 shadow-sm"><UploadCloud className="h-7 w-7 text-emerald-500" /></div><p className="text-sm font-bold text-foreground shrink-0">Click or drag a file to this area to upload</p><p className="text-xs text-muted-foreground mt-2">Support for videos, documents, and images</p></div>)}</div></div>
              {uploadFile && !uploadFile.type.startsWith('image/') && (
                <div className="space-y-2 pt-4 border-t border-border/50 overflow-hidden min-w-0"><label className="text-[10px] font-black tracking-widest uppercase text-muted-foreground flex items-center gap-2"><ImagePlus className="h-3 w-3 shrink-0" /> Custom Thumbnail (Optional)</label><div className="flex items-center gap-3 w-full min-w-0"><Button type="button" variant="outline" className="h-10 border-dashed shrink-0 rounded-xl" onClick={() => thumbInputRef.current?.click()} disabled={uploadFileMut.isPending}>Select Cover</Button><span className="text-xs font-mono text-muted-foreground truncate flex-1 min-w-0" title={customThumbnail ? customThumbnail.name : 'None selected'}>{customThumbnail ? customThumbnail.name : 'None selected'}</span><input type="file" accept="image/*" className="hidden" ref={thumbInputRef} onChange={(e) => e.target.files && setCustomThumbnail(e.target.files[0])} /></div></div>
              )}
            </div>
          </form>
          <DialogFooter className="border-t border-border/40 p-4 shrink-0 bg-muted/10"><Button type="button" variant="ghost" onClick={() => setIsUploadOpen(false)} disabled={uploadFileMut.isPending} className="rounded-xl">Cancel</Button><Button type="submit" form="upload-file-form" disabled={!uploadFile || uploadFileMut.isPending} className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all flex-1 sm:flex-none px-8">{uploadFileMut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</> : 'Upload File'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD TO PLAYLIST DIALOG */}
      <Dialog open={isAddToPlaylistOpen} onOpenChange={setIsAddToPlaylistOpen}>
        <DialogContent className="sm:max-w-md rounded-[3rem] bg-background/80 backdrop-blur-3xl border-border/40 shadow-2xl p-0 overflow-hidden z-[9999]" overlayClassName="z-[9998]">
          <div className="p-8 border-b border-border/40 flex items-center justify-between bg-pink-500/5">
            <div>
              <DialogTitle className="flex items-center gap-2 text-2xl font-black tracking-tight"><Music className="h-6 w-6 text-pink-500" /> Add to Playlist</DialogTitle>
              <DialogDescription className="text-sm font-medium mt-1">Select a destination for your sound.</DialogDescription>
            </div>
          </div>
          <div className="p-4 space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar bg-card/20">
            {playlists.map((pl: any) => (
              <button
                key={pl.id}
                onClick={() => itemToAddToPlaylist && addToPlaylistMut.mutate({ playlistId: pl.id, fileId: itemToAddToPlaylist.id })}
                disabled={addToPlaylistMut.isPending}
                className="w-full flex items-center justify-between p-4 rounded-[1.5rem] border border-border/40 hover:bg-pink-500/10 hover:border-pink-500/40 transition-all group hover:scale-[1.01] active:scale-[0.99] shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-pink-500/10 p-2.5 rounded-xl group-hover:bg-pink-500/20 transition-colors">
                    <Music className="h-5 w-5 text-pink-500" />
                  </div>
                  <div className="text-left">
                    <span className="font-bold text-base block leading-none">{pl.name}</span>
                    <span className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/60 mt-1 block">Custom Playlist</span>
                  </div>
                </div>
                <div className="h-8 w-8 rounded-full bg-pink-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0 translate-x-4">
                  <Plus className="h-4 w-4 text-pink-500" />
                </div>
              </button>
            ))}
            {playlists.length === 0 && (
              <div className="text-center py-12 px-6">
                <div className="h-20 w-20 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-dashed border-border/40">
                  <Music className="h-10 w-10 text-muted-foreground/30" />
                </div>
                <p className="text-base font-bold text-foreground mb-1">No playlists yet</p>
                <p className="text-xs text-muted-foreground font-medium">Create your first playlist below to start organizing.</p>
              </div>
            )}
          </div>
          <DialogFooter className="p-8 pt-6 border-t border-border/40 bg-pink-500/5 flex flex-col gap-4">
             <div className="relative w-full">
                <Music className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="New Playlist Name..." 
                  id="new-playlist-input"
                  className="rounded-[1.25rem] h-12 bg-background border-border/50 focus-visible:ring-pink-500 pl-11 shadow-inner font-bold" 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value;
                      if (val) { createPlaylistMut.mutate(val); (e.target as HTMLInputElement).value = ''; }
                    }
                  }}
                />
                <Button 
                  size="sm" 
                  className="absolute right-1 top-1 h-10 w-10 p-0 rounded-xl bg-pink-500 hover:bg-pink-400 text-white shadow-lg shadow-pink-500/20"
                  onClick={() => {
                    const input = document.getElementById('new-playlist-input') as HTMLInputElement;
                    if (input.value) { createPlaylistMut.mutate(input.value); input.value = ''; }
                  }}
                  disabled={createPlaylistMut.isPending}
                >
                  {createPlaylistMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
                </Button>
             </div>
             <div className="flex gap-3 w-full">
                <Button type="button" variant="ghost" className="rounded-2xl h-11 flex-1 font-bold hover:bg-pink-500/5" onClick={() => setIsAddToPlaylistOpen(false)}>Close</Button>
             </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ icon, title, size, count, color, onClick, isActive }: any) {
  return (
    <div onClick={onClick} className={cn("border p-3.5 rounded-2xl flex flex-col gap-2 min-w-0 transition-all cursor-pointer group", color, isActive ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background scale-[1.02] shadow-md border-emerald-500/50" : "hover:bg-muted/50 hover:scale-[1.01]")}>
      <div className="flex items-center justify-between w-full"><div className="bg-background/80 p-2 rounded-xl border border-border/50 shadow-sm shrink-0">{icon}</div><Badge variant="outline" className="text-[9px] font-mono opacity-60 bg-transparent border-border/50">{count}</Badge></div>
      <div className="overflow-hidden w-full mt-1"><p className="text-xs font-bold text-foreground truncate w-full">{title}</p><p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate w-full">{formatBytes(size)}</p></div>
    </div>
  );
}
