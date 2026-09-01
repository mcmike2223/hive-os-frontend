"use client";

import * as React from "react";
import {
  Palette,
  Code2,
  Copy,
  Check,
  Globe,
  Bot,
  MessageCircle,
  Sparkles,
  ExternalLink,
  Sliders,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supportBotApi } from "../../api/support-bot-api";
import { SupportBot } from "../../types";

interface Props {
  bot: SupportBot;
  onRefresh?: () => void;
}

export function WidgetCustomizer({ bot, onRefresh }: Props) {
  const [primaryColor, setPrimaryColor] = React.useState(bot.primary_color || "#3b82f6");
  const [botTitle, setBotTitle] = React.useState(bot.widget_config?.title || bot.name);
  const [botSubtitle, setBotSubtitle] = React.useState(bot.widget_config?.subtitle || "Instant ERP & Customer Support");
  const [greeting, setGreeting] = React.useState(
    bot.greeting_message || `Hello! Welcome to ${bot.name}. How can we assist you today?`
  );
  const [position, setPosition] = React.useState<"bottom-right" | "bottom-left">(
    bot.widget_config?.position || "bottom-right"
  );
  const [saving, setSaving] = React.useState(false);
  const [copiedSnippet, setCopiedSnippet] = React.useState(false);
  const [copiedReact, setCopiedReact] = React.useState(false);

  const scriptEmbedCode = `<!-- HIVE.OS AI Customer Support Bot Widget -->
<script
  src="https://hive.et/embed/webchat.js"
  data-bot-slug="${bot.slug}"
  data-primary-color="${primaryColor}"
  data-position="${position}"
  async
></script>`;

  const reactEmbedCode = `import { SupportWebchatWidget } from "@/components/support-bot/support-webchat-widget";

export default function MyPage() {
  return (
    <div>
      {/* Your page contents */}
      <SupportWebchatWidget botSlug="${bot.slug}" />
    </div>
  );
}`;

  const handleCopySnippet = (text: string, type: "snippet" | "react") => {
    navigator.clipboard.writeText(text);
    if (type === "snippet") {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    } else {
      setCopiedReact(true);
      setTimeout(() => setCopiedReact(false), 2000);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await supportBotApi.updateBot(bot.id, {
        primary_color: primaryColor,
        greeting_message: greeting,
        widget_config: {
          title: botTitle,
          subtitle: botSubtitle,
          position,
          show_avatar: true,
        },
      });
      onRefresh?.();
    } catch (e) {
      console.error("Failed to save widget config", e);
    } finally {
      setSaving(false);
    }
  };

  const PRESET_COLORS = [
    "#3b82f6", // Blue
    "#10b981", // Emerald
    "#8b5cf6", // Purple
    "#f59e0b", // Amber
    "#ef4444", // Red
    "#06b6d4", // Cyan
    "#0f172a", // Slate Dark
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Left: Customizer Controls */}
      <div className="space-y-6 lg:col-span-6">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Sliders className="h-4 w-4 text-primary" />
              Webchat Appearance & Branding
            </CardTitle>
            <CardDescription className="text-xs">
              Customize the look, feel, and greeting shown on your website or ERP portal.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-muted-foreground">Widget Title</label>
              <Input
                value={botTitle}
                onChange={(e) => setBotTitle(e.target.value)}
                placeholder="e.g. Hive Support Assistant"
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-muted-foreground">Subtitle / Status</label>
              <Input
                value={botSubtitle}
                onChange={(e) => setBotSubtitle(e.target.value)}
                placeholder="e.g. Typically replies instantly"
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-muted-foreground">Initial Greeting Message</label>
              <Textarea
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                rows={3}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-muted-foreground block mb-1.5">Brand Accent Color</label>
              <div className="flex items-center gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPrimaryColor(c)}
                    className={`h-7 w-7 rounded-full border-2 transition-transform ${
                      primaryColor === c ? "scale-110 border-foreground ring-2 ring-primary/40" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-8 w-24 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-muted-foreground block mb-1.5">Launcher Position</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={position === "bottom-right" ? "default" : "outline"}
                  onClick={() => setPosition("bottom-right")}
                  className="h-8 text-xs flex-1"
                >
                  Bottom Right
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={position === "bottom-left" ? "default" : "outline"}
                  onClick={() => setPosition("bottom-left")}
                  className="h-8 text-xs flex-1"
                >
                  Bottom Left
                </Button>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full h-9 shadow mt-2">
              {saving ? "Saving..." : "Apply & Save Branding"}
            </Button>
          </CardContent>
        </Card>

        {/* Embed Code Snippet Card */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Code2 className="h-4 w-4 text-primary" />
              Embed on Any Website
            </CardTitle>
            <CardDescription className="text-xs">
              Copy and paste this snippet right before the closing <code>&lt;/body&gt;</code> tag of your website or store.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 text-xs">
            <div className="relative rounded-lg bg-muted/80 p-3 font-mono text-[11px] text-foreground border border-border/60">
              <pre className="overflow-x-auto whitespace-pre-wrap">{scriptEmbedCode}</pre>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopySnippet(scriptEmbedCode, "snippet")}
                className="absolute top-2 right-2 h-7 gap-1 text-[10px] bg-background/80 hover:bg-background border border-border/60"
              >
                {copiedSnippet ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                {copiedSnippet ? "Copied!" : "Copy Code"}
              </Button>
            </div>

            <div>
              <label className="font-semibold text-muted-foreground block mb-1">React / Next.js Component:</label>
              <div className="relative rounded-lg bg-muted/80 p-3 font-mono text-[11px] text-foreground border border-border/60">
                <pre className="overflow-x-auto whitespace-pre-wrap">{reactEmbedCode}</pre>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopySnippet(reactEmbedCode, "react")}
                  className="absolute top-2 right-2 h-7 gap-1 text-[10px] bg-background/80 hover:bg-background border border-border/60"
                >
                  {copiedReact ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copiedReact ? "Copied!" : "Copy Code"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right: Live Interactive Widget Mockup */}
      <div className="lg:col-span-6 flex flex-col items-center justify-center p-6 bg-muted/10 rounded-xl border border-dashed border-border/80 relative min-h-[500px]">
        <Badge variant="outline" className="absolute top-4 left-4 text-xs font-semibold">
          Live Interactive Preview
        </Badge>

        {/* Webchat Floating Card Preview */}
        <div className="w-full max-w-[340px] rounded-2xl border border-border/80 bg-card shadow-2xl overflow-hidden">
          {/* Header */}
          <div
            className="p-4 text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-sm leading-tight">{botTitle}</h4>
                <p className="text-[11px] text-white/80">{botSubtitle}</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3 bg-background min-h-[220px]">
            <div className="flex items-start gap-2">
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white text-[10px]"
                style={{ backgroundColor: primaryColor }}
              >
                <Bot className="h-3 w-3" />
              </div>
              <div className="rounded-2xl rounded-tl-none bg-muted/80 p-2.5 text-xs text-foreground leading-relaxed border border-border/60">
                {greeting}
              </div>
            </div>

            <div className="flex flex-wrap gap-1 pl-8">
              {["Explore Modules", "Ethiopian VAT & Tax", "Talk to Human"].map((b, i) => (
                <span
                  key={i}
                  className="rounded-full border px-2.5 py-0.5 text-[10px] font-medium"
                  style={{ color: primaryColor, borderColor: `${primaryColor}60`, backgroundColor: `${primaryColor}10` }}
                >
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* Input Footer */}
          <div className="p-3 border-t border-border/60 bg-muted/20 flex items-center gap-2">
            <Input
              placeholder="Ask a question..."
              readOnly
              className="h-8 text-xs rounded-full bg-background border-border/80"
            />
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              <MessageCircle className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
