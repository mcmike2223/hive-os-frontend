"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Home, Upload, Download, X, RefreshCw, ImageIcon,
  ArrowRight, CheckCircle2, Loader2, ChevronDown, ZoomIn, ZoomOut, Maximize2
} from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";

type OutputFormat = "image/png" | "image/jpeg" | "image/webp" | "image/gif";
type OutputExt = "png" | "jpg" | "webp" | "gif";

interface ConvertedFile {
  id: string;
  originalName: string;
  originalSize: number;
  originalUrl: string;
  convertedUrl: string;
  convertedBlob: Blob;
  convertedSize: number;
  outputName: string;
  width: number;
  height: number;
}

const FORMAT_OPTIONS: { value: OutputFormat; ext: OutputExt; label: string; description: string; icon: string }[] = [
  { value: "image/png", ext: "png", label: "PNG", description: "Lossless · Transparent support", icon: "🟦" },
  { value: "image/jpeg", ext: "jpg", label: "JPG / JPEG", description: "Lossy · Smallest file size", icon: "🟧" },
  { value: "image/webp", ext: "webp", label: "WEBP", description: "Next-gen · Best compression", icon: "🟩" },
  { value: "image/gif", ext: "gif", label: "GIF", description: "Animated · Wide compatibility", icon: "🟨" },
];

const SUPPORTED_INPUTS = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "image/tiff", "image/bmp", "image/svg+xml"];
const SPECIAL_INPUTS: Record<string, string> = {
  ".jfif": "image/jpeg",
  ".heic": "heic",
  ".heif": "heic",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function convertImageFile(
  file: File,
  outputFormat: OutputFormat,
  outputExt: OutputExt,
  quality: number
): Promise<ConvertedFile> {
  return new Promise((resolve, reject) => {
    const ext = "." + file.name.split(".").pop()!.toLowerCase();
    
    // Handle HEIC via dynamic import
    if (ext === ".heic" || ext === ".heif") {
      import("heic2any").then(({ default: heic2any }) => {
        heic2any({ blob: file, toType: outputFormat, quality: quality / 100 })
          .then((result) => {
            const blob = Array.isArray(result) ? result[0] : result;
            const originalUrl = URL.createObjectURL(file);
            const convertedUrl = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
              resolve({
                id: Math.random().toString(36).slice(2),
                originalName: file.name,
                originalSize: file.size,
                originalUrl,
                convertedUrl,
                convertedBlob: blob,
                convertedSize: blob.size,
                outputName: file.name.replace(/\.[^.]+$/, "") + "." + outputExt,
                width: img.naturalWidth,
                height: img.naturalHeight,
              });
            };
            img.onerror = reject;
            img.src = convertedUrl;
          })
          .catch(reject);
      }).catch(() => reject(new Error("HEIC conversion library failed to load.")));
      return;
    }

    const originalUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;

      // White background for JPEG
      if (outputFormat === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Canvas toBlob failed."));
          const convertedUrl = URL.createObjectURL(blob);
          resolve({
            id: Math.random().toString(36).slice(2),
            originalName: file.name,
            originalSize: file.size,
            originalUrl,
            convertedUrl,
            convertedBlob: blob,
            convertedSize: blob.size,
            outputName: file.name.replace(/\.[^.]+$/, "") + "." + outputExt,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        },
        outputFormat,
        quality / 100
      );
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
    img.src = originalUrl;
  });
}

export default function ImageConverterPage() {
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("image/png");
  const [outputExt, setOutputExt] = useState<OutputExt>("png");
  const [quality, setQuality] = useState(92);
  const [files, setFiles] = useState<File[]>([]);
  const [converted, setConverted] = useState<ConvertedFile[]>([]);
  const [converting, setConverting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewItem, setPreviewItem] = useState<ConvertedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedFormat = FORMAT_OPTIONS.find((f) => f.value === outputFormat)!;

  const handleFormatChange = (val: string) => {
    const fmt = FORMAT_OPTIONS.find((f) => f.value === val)!;
    setOutputFormat(fmt.value);
    setOutputExt(fmt.ext);
  };

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const valid = arr.filter((f) => {
      const ext = "." + f.name.split(".").pop()!.toLowerCase();
      return SUPPORTED_INPUTS.includes(f.type) || Object.keys(SPECIAL_INPUTS).includes(ext);
    });
    const invalid = arr.length - valid.length;
    if (invalid > 0) toast.warning(`${invalid} file(s) skipped — unsupported format.`);
    if (valid.length > 0) setFiles((prev) => [...prev, ...valid]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setConverted((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConvert = async () => {
    if (files.length === 0) return toast.error("Please add at least one image.");
    setConverting(true);
    setConverted([]);
    const toastId = toast.loading(`Converting ${files.length} image(s)...`);
    const results: ConvertedFile[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        const result = await convertImageFile(file, outputFormat, outputExt, quality);
        results.push(result);
      } catch (err: unknown) {
        errors.push(`${file.name}: ${getErrorMessage(err)}`);
      }
    }

    setConverted(results);
    setConverting(false);

    if (errors.length > 0) {
      toast.error(`${errors.length} file(s) failed. Check console.`, { id: toastId });
      errors.forEach((e) => console.error(e));
    } else {
      toast.success(`${results.length} image(s) converted successfully!`, { id: toastId });
    }
  };

  const downloadAll = () => {
    converted.forEach((item, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = item.convertedUrl;
        a.download = item.outputName;
        a.click();
      }, i * 150);
    });
  };

  const downloadOne = (item: ConvertedFile) => {
    const a = document.createElement("a");
    a.href = item.convertedUrl;
    a.download = item.outputName;
    a.click();
  };

  useEffect(() => {
    return () => {
      converted.forEach((c) => {
        URL.revokeObjectURL(c.convertedUrl);
        URL.revokeObjectURL(c.originalUrl);
      });
    };
  }, []);

  const showQuality = outputFormat !== "image/png";

  return (
    <div className="space-y-6 pb-24">
      {/* Breadcrumb */}
      <div className="flex w-full justify-end items-center gap-3">
        <Breadcrumbs
          items={[
            { label: "Hive.OS", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
            { label: "Apps & Tools" },
            { label: "Converters", href: "/dashboard/tools/converters" },
            { label: "Image Converter" },
          ]}
        />
      </div>

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-[2rem] border border-border/50 bg-card/40 backdrop-blur-md p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 via-transparent to-blue-500/5 pointer-events-none" />
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-sky-500/8 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500 shadow-inner">
              <ImageIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Image Converter</h1>
              <p className="text-sm text-muted-foreground">
                Convert PNG, JPG, WEBP, HEIC, JFIF, GIF, SVG and more — fully browser-side, no upload needed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-sky-500/10 text-sky-500 border-sky-500/20 px-3 py-1 rounded-full font-mono text-[11px] tracking-widest uppercase">
              Client-Side · Private
            </Badge>
          </div>
        </div>

        {/* Supported formats */}
        <div className="relative mt-5 flex flex-wrap gap-2">
          {["PNG", "JPG", "WEBP", "GIF", "HEIC", "JFIF", "AVIF", "BMP", "SVG", "TIFF"].map((fmt) => (
            <span key={fmt} className="rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-[11px] font-bold text-muted-foreground">
              {fmt}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEFT: Drop Zone + File List */}
        <div className="xl:col-span-8 flex flex-col gap-5">

          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "rounded-[1.5rem] border-2 border-dashed transition-all duration-300 cursor-pointer min-h-[220px] flex flex-col items-center justify-center gap-4 text-center p-8",
              isDragging
                ? "border-sky-500 bg-sky-500/5 scale-[0.99]"
                : "border-border/60 hover:border-sky-500/50 hover:bg-muted/20 bg-card/20"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.heic,.heif,.jfif"
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
            <div className={cn(
              "flex h-16 w-16 items-center justify-center rounded-2xl transition-all",
              isDragging ? "bg-sky-500/20 text-sky-500 scale-110" : "bg-muted/40 text-muted-foreground"
            )}>
              <Upload className="h-7 w-7" />
            </div>
            <div>
              <p className="text-base font-black tracking-tight">
                {isDragging ? "Release to add images" : "Drop images here or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports PNG · JPG · WEBP · HEIC · GIF · SVG · AVIF · BMP · TIFF · JFIF
              </p>
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="rounded-[1.5rem] border border-border/50 bg-card/40 backdrop-blur-md overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
                <span className="text-sm font-black">{files.length} image{files.length !== 1 ? "s" : ""} queued</span>
                <Button variant="ghost" size="sm" className="text-destructive rounded-full h-7 px-3 text-xs" onClick={() => { setFiles([]); setConverted([]); }}>
                  Clear all
                </Button>
              </div>
              <div className="divide-y divide-border/30 max-h-64 overflow-y-auto">
                {files.map((file, idx) => {
                  const conv = converted[idx];
                  return (
                    <div key={idx} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/20 transition-colors">
                      {/* Thumbnail */}
                      <div className="h-10 w-10 rounded-xl bg-muted/40 overflow-hidden shrink-0 border border-border/40">
                        {SUPPORTED_INPUTS.includes(file.type) ? (
                           
                          <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[10px] font-mono text-muted-foreground">
                            {file.name.split(".").pop()?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{file.name}</p>
                        <p className="text-[10px] text-muted-foreground">{formatBytes(file.size)}</p>
                      </div>
                      {conv && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] rounded-full px-2">
                            <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                            {formatBytes(conv.convertedSize)}
                          </Badge>
                          <Button size="sm" variant="outline" className="h-7 rounded-full text-[10px] px-3" onClick={() => setPreviewItem(conv)}>
                            <ZoomIn className="h-3 w-3 mr-1" /> Preview
                          </Button>
                          <Button size="sm" className="h-7 rounded-full text-[10px] px-3 bg-sky-500 hover:bg-sky-600 text-white" onClick={() => downloadOne(conv)}>
                            <Download className="h-3 w-3 mr-1" /> Save
                          </Button>
                        </div>
                      )}
                      <button onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Converted Results summary */}
          {converted.length > 0 && (
            <div className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/5 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" />
                <div>
                  <p className="font-black text-sm">
                    {converted.length} image{converted.length !== 1 ? "s" : ""} converted to {selectedFormat.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Total size: {formatBytes(converted.reduce((a, c) => a + c.convertedSize, 0))}
                  </p>
                </div>
              </div>
              <Button onClick={downloadAll} className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/25">
                <Download className="h-4 w-4 mr-2" />
                Download All ({converted.length})
              </Button>
            </div>
          )}
        </div>

        {/* RIGHT: Settings + Action */}
        <div className="xl:col-span-4 flex flex-col gap-5">
          <div className="rounded-[1.5rem] border border-border/50 bg-card/40 backdrop-blur-md p-6 space-y-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Conversion Settings</h2>

            {/* Output Format */}
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Output Format
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {FORMAT_OPTIONS.map((fmt) => (
                  <button
                    key={fmt.value}
                    onClick={() => handleFormatChange(fmt.value)}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-all duration-200",
                      outputFormat === fmt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/50 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40"
                    )}
                  >
                    <span className="text-base">{fmt.icon}</span>
                    <span className="text-xs font-black">{fmt.label}</span>
                    <span className="text-[9px] leading-tight opacity-60">{fmt.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quality Slider */}
            {showQuality && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Quality
                  </Label>
                  <span className="text-xs font-black text-primary">{quality}%</span>
                </div>
                <Slider
                  min={1}
                  max={100}
                  step={1}
                  value={[quality]}
                  onValueChange={([v]) => setQuality(v)}
                  className="w-full"
                />
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>Smaller file</span>
                  <span>Best quality</span>
                </div>
              </div>
            )}

            {/* Tips */}
            <div className="rounded-xl bg-muted/30 border border-border/40 p-3 space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Tips</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {outputFormat === "image/png" && "PNG is lossless and supports transparent backgrounds. Great for logos and icons."}
                {outputFormat === "image/jpeg" && "JPEG is ideal for photos. Quality 85-95 gives the best file size / quality balance."}
                {outputFormat === "image/webp" && "WebP offers 25-35% smaller files than JPEG with similar quality. Recommended for web."}
                {outputFormat === "image/gif" && "GIF supports animation and transparency but is limited to 256 colors."}
              </p>
            </div>
          </div>

          {/* Convert Button */}
          <Button
            onClick={handleConvert}
            disabled={files.length === 0 || converting}
            className={cn(
              "w-full h-14 rounded-[1.25rem] font-bold text-sm tracking-wide shadow-lg transition-all duration-300",
              files.length > 0 && !converting
                ? "bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/25 hover:scale-[1.02]"
                : "bg-muted text-muted-foreground shadow-none cursor-not-allowed"
            )}
          >
            {converting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <RefreshCw className="h-5 w-5 mr-2" />
                Convert {files.length > 0 ? `${files.length} Image${files.length !== 1 ? "s" : ""}` : "Images"} → {selectedFormat.label}
              </>
            )}
          </Button>

          {/* Back to hub */}
          <Link
            href="/dashboard/tools/converters"
            className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← All Converters
          </Link>
        </div>
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] rounded-[2rem] bg-card border border-border/50 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
              <div>
                <p className="font-black text-sm">{previewItem.outputName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {previewItem.width} × {previewItem.height}px · {formatBytes(previewItem.convertedSize)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" className="rounded-full" onClick={() => downloadOne(previewItem)}>
                  <Download className="h-4 w-4 mr-1" /> Download
                </Button>
                <Button size="icon" variant="ghost" className="rounded-full" onClick={() => setPreviewItem(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {/* Before / After */}
            <div className="grid grid-cols-2 gap-0 h-[60vh]">
              <div className="relative border-r border-border/40 bg-muted/20 flex items-center justify-center overflow-hidden">
                <div className="absolute top-2 left-2 z-10">
                  <Badge variant="secondary" className="text-[10px] rounded-full">Original</Badge>
                </div>
                { }
                <img src={previewItem.originalUrl} alt="Original" className="max-h-full max-w-full object-contain" />
                <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground bg-background/70 rounded-full px-2 py-0.5">
                  {formatBytes(previewItem.originalSize)}
                </div>
              </div>
              <div className="relative bg-muted/20 flex items-center justify-center overflow-hidden">
                <div className="absolute top-2 left-2 z-10">
                  <Badge className="text-[10px] rounded-full bg-emerald-500 text-white">Converted · {selectedFormat.label}</Badge>
                </div>
                { }
                <img src={previewItem.convertedUrl} alt="Converted" className="max-h-full max-w-full object-contain" />
                <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground bg-background/70 rounded-full px-2 py-0.5">
                  {formatBytes(previewItem.convertedSize)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
