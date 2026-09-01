"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Editor } from "grapesjs";
import {
  AlertCircle,
  FolderOpen,
  Layers,
  Loader2,
  Sliders,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  TemplateBuilderData,
  TemplatePageItem,
  TemplateCodeFile,
  TemplateVersionItem,
  fetchBuilderData,
  saveDraft,
  syncCode,
  createTemplateVersion,
  togglePublish
} from "../lib/api";
import { BuilderTopbar, BuilderTab, ViewportMode, AutosaveStatus } from "./components/builder-topbar";
import { bindTenantData } from "@/modules/tenancy/landing-data-binder";
import { GrapesCanvas } from "./components/grapes-canvas";
import { BlockLibrary } from "./components/block-library";
import { StyleManagerPanel } from "./components/style-manager-panel";
import { TraitManagerPanel } from "./components/trait-manager-panel";
import { LayerManagerPanel } from "./components/layer-manager-panel";
import { PageManagerPanel } from "./components/page-manager-panel";
import { MonacoCodeWorkspace } from "./components/monaco-code-workspace";
import { MonacoDiffWorkspace } from "./components/monaco-diff-workspace";
import { AssetManagerModal } from "./components/asset-manager-modal";
import { SaveVersionDialog } from "./components/save-version-dialog";

interface LandingBuilderWorkspaceProps {
  templateId: number;
}

const inspectorTabs = [
  { id: "styles" as const, label: "Styles", icon: SlidersHorizontal },
  { id: "traits" as const, label: "Content", icon: Sliders },
  { id: "layers" as const, label: "Layers", icon: Layers },
];

export const LandingBuilderWorkspace: React.FC<LandingBuilderWorkspaceProps> = ({ templateId }) => {
  const router = useRouter();
  const [data, setData] = useState<TemplateBuilderData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs & Navigation
  const [activeTab, setActiveTab] = useState<BuilderTab>("visual");
  const [activeSidebar, setActiveSidebar] = useState<"styles" | "traits" | "layers">("styles");
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [customWidth, setCustomWidth] = useState(1440);
  const [blocksOpen, setBlocksOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  // Working state
  const [pages, setPages] = useState<TemplatePageItem[]>([]);
  const [activePageId, setActivePageId] = useState<string>("page-home");
  const [codeFiles, setCodeFiles] = useState<TemplateCodeFile[]>([]);
  const [versions, setVersions] = useState<TemplateVersionItem[]>([]);
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Autosave & Undo/Redo
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("saved");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSyncingCode, setIsSyncingCode] = useState(false);
  const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null);

  // Active selection
  const [selectedComponent, setSelectedComponent] = useState<any>(null);

  // Modals
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isSaveVersionOpen, setIsSaveVersionOpen] = useState(false);

  const editorInstanceRef = useRef<Editor | null>(null);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autosaveRevisionRef = useRef(0);

  // Load Builder Data on mount
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchBuilderData(templateId);
      setData(res.data);
      setPages(res.data.pages || []);
      setActivePageId(res.data.pages?.[0]?.id || "page-home");
      setCodeFiles(res.data.code_files || []);
      setVersions(res.data.versions || []);
      setHasDraft(Boolean(res.data.has_draft));
      setLastSavedAt(res.data.draft_saved_at);
    } catch (err: any) {
      setError(err.message || "Failed to load builder workspace.");
    } finally {
      setIsLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Debounced Autosave
  const triggerAutosave = useCallback(
    (newProjectData?: Record<string, unknown>, newPages?: TemplatePageItem[], newCodeFiles?: TemplateCodeFile[]) => {
      setAutosaveStatus("unsaved");
      const revision = ++autosaveRevisionRef.current;
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);

      autosaveTimeoutRef.current = setTimeout(async () => {
        setAutosaveStatus("saving");
        try {
          const projectDataToSave = newProjectData || (editorInstanceRef.current ? editorInstanceRef.current.getProjectData() : data?.project_data);
          const pagesToSave = newPages || pages;
          const codeFilesToSave = newCodeFiles || codeFiles;

          const response = await saveDraft(templateId, {
            project_data: projectDataToSave,
            pages: pagesToSave,
            code_files: codeFilesToSave,
          });

          if (revision === autosaveRevisionRef.current) {
            setAutosaveStatus("saved");
            setHasDraft(true);
            setLastSavedAt(response.data.saved_at || new Date().toISOString());
          }
        } catch (e) {
          console.error("Autosave failed:", e);
          if (revision === autosaveRevisionRef.current) {
            setAutosaveStatus("error");
            setWorkspaceNotice("Draft could not be saved. Your changes remain in this workspace; retry by making another edit.");
          }
        }
      }, 1500);
    },
    [templateId, data, pages, codeFiles]
  );

  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "visual" || !editorInstanceRef.current) return;
    const frame = requestAnimationFrame(() => editorInstanceRef.current?.refresh?.());
    return () => cancelAnimationFrame(frame);
  }, [activeTab, blocksOpen, inspectorOpen, viewport, customWidth]);

  // GrapesJS init callback
  const handleEditorInit = (editor: Editor) => {
    editorInstanceRef.current = editor;
    setEditorInstance(editor);

    editor.on("undo", () => {
      setCanUndo(editor.UndoManager?.hasUndo() || false);
      setCanRedo(editor.UndoManager?.hasRedo() || false);
    });

    editor.on("redo", () => {
      setCanUndo(editor.UndoManager?.hasUndo() || false);
      setCanRedo(editor.UndoManager?.hasRedo() || false);
    });
  };

  const handleCanvasUpdate = () => {
    if (!editorInstanceRef.current) return;
    setCanUndo(editorInstanceRef.current.UndoManager?.hasUndo() || false);
    setCanRedo(editorInstanceRef.current.UndoManager?.hasRedo() || false);

    const projectData = editorInstanceRef.current.getProjectData();
    const html = editorInstanceRef.current.getHtml() || "";
    const css = editorInstanceRef.current.getCss() || "";

    // Update index.html and styles.css code files
    const updatedCodeFiles = codeFiles.map((f) => {
      if (f.name === "index.html") return { ...f, content: html };
      if (f.name === "styles.css") return { ...f, content: css };
      return f;
    });

    setCodeFiles(updatedCodeFiles);
    triggerAutosave(projectData, pages, updatedCodeFiles);
  };

  // Insert block into canvas
  const handleInsertBlock = (blockHtml: string) => {
    if (!editorInstanceRef.current) return;
    const selected = editorInstanceRef.current.getSelected();
    if (selected) {
      selected.append(blockHtml);
    } else {
      editorInstanceRef.current.getWrapper()?.append(blockHtml);
    }
    handleCanvasUpdate();
  };

  // Update styles from panel
  const handleUpdateStyle = (property: string, value: string) => {
    if (!selectedComponent) return;
    selectedComponent.addStyle({ [property]: value });
    handleCanvasUpdate();
  };

  // Update trait from panel
  const handleUpdateTrait = (traitName: string, value: string) => {
    if (!selectedComponent) return;
    const attrs = { ...selectedComponent.getAttributes() };
    attrs[traitName] = value;
    selectedComponent.setAttributes(attrs);
    handleCanvasUpdate();
  };

  // Sync Monaco code back to visual builder
  const handleSyncCode = async () => {
    setIsSyncingCode(true);
    setWorkspaceNotice("Creating a recovery snapshot before applying code changes…");
    try {
      await createTemplateVersion(templateId, {
        project_data: editorInstanceRef.current?.getProjectData() || data?.project_data,
        pages,
        code_files: codeFiles,
        label: "Automatic snapshot before code sync",
        changelog: "Created automatically before Monaco code replaced visual canvas content.",
      });
      const res = await syncCode(templateId, codeFiles);
      setData(res.data);
      if (editorInstanceRef.current) {
        const indexHtml = codeFiles.find((f) => f.name === "index.html")?.content || "";
        const stylesCss = codeFiles.find((f) => f.name === "styles.css")?.content || "";
        editorInstanceRef.current.setComponents(indexHtml);
        editorInstanceRef.current.setStyle(stylesCss);
      }
      setActiveTab("visual");
      setWorkspaceNotice("Code changes applied to the visual canvas. A recovery snapshot is available in History.");
    } catch (e: any) {
      console.error("Failed to sync code:", e);
      setWorkspaceNotice(e?.message || "Code changes were not applied. The existing visual project is unchanged.");
    } finally {
      setIsSyncingCode(false);
    }
  };

  // Save new version
  const handleSaveVersion = async (label: string, changelog: string) => {
    const projectData = editorInstanceRef.current ? editorInstanceRef.current.getProjectData() : data?.project_data;
    const res = await createTemplateVersion(templateId, {
      project_data: projectData,
      pages,
      code_files: codeFiles,
      label,
      changelog,
    });
    setData((prev) => (prev ? { ...prev, template: res.data } : null));
    await loadData();
  };

  // Toggle publish
  const handleTogglePublish = async () => {
    if (!data?.template) return;
    setIsPublishing(true);
    try {
      const res = await togglePublish(templateId, !data.template.is_published);
      setData((prev) => (prev ? { ...prev, template: res.data } : null));
      setWorkspaceNotice(res.data.is_published ? "Template published successfully." : "Template returned to draft status.");
    } catch (e: any) {
      console.error("Publish failed:", e);
      setWorkspaceNotice(e?.message || "Publishing failed. The current live version was not changed.");
    } finally {
      setIsPublishing(false);
    }
  };

  // Page Manager Handlers
  const handleAddPage = (newPage: Omit<TemplatePageItem, "id">) => {
    const page: TemplatePageItem = {
      ...newPage,
      id: `page-${Date.now()}`,
    };
    const updated = [...pages, page];
    setPages(updated);
    const editor = editorInstanceRef.current;
    if (editor) {
      editor.Pages.add({
        id: page.id,
        name: page.name,
        component: `<main><section style="padding:64px 32px;text-align:center"><h1>${page.title || page.name}</h1><p>Start building this page from the component library.</p></section></main>`,
      });
      editor.Pages.select(page.id);
      setActivePageId(page.id);
    }
    triggerAutosave(editor?.getProjectData(), updated, undefined);
  };

  const handleUpdatePage = (pageId: string, updates: Partial<TemplatePageItem>) => {
    const updated = pages.map((p) => (p.id === pageId ? { ...p, ...updates } : p));
    setPages(updated);
    const projectPage = editorInstanceRef.current?.Pages.get(pageId);
    if (updates.name && projectPage) projectPage.set("name", updates.name);
    triggerAutosave(editorInstanceRef.current?.getProjectData(), updated, undefined);
  };

  const handleDeletePage = (pageId: string) => {
    const updated = pages.filter((p) => p.id !== pageId);
    setPages(updated);
    if (activePageId === pageId) {
      setActivePageId(updated[0]?.id || "page-home");
    }
    const editor = editorInstanceRef.current;
    const projectPage = editor?.Pages.get(pageId);
    if (projectPage) editor?.Pages.remove(projectPage);
    if (updated[0]) editor?.Pages.select(updated[0].id);
    triggerAutosave(editor?.getProjectData(), updated, undefined);
  };

  const handleDuplicatePage = (pageId: string) => {
    const target = pages.find((p) => p.id === pageId);
    if (!target) return;
    const duplicate: TemplatePageItem = {
      ...target,
      id: `page-${Date.now()}`,
      name: `${target.name} (Copy)`,
      slug: `${target.slug}-copy`,
      is_homepage: false,
    };
    const updated = [...pages, duplicate];
    setPages(updated);
    const editor = editorInstanceRef.current;
    const sourcePage = editor?.Pages.get(pageId);
    const sourceComponents = sourcePage?.getMainComponent?.().components?.().toJSON?.();
    if (editor) {
      editor.Pages.add({
        id: duplicate.id,
        name: duplicate.name,
        component: sourceComponents || "",
      });
    }
    triggerAutosave(editor?.getProjectData(), updated, undefined);
  };

  const handleSetHomepage = (pageId: string) => {
    const updated = pages.map((page) => ({
      ...page,
      is_homepage: page.id === pageId,
      slug:
        page.id === pageId
          ? "index"
          : page.slug === "index"
            ? page.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "home"
            : page.slug,
    }));
    setPages(updated);
    triggerAutosave(editorInstanceRef.current?.getProjectData(), updated, undefined);
    setWorkspaceNotice(`${updated.find((page) => page.id === pageId)?.name || "Page"} is now the homepage.`);
  };

  const handleInspectorKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % inspectorTabs.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + inspectorTabs.length) % inspectorTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = inspectorTabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = inspectorTabs[nextIndex].id;
    setActiveSidebar(nextTab);
    requestAnimationFrame(() => document.getElementById(`inspector-tab-${nextTab}`)?.focus());
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">Initializing HIVE Visual & Code Builder...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background p-6 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h2 className="text-lg font-bold">Failed to load Builder Workspace</h2>
        <p className="text-sm text-muted-foreground max-w-md">{error}</p>
        <Button onClick={loadData}>Retry</Button>
      </div>
    );
  }

  const compiledHtml = codeFiles.find((f) => f.name === "index.html")?.content || "";
  const compiledCss = codeFiles.find((f) => f.name === "styles.css")?.content || "";
  const compiledJs = codeFiles.find((f) => f.name === "script.js")?.content || "";
  const rawVariables = codeFiles.find((f) => f.name === "variables.json")?.content || "{}";

  let previewTenant: any = {
    name: data?.template?.name || "Company Name",
    tagline: "Experience excellence, state-of-the-art acoustics, and curated mixology in an ambient space.",
    phone: "+251 91 999 0011",
    email: "vip@savorylounge.com",
    address: "Bole Atlas, Club District, Addis Ababa",
  };
  try {
    const parsed = JSON.parse(rawVariables);
    if (parsed && typeof parsed === "object") {
      previewTenant = {
        ...previewTenant,
        name: parsed.company_name || parsed.name || previewTenant.name,
        tagline: parsed.tagline || previewTenant.tagline,
        phone: parsed.phone || previewTenant.phone,
        email: parsed.email || previewTenant.email,
        address: parsed.address || previewTenant.address,
      };
    }
  } catch {}

  const previewHtml = bindTenantData(compiledHtml, previewTenant, {}, data?.template?.preview?.rendering?.asset_base_url || "");
  const previewCss = bindTenantData(compiledCss, previewTenant, {}, data?.template?.preview?.rendering?.asset_base_url || "");

  return (
    <div className="flex h-dvh min-h-[640px] w-full flex-col overflow-hidden bg-slate-100 dark:bg-slate-950">
      <BuilderTopbar
        template={data.template}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        viewport={viewport}
        setViewport={setViewport}
        customWidth={customWidth}
        setCustomWidth={setCustomWidth}
        autosaveStatus={autosaveStatus}
        lastSavedAt={lastSavedAt}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => editorInstanceRef.current?.UndoManager?.undo()}
        onRedo={() => editorInstanceRef.current?.UndoManager?.redo()}
        onSyncCode={handleSyncCode}
        onSaveVersion={() => setIsSaveVersionOpen(true)}
        onPublish={handleTogglePublish}
        onPreview={() => router.push(`/dashboard/landing-library/${templateId}/preview`)}
        isPublishing={isPublishing}
        blocksOpen={blocksOpen}
        inspectorOpen={inspectorOpen}
        onToggleBlocks={() => setBlocksOpen((open) => !open)}
        onToggleInspector={() => setInspectorOpen((open) => !open)}
      />

      <main className="relative flex min-h-0 flex-1 overflow-hidden bg-slate-100 dark:bg-slate-950">
        <section
          id="builder-panel-visual"
          role="tabpanel"
          aria-labelledby="builder-tab-visual"
          hidden={activeTab !== "visual"}
          className={activeTab === "visual" ? "relative flex min-w-0 flex-1" : "hidden"}
        >
            {blocksOpen && (
              <aside
                aria-label="Component library"
                className="absolute inset-y-0 left-0 z-30 flex w-[18.5rem] shrink-0 flex-col border-r border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 xl:relative xl:z-20 xl:shadow-none"
              >
                <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4 text-xs font-semibold dark:border-slate-800">
                  <span className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <Sparkles className="h-4 w-4 text-blue-700 dark:text-blue-300" aria-hidden="true" />
                    Components
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setIsAssetModalOpen(true)} className="h-11 gap-2 px-3 text-xs">
                    <FolderOpen className="h-4 w-4" aria-hidden="true" />
                    Media
                  </Button>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <BlockLibrary onInsertBlock={handleInsertBlock} />
                </div>
              </aside>
            )}

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <GrapesCanvas
                initialProjectData={data.project_data}
                initialHtml={previewHtml}
                initialCss={previewCss}
                viewport={viewport}
                customWidth={customWidth}
                onEditorInit={handleEditorInit}
                onUpdate={handleCanvasUpdate}
                onSelectComponent={setSelectedComponent}
              />
              <footer className="flex h-8 shrink-0 items-center justify-between border-t border-slate-300 bg-white px-4 font-mono text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <span>{pages.find((page) => page.id === activePageId)?.name || "Page"}</span>
                <span>{viewport === "custom" ? `${customWidth}px` : viewport}</span>
              </footer>
            </div>

            {inspectorOpen && (
              <aside
                aria-label="Element inspector"
                className="absolute inset-y-0 right-0 z-30 flex w-[20rem] shrink-0 flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 xl:relative xl:z-20 xl:shadow-none"
              >
                <div className="flex min-h-14 shrink-0 items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 dark:border-slate-800 dark:bg-slate-900" role="tablist" aria-label="Element inspector">
                  {inspectorTabs.map((tab, index) => {
                    const Icon = tab.icon;
                    const selected = activeSidebar === tab.id;
                    return (
                      <button
                        key={tab.id}
                        id={`inspector-tab-${tab.id}`}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-controls="inspector-panel"
                        tabIndex={selected ? 0 : -1}
                        onKeyDown={(event) => handleInspectorKeyDown(event, index)}
                        onClick={() => setActiveSidebar(tab.id)}
                        className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                          selected
                            ? "bg-white text-blue-800 shadow-sm dark:bg-slate-800 dark:text-blue-200"
                            : "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div id="inspector-panel" role="tabpanel" aria-labelledby={`inspector-tab-${activeSidebar}`} className="min-h-0 flex-1 overflow-hidden">
                  {activeSidebar === "styles" && <StyleManagerPanel selectedComponent={selectedComponent} onUpdateStyle={handleUpdateStyle} />}
                  {activeSidebar === "traits" && <TraitManagerPanel selectedComponent={selectedComponent} onUpdateTrait={handleUpdateTrait} />}
                  {activeSidebar === "layers" && <LayerManagerPanel editor={editorInstance} />}
                </div>
              </aside>
            )}
        </section>

        <section
          id="builder-panel-code"
          role="tabpanel"
          aria-labelledby="builder-tab-code"
          hidden={activeTab !== "code"}
          className={activeTab === "code" ? "flex min-w-0 flex-1" : "hidden"}
        >
          {activeTab === "code" && (
            <MonacoCodeWorkspace
              codeFiles={codeFiles}
              onChangeCodeFiles={(updated) => {
                setCodeFiles(updated);
                triggerAutosave(undefined, undefined, updated);
              }}
              onSyncToCanvas={handleSyncCode}
              isSyncing={isSyncingCode}
            />
          )}
        </section>

        <section
          id="builder-panel-pages"
          role="tabpanel"
          aria-labelledby="builder-tab-pages"
          hidden={activeTab !== "pages"}
          className={activeTab === "pages" ? "flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950" : "hidden"}
        >
          {activeTab === "pages" && (
            <PageManagerPanel
              pages={pages}
              activePageId={activePageId}
              onSelectPage={(id) => {
                setActivePageId(id);
                editorInstanceRef.current?.Pages.select(id);
                setActiveTab("visual");
              }}
              onAddPage={handleAddPage}
              onUpdatePage={handleUpdatePage}
              onDeletePage={handleDeletePage}
              onDuplicatePage={handleDuplicatePage}
              onSetHomepage={handleSetHomepage}
            />
          )}
        </section>

        <section
          id="builder-panel-assets"
          role="tabpanel"
          aria-labelledby="builder-tab-assets"
          hidden={activeTab !== "assets"}
          className={activeTab === "assets" ? "flex-1 overflow-y-auto bg-slate-50 p-6 dark:bg-slate-950" : "hidden"}
        >
          {activeTab === "assets" && (
            <AssetManagerModal
              open={true}
              onOpenChange={() => setActiveTab("visual")}
              templateId={templateId}
            />
          )}
        </section>

        <section
          id="builder-panel-diff"
          role="tabpanel"
          aria-labelledby="builder-tab-diff"
          hidden={activeTab !== "diff"}
          className={activeTab === "diff" ? "flex min-w-0 flex-1" : "hidden"}
        >
          {activeTab === "diff" && (
            <MonacoDiffWorkspace
              template={data.template}
              versions={versions}
              hasDraft={hasDraft}
              onRollbackComplete={loadData}
            />
          )}
        </section>
      </main>

      {workspaceNotice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-xl items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" role="status">
            <span>{workspaceNotice}</span>
            <Button variant="ghost" size="sm" className="h-11 shrink-0" onClick={() => setWorkspaceNotice(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Asset Manager Dialog */}
      <AssetManagerModal
        open={isAssetModalOpen}
        onOpenChange={setIsAssetModalOpen}
        templateId={templateId}
        onSelectAsset={(url) => {
          if (selectedComponent && selectedComponent.get("tagName") === "img") {
            handleUpdateTrait("src", url);
          }
        }}
      />

      {/* Save Version Dialog */}
      <SaveVersionDialog
        open={isSaveVersionOpen}
        onOpenChange={setIsSaveVersionOpen}
        currentVersion={data.template.current_version}
        onSave={handleSaveVersion}
      />
    </div>
  );
};
