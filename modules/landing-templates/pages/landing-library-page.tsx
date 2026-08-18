"use client";

import * as React from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  Copy,
  Eye,
  FileCode2,
  Home,
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
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { TemplateEditDialog } from "../components/template-edit-dialog";
import {
  deleteTemplate,
  duplicateTemplate,
  ejectTemplate,
  fetchCategories,
  fetchLibrary,
  toggleArchive,
  togglePublish,
  type TemplateLibraryCard,
} from "../lib/api";

const frameworkLabel: Record<string, string> = {
  "static-html": "Static HTML",
  "html-css-js": "HTML + CSS + JS",
  react: "React",
  nextjs: "Next.js",
};

const frameworkColor: Record<string, string> = {
  "static-html": "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  "html-css-js": "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  react: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  nextjs: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-200",
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
  const [businessTypes, setBusinessTypes] = React.useState<{ key: string; label: string }[]>([]);
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
  const [assignTarget, setAssignTarget] = React.useState<TemplateLibraryCard | null>(null);
  const [editTarget, setEditTarget] = React.useState<TemplateLibraryCard | null>(null);
  const [previewTarget, setPreviewTarget] = React.useState<TemplateLibraryCard | null>(null);
  const [ejectTarget, setEjectTarget] = React.useState<TemplateLibraryCard | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<TemplateLibraryCard | null>(null);
  const [busyId, setBusyId] = React.useState<number | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(filters.q), 350);
    return () => clearTimeout(timer);
  }, [filters.q]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [library, categories] = await Promise.all([
        fetchLibrary({
          q: debouncedQuery || undefined,
          business_type: filters.business_type || undefined,
          framework: filters.framework || undefined,
          status: filters.status || undefined,
          archived: filters.archived || undefined,
        }),
        fetchCategories(),
      ]);
      setTemplates(library.data);
      setTotal(library.meta.total);
      setBusinessTypes(categories.data.business_types.map((b) => ({ key: b.key, label: b.label })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the template library.");
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, filters.business_type, filters.framework, filters.status, filters.archived]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (id: number, action: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="mb-4 flex w-full items-center justify-end gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Home className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <span className="text-xs text-border">/</span>
        <span className="text-xs font-semibold text-foreground">Landing Library</span>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-border/50 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.16),transparent_32%),linear-gradient(145deg,rgba(15,23,42,0.02),rgba(15,23,42,0.09))] p-6 shadow-sm backdrop-blur-md">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-space font-black tracking-tight text-foreground">
              <LayoutTemplate className="h-6 w-6 text-primary" />
              Universal Landing Template Library
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              The master template marketplace for the whole platform. Create, import, convert, validate, assign, version
              and publish landing templates — HTML/CSS/JS, React or Next.js — all rendered by the Hive Next.js runtime.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Next.js canonical runtime
            </Badge>
            <Button onClick={() => setImportOpen(true)} className="gap-2 rounded-xl">
              <UploadCloud className="h-4 w-4" />
              Import Template
            </Button>
            <Button asChild variant="outline" className="rounded-xl border-border/60 bg-background/70">
              <Link href="/dashboard/landing-templates">
                Business Type Catalog
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-col gap-3 rounded-[1.5rem] border border-border/50 bg-card/40 p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="Search templates by name, slug or description…"
            className="h-10 rounded-xl bg-background/70 pl-9"
          />
        </div>
        <Select
          value={filters.business_type || undefined}
          onValueChange={(v) => setFilters((f) => ({ ...f, business_type: v === "all" ? "" : v }))}
        >
          <SelectTrigger className="h-10 w-full rounded-xl bg-background/70 md:w-52">
            <SelectValue placeholder="All business types" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border/60">
            <SelectItem value="all">All business types</SelectItem>
            {businessTypes.map((bt) => (
              <SelectItem key={bt.key} value={bt.key}>
                {bt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.framework || undefined}
          onValueChange={(v) => setFilters((f) => ({ ...f, framework: v === "all" ? "" : v }))}
        >
          <SelectTrigger className="h-10 w-full rounded-xl bg-background/70 md:w-44">
            <SelectValue placeholder="All frameworks" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border/60">
            <SelectItem value="all">All frameworks</SelectItem>
            {Object.entries(frameworkLabel).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status || undefined}
          onValueChange={(v) => setFilters((f) => ({ ...f, status: v === "all" ? "" : v }))}
        >
          <SelectTrigger className="h-10 w-full rounded-xl bg-background/70 md:w-44">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border/60">
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="pending_approval">Pending approval</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          onClick={() => setFilters((f) => ({ ...f, archived: !f.archived }))}
          className={cn("h-10 gap-2 rounded-xl", filters.archived && "bg-amber-500/10 text-amber-600 dark:text-amber-300")}
        >
          <Archive className="h-4 w-4" />
          Archived
        </Button>
        <Button variant="ghost" size="icon" onClick={() => void load()} className="h-10 w-10 rounded-xl">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}

      {/* grid */}
      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-[1.75rem]" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[2rem] border border-dashed border-border/60 py-20 text-center">
          <PackageOpen className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-semibold text-foreground">No templates match these filters</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Import a template ZIP, or create one from the business-type catalog, to grow the master library.
          </p>
          <Button onClick={() => setImportOpen(true)} variant="outline" className="mt-2 gap-2 rounded-xl">
            <UploadCloud className="h-4 w-4" /> Import a template
          </Button>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{total} template{total === 1 ? "" : "s"} in the library</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                busy={busyId === template.id}
                onPreview={() => setPreviewTarget(template)}
                onAssign={() => setAssignTarget(template)}
                onEdit={() => setEditTarget(template)}
                onPublish={() => runAction(template.id, () => togglePublish(template.id, !template.is_published))}
                onArchive={() => runAction(template.id, () => toggleArchive(template.id, !template.is_archived))}
                onDuplicate={() => runAction(template.id, () => duplicateTemplate(template.id))}
                onEject={() => setEjectTarget(template)}
                onDelete={() => setDeleteTarget(template)}
              />
            ))}
          </div>
        </>
      )}

      <ImportTemplateDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => void load()} />
      {assignTarget && (
        <AssignTemplateDialog
          template={assignTarget}
          businessTypes={businessTypes}
          open={!!assignTarget}
          onOpenChange={(open) => !open && setAssignTarget(null)}
          onAssigned={() => void load()}
        />
      )}
      <TemplateEditDialog
        template={editTarget}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onSaved={() => void load()}
      />
      {previewTarget && <PreviewDialog template={previewTarget} onClose={() => setPreviewTarget(null)} />}
      {deleteTarget && (
        <DeleteDialog
          template={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            void load();
          }}
        />
      )}
      {ejectTarget && (
        <EjectDialog
          template={ejectTarget}
          busy={busyId === ejectTarget.id}
          onClose={() => setEjectTarget(null)}
          onConfirm={async () => {
            const target = ejectTarget;
            setEjectTarget(null);
            await runAction(target.id, () => ejectTemplate(target.id));
          }}
        />
      )}
    </div>
  );
}

/**
 * Delete is the one irreversible action here — versions and assignments
 * cascade with the row. The API refuses first when a tenant is live on the
 * template; that refusal is surfaced here so the operator sees who is affected
 * before choosing to force it.
 */
function DeleteDialog({
  template,
  onClose,
  onDeleted,
}: {
  template: TemplateLibraryCard;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [blockedBy, setBlockedBy] = React.useState<string | null>(null);

  const run = async (force: boolean) => {
    setBusy(true);
    try {
      await deleteTemplate(template.id, force);
      onDeleted();
    } catch (e) {
      setBlockedBy(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(560px,95vw)] rounded-[1.5rem] border-border/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-space text-lg font-black tracking-tight">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete “{template.name}”?
          </DialogTitle>
          <DialogDescription>
            This removes the template and every one of its versions and assignments. It cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {blockedBy ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {blockedBy}
          </div>
        ) : (
          <p className="text-xs leading-5 text-muted-foreground">
            Tenants already running this template keep their published page — their content lives on the tenant, not
            here — but they lose the link back to the library.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl border-border/60">
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void run(!!blockedBy)}
            disabled={busy}
            className="gap-2 rounded-xl"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {blockedBy ? "Delete anyway" : "Delete template"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Eject is additive and reversible, but it does change what the template is —
 * so the dialog states the cost plainly rather than just asking "are you sure".
 */
function EjectDialog({
  template,
  busy,
  onClose,
  onConfirm,
}: {
  template: TemplateLibraryCard;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(560px,95vw)] rounded-[1.5rem] border-border/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-space text-lg font-black tracking-tight">
            <FileCode2 className="h-5 w-5 text-primary" />
            Eject “{template.name}” to code?
          </DialogTitle>
          <DialogDescription>
            This snapshots the design into editable HTML and CSS that the template owns, saved as a new version.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-700 dark:text-amber-300">
            <p className="font-semibold">The rendered page loses its React behaviour.</p>
            <p className="mt-1 text-xs leading-5">
              Hero carousels, scroll animations and ambient effects come from the shared component, not from the
              template. The ejected copy keeps the layout and styling but renders as flat markup, and it stops picking
              up future improvements to that component.
            </p>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Version{" "}
            <span className="font-semibold text-foreground">v{template.current_version}</span> stays in the history, so
            you can roll back if the result is worse.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl border-border/60">
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy} className="gap-2 rounded-xl">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode2 className="h-4 w-4" />}
            Eject to code
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({
  template,
  busy,
  onPreview,
  onAssign,
  onEdit,
  onPublish,
  onArchive,
  onDuplicate,
  onEject,
  onDelete,
}: {
  template: TemplateLibraryCard;
  busy: boolean;
  onPreview: () => void;
  onAssign: () => void;
  onEdit: () => void;
  onPublish: () => void;
  onArchive: () => void;
  onDuplicate: () => void;
  onEject: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="group relative overflow-hidden rounded-[1.75rem] border-border/50 bg-card/50 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-lg">
      {/* visual header — real rendered screenshot when available */}
      <div className="relative h-28 overflow-hidden border-b border-border/40">
        {template.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${getBackendOrigin()}${template.thumbnail}`}
            alt={template.name}
            className="absolute inset-0 h-full w-full object-cover object-top"
            loading="lazy"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 20% 20%, ${template.preview?.theme?.accent_soft ?? "#ccfbf1"}55, transparent 60%), linear-gradient(135deg, ${
                template.preview?.theme?.surface ?? "#0f172a"
              }, ${template.preview?.theme?.accent ?? "#0f766e"}22)`,
            }}
          />
        )}
        <div className="absolute inset-0 flex items-end p-3">
          <div className="rounded-xl border border-white/20 bg-black/25 px-2.5 py-1.5 backdrop-blur-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/90">
              {template.preview?.hero?.title ? String(template.preview.hero.title).slice(0, 34) : template.name}
            </p>
          </div>
        </div>
        <div className="absolute right-2 top-2 flex gap-1.5">
          {template.is_published ? (
            <Badge className="border-transparent bg-emerald-500/90 text-white">Live</Badge>
          ) : (
            <Badge variant="outline" className="border-white/25 bg-black/30 text-white">Draft</Badge>
          )}
        </div>
      </div>

      <CardHeader className="space-y-1.5 p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-space text-base font-black tracking-tight text-foreground">{template.name}</h3>
          {template.is_premium && <Lock className="h-4 w-4 shrink-0 text-amber-500" />}
        </div>
        <p className="line-clamp-2 min-h-[2.2rem] text-xs leading-5 text-muted-foreground">
          {template.description ?? "No description provided."}
        </p>
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-1">
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant="outline"
            className={cn("border-transparent font-semibold", frameworkColor[template.source_framework] ?? "bg-zinc-500/10")}
          >
            {frameworkLabel[template.source_framework] ?? template.source_framework}
          </Badge>
          {(template.business_types ?? []).slice(0, 2).map((bt) => (
            <Badge key={bt} variant="outline" className="border-border/60 bg-background/60 text-muted-foreground">
              <Tag className="mr-1 h-3 w-3" />
              {bt}
            </Badge>
          ))}
          <Badge variant="outline" className="border-border/60 bg-background/60 text-muted-foreground">
            v{template.current_version}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {template.compatibility_score >= 90 ? (
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            ) : template.compatibility_score >= 60 ? (
              <Sparkles className="h-4 w-4 text-amber-500" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-500" />
            )}
            <span className="text-xs font-bold text-foreground">{template.compatibility_score}%</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">compat</span>
          </div>
          {template.import_status !== "none" && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              {template.import_status === "approved" ? (
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
              ) : template.import_status === "pending_approval" ? (
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-rose-500" />
              )}
              {template.import_status.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap items-center gap-1.5 p-4 pt-0">
        <Button variant="outline" size="sm" onClick={onPreview} className="h-8 gap-1 rounded-lg text-xs">
          <Eye className="h-3.5 w-3.5" /> Preview
        </Button>
        <Button variant="outline" size="sm" onClick={onEdit} className="h-8 gap-1 rounded-lg text-xs">
          <Sparkles className="h-3.5 w-3.5" /> Edit
        </Button>
        <Button variant="outline" size="sm" onClick={onAssign} className="h-8 gap-1 rounded-lg text-xs">
          <Tag className="h-3.5 w-3.5" /> Assign
        </Button>
        <Button
          variant={template.is_published ? "ghost" : "default"}
          size="sm"
          onClick={onPublish}
          disabled={busy}
          className="h-8 gap-1 rounded-lg text-xs"
        >
          {template.is_published ? "Unpublish" : "Publish"}
        </Button>
        <div className="ml-auto flex gap-1">
          {(template.preview?.rendering?.mode ?? "structured") === "structured" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              title="Eject to editable code"
              onClick={onEject}
              disabled={busy}
            >
              <FileCode2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Duplicate" onClick={onDuplicate} disabled={busy}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
            title="Delete template"
            onClick={onDelete}
            disabled={busy}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title={template.is_archived ? "Restore" : "Archive"} onClick={onArchive} disabled={busy}>
            {template.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function PreviewDialog({ template, onClose }: { template: TemplateLibraryCard; onClose: () => void }) {
  const [fullscreen, setFullscreen] = React.useState(true);
  const rendering = template.preview?.rendering as { mode?: string; html?: string; css?: string; js?: string } | undefined;
  const isRaw = rendering?.mode === "raw_package" || rendering?.mode === "custom_code";
  const srcDoc = React.useMemo(() => {
    if (!isRaw) return null;
    return `<!doctype html><html><head><meta charset="utf-8"/><style>html,body{margin:0;min-height:100%}body{font-family:Inter,system-ui,sans-serif}${rendering?.css ?? ""}</style></head><body>${rendering?.html ?? ""}${rendering?.js ? `<script>${rendering.js}</script>` : ""}</body></html>`;
  }, [isRaw, rendering]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "overflow-hidden rounded-[1.75rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl",
          fullscreen
            ? "flex h-[100dvh] w-screen max-w-none flex-col rounded-none border-0 sm:max-w-none"
            : "max-h-[92vh] w-[min(1300px,97vw)] sm:max-w-[1300px]",
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border/40 px-5 py-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 font-space text-lg font-black uppercase tracking-tight">
              <Eye className="h-5 w-5 text-primary" />
              {template.name}
              <span className="text-xs font-semibold normal-case tracking-normal text-muted-foreground">v{template.current_version}</span>
            </DialogTitle>
            <div className="flex shrink-0 items-center gap-2">
              {isRaw && <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">Sandboxed {rendering?.mode}</Badge>}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setFullscreen((value) => !value)}
                className="h-8 w-8 rounded-lg border border-border/50 bg-background/70"
                title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <DialogDescription>{template.description ?? "Template preview"}</DialogDescription>
        </DialogHeader>

        <div className={cn("overflow-y-auto", fullscreen ? "min-h-0 flex-1" : "h-[62vh]")}>
          {srcDoc ? (
            <iframe title={`${template.name} preview`} srcDoc={srcDoc} sandbox="allow-scripts allow-popups" className="h-full w-full border-0" />
          ) : template.is_published ? (
            // Render through the real Next.js template component rather than
            // the JSON approximation: StructuredPreview draws a generic
            // hero/stats/cards page that looks nothing like the live site,
            // which made every structured template preview look identical.
            <iframe
              title={`${template.name} preview`}
              src={`/landing-preview/${template.slug}`}
              className="h-full w-full border-0"
            />
          ) : (
            <StructuredPreview template={template} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StructuredPreview({ template }: { template: TemplateLibraryCard }) {
  const p = template.preview as {
    hero?: { eyebrow?: string; title?: string; description?: string; primary_label?: string; primary_href?: string; secondary_label?: string };
    stats?: { value: string; label: string }[];
    highlights?: { kicker?: string; title?: string; description?: string }[];
    testimonials?: { quote?: string; author?: string; role?: string }[];
    final_cta?: { title?: string; description?: string; primary_label?: string };
    theme?: { accent?: string; accent_soft?: string; surface?: string; text?: string; muted?: string };
  } | null;

  const theme = p?.theme ?? {};
  const accent = theme.accent ?? "#0f766e";
  const surface = theme.surface ?? "#f8fafc";

  return (
    <div className="min-h-full" style={{ background: surface, color: theme.text ?? "#0f172a" }}>
      {p?.hero && (
        <div className="px-8 py-12 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.24em]" style={{ color: accent }}>{p.hero.eyebrow}</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-black leading-tight tracking-tight">{p.hero.title}</h2>
          {p.hero.description && <p className="mx-auto mt-3 max-w-xl text-sm leading-6 opacity-80">{p.hero.description}</p>}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <span className="rounded-full px-5 py-2.5 text-sm font-bold text-white" style={{ background: accent }}>{p.hero.primary_label ?? "Get Started"}</span>
            {p.hero.secondary_label && <span className="rounded-full border px-5 py-2.5 text-sm font-semibold opacity-80">{p.hero.secondary_label}</span>}
          </div>
        </div>
      )}

      {p?.stats && (
        <div className="grid grid-cols-3 gap-4 px-8 pb-10">
          {p.stats.map((s, i) => (
            <div key={i} className="rounded-2xl border p-4 text-center" style={{ borderColor: `${accent}33`, background: "#ffffff66" }}>
              <p className="text-2xl font-black" style={{ color: accent }}>{s.value}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wider opacity-70">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {p?.highlights && (
        <div className="grid gap-4 px-8 pb-10 sm:grid-cols-3">
          {p.highlights.map((h, i) => (
            <div key={i} className="rounded-2xl border p-5" style={{ borderColor: `${accent}22`, background: "#ffffff88" }}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: accent }}>{h.kicker}</p>
              <h3 className="mt-2 text-sm font-bold leading-snug">{h.title}</h3>
              <p className="mt-1.5 text-xs leading-5 opacity-70">{h.description}</p>
            </div>
          ))}
        </div>
      )}

      {p?.testimonials && (
        <div className="px-8 pb-10">
          <div className="grid gap-4 sm:grid-cols-2">
            {p.testimonials.map((t, i) => (
              <figure key={i} className="rounded-2xl border p-5" style={{ borderColor: `${accent}22`, background: "#ffffff88" }}>
                <blockquote className="text-sm italic leading-6 opacity-85">“{t.quote}”</blockquote>
                <figcaption className="mt-3 text-xs font-bold">{t.author} <span className="font-normal opacity-60">— {t.role}</span></figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      {p?.final_cta && (
        <div className="px-8 pb-12">
          <div className="rounded-3xl px-8 py-10 text-center text-white" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}>
            <h3 className="text-2xl font-black tracking-tight">{p.final_cta.title}</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm opacity-90">{p.final_cta.description}</p>
            <span className="mt-5 inline-block rounded-full bg-white px-6 py-2.5 text-sm font-bold" style={{ color: accent }}>
              {p.final_cta.primary_label ?? "Get Started"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
