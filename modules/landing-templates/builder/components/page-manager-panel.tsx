"use client";

import React, { useState } from "react";
import { Plus, Home, Copy, Trash2, FileText, Search, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TemplatePageItem } from "../../lib/api";

interface PageManagerPanelProps {
  pages: TemplatePageItem[];
  activePageId: string;
  onSelectPage: (pageId: string) => void;
  onAddPage: (page: Omit<TemplatePageItem, "id">) => void;
  onUpdatePage: (pageId: string, updates: Partial<TemplatePageItem>) => void;
  onDeletePage: (pageId: string) => void;
  onDuplicatePage: (pageId: string) => void;
  onSetHomepage: (pageId: string) => void;
}

export const PageManagerPanel: React.FC<PageManagerPanelProps> = ({
  pages,
  activePageId,
  onSelectPage,
  onAddPage,
  onUpdatePage,
  onDeletePage,
  onDuplicatePage,
  onSetHomepage,
}) => {
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<TemplatePageItem | null>(null);

  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newSeoDesc, setNewSeoDesc] = useState("");

  const filteredPages = pages.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.slug.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newSlug.trim()) return;

    onAddPage({
      name: newName.trim(),
      slug: newSlug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-"),
      title: newTitle.trim() || newName.trim(),
      seo_title: newTitle.trim() || newName.trim(),
      seo_description: newSeoDesc.trim(),
      is_homepage: pages.length === 0,
      sort_order: pages.length,
    });

    setNewName("");
    setNewSlug("");
    setNewTitle("");
    setNewSeoDesc("");
    setIsAddOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPage) return;

    onUpdatePage(editingPage.id, {
      name: editingPage.name,
      slug: editingPage.slug,
      title: editingPage.title,
      seo_title: editingPage.seo_title,
      seo_description: editingPage.seo_description,
    });
    setEditingPage(null);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Multi-Page Manager</h2>
          <p className="text-sm text-muted-foreground">
            Manage your website navigation hierarchy, page slugs, SEO titles, and meta descriptions.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          <span>Add Page</span>
        </Button>
      </div>

      <div className="flex items-end gap-3">
        <div className="max-w-sm flex-1 space-y-1.5">
          <Label htmlFor="page-manager-search">Find a page</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="page-manager-search"
              type="search"
              placeholder="Search by name or URL slug"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 bg-background pl-9"
            />
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          {pages.length} {pages.length === 1 ? "Page" : "Pages"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPages.map((page) => {
          const isActive = page.id === activePageId;
          return (
            <div
              key={page.id}
              className={`group relative rounded-2xl border p-5 transition-all flex flex-col justify-between ${
                isActive
                  ? "border-primary bg-primary/[0.03] shadow-md shadow-primary/5 ring-1 ring-primary/20"
                  : "border-border/60 bg-card hover:border-border hover:shadow-sm"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${page.is_homepage ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {page.is_homepage ? <Home className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm leading-tight flex items-center gap-1.5">
                        {page.name}
                        {page.is_homepage && (
                          <Badge className="text-[10px] h-4 bg-primary/15 text-primary border-primary/20 px-1">
                            Home
                          </Badge>
                        )}
                      </h3>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">/{page.slug}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 rounded-lg"
                      aria-label={`Edit ${page.name} details`}
                      onClick={() => setEditingPage(page)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 rounded-lg"
                      aria-label={`Duplicate ${page.name}`}
                      onClick={() => onDuplicatePage(page.id)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {!page.is_homepage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                        aria-label={`Delete ${page.name}`}
                        onClick={() => {
                          if (window.confirm(`Delete page “${page.name}”? This removes its canvas content from the draft.`)) {
                            onDeletePage(page.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {page.seo_description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/40 p-2 rounded-lg border border-border/40">
                    {page.seo_description}
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-border/40 mt-4 flex items-center justify-between gap-2">
                {!page.is_homepage && (
                  <Button size="sm" variant="ghost" className="h-11 text-xs" onClick={() => onSetHomepage(page.id)}>
                    <Home className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Set home
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  className="h-11 flex-1 text-xs"
                  onClick={() => onSelectPage(page.id)}
                >
                  {isActive ? "Currently Editing" : "Switch to Page"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Page Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Add New Page</DialogTitle>
              <DialogDescription>Create a visual page and its search metadata.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="page-name">Page Name</Label>
                <Input
                  id="page-name"
                  placeholder="e.g. Services, About Us, Menu"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newSlug) {
                      setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "-"));
                    }
                  }}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="page-slug">URL Slug</Label>
                <div className="flex items-center rounded-lg border bg-muted/30 px-3">
                  <span className="text-xs text-muted-foreground font-mono">/</span>
                  <Input
                    id="page-slug"
                    className="border-0 bg-transparent px-1 focus-visible:ring-0 text-xs font-mono"
                    placeholder="services"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="page-title">SEO Page Title</Label>
                <Input
                  id="page-title"
                  placeholder="e.g. Our Premium Services | Company Name"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="page-desc">Meta Description</Label>
                <Input
                  id="page-desc"
                  placeholder="Brief summary of this page for search engines..."
                  value={newSeoDesc}
                  onChange={(e) => setNewSeoDesc(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Page</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Page SEO Modal */}
      <Dialog open={!!editingPage} onOpenChange={(open) => !open && setEditingPage(null)}>
        <DialogContent className="sm:max-w-md">
          {editingPage && (
            <form onSubmit={handleSaveEdit}>
              <DialogHeader>
                <DialogTitle>Edit Page Details & SEO</DialogTitle>
                <DialogDescription>Update the page label, URL slug, and search preview metadata.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-page-name">Page Name</Label>
                  <Input
                    id="edit-page-name"
                    value={editingPage.name}
                    onChange={(e) => setEditingPage({ ...editingPage, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-page-slug">URL Slug</Label>
                  <Input
                    id="edit-page-slug"
                    value={editingPage.slug}
                    onChange={(e) => setEditingPage({ ...editingPage, slug: e.target.value })}
                    disabled={editingPage.is_homepage}
                    required
                  />
                  {editingPage.is_homepage && (
                    <p className="text-[11px] text-muted-foreground">Homepage slug is fixed to index.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-page-seo-title">SEO Title</Label>
                  <Input
                    id="edit-page-seo-title"
                    value={editingPage.seo_title || ""}
                    onChange={(e) => setEditingPage({ ...editingPage, seo_title: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-page-description">Meta Description</Label>
                  <Input
                    id="edit-page-description"
                    value={editingPage.seo_description || ""}
                    onChange={(e) => setEditingPage({ ...editingPage, seo_description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingPage(null)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
