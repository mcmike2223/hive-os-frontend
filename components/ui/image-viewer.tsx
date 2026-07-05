import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { 
  Maximize, Minimize, Edit2, X, RotateCw, 
  FlipHorizontal, FlipVertical, ZoomIn, ZoomOut, Sun, Contrast, Droplets, Save,
  Image as ImageIcon, Loader2, Link as LinkIcon, Unlink, Palette, RotateCcw,
  Square, Monitor, FileImage, Settings, DownloadCloud, Crop, Eraser, Wand2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge'; 
import { toast } from 'sonner';
import { getAuthHeaders, getBackendOrigin } from '@/lib/runtime-context';

import { removeBackground } from "@imgly/background-removal";

interface ImageViewerProps {
  src: string;
  fetchUrl?: string; 
  alt?: string;
  className?: string;
  onSaveEdited?: (file: File) => void;
}

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

const getApiUrl = () => {
  return `${getBackendOrigin()}/api`;
};

export function ImageViewer({ src, fetchUrl, alt = "Image preview", className, onSaveEdited }: ImageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const cropWrapperRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<EditTab>('transform');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiLoadingText, setAiLoadingText] = useState("");
  
  const [blobSrc, setBlobSrc] = useState<string>(''); 
  const [isLoadingBlob, setIsLoadingBlob] = useState<boolean>(true);
  const [isIsolatedMode, setIsIsolatedMode] = useState<boolean>(false);

  // Transform States
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  
  // Color States
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [hue, setHue] = useState(0);

  // Export States
  const [resize, setResize] = useState({ w: 0, h: 0 });
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [exportFormat, setExportFormat] = useState('image/png'); // Force PNG by default for AI
  const [exportQuality, setExportQuality] = useState(100);

  // Crop States
  const [natSize, setNatSize] = useState({ w: 0, h: 0 }); 
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [activeHandle, setActiveHandle] = useState<string | null>(null); 
  const dragStartInfo = useRef<any>(null); 

  useEffect(() => {
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

  useEffect(() => {
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

  const resetEdits = useCallback(() => {
    setZoom(1); setRotate(0); setFlipH(false); setFlipV(false);
    setBrightness(100); setContrast(100); setSaturation(100); setHue(0);
    setExportFormat('image/png'); setExportQuality(100);
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

  // 🚀 FIXED: Immediate Canvas Trimming Helper
  // Trims empty transparent space from a Blob, returning a tight, cropped Blob.
  const processAndTrimBlob = async (blob: Blob): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(blob);
        
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;
        let minX = img.width, minY = img.height, maxX = 0, maxY = 0;
        let found = false;

        for (let y = 0; y < img.height; y++) {
          for (let x = 0; x < img.width; x++) {
            const alpha = data[(y * img.width + x) * 4 + 3];
            if (alpha > 15) { // Ignore faint anti-aliasing
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
              found = true;
            }
          }
        }

        if (!found) return resolve(blob);

        // Add 10px breathing room padding
        const padding = 10;
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(img.width - 1, maxX + padding);
        maxY = Math.min(img.height - 1, maxY + padding);

        const tWidth = (maxX - minX) + 1;
        const tHeight = (maxY - minY) + 1;

        const tCanvas = document.createElement('canvas');
        tCanvas.width = tWidth;
        tCanvas.height = tHeight;
        const tCtx = tCanvas.getContext('2d');
        if (!tCtx) return resolve(blob);

        tCtx.drawImage(canvas, minX, minY, tWidth, tHeight, 0, 0, tWidth, tHeight);
        tCanvas.toBlob((b) => b ? resolve(b) : resolve(blob), 'image/png');
      };
      img.onerror = () => resolve(blob); 
      img.src = URL.createObjectURL(blob);
    });
  };

  // 🚀 HIGH QUALITY IN-BROWSER AI BACKGROUND REMOVAL 
  const handleRemoveBackgroundLocalAI = async () => {
      if (!blobSrc) return;
      setIsProcessing(true);
      setAiLoadingText("Downloading AI Model...");
      
      try {
         const config = {
              publicPath: "https://static.imgly.com/@imgly/background-removal/1.4.3/dist/",
              debug: false,
              // 🚀 THE FIX: Added 'as const' to satisfy the strict union type
              output: { format: 'image/png' as const, quality: 1.0 }
          };

          setAiLoadingText("Isolating Subject...");
          const rawTransparentBlob = await removeBackground(blobSrc, config); 
          
          setAiLoadingText("Trimming Canvas...");
          const trimmedBlob = await processAndTrimBlob(rawTransparentBlob);

          const newUrl = URL.createObjectURL(trimmedBlob);
          
          // 🚀 FIX: Instantly snap crop box and sizing to new dimensions
          const img = new Image();
          img.onload = () => {
              setNatSize({ w: img.width, h: img.height });
              setCropBox({ x: 0, y: 0, width: img.width, height: img.height });
              setResize({ w: img.width, h: img.height });
              
              setBlobSrc(newUrl);
              setExportFormat('image/png'); 
              setIsIsolatedMode(true); 
              toast.success("Background removed & cropped successfully!");
              setIsProcessing(false);
              setAiLoadingText("");
          };
          img.src = newUrl;

      } catch (error: any) {
          console.error("Imgly AI Error: ", error);
          toast.error("AI processing failed. Check the console for WASM/WebGL errors.");
          setIsProcessing(false);
          setAiLoadingText("");
      } 
  };

  // 🚀 LOGO MAGIC WAND API CALL (Hits PHP GD)
  const removeLogoBackground = async () => {
      if (!blobSrc) return;
      setIsProcessing(true);
      setAiLoadingText("Scanning Logo Colors...");
      
      try {
          const response = await fetch(blobSrc);
          const imageBlob = await response.blob();
          
          const formData = new FormData();
          formData.append('file', imageBlob, 'image.png');

          const apiRes = await fetch(`${getApiUrl()}/v1/files/remove-logo-background`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
          });

          if (!apiRes.ok) {
            const errData = await apiRes.json().catch(() => null);
            throw new Error(errData?.message || "Failed to process logo.");
          }

          setAiLoadingText("Trimming Canvas...");
          const rawTransparentBlob = await apiRes.blob();
          const trimmedBlob = await processAndTrimBlob(rawTransparentBlob);

          const newUrl = URL.createObjectURL(trimmedBlob);
          
          // 🚀 FIX: Instantly snap crop box and sizing to new dimensions
          const img = new Image();
          img.onload = () => {
              setNatSize({ w: img.width, h: img.height });
              setCropBox({ x: 0, y: 0, width: img.width, height: img.height });
              setResize({ w: img.width, h: img.height });

              setBlobSrc(newUrl);
              setExportFormat('image/png');
              setIsIsolatedMode(true);
              toast.success("Logo background punched out & cropped successfully!");
              setIsProcessing(false);
              setAiLoadingText("");
          };
          img.src = newUrl;

      } catch (error: any) {
          console.error(error);
          toast.error(error.message || "Failed to remove logo background.");
          setIsProcessing(false);
          setAiLoadingText("");
      } 
  };

  // 🚀 PHOTO AI BACKGROUND REMOVAL API CALL (Hits rembg:5000)
  const removeBackgroundOnServer = async () => {
      if (!blobSrc) return;
      setIsProcessing(true);
      setAiLoadingText("Isolating Subject...");
      
      try {
          const response = await fetch(blobSrc);
          const blob = await response.blob();
          
          const formData = new FormData();
          formData.append('file', blob, 'image.png');

          const apiRes = await fetch(`${getApiUrl()}/v1/files/remove-background`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
          });

          if (!apiRes.ok) {
            const errData = await apiRes.json().catch(() => null);
            throw new Error(errData?.message || "Failed to process image on server.");
          }

          setAiLoadingText("Trimming Canvas...");
          const rawTransparentBlob = await apiRes.blob();
          const trimmedBlob = await processAndTrimBlob(rawTransparentBlob);

          const newUrl = URL.createObjectURL(trimmedBlob);
          
          // 🚀 FIX: Instantly snap crop box and sizing to new dimensions
          const img = new Image();
          img.onload = () => {
              setNatSize({ w: img.width, h: img.height });
              setCropBox({ x: 0, y: 0, width: img.width, height: img.height });
              setResize({ w: img.width, h: img.height });

              setBlobSrc(newUrl);
              setExportFormat('image/png');
              setIsIsolatedMode(true);
              toast.success("Background removed & cropped successfully!");
              setIsProcessing(false);
              setAiLoadingText("");
          };
          img.src = newUrl;

      } catch (error: any) {
          console.error(error);
          toast.error(error.message || "Failed to remove background. Server error.");
          setIsProcessing(false);
          setAiLoadingText("");
      } 
  };

  const exportEditedImage = () => {
    const image = imageRef.current;
    if (!image) return;
    setIsProcessing(true);

    setTimeout(() => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context");

        const dWidth = resize.w || cropBox.width;
        const dHeight = resize.h || cropBox.height;
        const isRotated = rotate % 180 !== 0;

        canvas.width = isRotated ? dHeight : dWidth;
        canvas.height = isRotated ? dWidth : dHeight;

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotate * Math.PI) / 180);
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

        // 🚀 FIXED: If exporting a transparent image to JPEG, fill with White (not black!)
        if (exportFormat === 'image/jpeg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-dWidth / 2, -dHeight / 2, dWidth, dHeight);
        }

        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`;
        ctx.drawImage(image, cropBox.x, cropBox.y, cropBox.width, cropBox.height, -dWidth / 2, -dHeight / 2, dWidth, dHeight);

        const ext = exportFormat === 'image/jpeg' ? 'jpg' : exportFormat === 'image/png' ? 'png' : 'webp';

        // 🚀 FIXED: Export respects exact dimensions and quality settings without re-trimming
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

  const handleMouseMove = useCallback((e: MouseEvent) => {
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

  const handleMouseUp = useCallback(() => {
    setActiveHandle(null);
    dragStartInfo.current = null;
  }, []);

  useEffect(() => {
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
              <Button variant="outline" onClick={() => setIsEditing(true)} className="h-10 rounded-xl border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 transition-colors font-bold px-6"><Edit2 className="h-4 w-4 mr-2" /> Edit Image</Button>
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

            {/* 🚀 AI MAGIC TAB (Dual Options) */}
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
