"use client";

import * as React from "react";
import {
  Check,
  CheckCircle2,
  Eye,
  Globe,
  LayoutTemplate,
  Loader2,
  Lock,
  Search,
  Sparkles,
  Tag,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getBackendOrigin } from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import { TemplatePreviewDialog } from "./template-preview-dialog";
import {
  fetchCategories,
  fetchLibrary,
  type TemplateLibraryCard,
} from "../lib/api";

const frameworkLabel: Record<string, string> = {
  "static-html": "Static HTML",
  "html-css-js": "HTML + CSS + JS",
  react: "React",
  nextjs: "Next.js",
};

const frameworkColor: Record<string, string> = {
  "static-html": "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20",
  "html-css-js": "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20",
  react: "bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/20",
  nextjs: "bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/20",
};

type TemplatePickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTemplateSlug?: string | null;
  selectedTemplateKey?: string | null;
  businessType?: string;
  onSelectTemplate: (template: TemplateLibraryCard) => void;
};

export function TemplatePickerDialog({
  open,
  onOpenChange,
  selectedTemplateSlug,
  selectedTemplateKey,
  businessType,
  onSelectTemplate,
}: TemplatePickerDialogProps) {
  const [templates, setTemplates] = React.useState<TemplateLibraryCard[]>([]);
  const [categories, setCategories] = React.useState<
    { key: string; label: string; description?: string }[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [previewTarget, setPreviewTarget] = React.useState<TemplateLibraryCard | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadTemplates = React.useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const [libRes, catRes] = await Promise.all([
        fetchLibrary({
          q: debouncedQuery || undefined,
          business_type: selectedCategory === "all" ? undefined : selectedCategory,
          status: "published",
        }),
        fetchCategories(),
      ]);
      setTemplates(libRes.data || []);
      setCategories(
        catRes.data.business_types.map((b) => ({
          key: b.key,
          label: b.label,
          description: b.description,
        }))
      );
    } catch (err) {
      console.error("Failed to load landing library templates:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, open, selectedCategory]);

  React.useEffect(() => {
    if (open) {
      void loadTemplates();
    }
  }, [loadTemplates, open]);

  const handleChoose = (template: TemplateLibraryCard) => {
    onSelectTemplate(template);
    setPreviewTarget(null);
    onOpenChange(false);
  };

  const getActiveBusinessLabel = () => {
    if (selectedCategory !== "all") {
      const match = categories.find((c) => c.key === selectedCategory);
      if (match) return match.label;
    }
    return "General Business";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent overlayClassName="z-[60]" className="sm:max-w-[1100px] p-0 overflow-hidden rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-2xl max-h-[90vh] flex flex-col z-[60]">
          <div className="px-6 py-5 border-b border-border/40 bg-muted/20 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shrink-0 shadow-inner">
                  <LayoutTemplate className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-space font-black tracking-tight">
                    Landing Template Library
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Select a high-conversion landing template to provision for this tenant node.
                  </DialogDescription>
                </div>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates..."
                  className="pl-9 h-10 bg-background/80 rounded-xl border-border/60 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pt-4 pb-1 scrollbar-none">
              <Button
                type="button"
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("all")}
                className={cn(
                  "rounded-full text-xs h-8 px-3.5 whitespace-nowrap transition-all",
                  selectedCategory === "all"
                    ? "shadow-sm font-semibold"
                    : "border-border/50 bg-background/50 hover:bg-muted/40 text-muted-foreground"
                )}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                All Templates
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.key}
                  type="button"
                  variant={selectedCategory === cat.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.key)}
                  className={cn(
                    "rounded-full text-xs h-8 px-3.5 whitespace-nowrap transition-all",
                    selectedCategory === cat.key
                      ? "shadow-sm font-semibold"
                      : "border-border/50 bg-background/50 hover:bg-muted/40 text-muted-foreground"
                  )}
                >
                  {cat.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="p-6 overflow-y-auto scrollbar-thin flex-1">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="rounded-2xl border border-border/40 p-4 space-y-3">
                    <Skeleton className="h-44 w-full rounded-xl" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <div className="flex gap-2 pt-2">
                      <Skeleton className="h-9 flex-1 rounded-xl" />
                      <Skeleton className="h-9 w-20 rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-muted/40 flex items-center justify-center text-muted-foreground mb-3">
                  <LayoutTemplate className="h-7 w-7" />
                </div>
                <h3 className="text-base font-bold text-foreground">No templates found</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Try adjusting your search query or choosing a different business category filter.
                </p>
                {selectedCategory !== "all" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCategory("all")}
                    className="mt-4 rounded-xl text-xs"
                  >
                    View All Templates
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {templates.map((tpl) => {
                  const isSelected =
                    selectedTemplateSlug === tpl.slug ||
                    selectedTemplateKey === tpl.slug ||
                    (tpl.preview?.meta?.template_key && selectedTemplateKey === tpl.preview.meta.template_key);

                  const thumbUrl = tpl.thumbnail
                    ? `${getBackendOrigin()}${tpl.thumbnail}`
                    : null;

                  return (
                    <Card
                      key={tpl.id}
                      className={cn(
                        "group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-200 hover:shadow-lg",
                        isSelected
                          ? "border-primary bg-primary/[0.03] ring-2 ring-primary/20 shadow-md"
                          : "border-border/60 bg-card/60 hover:border-border"
                      )}
                    >
                      <div className="relative h-44 w-full overflow-hidden bg-muted/30 border-b border-border/40">
                        {thumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumbUrl}
                            alt={tpl.name}
                            className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-background to-muted/40 p-4 text-center">
                            <LayoutTemplate className="h-10 w-10 text-primary/40 mb-1" />
                          </div>
                        )}

                        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1.5 pointer-events-none">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] uppercase tracking-wider backdrop-blur-md shadow-sm font-semibold",
                              frameworkColor[tpl.source_framework] || "bg-background/80 text-foreground"
                            )}
                          >
                            {frameworkLabel[tpl.source_framework] || tpl.source_framework}
                          </Badge>

                          <div className="flex items-center gap-1">
                            {tpl.is_premium && (
                              <Badge className="bg-amber-500/90 text-white text-[10px] backdrop-blur-md shadow-sm border-0 font-bold">
                                <Lock className="h-2.5 w-2.5 mr-1" />
                                Premium
                              </Badge>
                            )}
                            {isSelected && (
                              <Badge className="bg-primary text-primary-foreground text-[10px] shadow-sm font-bold">
                                <Check className="h-2.5 w-2.5 mr-1" />
                                Selected
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setPreviewTarget(tpl)}
                            className="rounded-xl shadow-lg font-semibold text-xs h-9"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            Live Preview
                          </Button>
                        </div>
                      </div>

                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-space font-bold text-sm text-foreground line-clamp-1">
                              {tpl.name}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                              {tpl.description || "Production-ready responsive landing template."}
                            </p>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 pt-1 pb-3 flex-1 flex flex-col justify-end">
                        <div className="flex flex-wrap gap-1 mt-2">
                          {tpl.business_types.slice(0, 2).map((bt) => (
                            <Badge
                              key={bt}
                              variant="outline"
                              className="text-[10px] border-border/50 bg-background/50 text-muted-foreground"
                            >
                              <Tag className="h-2.5 w-2.5 mr-1 text-primary/70" />
                              {bt}
                            </Badge>
                          ))}
                          <Badge
                            variant="outline"
                            className="text-[10px] border-border/50 bg-background/50 text-muted-foreground font-mono"
                          >
                            v{tpl.current_version}
                          </Badge>
                        </div>
                      </CardContent>

                      <CardFooter className="p-4 pt-0 border-t border-border/30 bg-muted/10 gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewTarget(tpl)}
                          className="h-9 px-2.5 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Preview
                        </Button>
                        <Button
                          type="button"
                          variant={isSelected ? "secondary" : "default"}
                          size="sm"
                          onClick={() => handleChoose(tpl)}
                          className={cn(
                            "flex-1 h-9 rounded-xl text-xs font-bold transition-all",
                            isSelected && "border border-primary/30"
                          )}
                        >
                          {isSelected ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-primary" />
                              Active Template
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                              Select Template
                            </>
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-6 py-3.5 border-t border-border/40 bg-muted/20 flex items-center justify-between shrink-0">
            <p className="text-xs text-muted-foreground">
              {templates.length} master template{templates.length !== 1 ? "s" : ""} available in library
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {previewTarget && (
        <TemplatePreviewDialog
          template={previewTarget}
          businessLabel={getActiveBusinessLabel()}
          busy={false}
          onOpenChange={(isOpen) => {
            if (!isOpen) setPreviewTarget(null);
          }}
          onChoose={handleChoose}
        />
      )}
    </>
  );
}

export default TemplatePickerDialog;
