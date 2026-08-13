"use client";

import React, { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Home, Upload, Download, X, Loader2, Music, Film, Zap, Server } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import { getAccessToken, getBackendApiRoot } from "@/lib/runtime-context";
import { VideoPlayer } from "@/components/ui/video-player";

// ─── Types ────────────────────────────────────────────────────────────────────
type Mode = "video" | "audio";
type VideoFormat = "mp4" | "webm" | "mov" | "avi" | "mkv";
type AudioFormat = "mp3" | "ogg" | "wav" | "flac" | "aac" | "m4a";

const VIDEO_FORMATS: VideoFormat[] = ["mp4", "webm", "mov", "avi", "mkv"];
const AUDIO_FORMATS: AudioFormat[] = ["mp3", "ogg", "wav", "flac", "aac", "m4a"];

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function VideoAudioConverterPage() {
  const [mode, setMode] = useState<Mode>("video");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputFormat, setOutputFormat] = useState<VideoFormat | AudioFormat>("mp4");
  const [quality, setQuality] = useState(80);
  const [compress, setCompress] = useState(false);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputName, setOutputName] = useState("");
  const [outputSize, setOutputSize] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) { setFile(f); setOutputUrl(null); }
  }, []);

  React.useEffect(() => {
    setOutputFormat(mode === "video" ? "mp4" : "mp3");
    setFile(null); setOutputUrl(null);
  }, [mode]);

  // Simulated progress (server-side — we don't get real progress %)
  const startFakeProgress = () => {
    setProgress(0);
    let p = 0;
    progressTimer.current = setInterval(() => {
      p += Math.random() * 8;
      if (p >= 90) { clearInterval(progressTimer.current!); p = 90; }
      setProgress(Math.round(p));
    }, 600);
  };
  const finishFakeProgress = () => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 1000);
  };

  const handleConvert = async () => {
    if (!file) return toast.error("Please select a file.");
    setConverting(true);
    startFakeProgress();
    const toastId = toast.loading("Sending to FFmpeg server...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("action", "convert");
      formData.append("mode", mode);
      formData.append("output_format", outputFormat);
      formData.append("quality", String(quality));
      formData.append("compress", String(compress));

      const token = getAccessToken();
      const res = await fetch(`${getBackendApiRoot()}/convert/media`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.details || "Conversion failed on server.");
      }

      toast.loading("Downloading result...", { id: toastId });
      const blob = await res.blob();

      // Extract filename from Content-Disposition
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      const name = match ? match[1].replace(/['"]/g, "") : `${file.name.replace(/\.[^.]+$/, "")}.${outputFormat}`;

      const url = URL.createObjectURL(blob);
      setOutputUrl(url); setOutputName(name); setOutputSize(blob.size);
      finishFakeProgress();
      toast.success(`Converted to ${outputFormat.toUpperCase()}!`, { id: toastId });

    } catch (err: unknown) {
      finishFakeProgress();
      toast.error(getErrorMessage(err, "Conversion failed."), { id: toastId });
    } finally {
      setConverting(false);
    }
  };

  const formats = mode === "video" ? VIDEO_FORMATS : AUDIO_FORMATS;
  const accept = mode === "video"
    ? "video/mp4,video/webm,video/quicktime,video/x-msvideo,.mp4,.webm,.mov,.avi,.mkv"
    : "audio/mpeg,audio/ogg,audio/wav,audio/flac,audio/aac,audio/x-m4a,.mp3,.ogg,.wav,.flac,.aac,.m4a,video/mp4,.mp4";

  return (
    <div className="space-y-6 pb-24">
      {/* Breadcrumb */}
      <div className="flex w-full justify-end items-center gap-3">
        <Breadcrumbs
          items={[
            { label: "Hive.OS", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
            { label: "Apps & Tools" },
            { label: "Converters", href: "/dashboard/tools/converters" },
            { label: mode === "video" ? "Video Converter" : "Audio Converter" },
          ]}
        />
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-[2rem] border border-border/50 bg-card/40 backdrop-blur-md p-8 bg-gradient-to-br from-violet-500/10 to-purple-500/5">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500 shadow-inner">
              {mode === "video" ? <Film className="h-6 w-6" /> : <Music className="h-6 w-6" />}
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">
                {mode === "video" ? "Video Converter" : "Audio Converter"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Powered by FFmpeg running in Docker — fast server-side conversion, no browser limits
              </p>
            </div>
          </div>
          <Badge className="bg-violet-500/10 text-violet-500 border-violet-500/20 px-3 py-1 rounded-full font-mono text-[11px] tracking-widest uppercase">
            <Server className="h-3 w-3 mr-1" /> FFmpeg · Docker Service
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEFT */}
        <div className="xl:col-span-8 flex flex-col gap-5">
          {/* Mode toggle */}
          <div className="flex gap-2 p-1 rounded-2xl border border-border/50 bg-card/40 w-fit">
            {(["video", "audio"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200",
                  mode === m ? "bg-violet-500 text-white shadow-lg shadow-violet-500/25" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "video" ? <Film className="h-4 w-4" /> : <Music className="h-4 w-4" />}
                {m === "video" ? "Video" : "Audio / Extract"}
              </button>
            ))}
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "rounded-[1.5rem] border-2 border-dashed min-h-[200px] flex flex-col items-center justify-center gap-4 cursor-pointer p-8 text-center transition-all duration-300",
              isDragging ? "border-violet-500 bg-violet-500/5 scale-[0.99]" : "border-border/60 hover:border-violet-500/40 hover:bg-muted/20 bg-card/20"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setOutputUrl(null); } }}
            />
            <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl transition-all", isDragging ? "bg-violet-500/20 text-violet-500 scale-110" : "bg-muted/40 text-muted-foreground")}>
              <Upload className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-black">Drop a {mode} file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">
                {mode === "video"
                  ? "MP4, WEBM, MOV, AVI, MKV — up to 500MB"
                  : "MP3, WAV, OGG, FLAC, AAC, M4A — or extract audio from MP4"}
              </p>
            </div>
          </div>

          {/* Selected file */}
          {file && (
            <div className="rounded-[1.5rem] border border-border/50 bg-card/40 px-5 py-3 flex items-center gap-4">
              {mode === "video" ? <Film className="h-5 w-5 text-muted-foreground" /> : <Music className="h-5 w-5 text-muted-foreground" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{file.name}</p>
                <p className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              <button onClick={() => { setFile(null); setOutputUrl(null); }} className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Progress */}
          {converting && (
            <div className="rounded-[1.5rem] border border-violet-500/20 bg-violet-500/5 p-5 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                <p className="text-sm font-black">
                  {progress < 20 ? "Uploading to FFmpeg server..." : progress < 90 ? `Converting... ${progress}%` : "Finalizing..."}
                </p>
              </div>
              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Server className="h-3 w-3" />
                Processing on Hive FFmpeg service — no browser limits, handles files up to 500MB
              </div>
            </div>
          )}

          {/* Output */}
          {outputUrl && !converting && (
            <div className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black text-sm">{outputName}</p>
                  <p className="text-[11px] text-muted-foreground">{formatBytes(outputSize)}</p>
                </div>
                <Button
                  onClick={() => { const a = document.createElement("a"); a.href = outputUrl!; a.download = outputName; a.click(); }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl"
                >
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>
              </div>
              {["mp3", "ogg", "wav", "flac", "aac", "m4a", "opus"].includes(outputFormat) || mode === "audio" ? (
                <audio src={outputUrl} controls className="w-full rounded-xl" />
              ) : (
                <VideoPlayer src={outputUrl} className="w-full rounded-xl" />
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Settings */}
        <div className="xl:col-span-4 flex flex-col gap-5">
          <div className="rounded-[1.5rem] border border-border/50 bg-card/40 backdrop-blur-md p-6 space-y-5">
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Settings</h2>

            <div className="space-y-3">
              <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Output Format</Label>
              <div className="grid grid-cols-3 gap-2">
                {formats.map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setOutputFormat(fmt)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-xs font-black transition-all",
                      outputFormat === fmt
                        ? "border-violet-500 bg-violet-500/10 text-violet-600"
                        : "border-border/50 bg-muted/20 text-muted-foreground hover:border-border"
                    )}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  {mode === "audio" ? "Bitrate / Quality" : "Quality"}
                </Label>
                <span className="text-xs font-black text-violet-500">{quality}%</span>
              </div>
              <Slider min={10} max={100} step={5} value={[quality]} onValueChange={([v]) => setQuality(v)} />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Smaller file</span><span>Best quality</span>
              </div>
            </div>

            {mode === "video" && (
              <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/10 p-4">
                <div className="space-y-0.5">
                  <Label className="text-xs font-black uppercase tracking-widest">High Compression</Label>
                  <p className="text-[11px] text-muted-foreground">Significantly reduce file size with minor quality loss</p>
                </div>
                <Switch checked={compress} onCheckedChange={setCompress} />
              </div>
            )}

            {/* Engine info */}
            <div className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-violet-500" />
                <p className="text-[11px] font-black text-violet-600">FFmpeg Docker Service</p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Conversion runs on the server using the full FFmpeg binary with all codec support. No browser memory limits — handles files up to 500MB.
              </p>
            </div>
          </div>

          <Button
            onClick={handleConvert}
            disabled={!file || converting}
            className={cn(
              "w-full h-14 rounded-[1.25rem] font-bold text-sm shadow-lg transition-all duration-300",
              file && !converting
                ? "bg-violet-500 hover:bg-violet-600 text-white shadow-violet-500/25 hover:scale-[1.02]"
                : "bg-muted text-muted-foreground cursor-not-allowed shadow-none"
            )}
          >
            {converting
              ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Converting {progress > 0 ? `${progress}%` : "..."}</>
              : <>{mode === "video" ? <Film className="h-5 w-5 mr-2" /> : <Music className="h-5 w-5 mr-2" />}Convert to {outputFormat.toUpperCase()}</>
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
