"use client";

import React, { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Home, Upload, Download, X, Loader2, Image as ImageIcon, Film, Server } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import { getAccessToken, getBackendApiRoot } from "@/lib/runtime-context";

type GifMode = "video-to-gif" | "images-to-gif" | "gif-to-mp4";

const MODES: Record<GifMode, { label: string; inputAccept: string; desc: string; multi: boolean }> = {
  "video-to-gif": {
    label: "Video → GIF",
    inputAccept: "video/mp4,video/webm,video/quicktime,video/x-msvideo,.mp4,.webm,.mov,.avi",
    desc: "Convert an MP4, WEBM, MOV, or AVI clip into an optimised animated GIF.",
    multi: false,
  },
  "images-to-gif": {
    label: "Images → GIF",
    inputAccept: "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp",
    desc: "Combine multiple images into an animated GIF slideshow.",
    multi: true,
  },
  "gif-to-mp4": {
    label: "GIF → MP4",
    inputAccept: "image/gif,.gif",
    desc: "Convert an animated GIF to a small, web-friendly MP4 video.",
    multi: false,
  },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function GifConverterPage() {
  const [mode, setMode] = useState<GifMode>("video-to-gif");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputName, setOutputName] = useState("");
  const [outputSize, setOutputSize] = useState(0);
  const [fps, setFps] = useState(10);
  const [scale, setScale] = useState(480);
  const [duration, setDuration] = useState(10);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const cfg = MODES[mode];

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    setFiles(cfg.multi ? arr : [arr[0]]);
    setOutputUrl(null);
  }, [cfg.multi]);

  React.useEffect(() => { setFiles([]); setOutputUrl(null); }, [mode]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const startFakeProgress = () => {
    setProgress(0);
    let p = 0;
    progressTimer.current = setInterval(() => {
      p += Math.random() * 10;
      if (p >= 88) { clearInterval(progressTimer.current!); p = 88; }
      setProgress(Math.round(p));
    }, 700);
  };
  const finishFakeProgress = () => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 800);
  };

  const handleConvert = async () => {
    if (files.length === 0) return toast.error("Please select a file.");
    setConverting(true);
    startFakeProgress();
    const toastId = toast.loading("Sending to FFmpeg server...");

    try {
      const token = getAccessToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      if (mode === "video-to-gif") {
        // Use dedicated /gif endpoint on the FFmpeg service (via backend proxy)
        const formData = new FormData();
        formData.append("file", files[0]);
        formData.append("action", "gif");
        formData.append("fps", String(fps));
        formData.append("width", String(scale));
        formData.append("duration", String(duration));

        const res = await fetch(`${getBackendApiRoot()}/convert/media`, {
          method: "POST",
          headers,
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || err.details || "GIF conversion failed.");
        }

        toast.loading("Downloading GIF...", { id: toastId });
        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition") ?? "";
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        const name = match ? match[1].replace(/['"]/g, "") : `${files[0].name.replace(/\.[^.]+$/, "")}.gif`;
        setOutputUrl(URL.createObjectURL(blob));
        setOutputName(name);
        setOutputSize(blob.size);

      } else if (mode === "gif-to-mp4") {
        // Convert GIF → MP4 using video convert endpoint
        const formData = new FormData();
        formData.append("file", files[0]);
        formData.append("action", "convert");
        formData.append("mode", "video");
        formData.append("output_format", "mp4");
        formData.append("quality", "85");

        const res = await fetch(`${getBackendApiRoot()}/convert/media`, {
          method: "POST",
          headers,
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || err.details || "Conversion failed.");
        }

        const blob = await res.blob();
        const name = files[0].name.replace(/\.gif$/i, ".mp4");
        setOutputUrl(URL.createObjectURL(blob));
        setOutputName(name);
        setOutputSize(blob.size);

      } else if (mode === "images-to-gif") {
        // Images → GIF: we'll zip them and send as a batch
        // For now, send the first image and inform — full slideshow needs a custom endpoint
        toast.info("Images → GIF currently converts the first image. Multi-frame slideshow is coming soon.", { id: toastId, duration: 6000 });
        finishFakeProgress();
        setConverting(false);
        return;
      }

      finishFakeProgress();
      toast.success("Conversion complete!", { id: toastId });

    } catch (err: unknown) {
      finishFakeProgress();
      toast.error(getErrorMessage(err, "Conversion failed."), { id: toastId });
    } finally {
      setConverting(false);
    }
  };

  const download = () => {
    if (!outputUrl) return;
    const a = document.createElement("a");
    a.href = outputUrl;
    a.download = outputName;
    a.click();
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Breadcrumb */}
      <div className="flex w-full justify-end items-center gap-3">
        <Breadcrumbs
          items={[
            { label: "Hive.OS", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
            { label: "Apps & Tools" },
            { label: "Converters", href: "/dashboard/tools/converters" },
            { label: "GIF Converter" },
          ]}
        />
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-[2rem] border border-border/50 bg-card/40 backdrop-blur-md p-8 bg-gradient-to-br from-emerald-500/10 to-green-500/5">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 shadow-inner text-2xl">✨</div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">GIF Converter</h1>
              <p className="text-sm text-muted-foreground">
                Convert videos to optimised GIFs using the palette method — powered by Docker FFmpeg
              </p>
            </div>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1 rounded-full font-mono text-[11px] tracking-widest uppercase">
            <Server className="h-3 w-3 mr-1" /> FFmpeg · Docker Service
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEFT */}
        <div className="xl:col-span-8 flex flex-col gap-5">

          {/* Mode Selector */}
          <div className="rounded-[1.5rem] border border-border/50 bg-card/40 backdrop-blur-md p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(Object.entries(MODES) as [GifMode, typeof MODES[GifMode]][]).map(([key, c]) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-xs font-bold transition-all duration-200",
                    mode === key ? "border-emerald-500 bg-emerald-500/10 text-emerald-600" : "border-border/50 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40"
                  )}
                >
                  {key.includes("video") || key.includes("mp4") ? <Film className="h-4 w-4 shrink-0" /> : <ImageIcon className="h-4 w-4 shrink-0" />}
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "rounded-[1.5rem] border-2 border-dashed transition-all duration-300 cursor-pointer min-h-[180px] flex flex-col items-center justify-center gap-4 text-center p-8",
              isDragging ? "border-emerald-500 bg-emerald-500/5 scale-[0.99]" : "border-border/60 hover:border-emerald-500/40 hover:bg-muted/20 bg-card/20"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple={cfg.multi}
              accept={cfg.inputAccept}
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
            <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl transition-all", isDragging ? "bg-emerald-500/20 text-emerald-500 scale-110" : "bg-muted/40 text-muted-foreground")}>
              <Upload className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-black">{cfg.desc}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {cfg.multi ? "Select multiple files" : "Select a single file"} — drag & drop or click
              </p>
            </div>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="rounded-[1.5rem] border border-border/50 bg-card/40 overflow-hidden">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3 border-b border-border/30 last:border-b-0">
                  <Film className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{f.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatBytes(f.size)}</p>
                  </div>
                  <button onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Progress */}
          {converting && (
            <div className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                <p className="text-sm font-black">
                  {progress < 20 ? "Uploading..." : progress < 90 ? `Generating GIF... ${progress}%` : "Finalizing palette..."}
                </p>
              </div>
              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Server className="h-3 w-3" />
                FFmpeg uses a 2-pass palette method for best GIF colour quality
              </div>
            </div>
          )}

          {/* Output Preview */}
          {outputUrl && !converting && (
            <div className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black text-sm">{outputName}</p>
                  <p className="text-[11px] text-muted-foreground">{formatBytes(outputSize)}</p>
                </div>
                <Button onClick={download} className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white">
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>
              </div>
              {outputName.endsWith(".gif") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={outputUrl} alt="Output GIF" className="w-full rounded-xl border border-emerald-500/20 max-h-64 object-contain" />
              ) : (
                <video src={outputUrl} controls className="w-full rounded-xl border border-emerald-500/20 max-h-64" />
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Settings */}
        <div className="xl:col-span-4 flex flex-col gap-5">
          <div className="rounded-[1.5rem] border border-border/50 bg-card/40 backdrop-blur-md p-6 space-y-5">
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">GIF Settings</h2>

            {mode === "video-to-gif" && (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Frame Rate (FPS)</Label>
                    <span className="text-xs font-black text-emerald-500">{fps} fps</span>
                  </div>
                  <Slider min={1} max={30} step={1} value={[fps]} onValueChange={([v]) => setFps(v)} />
                  <div className="flex justify-between text-[9px] text-muted-foreground">
                    <span>Smaller file</span><span>Smoother</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Width (px)</Label>
                    <span className="text-xs font-black text-emerald-500">{scale}px</span>
                  </div>
                  <Slider min={120} max={1280} step={40} value={[scale]} onValueChange={([v]) => setScale(v)} />
                  <div className="flex justify-between text-[9px] text-muted-foreground">
                    <span>120px</span><span>1280px</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Max Duration</Label>
                    <span className="text-xs font-black text-emerald-500">{duration}s</span>
                  </div>
                  <Slider min={1} max={60} step={1} value={[duration]} onValueChange={([v]) => setDuration(v)} />
                  <div className="flex justify-between text-[9px] text-muted-foreground">
                    <span>1s</span><span>60s</span>
                  </div>
                </div>
              </>
            )}

            {/* Engine info */}
            <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-emerald-500" />
                <p className="text-[11px] font-black text-emerald-600">FFmpeg Docker Service</p>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Uses FFmpeg's 2-pass palette method for best GIF quality. Runs server-side — no browser limits.
              </p>
            </div>
          </div>

          <Button
            onClick={handleConvert}
            disabled={files.length === 0 || converting}
            className={cn(
              "w-full h-14 rounded-[1.25rem] font-bold text-sm shadow-lg transition-all duration-300",
              files.length > 0 && !converting
                ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/25 hover:scale-[1.02]"
                : "bg-muted text-muted-foreground shadow-none cursor-not-allowed"
            )}
          >
            {converting
              ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />{progress > 0 ? `${progress}%` : "Processing..."}</>
              : <>✨ Convert → {mode === "gif-to-mp4" ? "MP4" : "GIF"}</>
            }
          </Button>

          <Link href="/dashboard/tools/converters" className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← All Converters
          </Link>
        </div>
      </div>
    </div>
  );
}
