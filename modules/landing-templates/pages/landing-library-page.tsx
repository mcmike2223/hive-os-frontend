"use client";

import * as React from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  BadgeCheck,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileCode2,
  FolderOpen,
  LayoutTemplate,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  PackageOpen,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  UploadCloud,
  XCircle,
  Code2,
  Layers,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getBackendOrigin } from "@/lib/runtime-context";
import { AssignTemplateDialog } from "../components/assign-template-dialog";
import { ImportTemplateDialog } from "../components/import-template-dialog";
import { LandingWorkspaceNav } from "../components/landing-workspace-nav";
import { TemplateEditDialog } from "../components/template-edit-dialog";
import { AssetManagerModal } from "../builder/components/asset-manager-modal";
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  ejectTemplate,
  fetchCategories,
  fetchLibrary,
  getTemplateExportUrl,
  toggleArchive,
  togglePublish,
  type TemplateLibraryCard,
} from "../lib/api";

const frameworkLabel: Record<string, string> = {
  "static-html": "Static HTML",
  "html-css-js": "HTML + CSS + JS",
  react: "React",
  nextjs: "Next.js",
  visual: "GrapesJS Visual",
};

const frameworkColor: Record<string, string> = {
  "static-html": "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  "html-css-js": "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  react: "bg-sky-500/10 text-sky-800 dark:text-sky-300",
  nextjs: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-200",
  visual: "bg-teal-500/10 text-teal-800 dark:text-teal-300 border-teal-500/20",
};

type Filters = {
  q: string;
  business_type: string;
  framework: string;
  status: string;
  archived: boolean;
};

export default function LandingLibraryPage() {
  const [templates, setTemplates] = React.useState<TemplateLibraryCard[]>([]);
  const [total, setTotal] = React.useState(0);
  const [businessTypes, setBusinessTypes] = React.useState<
    { key: string; label: string }[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<Filters>({
    q: "",
    business_type: "",
    framework: "",
    status: "",
    archived: false,
  });
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [importOpen, setImportOpen] = React.useState(false);
  const [assetManagerOpen, setAssetManagerOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [assignTarget, setAssignTarget] =
    React.useState<TemplateLibraryCard | null>(null);
  const [editTarget, setEditTarget] =
    React.useState<TemplateLibraryCard | null>(null);
  const [ejectTarget, setEjectTarget] =
    React.useState<TemplateLibraryCard | null>(null);
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const loadRequestRef = React.useRef(0);

  // New Template form state
  const [newTemplateName, setNewTemplateName] = React.useState("");
  const [newTemplateBusinessType, setNewTemplateBusinessType] = React.useState("general");
  const [newTemplateType, setNewTemplateType] = React.useState<"visual" | "html-css-js">("visual");
  const [isCreating, setIsCreating] = React.useState(false);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(filters.q);
    }, 300);
    return () => clearTimeout(handle);
  }, [filters.q]);

  React.useEffect(() => {
    let active = true;
    fetchCategories()
      .then((response) => {
        if (!active) return;
        setBusinessTypes(
          response.data.business_types.map((businessType) => ({
            key: businessType.key,
            label: businessType.label,
          })),
        );
      })
      .catch(() => {
        if (active) setBusinessTypes([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadData = React.useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const libRes = await fetchLibrary({
        q: debouncedQuery || undefined,
        business_type: filters.business_type || undefined,
        framework: filters.framework || undefined,
        status: filters.status || undefined,
        archived: filters.archived,
      });
      if (requestId === loadRequestRef.current) {
        setTemplates(libRes.data);
        setTotal(libRes.meta.total);
      }
    } catch (err: any) {
      if (requestId === loadRequestRef.current) {
        setError(err?.message ?? "Failed to load landing template library.");
      }
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [
    debouncedQuery,
    filters.business_type,
    filters.framework,
    filters.status,
    filters.archived,
  ]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;

    setIsCreating(true);
    try {
      const res = await createTemplate({
        name: newTemplateName.trim(),
        business_types: [newTemplateBusinessType],
        source_framework: newTemplateType === "visual" ? "visual" : "html-css-js",
        template_type: newTemplateType,
        body: {
          theme: { accent: "#0f766e", surface: "#ffffff" },
          hero: {
            title: newTemplateName.trim(),
            description: "Welcome to our official website.",
            primary_label: "Get Started",
            primary_href: "#get-started",
          },
          rendering: {
            mode: "custom_code",
            html: `<section class="py-20 text-center bg-slate-950 text-white"><div class="max-w-4xl mx-auto px-4"><h1 class="text-5xl font-bold tracking-tight mb-4">${newTemplateName.trim()}</h1><p class="text-slate-400 text-lg">Created with HIVE Live Builder</p></div></section>`,
            css: "body { margin: 0; font-family: system-ui, sans-serif; }",
            js: "console.log('Template initialized');",
          },
        },
      });

      setCreateOpen(false);
      setNewTemplateName("");
      await loadData();
    } catch (err: any) {
      alert("Failed to create template: " + (err.message || err));
    } finally {
      setIsCreating(false);
    }
  };

  const handleTogglePublish = async (tpl: TemplateLibraryCard) => {
    setBusyId(tpl.id);
    try {
      const res = await togglePublish(tpl.id, !tpl.is_published);
      setTemplates((prev) =>
        prev.map((t) => (t.id === tpl.id ? res.data : t)),
      );
    } catch (err: any) {
      alert(err?.message ?? "Failed to toggle publish status.");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleArchive = async (tpl: TemplateLibraryCard) => {
    setBusyId(tpl.id);
    try {
      const res = await toggleArchive(tpl.id, !tpl.is_archived);
      setTemplates((prev) =>
        prev.map((t) => (t.id === tpl.id ? res.data : t)),
      );
    } catch (err: any) {
      alert(err?.message ?? "Failed to toggle archive status.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDuplicate = async (tpl: TemplateLibraryCard) => {
    setBusyId(tpl.id);
    try {
      await duplicateTemplate(tpl.id);
      await loadData();
    } catch (err: any) {
      alert(err?.message ?? "Failed to duplicate template.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (tpl: TemplateLibraryCard) => {
    if (!confirm(`Permanently delete template "${tpl.name}"? This cannot be undone.`)) {
      return;
    }
    setBusyId(tpl.id);
    try {
      await deleteTemplate(tpl.id, true);
      setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err: any) {
      alert(err?.message ?? "Failed to delete template.");
    } finally {
      setBusyId(null);
    }
  };

  const handleEject = async (tpl: TemplateLibraryCard) => {
    setBusyId(tpl.id);
    try {
      const res = await ejectTemplate(tpl.id);
      setTemplates((prev) =>
        prev.map((t) => (t.id === tpl.id ? res.data : t)),
      );
      setEjectTarget(null);
    } catch (err: any) {
      alert(err?.message ?? "Failed to eject template.");
    } finally {
      setBusyId(null);
    }
  };

  const publishedCount = templates.filter((template) => template.is_published).length;
  const visualCount = templates.filter((template) => (template.template_type || template.source_framework) === "visual").length;

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 px-1 pb-10 sm:px-2">
      <LandingWorkspaceNav active="library" />

      <section className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 px-6 py-8 text-white shadow-[0_24px_70px_rgba(15,23,42,0.28)] sm:px-9 sm:py-10" aria-labelledby="landing-library-heading">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <Badge variant="outline" className="border-blue-400/50 bg-blue-400/10 text-blue-100">
              GrapesJS visual canvas + Monaco code workspace
            </Badge>
            <div className="space-y-2">
              <h1 id="landing-library-heading" className="text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">
                Landing studio
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Build, version, preview, and distribute secure multi-page websites from one production workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-200">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5"><strong className="text-white">{total}</strong> templates</span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5"><strong className="text-emerald-300">{publishedCount}</strong> live</span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5"><strong className="text-blue-200">{visualCount}</strong> visual</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setAssetManagerOpen(true)}
            className="h-11 gap-2 border-slate-600 bg-slate-900 text-white hover:bg-slate-800 hover:text-white"
          >
            <FolderOpen className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            <span>Media Library</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="h-11 gap-2 border-slate-600 bg-slate-900 text-white hover:bg-slate-800 hover:text-white"
          >
            <UploadCloud className="h-4 w-4 text-blue-300" aria-hidden="true" />
            <span>Import ZIP</span>
          </Button>

          <Button
            onClick={() => setCreateOpen(true)}
            className="h-11 gap-2 bg-blue-600 px-5 text-white shadow-lg shadow-blue-950/40 hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>New Template</span>
          </Button>
        </div>
      </div>
      </section>

      {/* Filter Bar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950" aria-labelledby="template-filters-heading">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 id="template-filters-heading" className="text-sm font-bold text-slate-950 dark:text-white">Find a template</h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">Search and narrow the central library without losing your place.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={loadData} disabled={loading} className="h-11 gap-2">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
            Refresh
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="template-library-search">Search templates</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="template-library-search"
                type="search"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                placeholder="Name, slug, category, or tag"
                className="h-11 pl-9"
              />
            </div>
          </div>

        <div className="space-y-1.5">
          <Label id="business-type-filter-label">Business type</Label>
        <Select
          value={filters.business_type || "__all"}
          onValueChange={(val) =>
            setFilters({
              ...filters,
              business_type: val === "__all" ? "" : val,
            })
          }
        >
          <SelectTrigger className="h-11" aria-labelledby="business-type-filter-label">
            <SelectValue placeholder="All Business Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All Business Types</SelectItem>
            {businessTypes.map((bt) => (
              <SelectItem key={bt.key} value={bt.key}>
                {bt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        </div>

        <div className="space-y-1.5">
          <Label id="framework-filter-label">Editing engine</Label>
        <Select
          value={filters.framework || "__all"}
          onValueChange={(val) =>
            setFilters({
              ...filters,
              framework: val === "__all" ? "" : val,
            })
          }
        >
          <SelectTrigger className="h-11" aria-labelledby="framework-filter-label">
            <SelectValue placeholder="All Frameworks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All Frameworks</SelectItem>
            <SelectItem value="visual">GrapesJS Visual</SelectItem>
            <SelectItem value="static-html">Static HTML</SelectItem>
            <SelectItem value="html-css-js">HTML + CSS + JS</SelectItem>
            <SelectItem value="react">React</SelectItem>
            <SelectItem value="nextjs">Next.js</SelectItem>
          </SelectContent>
        </Select>
        </div>

        <div className="space-y-1.5">
          <Label id="status-filter-label">Publication status</Label>
        <Select
          value={filters.status || "__all"}
          onValueChange={(val) =>
            setFilters({
              ...filters,
              status: val === "__all" ? "" : val,
            })
          }
        >
          <SelectTrigger className="h-11" aria-labelledby="status-filter-label">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All Statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Drafts</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        </div>
      </div>
      </section>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1 text-sm text-slate-600 dark:text-slate-300" role="status">
        <span>
          Showing {templates.length} of {total} templates
        </span>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden rounded-2xl border-border/60">
              <Skeleton className="aspect-video w-full" />
              <div className="p-5 space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-3">
          <XCircle className="mx-auto h-8 w-8 text-destructive" />
          <p className="text-sm font-semibold text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={loadData}>
            Try Again
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && templates.length === 0 && (
        <div className="rounded-3xl border-2 border-dashed border-border/60 bg-muted/20 p-12 text-center space-y-4">
          <LayoutTemplate className="mx-auto h-12 w-12 text-muted-foreground/60" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold">No landing templates found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Create a new template using the visual builder or import an existing static site archive.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" />
            <span>Create First Template</span>
          </Button>
        </div>
      )}

      {/* Template Cards Grid */}
      {!loading && !error && templates.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((tpl) => {
            const isBusy = busyId === tpl.id;
            const backendOrigin = getBackendOrigin();
            const thumbUrl = tpl.thumbnail
              ? tpl.thumbnail.startsWith("http")
                ? tpl.thumbnail
                : `${backendOrigin}${tpl.thumbnail}`
              : null;

            return (
              <Card
                key={tpl.id}
                className={cn(
                  "group overflow-hidden rounded-2xl border-border/60 bg-card hover:border-primary/40 hover:shadow-lg transition-all duration-300 flex flex-col justify-between",
                  tpl.is_archived && "opacity-60 bg-muted/30",
                )}
              >
                <div>
                  {/* Thumbnail / Visual Preview banner */}
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-950/90 border-b border-border/40 flex items-center justify-center">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={`Preview of ${tpl.name}`}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2 bg-gradient-to-br from-slate-900 to-slate-950">
                        <Sparkles className="h-8 w-8 text-primary/80" />
                        <span className="text-xs font-semibold text-slate-200 tracking-tight">{tpl.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">v{tpl.current_version} • {tpl.pages_count || 1} {tpl.pages_count === 1 ? "Page" : "Pages"}</span>
                      </div>
                    )}

                    {/* Status Badges Overlay */}
                    <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                      <Badge className={cn("text-[10px] font-mono uppercase px-2 py-0.5", frameworkColor[tpl.template_type || tpl.source_framework] || "bg-primary/10 text-primary")}>
                        {frameworkLabel[tpl.template_type || tpl.source_framework] || tpl.template_type || tpl.source_framework}
                      </Badge>
                      {tpl.is_published ? (
                        <Badge className="bg-emerald-800 text-white text-[10px] px-2 py-0.5 shadow-sm">
                          Live
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-black/60 text-white backdrop-blur">
                          Draft
                        </Badge>
                      )}
                    </div>

                    <div className="absolute top-3 right-3 flex items-center gap-1">
                      <Badge variant="outline" className="text-[10px] font-mono bg-black/60 text-white border-white/20 backdrop-blur">
                        <Layers className="h-2.5 w-2.5 mr-1" />
                        {tpl.pages_count || 1}P
                      </Badge>
                    </div>

                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-slate-950 via-slate-950/75 to-transparent px-3 pb-3 pt-12">
                      <Button
                        size="sm"
                        asChild
                        className="h-11 gap-2 bg-blue-600 px-4 font-semibold text-white shadow-md hover:bg-blue-500"
                      >
                        <Link href={`/dashboard/landing-library/${tpl.id}/builder`} aria-label={`Open ${tpl.name} in visual builder`}>
                          <Sparkles className="h-4 w-4" aria-hidden="true" />
                          <span>Open Builder</span>
                        </Link>
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        asChild
                        className="h-11 gap-2 bg-white px-4 text-slate-950 shadow-md hover:bg-slate-100"
                      >
                        <Link href={`/dashboard/landing-library/${tpl.id}/preview`} aria-label={`Preview ${tpl.name} on a full page`}>
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          <span>Preview</span>
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {/* Body Content */}
                  <CardHeader className="p-5 pb-2 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-base tracking-tight leading-snug group-hover:text-primary transition-colors">
                        {tpl.name}
                      </h3>
                      {tpl.is_premium && (
                        <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30 shrink-0">
                          Premium
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {tpl.description || "Production-grade multi-tenant website landing template."}
                    </p>
                  </CardHeader>

                  <CardContent className="p-5 pt-0 space-y-3">
                    {/* Business Types Tags */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2">
                      {(tpl.business_types || []).map((bt) => (
                        <span
                          key={bt}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] capitalize font-medium"
                        >
                          <Tag className="h-2.5 w-2.5" />
                          {bt.replace("_", " ")}
                        </span>
                      ))}
                    </div>

                    {/* Assignment count indicator */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                      <div>
                        <span className="block">Assignment</span>
                        <span className="font-semibold text-foreground">{tpl.assignments?.length ? `${tpl.assignments.length} tenants / types` : "Global default"}</span>
                      </div>
                      <div className="text-right">
                        <span className="block">Last edited</span>
                        <span className="font-semibold text-foreground">{tpl.updated_at ? new Date(tpl.updated_at).toLocaleDateString() : "Not available"}</span>
                      </div>
                    </div>
                  </CardContent>
                </div>

                {/* Footer Toolbar */}
                <CardFooter className="flex items-center justify-between gap-2 border-t border-border/50 bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 rounded-lg"
                      aria-label={`Edit ${tpl.name} metadata`}
                      onClick={() => setEditTarget(tpl)}
                    >
                      <FileCode2 className="h-4 w-4 text-slate-700 dark:text-slate-200" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 rounded-lg"
                      aria-label={`Assign ${tpl.name}`}
                      onClick={() => setAssignTarget(tpl)}
                    >
                      <BadgeCheck className="h-4 w-4 text-primary" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 rounded-lg"
                      aria-label={`Duplicate ${tpl.name}`}
                      onClick={() => handleDuplicate(tpl)}
                      disabled={isBusy}
                    >
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      className="h-11 w-11 rounded-lg"
                    >
                      <a href={getTemplateExportUrl(tpl.id)} download aria-label={`Export ${tpl.name} ZIP package`}>
                        <Download className="h-4 w-4 text-muted-foreground" />
                      </a>
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 rounded-lg"
                      aria-label={`${tpl.is_archived ? "Restore" : "Archive"} ${tpl.name}`}
                      onClick={() => handleToggleArchive(tpl)}
                      disabled={isBusy}
                    >
                      {tpl.is_archived ? <ArchiveRestore className="h-4 w-4" aria-hidden="true" /> : <Archive className="h-4 w-4" aria-hidden="true" />}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 rounded-lg text-destructive hover:bg-destructive/10"
                      aria-label={`Delete ${tpl.name}`}
                      onClick={() => handleDelete(tpl)}
                      disabled={isBusy}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    variant={tpl.is_published ? "outline" : "default"}
                    className="h-11 shrink-0 text-xs font-semibold"
                    onClick={() => handleTogglePublish(tpl)}
                    disabled={isBusy}
                  >
                    {isBusy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : tpl.is_published ? (
                      "Unpublish"
                    ) : (
                      "Publish Live"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Template Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateTemplate}>
            <DialogHeader>
              <DialogTitle>Create New Landing Template</DialogTitle>
              <DialogDescription>
                Start with a blank visual builder workspace or custom HTML/CSS/JS template.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-template-name">Template name</Label>
                <Input
                  id="new-template-name"
                  placeholder="e.g. Modern Bottling Plant, Apex Hotel Luxury"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label id="new-template-business-type-label">Target industry / business type</Label>
                <Select value={newTemplateBusinessType} onValueChange={setNewTemplateBusinessType}>
                  <SelectTrigger className="h-11" aria-labelledby="new-template-business-type-label">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Universal / General Business</SelectItem>
                    <SelectItem value="restaurant">Restaurant & Lounge</SelectItem>
                    <SelectItem value="hotel">Hotel & Hospitality</SelectItem>
                    <SelectItem value="manufacturing">Manufacturing & Factory</SelectItem>
                    <SelectItem value="water_bottling">Water Bottling & Plant</SelectItem>
                    <SelectItem value="retail">Retail & Commerce</SelectItem>
                    <SelectItem value="services">Professional Services</SelectItem>
                    <SelectItem value="healthcare">Healthcare & Clinics</SelectItem>
                    <SelectItem value="education">Education & LMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <span id="new-template-engine-label" className="text-sm font-medium">Editing engine mode</span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    aria-pressed={newTemplateType === "visual"}
                    aria-describedby="new-template-engine-label"
                    onClick={() => setNewTemplateType("visual")}
                    className={cn(
                      "min-h-24 space-y-1 rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                      newTemplateType === "visual"
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border/60 hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Visual Canvas</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Drag & drop blocks with GrapesJS</p>
                  </button>

                  <button
                    type="button"
                    aria-pressed={newTemplateType === "html-css-js"}
                    aria-describedby="new-template-engine-label"
                    onClick={() => setNewTemplateType("html-css-js")}
                    className={cn(
                      "min-h-24 space-y-1 rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                      newTemplateType === "html-css-js"
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border/60 hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-blue-500">
                      <Code2 className="h-3.5 w-3.5" />
                      <span>Monaco Code</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Raw HTML, CSS, and JS editor</p>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={isCreating}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating} className="gap-1.5">
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span>Create & Launch</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modals */}
      <ImportTemplateDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={loadData}
      />

      <AssetManagerModal
        open={assetManagerOpen}
        onOpenChange={setAssetManagerOpen}
      />

      {assignTarget && (
        <AssignTemplateDialog
          template={assignTarget}
          businessTypes={businessTypes}
          open={!!assignTarget}
          onOpenChange={(open) => !open && setAssignTarget(null)}
          onAssigned={loadData}
        />
      )}

      {editTarget && (
        <TemplateEditDialog
          template={editTarget}
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          onSaved={loadData}
        />
      )}

    </div>
  );
}
