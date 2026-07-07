"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Home, Upload, Download, X, Loader2, FileText, ArrowRight,
  CheckCircle2, AlertCircle, File, Image as ImageIcon, BookOpen, FileCode
} from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import { getAccessToken, getBackendApiRoot } from "@/lib/runtime-context";

// ─── Types ─────────────────────────────────────────────────────────────────────
type ConversionMode =
  | "pdf-to-jpg"
  | "pdf-to-png"
  | "jpg-to-pdf"
  | "png-to-pdf"
  | "docx-to-pdf"
  | "epub-to-pdf"
  | "heic-to-pdf"
  | "pdf-to-epub"
  | "pdf-to-word";

interface ModeConfig {
  label: string;
  inputAccept: string;
  inputLabel: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
  description: string;
  badge?: string;
  engine: "client" | "backend";
}

const MODES: Record<ConversionMode, ModeConfig> = {
  "pdf-to-jpg": {
    label: "PDF → JPG",
    inputAccept: ".pdf,application/pdf",
    inputLabel: "Upload a PDF",
    icon: <ImageIcon className="h-5 w-5" />,
    color: "text-orange-500",
    gradient: "from-orange-500/10 to-amber-500/5",
    description: "Convert every page of your PDF into high-quality JPG images.",
    engine: "client",
  },
  "pdf-to-png": {
    label: "PDF → PNG",
    inputAccept: ".pdf,application/pdf",
    inputLabel: "Upload a PDF",
    icon: <ImageIcon className="h-5 w-5" />,
    color: "text-sky-500",
    gradient: "from-sky-500/10 to-blue-500/5",
    description: "Convert PDF pages to lossless PNG images with transparency support.",
    engine: "client",
  },
  "jpg-to-pdf": {
    label: "JPG → PDF",
    inputAccept: "image/jpeg,.jpg,.jpeg",
    inputLabel: "Upload JPG Image(s)",
    icon: <FileText className="h-5 w-5" />,
    color: "text-red-500",
    gradient: "from-red-500/10 to-rose-500/5",
    description: "Combine one or more JPG images into a single PDF document.",
    engine: "backend",
  },
  "png-to-pdf": {
    label: "PNG → PDF",
    inputAccept: "image/png,.png",
    inputLabel: "Upload PNG Image(s)",
    icon: <FileText className="h-5 w-5" />,
    color: "text-red-500",
    gradient: "from-red-500/10 to-rose-500/5",
    description: "Bundle PNG images into a clean PDF.",
    engine: "backend",
  },
  "docx-to-pdf": {
    label: "DOCX → PDF",
    inputAccept: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    inputLabel: "Upload a DOCX File",
    icon: <FileCode className="h-5 w-5" />,
    color: "text-blue-600",
    gradient: "from-blue-600/10 to-indigo-500/5",
    description: "Convert Microsoft Word documents to PDF using Gotenberg Libre Office.",
    badge: "Gotenberg",
    engine: "backend",
  },
  "epub-to-pdf": {
    label: "EPUB → PDF",
    inputAccept: ".epub",
    inputLabel: "Upload an EPUB File",
    icon: <BookOpen className="h-5 w-5" />,
    color: "text-purple-500",
    gradient: "from-purple-500/10 to-violet-500/5",
    description: "Convert EPUB eBooks into printable PDF documents.",
    badge: "Gotenberg",
    engine: "backend",
  },
  "heic-to-pdf": {
    label: "HEIC → PDF",
    inputAccept: ".heic,.heif",
    inputLabel: "Upload HEIC/HEIF Photo",
    icon: <FileText className="h-5 w-5" />,
    color: "text-pink-500",
    gradient: "from-pink-500/10 to-rose-500/5",
    description: "Convert Apple HEIC photos directly to PDF.",
    engine: "backend",
  },
  "pdf-to-epub": {
    label: "PDF → EPUB",
    inputAccept: ".pdf,application/pdf",
    inputLabel: "Upload a PDF",
    icon: <BookOpen className="h-5 w-5" />,
    color: "text-teal-500",
    gradient: "from-teal-500/10 to-emerald-500/5",
    description: "Convert PDFs to reflowable EPUB eBooks.",
    badge: "Backend",
    engine: "backend",
  },
  "pdf-to-word": {
    label: "PDF → Word",
    inputAccept: ".pdf,application/pdf",
    inputLabel: "Upload a PDF",
    icon: <FileCode className="h-5 w-5" />,
    color: "text-blue-500",
    gradient: "from-blue-500/10 to-sky-500/5",
    description: "Extract and convert PDF content into an editable Word document.",
    badge: "Backend",
    engine: "backend",
  },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Client-side PDF→Image using pdf.js
async function pdfToImages(file: File, outputFormat: "jpeg" | "png", scale = 2): Promise<{ url: string; blob: Blob; name: string }[]> {
  // Dynamically load pdfjs
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const results: { url: string; blob: Blob; name: string }[] = [];
  const baseName = file.name.replace(/\.pdf$/i, "");

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;

    if (outputFormat === "jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport } as any).promise;

    const mimeType = outputFormat === "jpeg" ? "image/jpeg" : "image/png";
    const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), mimeType, 0.95));
    const url = URL.createObjectURL(blob);
    results.push({ url, blob, name: `${baseName}_page_${i}.${outputFormat === "jpeg" ? "jpg" : "png"}` });
  }

  return results;
}

interface OutputItem {
  url: string;
  blob: Blob;
  name: string;
  size: number;
}

export default function PdfConverterPage() {
  const [mode, setMode] = useState<ConversionMode>("pdf-to-jpg");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [converting, setConverting] = useState(false);
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cfg = MODES[mode];

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    setFiles((prev) => {
      // For single-file modes keep only last selected
      const modes: ConversionMode[] = ["pdf-to-jpg", "pdf-to-png", "pdf-to-epub", "pdf-to-word", "docx-to-pdf", "epub-to-pdf", "heic-to-pdf"];
      if (modes.includes(mode)) return [arr[0]];
      return [...prev, ...arr];
    });
    setOutputs([]);
  }, [mode]);

  // Reset on mode change
  useEffect(() => { setFiles([]); setOutputs([]); }, [mode]);
  useEffect(() => {
    return () => { outputs.forEach((o) => URL.revokeObjectURL(o.url)); };
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleConvert = async () => {
    if (files.length === 0) return toast.error("Please select a file first.");
    setConverting(true);
    setOutputs([]);
    const toastId = toast.loading("Converting...");

    try {
      if (mode === "pdf-to-jpg" || mode === "pdf-to-png") {
        const imgFmt = mode === "pdf-to-jpg" ? "jpeg" : "png";
        const pages = await pdfToImages(files[0], imgFmt);
        setOutputs(pages.map((p) => ({ url: p.url, blob: p.blob, name: p.name, size: p.blob.size })));
        toast.success(`Converted ${pages.length} page(s)!`, { id: toastId });
      } else {
        // Backend conversion
        const token = getAccessToken();
        const formData = new FormData();
        files.forEach((f) => formData.append("files[]", f));
        formData.append("mode", mode);

        const res = await fetch(`${getBackendApiRoot()}/convert/document`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Conversion failed.");
        }

        const blob = await res.blob();
        const contentDisposition = res.headers.get("Content-Disposition") ?? "";
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        const filename = match ? match[1].replace(/['"]/g, "") : `converted_${Date.now()}`;
        const url = URL.createObjectURL(blob);
        setOutputs([{ url, blob, name: filename, size: blob.size }]);
        toast.success("Conversion complete!", { id: toastId });
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "An error occurred."), { id: toastId });
    } finally {
      setConverting(false);
    }
  };

  const downloadAll = () => {
    outputs.forEach((item, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = item.url;
        a.download = item.name;
        a.click();
      }, i * 150);
    });
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
            { label: "PDF & Documents" },
          ]}
        />
      </div>

      {/* Hero Header */}
      <div className={cn("relative overflow-hidden rounded-[2rem] border border-border/50 bg-card/40 backdrop-blur-md p-8 transition-all duration-500", `bg-gradient-to-br ${cfg.gradient}`)}>
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-20 blur-3xl bg-current pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl bg-card/60 shadow-inner", cfg.color)}>
              {cfg.icon}
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">PDF & Document Converter</h1>
              <p className="text-sm text-muted-foreground">{cfg.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {cfg.badge && (
              <Badge className="bg-card/60 border-border/40 text-foreground text-[10px] px-3 py-1 rounded-full font-mono tracking-widest">
                {cfg.badge}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEFT: Mode picker + Upload + Output */}
        <div className="xl:col-span-8 flex flex-col gap-5">

          {/* Mode Selector */}
          <div className="rounded-[1.5rem] border border-border/50 bg-card/40 backdrop-blur-md p-5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 block">
              Conversion Type
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.entries(MODES) as [ConversionMode, ModeConfig][]).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-all duration-200",
                    mode === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/50 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground"
                  )}
                >
                  <span className={cn("shrink-0", mode === key ? "text-primary" : config.color)}>{config.icon}</span>
                  <span className="truncate">{config.label}</span>
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
              "rounded-[1.5rem] border-2 border-dashed transition-all duration-300 cursor-pointer min-h-[200px] flex flex-col items-center justify-center gap-4 text-center p-8",
              isDragging ? "border-primary bg-primary/5 scale-[0.99]" : "border-border/60 hover:border-primary/40 hover:bg-muted/20 bg-card/20"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple={["jpg-to-pdf", "png-to-pdf"].includes(mode)}
              accept={cfg.inputAccept}
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
            <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl transition-all", isDragging ? "bg-primary/20 text-primary scale-110" : "bg-muted/40 text-muted-foreground")}>
              <Upload className="h-7 w-7" />
            </div>
            <div>
              <p className="text-base font-black tracking-tight">{cfg.inputLabel}</p>
              <p className="text-xs text-muted-foreground mt-1">Drag & drop or click to browse</p>
            </div>
          </div>

          {/* Selected files */}
          {files.length > 0 && (
            <div className="rounded-[1.5rem] border border-border/50 bg-card/40 backdrop-blur-md overflow-hidden">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-border/30 last:border-b-0">
                  <File className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{f.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatBytes(f.size)}</p>
                  </div>
                  <button onClick={() => { setFiles((prev) => prev.filter((_, idx) => idx !== i)); setOutputs([]); }} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Output list */}
          {outputs.length > 0 && (
            <div className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/5 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm font-black">{outputs.length} file{outputs.length !== 1 ? "s" : ""} ready</span>
                </div>
                <Button onClick={downloadAll} size="sm" className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white">
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Download All
                </Button>
              </div>
              <div className="divide-y divide-emerald-500/10 max-h-64 overflow-y-auto">
                {outputs.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-emerald-500/5 transition-colors">
                    {item.name.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.url} alt="" className="h-10 w-10 rounded-lg object-cover border border-emerald-500/20" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-emerald-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatBytes(item.size)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-full text-[10px] px-3 border-emerald-500/30 text-emerald-600"
                      onClick={() => { const a = document.createElement("a"); a.href = item.url; a.download = item.name; a.click(); }}
                    >
                      <Download className="h-3 w-3 mr-1" /> Save
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Info + Action */}
        <div className="xl:col-span-4 flex flex-col gap-5">
          <div className="rounded-[1.5rem] border border-border/50 bg-card/40 backdrop-blur-md p-6 space-y-5">
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">How it Works</h2>
            {cfg.engine === "client" ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-sky-500/5 border border-sky-500/20">
                  <div className="h-6 w-6 rounded-full bg-sky-500/20 text-sky-500 flex items-center justify-center shrink-0 text-[10px] font-black">1</div>
                  <p className="text-xs text-muted-foreground">Your PDF is parsed locally in the browser using PDF.js — <strong>no upload required</strong>.</p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
                  <div className="h-6 w-6 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center shrink-0 text-[10px] font-black">2</div>
                  <p className="text-xs text-muted-foreground">Each page is rendered onto a Canvas element and exported as a high-resolution image.</p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 text-[10px] font-black">3</div>
                  <p className="text-xs text-muted-foreground">Download individual pages or all at once.</p>
                </div>
                <Badge className="w-full justify-center bg-sky-500/10 text-sky-500 border-sky-500/20 rounded-xl py-2 font-mono text-[10px] tracking-widest">
                  🔒 100% Private · Client-Side
                </Badge>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                  <div className="h-6 w-6 rounded-full bg-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0 text-[10px] font-black">1</div>
                  <p className="text-xs text-muted-foreground">Your file is securely sent to the Gotenberg engine (LibreOffice / Chromium).</p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
                  <div className="h-6 w-6 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center shrink-0 text-[10px] font-black">2</div>
                  <p className="text-xs text-muted-foreground">Converted server-side with full fidelity using industry-standard open-source tools.</p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 text-[10px] font-black">3</div>
                  <p className="text-xs text-muted-foreground">Result is streamed directly to your browser for download.</p>
                </div>
                <Badge className="w-full justify-center bg-indigo-500/10 text-indigo-500 border-indigo-500/20 rounded-xl py-2 font-mono text-[10px] tracking-widest">
                  ⚡ Powered by Gotenberg
                </Badge>
              </div>
            )}
          </div>

          <Button
            onClick={handleConvert}
            disabled={files.length === 0 || converting}
            className={cn(
              "w-full h-14 rounded-[1.25rem] font-bold text-sm tracking-wide shadow-lg transition-all duration-300",
              files.length > 0 && !converting
                ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/25 hover:scale-[1.02]"
                : "bg-muted text-muted-foreground shadow-none cursor-not-allowed"
            )}
          >
            {converting ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Converting...</>
            ) : (
              <><ArrowRight className="h-5 w-5 mr-2" />Convert — {cfg.label}</>
            )}
          </Button>

          <Link
            href="/dashboard/tools/converters"
            className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← All Converters
          </Link>
        </div>
      </div>
    </div>
  );
}
