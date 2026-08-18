"use client";

import React from "react";
import Link from "next/link";
import { Home, ArrowRight, Zap } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ConverterEntry = {
  label: string;
  href: string;
  badge?: string;
};

type Category = {
  title: string;
  icon: string;
  color: string;
  gradient: string;
  converters: ConverterEntry[];
};

const CATEGORIES: Category[] = [
  {
    title: "Video & Audio",
    icon: "🎬",
    color: "text-violet-500",
    gradient: "from-violet-500/10 to-purple-500/5",
    converters: [
      { label: "Video Converter", href: "/dashboard/tools/converters/video" },
      { label: "Audio Converter", href: "/dashboard/tools/converters/audio" },
      { label: "MP3 Converter", href: "/dashboard/tools/converters/audio" },
      { label: "MP4 to MP3", href: "/dashboard/tools/converters/audio" },
      { label: "Video to MP3", href: "/dashboard/tools/converters/audio" },
      { label: "MP4 Converter", href: "/dashboard/tools/converters/video" },
      { label: "MOV to MP4", href: "/dashboard/tools/converters/video" },
      { label: "MP3 to OGG", href: "/dashboard/tools/converters/audio" },
    ],
  },
  {
    title: "Image",
    icon: "🖼️",
    color: "text-sky-500",
    gradient: "from-sky-500/10 to-blue-500/5",
    converters: [
      { label: "Image Converter", href: "/dashboard/tools/converters/image" },
      { label: "WEBP to PNG", href: "/dashboard/tools/converters/image" },
      { label: "JFIF to PNG", href: "/dashboard/tools/converters/image" },
      { label: "PNG to SVG", href: "/dashboard/tools/converters/image" },
      { label: "HEIC to JPG", href: "/dashboard/tools/converters/image" },
      { label: "HEIC to PNG", href: "/dashboard/tools/converters/image" },
      { label: "WEBP to JPG", href: "/dashboard/tools/converters/image" },
      { label: "SVG Converter", href: "/dashboard/tools/converters/image" },
    ],
  },
  {
    title: "PDF & Documents",
    icon: "📄",
    color: "text-red-500",
    gradient: "from-red-500/10 to-orange-500/5",
    converters: [
      { label: "PDF Converter", href: "/dashboard/tools/converters/pdf", badge: "Popular" },
      { label: "Document Converter", href: "/dashboard/tools/converters/document" },
      { label: "Ebook Converter", href: "/dashboard/tools/converters/document" },
      { label: "PDF to Word", href: "/dashboard/tools/converters/pdf" },
      { label: "PDF to JPG", href: "/dashboard/tools/converters/pdf" },
      { label: "PDF to EPUB", href: "/dashboard/tools/converters/pdf" },
      { label: "EPUB to PDF", href: "/dashboard/tools/converters/document" },
      { label: "HEIC to PDF", href: "/dashboard/tools/converters/pdf" },
      { label: "DOCX to PDF", href: "/dashboard/tools/converters/document", badge: "Popular" },
      { label: "JPG to PDF", href: "/dashboard/tools/converters/pdf" },
    ],
  },
  {
    title: "GIF",
    icon: "✨",
    color: "text-emerald-500",
    gradient: "from-emerald-500/10 to-green-500/5",
    converters: [
      { label: "Video to GIF", href: "/dashboard/tools/converters/gif" },
      { label: "MP4 to GIF", href: "/dashboard/tools/converters/gif" },
      { label: "WEBM to GIF", href: "/dashboard/tools/converters/gif" },
      { label: "APNG to GIF", href: "/dashboard/tools/converters/gif" },
      { label: "GIF to MP4", href: "/dashboard/tools/converters/gif" },
      { label: "GIF to APNG", href: "/dashboard/tools/converters/gif" },
      { label: "Image to GIF", href: "/dashboard/tools/converters/gif" },
      { label: "MOV to GIF", href: "/dashboard/tools/converters/gif" },
      { label: "AVI to GIF", href: "/dashboard/tools/converters/gif" },
    ],
  },
  {
    title: "Others",
    icon: "⚡",
    color: "text-amber-500",
    gradient: "from-amber-500/10 to-yellow-500/5",
    converters: [
      { label: "Unit Converter", href: "/dashboard/tools/converters/unit" },
      { label: "Time Converter", href: "/dashboard/tools/converters/time" },
      { label: "Archive Converter", href: "/dashboard/tools/converters/archive" },
    ],
  },
];

export default function ConvertersHubPage() {
  return (
    <div className="space-y-8 pb-24">
      {/* Breadcrumb */}
      <div className="flex w-full justify-end items-center gap-3">
        <Breadcrumbs
          items={[
            { label: "Hive.OS", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
            { label: "Apps & Tools" },
            { label: "Converters Hub" },
          ]}
        />
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-[2rem] border border-border/50 bg-card/40 backdrop-blur-md p-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5 pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-violet-500/5 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl shadow-inner">
                ⚡
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-foreground">
                  Converters Hub
                </h1>
                <p className="text-sm text-muted-foreground">
                  All-in-one file conversion suite — images, PDFs, video, audio, and more
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-4 py-1.5 rounded-full font-mono text-xs tracking-widest uppercase shadow-sm">
              <Zap className="h-3 w-3 mr-1.5" /> Engine Online
            </Badge>
            <Badge variant="outline" className="px-4 py-1.5 rounded-full text-xs font-mono tracking-widest uppercase">
              {CATEGORIES.reduce((acc, c) => acc + c.converters.length, 0)} Converters
            </Badge>
          </div>
        </div>

        {/* Stats row */}
        <div className="relative mt-8 grid grid-cols-2 sm:grid-cols-5 gap-3">
          {CATEGORIES.map((cat) => (
            <div key={cat.title} className={cn("rounded-2xl bg-gradient-to-br p-4 border border-border/40", cat.gradient)}>
              <div className="text-2xl mb-1">{cat.icon}</div>
              <p className={cn("text-xs font-black tracking-tight", cat.color)}>{cat.title}</p>
              <p className="text-[11px] text-muted-foreground">{cat.converters.length} tools</p>
            </div>
          ))}
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {CATEGORIES.map((cat) => (
          <div
            key={cat.title}
            className="group rounded-[1.5rem] border border-border/50 bg-card/40 backdrop-blur-md overflow-hidden hover:border-border/80 hover:shadow-lg transition-all duration-300"
          >
            {/* Card Header */}
            <div className={cn("p-5 border-b border-border/40 bg-gradient-to-br", cat.gradient)}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{cat.icon}</span>
                <div>
                  <h2 className={cn("text-base font-black tracking-tight", cat.color)}>
                    {cat.title}
                  </h2>
                  <p className="text-[11px] text-muted-foreground">{cat.converters.length} converters available</p>
                </div>
              </div>
            </div>

            {/* Converter List */}
            <div className="p-4 grid grid-cols-2 gap-1.5">
              {cat.converters.map((conv) => (
                <Link
                  key={conv.label}
                  href={conv.href}
                  className="group/item flex items-center justify-between gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all duration-150"
                >
                  <span className="truncate">{conv.label}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {conv.badge && (
                      <Badge variant="secondary" className="text-[11px] px-1.5 py-0 h-4 rounded-full">
                        {conv.badge}
                      </Badge>
                    )}
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>

            {/* Footer CTA */}
            <div className="px-4 pb-4">
              <Link
                href={cat.converters[0]?.href ?? "#"}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition-all duration-200",
                  "border-border/50 bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                Open {cat.title} Suite
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Also keep HTML-to-PDF shortcut */}
      <div className="rounded-[1.5rem] border border-border/50 bg-card/40 backdrop-blur-md p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 text-lg">📑</div>
            <div>
              <h3 className="font-black text-sm">HTML to PDF — Powered by Gotenberg</h3>
              <p className="text-xs text-muted-foreground">Write or upload HTML and render pixel-perfect PDFs via headless Chromium.</p>
            </div>
          </div>
          <Link
            href="/dashboard/tools/converter"
            className="shrink-0 flex items-center gap-2 rounded-xl bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 px-5 py-2.5 text-xs font-bold transition-all"
          >
            Open Tool <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
