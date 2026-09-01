"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Code2,
  Download,
  Eye,
  FolderOpen,
  GitCommit,
  Laptop,
  Layers,
  Loader2,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  Send,
  Smartphone,
  Sparkles,
  SplitSquareVertical,
  Tablet,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TemplateLibraryCard, getTemplateExportUrl } from "../../lib/api";

export type ViewportMode = "desktop" | "laptop" | "tablet" | "mobile" | "custom";
export type BuilderTab = "visual" | "code" | "pages" | "assets" | "diff" | "settings";
export type AutosaveStatus = "saved" | "saving" | "unsaved" | "error";

interface BuilderTopbarProps {
  template: TemplateLibraryCard;
  activeTab: BuilderTab;
  setActiveTab: (tab: BuilderTab) => void;
  viewport: ViewportMode;
  setViewport: (mode: ViewportMode) => void;
  customWidth?: number;
  setCustomWidth?: (width: number) => void;
  lastSavedAt?: string | null;
  autosaveStatus: AutosaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSyncCode: () => void;
  onSaveVersion: () => void;
  onPublish: () => void;
  onPreview: () => void;
  isPublishing?: boolean;
  blocksOpen: boolean;
  inspectorOpen: boolean;
  onToggleBlocks: () => void;
  onToggleInspector: () => void;
}

const workspaceTabs: Array<{
  id: Exclude<BuilderTab, "settings">;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "visual", label: "Visual", icon: Sparkles },
  { id: "code", label: "Code", icon: Code2 },
  { id: "pages", label: "Pages", icon: Layers },
  { id: "assets", label: "Media", icon: FolderOpen },
  { id: "diff", label: "History", icon: SplitSquareVertical },
];

const viewportOptions: Array<{
  id: Exclude<ViewportMode, "custom">;
  label: string;
  width: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "desktop", label: "Desktop", width: "Fluid", icon: Monitor },
  { id: "laptop", label: "Laptop", width: "1024", icon: Laptop },
  { id: "tablet", label: "Tablet", width: "768", icon: Tablet },
  { id: "mobile", label: "Mobile", width: "390", icon: Smartphone },
];

function focusTab(tab: BuilderTab) {
  document.getElementById(`builder-tab-${tab}`)?.focus();
}

export const BuilderTopbar: React.FC<BuilderTopbarProps> = ({
  template,
  activeTab,
  setActiveTab,
  viewport,
  setViewport,
  customWidth = 1440,
  setCustomWidth,
  lastSavedAt,
  autosaveStatus,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSaveVersion,
  onPublish,
  onPreview,
  isPublishing = false,
  blocksOpen,
  inspectorOpen,
  onToggleBlocks,
  onToggleInspector,
}) => {
  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % workspaceTabs.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + workspaceTabs.length) % workspaceTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = workspaceTabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = workspaceTabs[nextIndex].id;
    setActiveTab(nextTab);
    requestAnimationFrame(() => focusTab(nextTab));
  };

  const savedLabel =
    autosaveStatus === "saving"
      ? "Saving draft"
      : autosaveStatus === "unsaved"
        ? "Unsaved changes"
        : autosaveStatus === "error"
          ? "Draft save failed"
          : lastSavedAt
            ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "All changes saved";

  return (
    <header className="relative z-40 shrink-0 border-b border-slate-200 bg-white text-slate-950 shadow-[0_1px_0_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50">
      <div className="flex min-h-16 flex-col items-stretch justify-between gap-3 px-3 py-2.5 sm:flex-row sm:items-center sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            asChild
            className="h-11 w-11 shrink-0 rounded-xl border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <Link href="/dashboard/landing-library" aria-label="Back to landing library">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>

          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="max-w-[42vw] truncate text-sm font-bold tracking-tight sm:text-base">
                {template.name}
              </h1>
              <Badge variant="outline" className="h-5 border-blue-300 bg-blue-50 px-2 font-mono text-[10px] text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                v{template.current_version}
              </Badge>
              <Badge
                variant="outline"
                className={template.is_published
                  ? "h-5 border-emerald-300 bg-emerald-50 px-2 text-[10px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                  : "h-5 border-amber-300 bg-amber-50 px-2 text-[10px] text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"}
              >
                {template.is_published ? "Published" : "Draft"}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span className="capitalize">{template.source_framework}</span>
              <span aria-hidden="true">/</span>
              <span className="capitalize">{template.business_types?.[0]?.replace("_", " ") || "Universal"}</span>
              <span aria-hidden="true" className="hidden sm:inline">/</span>
              <span className="hidden items-center gap-1 sm:inline-flex" role="status">
                {autosaveStatus === "saving" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-700 dark:text-blue-300" aria-hidden="true" />
                ) : autosaveStatus === "error" ? (
                  <span className="h-2 w-2 rounded-full bg-red-600" aria-hidden="true" />
                ) : autosaveStatus === "unsaved" ? (
                  <span className="h-2 w-2 rounded-full bg-amber-600" aria-hidden="true" />
                ) : (
                  <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                )}
                {savedLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" asChild className="hidden h-11 gap-2 lg:inline-flex">
            <a href={getTemplateExportUrl(template.id)} download>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={onPreview} className="h-11 gap-2">
            <Eye className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Preview</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onSaveVersion} className="hidden h-11 gap-2 md:inline-flex">
            <GitCommit className="h-4 w-4" aria-hidden="true" />
            Save version
          </Button>
          <Button size="sm" onClick={onPublish} disabled={isPublishing} className="h-11 gap-2 bg-blue-700 px-4 text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500">
            {isPublishing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            {template.is_published ? "Update live" : "Publish"}
          </Button>
        </div>
      </div>

      <div className="flex min-h-12 flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50/90 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900/90 sm:px-5">
        <nav className="flex shrink-0 flex-wrap items-center gap-1" role="tablist" aria-label="Builder workspace">
          {workspaceTabs.map((tab, index) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`builder-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`builder-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-slate-900 ${
                  selected
                    ? "bg-white text-blue-800 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-blue-200 dark:ring-slate-700"
                    : "text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="h-7 w-px shrink-0 bg-slate-300 dark:bg-slate-700" aria-hidden="true" />

        {activeTab === "visual" && (
          <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Preview width">
            {viewportOptions.map((option) => {
              const Icon = option.icon;
              const selected = viewport === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-label={`${option.label} preview${option.width === "Fluid" ? "" : `, ${option.width} pixels`}`}
                  aria-pressed={selected}
                  onClick={() => setViewport(option.id)}
                  className={`flex h-11 min-w-11 items-center justify-center rounded-lg px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    selected
                      ? "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
                      : "text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  }`}
                  title={`${option.label} ${option.width}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </button>
              );
            })}
            <label className="ml-1 flex h-11 items-center gap-1 rounded-lg border border-slate-500 bg-white px-2 text-xs text-slate-700 dark:border-slate-500 dark:bg-slate-950 dark:text-slate-200">
              <span className="sr-only">Custom preview width in pixels</span>
              <input
                type="number"
                min={320}
                max={1920}
                step={10}
                value={customWidth}
                onFocus={() => setViewport("custom")}
                onChange={(event) => {
                  const width = Math.min(1920, Math.max(320, Number(event.target.value) || 320));
                  setCustomWidth?.(width);
                  setViewport("custom");
                }}
                className="w-12 bg-transparent text-right font-mono outline-none"
              />
              <span aria-hidden="true">px</span>
            </label>
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {activeTab === "visual" && (
            <>
              <Button variant="ghost" size="icon" disabled={!canUndo} onClick={onUndo} className="h-11 w-11" aria-label="Undo last canvas change">
                <Undo2 className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" disabled={!canRedo} onClick={onRedo} className="h-11 w-11" aria-label="Redo canvas change">
                <Redo2 className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onToggleBlocks} aria-pressed={blocksOpen} className="h-11 w-11" aria-label={`${blocksOpen ? "Hide" : "Show"} component library`}>
                {blocksOpen ? <PanelLeftClose className="h-4 w-4" aria-hidden="true" /> : <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={onToggleInspector} aria-pressed={inspectorOpen} className="h-11 w-11" aria-label={`${inspectorOpen ? "Hide" : "Show"} element inspector`}>
                {inspectorOpen ? <PanelRightClose className="h-4 w-4" aria-hidden="true" /> : <PanelRightOpen className="h-4 w-4" aria-hidden="true" />}
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
