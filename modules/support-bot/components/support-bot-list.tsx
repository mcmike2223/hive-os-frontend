"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bot,
  Plus,
  Workflow,
  BookOpen,
  Headphones,
  Code2,
  Settings,
  MoreVertical,
  Trash2,
  Copy,
  Sparkles,
  ExternalLink,
  MessageSquare,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supportBotApi } from "../api/support-bot-api";
import { SupportBot } from "../types";
import { BotTestSimulator } from "./simulator/bot-test-simulator";

export function SupportBotList() {
  const [bots, setBots] = React.useState<SupportBot[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Create Modal
  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  // Testing Simulator Drawer
  const [simulatingBot, setSimulatingBot] = React.useState<SupportBot | null>(null);

  const loadBots = async () => {
    try {
      setLoading(true);
      const data = await supportBotApi.getBots();
      setBots(data);
    } catch (e) {
      console.error("Failed to load bots", e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadBots();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      setCreating(true);
      await supportBotApi.createBot({
        name,
        description,
        system_prompt: systemPrompt || undefined,
      });
      setCreateOpen(false);
      setName("");
      setDescription("");
      setSystemPrompt("");
      loadBots();
    } catch (e) {
      console.error("Failed to create bot", e);
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      await supportBotApi.duplicateBot(id);
      loadBots();
    } catch (e) {
      console.error("Failed to duplicate bot", e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this support bot?")) return;
    try {
      await supportBotApi.deleteBot(id);
      loadBots();
    } catch (e) {
      console.error("Failed to delete bot", e);
    }
  };

  const filteredBots = bots.filter(
    (b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.description && b.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AI Customer Support Bot Studio</h1>
              <p className="text-sm text-muted-foreground">
                Build, train, and deploy intelligent conversational AI assistants with visual flows and ERP integration.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setCreateOpen(true)} className="gap-2 shadow">
            <Plus className="h-4 w-4" />
            Create New Bot
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bots..."
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Bots Grid */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-64 animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      ) : filteredBots.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
            <Sparkles className="h-7 w-7" />
          </div>
          <h3 className="font-bold text-lg">No AI Support Bots Found</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1 mb-6">
            Create your first intelligent assistant to automate customer inquiries, sync with ERP products, and handle live ticket escalations.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create First Bot
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBots.map((bot) => (
            <Card
              key={bot.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-border/80 bg-card transition-all hover:shadow-lg hover:border-primary/50"
            >
              <div>
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                        style={{ backgroundColor: bot.primary_color || "#3b82f6" }}
                      >
                        <Bot className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold line-clamp-1">{bot.name}</CardTitle>
                        <p className="text-xs font-mono text-muted-foreground">{bot.slug}</p>
                      </div>
                    </div>

                    <Badge variant={bot.is_active ? "default" : "secondary"} className="text-[10px] capitalize">
                      {bot.is_active ? "Active" : "Disabled"}
                    </Badge>
                  </div>

                  <CardDescription className="text-xs line-clamp-2 mt-2 leading-relaxed">
                    {bot.description || "No description provided."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-4 text-xs">
                  {/* Quick Metrics */}
                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3 text-center">
                    <div>
                      <span className="block font-bold text-foreground">{bot.conversations_count ?? 0}</span>
                      <span className="text-[10px] text-muted-foreground">Chats</span>
                    </div>
                    <div>
                      <span className="block font-bold text-foreground">{bot.knowledge_bases_count ?? 0}</span>
                      <span className="text-[10px] text-muted-foreground">FAQs</span>
                    </div>
                    <div>
                      <span className="block font-bold text-foreground">{bot.flows_count ?? 0}</span>
                      <span className="text-[10px] text-muted-foreground">Flows</span>
                    </div>
                  </div>

                  {/* Feature Shortcuts */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <Link href={`/dashboard/support-bot/${bot.id}/studio`}>
                      <Button variant="outline" size="sm" className="w-full justify-start gap-1.5 text-xs h-8">
                        <Workflow className="h-3.5 w-3.5 text-blue-500" />
                        Flow Studio
                      </Button>
                    </Link>

                    <Link href={`/dashboard/support-bot/${bot.id}/knowledge`}>
                      <Button variant="outline" size="sm" className="w-full justify-start gap-1.5 text-xs h-8">
                        <BookOpen className="h-3.5 w-3.5 text-amber-500" />
                        Knowledge (RAG)
                      </Button>
                    </Link>

                    <Link href={`/dashboard/support-bot/${bot.id}/inbox`}>
                      <Button variant="outline" size="sm" className="w-full justify-start gap-1.5 text-xs h-8">
                        <Headphones className="h-3.5 w-3.5 text-rose-500" />
                        Live Inbox
                      </Button>
                    </Link>

                    <Link href={`/dashboard/support-bot/${bot.id}/widget`}>
                      <Button variant="outline" size="sm" className="w-full justify-start gap-1.5 text-xs h-8">
                        <Code2 className="h-3.5 w-3.5 text-emerald-500" />
                        Embed Widget
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 p-3 px-5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSimulatingBot(bot)}
                  className="h-8 gap-1.5 text-xs text-primary font-semibold hover:bg-primary/10"
                >
                  <Play className="h-3.5 w-3.5 fill-primary" />
                  Test Live
                </Button>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDuplicate(bot.id)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    title="Duplicate Bot"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>

                  <Link href={`/dashboard/support-bot/${bot.id}/settings`}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      title="Bot Settings"
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                  </Link>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(bot.id)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    title="Delete Bot"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Bot Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Support Bot</DialogTitle>
            <DialogDescription>
              Set up a new conversational AI assistant with isolated knowledge and visual workflows.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <label className="font-semibold text-foreground">Bot Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Addis Logistics Assistant"
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <label className="font-semibold text-foreground">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Handles order tracking, invoice questions & pricing"
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <label className="font-semibold text-foreground">System Prompt / Persona</label>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a professional customer support assistant for HIVE.OS..."
                rows={3}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || creating}>
              {creating ? "Creating..." : "Create Bot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Slide-out Live Testing Simulator Modal */}
      {simulatingBot && (
        <Dialog open={!!simulatingBot} onOpenChange={() => setSimulatingBot(null)}>
          <DialogContent className="sm:max-w-md h-[600px] p-0 overflow-hidden">
            <BotTestSimulator bot={simulatingBot} onClose={() => setSimulatingBot(null)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
