"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Trash2, Sliders, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supportBotApi } from "@/modules/support-bot/api/support-bot-api";
import { SupportBot } from "@/modules/support-bot/types";

export default function BotSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const botId = Number(params.id);

  const [bot, setBot] = React.useState<SupportBot | null>(null);
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [model, setModel] = React.useState("gpt-4o-mini");
  const [temperature, setTemperature] = React.useState(0.3);
  const [greeting, setGreeting] = React.useState("");
  const [fallback, setFallback] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [enableEscalation, setEnableEscalation] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (botId) {
      supportBotApi.getBot(botId).then((b) => {
        setBot(b);
        setName(b.name);
        setSlug(b.slug);
        setDescription(b.description || "");
        setSystemPrompt(b.system_prompt || "");
        setModel(b.model || "gpt-4o-mini");
        setTemperature(b.temperature ?? 0.3);
        setGreeting(b.greeting_message || "");
        setFallback(b.fallback_message || "");
        setIsActive(b.is_active);
        setEnableEscalation(b.enable_human_escalation);
      });
    }
  }, [botId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await supportBotApi.updateBot(botId, {
        name,
        slug,
        description,
        system_prompt: systemPrompt,
        model,
        temperature,
        greeting_message: greeting,
        fallback_message: fallback,
        is_active: isActive,
        enable_human_escalation: enableEscalation,
      });
      router.push(`/dashboard/support-bot/${botId}`);
    } catch (e) {
      console.error("Save settings error", e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to permanently delete this bot?")) return;
    try {
      await supportBotApi.deleteBot(botId);
      router.push("/dashboard/support-bot");
    } catch (e) {
      console.error("Delete bot error", e);
    }
  };

  if (!bot) return <div className="p-6 text-sm text-muted-foreground">Loading settings...</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/support-bot/${bot.id}`}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Bot Configuration & Model Settings</h1>
            <p className="text-xs text-muted-foreground">Manage LLM parameters and system persona for {bot.name}</p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-2 shadow">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            General Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-muted-foreground">Bot Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 text-xs" />
            </div>
            <div>
              <label className="font-semibold text-muted-foreground">Identifier / Slug</label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1 text-xs font-mono" />
            </div>
          </div>

          <div>
            <label className="font-semibold text-muted-foreground">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 text-xs" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            AI Model & Persona
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-muted-foreground">System Persona Prompt</label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
              className="mt-1 text-xs leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-muted-foreground">LLM Model</label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} className="mt-1 text-xs" />
            </div>
            <div>
              <label className="font-semibold text-muted-foreground">Creativity Temperature ({temperature})</label>
              <Input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-muted-foreground">Fallback Response (When no match is found)</label>
            <Textarea
              value={fallback}
              onChange={(e) => setFallback(e.target.value)}
              rows={2}
              className="mt-1 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-4">
        <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-2 text-xs">
          <Trash2 className="h-3.5 w-3.5" />
          Delete Bot
        </Button>
      </div>
    </div>
  );
}
