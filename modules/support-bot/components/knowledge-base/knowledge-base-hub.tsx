"use client";

import * as React from "react";
import {
  BookOpen,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Edit2,
  Sparkles,
  Database,
  CheckCircle2,
  HelpCircle,
  FileText,
  Boxes,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supportBotApi } from "../../api/support-bot-api";
import { SupportBot, SupportBotKnowledgeBase } from "../../types";

interface Props {
  bot: SupportBot;
  onRefresh?: () => void;
}

export function KnowledgeBaseHub({ bot, onRefresh }: Props) {
  const [items, setItems] = React.useState<SupportBotKnowledgeBase[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [syncingErp, setSyncingErp] = React.useState(false);
  const [syncMessage, setSyncMessage] = React.useState<string | null>(null);

  // Modal State
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<SupportBotKnowledgeBase | null>(null);
  const [formTitle, setFormTitle] = React.useState("");
  const [formQuestion, setFormQuestion] = React.useState("");
  const [formAnswer, setFormAnswer] = React.useState("");
  const [formCategory, setFormCategory] = React.useState("General");
  const [saving, setSaving] = React.useState(false);

  const loadData = async () => {
    if (!bot?.id) return;
    try {
      setLoading(true);
      const data = await supportBotApi.getKnowledgeBases(bot.id);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load KB", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, [bot.id]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormTitle("");
    setFormQuestion("");
    setFormAnswer("");
    setFormCategory("General");
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: SupportBotKnowledgeBase) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormQuestion(item.question || "");
    setFormAnswer(item.answer);
    setFormCategory(item.category || "General");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle || !formAnswer) return;
    try {
      setSaving(true);
      if (editingItem) {
        await supportBotApi.updateKnowledgeEntry(bot.id, editingItem.id, {
          title: formTitle,
          question: formQuestion,
          answer: formAnswer,
          category: formCategory,
        });
      } else {
        await supportBotApi.createKnowledgeEntry(bot.id, {
          title: formTitle,
          question: formQuestion,
          answer: formAnswer,
          category: formCategory,
          type: "faq",
        });
      }
      setDialogOpen(false);
      loadData();
      onRefresh?.();
    } catch (e) {
      console.error("Save KB error", e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to remove this knowledge entry?")) return;
    try {
      await supportBotApi.deleteKnowledgeEntry(bot.id, id);
      loadData();
      onRefresh?.();
    } catch (e) {
      console.error("Delete KB error", e);
    }
  };

  const handleSyncErp = async () => {
    try {
      setSyncingErp(true);
      setSyncMessage(null);
      const res = await supportBotApi.syncErpCatalog(bot.id);
      setSyncMessage(res.message);
      loadData();
      onRefresh?.();
    } catch (e) {
      console.error("Sync ERP error", e);
    } finally {
      setSyncingErp(false);
    }
  };

  // Categories extraction
  const categories = ["all", ...Array.from(new Set(items.map((i) => i.category || "General")))];

  // Filtered items
  const filtered = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.question && item.question.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === "all" || (item.category || "General") === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header with quick stats & ERP Sync button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">RAG Knowledge Base & Training</h2>
          <p className="text-sm text-muted-foreground">
            Teach {bot.name} using FAQs, company policies, and live ERP product catalog data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSyncErp}
            disabled={syncingErp}
            variant="outline"
            className="gap-2 border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary"
          >
            <Boxes className={`h-4 w-4 ${syncingErp ? "animate-spin" : ""}`} />
            {syncingErp ? "Syncing ERP..." : "Sync ERP Catalog"}
          </Button>

          <Button onClick={handleOpenCreate} className="gap-2 shadow">
            <Plus className="h-4 w-4" />
            Add Knowledge / FAQ
          </Button>
        </div>
      </div>

      {/* Sync Success Alert */}
      {syncMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search FAQs, questions, keywords..."
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* KB Cards Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-44 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-base">No knowledge entries found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
            Add FAQs or sync your ERP catalog so your AI assistant can accurately answer customer inquiries.
          </p>
          <Button onClick={handleOpenCreate} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Create First FAQ
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <Card key={item.id} className="group relative overflow-hidden transition-all hover:shadow-md border-border/80">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {item.category || "General"}
                  </Badge>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenEdit(item)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(item.id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <CardTitle className="text-sm font-semibold mt-1 leading-snug line-clamp-1">
                  {item.title}
                </CardTitle>
              </CardHeader>

              <CardContent className="p-4 pt-2 text-xs space-y-2">
                {item.question && (
                  <div className="flex items-start gap-1.5 text-muted-foreground">
                    <HelpCircle className="h-3.5 w-3.5 shrink-0 text-primary/70 mt-0.5" />
                    <span className="line-clamp-2 font-medium text-foreground/90">{item.question}</span>
                  </div>
                )}

                <div className="rounded-lg bg-muted/40 p-2.5 text-muted-foreground leading-relaxed line-clamp-3">
                  {item.answer}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit FAQ Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Knowledge Entry" : "Add Knowledge Base FAQ"}</DialogTitle>
            <DialogDescription>
              Provide the question, answer, and category to train your AI assistant.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold">Title / Topic</label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Return Policy, Pricing & VAT, Branch Locations"
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold">Typical Question Asked by Customers</label>
              <Input
                value={formQuestion}
                onChange={(e) => setFormQuestion(e.target.value)}
                placeholder="e.g. How does your 15% VAT invoice calculation work?"
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold">AI Verified Answer</label>
              <Textarea
                value={formAnswer}
                onChange={(e) => setFormAnswer(e.target.value)}
                placeholder="Write the exact answer the bot should provide when queried..."
                rows={4}
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold">Category</label>
              <Input
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="e.g. Finance, Shipping, General, Technical"
                className="mt-1 text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formTitle || !formAnswer || saving}>
              {saving ? "Saving..." : editingItem ? "Update Entry" : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
