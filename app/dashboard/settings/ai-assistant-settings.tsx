"use client";

import React from "react";
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  Sliders,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchCopilotModels,
  fetchCopilotSettings,
  reindexCopilotKnowledge,
  saveCopilotSettings,
  testCopilotConnection,
  type CopilotFeatureFlags,
  type CopilotModelOption,
  type CopilotProvider,
  type CopilotSettings,
} from "@/modules/support-bot/api/copilot-api";

/**
 * AI assistant configuration.
 *
 * The provider credential is write-only from here: it is sent to the server,
 * stored encrypted, and never sent back — so this page can show that a key is
 * configured and what it ends with, but never the key. Connection tests and
 * model discovery run server-side for the same reason.
 */

const PROVIDERS: Record<
  CopilotProvider,
  { name: string; badge: string; keyLink?: string; keyLinkLabel?: string; note: string }
> = {
  gemini: {
    name: "Google Gemini",
    badge: "Free tier available",
    keyLink: "https://aistudio.google.com/",
    keyLinkLabel: "Get a key at Google AI Studio",
    note: "Strong multilingual reasoning, including Amharic.",
  },
  groq: {
    name: "Groq Cloud",
    badge: "Fastest responses",
    keyLink: "https://console.groq.com/",
    keyLinkLabel: "Get a key at Groq Console",
    note: "Open models served on LPUs; very low latency.",
  },
  ollama: {
    name: "Ollama (self-hosted)",
    badge: "No external calls",
    keyLink: "https://ollama.com/",
    keyLinkLabel: "Download Ollama",
    note: "Runs on your own hardware. Nothing leaves your network.",
  },
  openrouter: {
    name: "OpenRouter",
    badge: "Many models, one key",
    keyLink: "https://openrouter.ai/",
    keyLinkLabel: "Get a key at OpenRouter",
    note: "A single key across many providers.",
  },
  openai: {
    name: "OpenAI",
    badge: "Paid",
    keyLink: "https://platform.openai.com/api-keys",
    keyLinkLabel: "Get a key at OpenAI",
    note: "GPT models.",
  },
  anthropic: {
    name: "Anthropic Claude",
    badge: "Paid",
    keyLink: "https://console.anthropic.com/",
    keyLinkLabel: "Get a key at Anthropic Console",
    note: "Claude models; strong at long, structured answers.",
  },
};

const FEATURE_LABELS: Array<{
  key: keyof CopilotFeatureFlags;
  title: string;
  description: string;
}> = [
  {
    key: "llm_phrasing",
    title: "Natural phrasing",
    description:
      "Let the model word the answer. Facts, page links and figures still come from Hive itself — anything the model adds that Hive did not verify is discarded.",
  },
  {
    key: "erp_navigation",
    title: "Navigate to pages",
    description: "Answer “where is X” with a link straight to the page, if the user may open it.",
  },
  {
    key: "autonomous_actions",
    title: "Run actions",
    description:
      "Allow the assistant to create and update records. Every write is permission-checked, confirmed by the user first, and written to the AI audit trail.",
  },
  {
    key: "tax_calculator",
    title: "Ethiopian tax calculator",
    description: "Payroll, pension, VAT and TOT calculations inside the conversation.",
  },
  {
    key: "voice_input",
    title: "Voice input",
    description: "Offer dictation in the assistant panel.",
  },
  {
    key: "human_escalation",
    title: "Escalate to a person",
    description: "Let a conversation be handed to the support inbox.",
  },
];

export function AiAssistantSettings() {
  const [settings, setSettings] = React.useState<CopilotSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [reindexing, setReindexing] = React.useState(false);

  const [models, setModels] = React.useState<CopilotModelOption[]>([]);
  const [modelsError, setModelsError] = React.useState<string | null>(null);
  const [loadingModels, setLoadingModels] = React.useState(false);

  // Held separately from `settings` because it is never loaded from the server:
  // it only ever travels one way.
  const [newApiKey, setNewApiKey] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);

  const [testResult, setTestResult] = React.useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      setSettings(await fetchCopilotSettings());
    } catch (error: unknown) {
      setLoadError(describeError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const loadModels = React.useCallback(
    async (provider: CopilotProvider, apiKey?: string, baseUrl?: string | null) => {
      setLoadingModels(true);
      setModelsError(null);

      try {
        const result = await fetchCopilotModels({
          provider,
          ...(apiKey ? { api_key: apiKey } : {}),
          ...(baseUrl ? { base_url: baseUrl } : {}),
        });

        setModels(result.models);
        setModelsError(result.error);
      } catch (error: unknown) {
        setModels([]);
        setModelsError(describeError(error));
      } finally {
        setLoadingModels(false);
      }
    },
    [],
  );

  // The model list is whatever this credential can actually reach, asked for
  // live. A hardcoded list goes stale silently and a removed model id looks
  // exactly like a broken assistant.
  React.useEffect(() => {
    if (!settings) return;
    void loadModels(settings.provider, newApiKey || undefined, settings.base_url);
    // Deliberately keyed on provider and base URL only: re-listing on every
    // keystroke of the key field would call the provider on each character.
  }, [settings?.provider, settings?.base_url]);

  const patch = (changes: Partial<CopilotSettings>) =>
    setSettings((previous) => (previous ? { ...previous, ...changes } : previous));

  const patchFeature = (key: keyof CopilotFeatureFlags, value: boolean) =>
    setSettings((previous) =>
      previous ? { ...previous, features: { ...previous.features, [key]: value } } : previous,
    );

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);

    try {
      const saved = await saveCopilotSettings({
        provider: settings.provider,
        model: settings.model,
        base_url: settings.base_url,
        temperature: settings.temperature,
        max_tokens: settings.max_tokens,
        system_prompt: settings.system_prompt,
        features: settings.features,
        // Absent means "leave the stored key alone".
        ...(newApiKey.trim() ? { api_key: newApiKey.trim() } : {}),
      });

      setSettings(saved);
      setNewApiKey("");
      toast.success("AI assistant settings saved.");
    } catch (error: unknown) {
      // A failed save must not read as a successful one.
      toast.error(describeError(error));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!settings) return;

    setTesting(true);
    setTestResult(null);

    try {
      const result = await testCopilotConnection({
        provider: settings.provider,
        model: settings.model,
        base_url: settings.base_url,
        ...(newApiKey.trim() ? { api_key: newApiKey.trim() } : {}),
      });

      setTestResult({ ok: result.ok, message: result.message });
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { data?: { message?: string } } } })?.response?.data?.data
          ?.message ?? describeError(error);

      setTestResult({ ok: false, message });
    } finally {
      setTesting(false);
    }
  };

  const handleReindex = async () => {
    setReindexing(true);

    try {
      const result = await reindexCopilotKnowledge();

      if (result.ok) {
        toast.success(`Re-learned the platform: ${result.documents} knowledge documents.`);
        setSettings(await fetchCopilotSettings());
      } else {
        toast.error("The rebuild did not complete. Check the application log.");
      }
    } catch (error: unknown) {
      toast.error(describeError(error));
    } finally {
      setReindexing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm">Loading assistant settings…</span>
      </div>
    );
  }

  if (loadError || !settings) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm font-medium">Could not load the assistant settings</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{loadError}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }

  const provider = PROVIDERS[settings.provider];
  const knowledge = settings.knowledge;

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------- */}
      {/* What the assistant knows                                          */}
      {/* ---------------------------------------------------------------- */}
      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">What the assistant knows</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Generated from this running application — its modules, routes, permissions and
                pages. It re-learns itself within the hour of any deployment that changes them.
              </p>
            </div>
          </div>

          <Button size="sm" variant="outline" onClick={handleReindex} disabled={reindexing}>
            {reindexing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Re-learn now
          </Button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Knowledge documents" value={knowledge.documents} />
          <Stat label="Modules" value={knowledge.modules} />
          <Stat label="API operations" value={knowledge.operations} />
          <Stat label="Actions it can run" value={`${knowledge.available_tools}/${knowledge.tools}`} />
          <Stat
            label="Last full sync"
            value={
              knowledge.last_synced_at
                ? new Date(knowledge.last_synced_at).toLocaleDateString()
                : "—"
            }
          />
        </dl>

        <div className="mt-3 flex flex-wrap gap-2">
          {knowledge.up_to_date ? (
            <Badge variant="outline" className="gap-1 text-[11px]">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              Index matches the running application
            </Badge>
          ) : knowledge.indexed_fingerprint === null ? (
            // "We have not recorded one" and "it no longer matches" are
            // different states, and only the second is a warning.
            <Badge variant="outline" className="gap-1 text-[11px]">
              <AlertCircle className="h-3 w-3 text-muted-foreground" />
              No index checkpoint recorded — the next hourly run will set one
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 border-amber-500/50 text-[11px]">
              <AlertCircle className="h-3 w-3 text-amber-600" />
              The application has changed since the last index
            </Badge>
          )}

          {knowledge.manifest_stale && (
            <Badge variant="outline" className="gap-1 border-amber-500/50 text-[11px]">
              <AlertCircle className="h-3 w-3 text-amber-600" />
              Navigation manifest missing — run npm run export:erp-manifest
            </Badge>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Provider                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Language model</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Used for wording answers, not for deciding them.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Provider</Label>
            <Select
              value={settings.provider}
              onValueChange={(value) => {
                patch({ provider: value as CopilotProvider, model: null });
                setTestResult(null);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PROVIDERS) as CopilotProvider[]).map((key) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    {PROVIDERS[key].name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">{provider.note}</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Model</Label>
              <button
                type="button"
                className="text-[11px] text-primary hover:underline"
                onClick={() =>
                  void loadModels(settings.provider, newApiKey || undefined, settings.base_url)
                }
              >
                Refresh list
              </button>
            </div>

            <Select
              value={settings.model ?? ""}
              onValueChange={(value) => patch({ model: value })}
              disabled={loadingModels || models.length === 0}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue
                  placeholder={
                    loadingModels
                      ? "Asking the provider…"
                      : models.length === 0
                        ? "No models available"
                        : "Choose a model"
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {models.map((model) => (
                  <SelectItem key={model.value} value={model.value} className="text-xs">
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {modelsError ? (
              <p className="text-[11px] text-destructive">{modelsError}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {models.length > 0
                  ? `${models.length} models this key can use.`
                  : "Save a key to see the models it can use."}
              </p>
            )}
          </div>
        </div>

        {settings.provider === "ollama" && (
          <div className="mt-4 space-y-1.5">
            <Label className="text-xs">Server URL</Label>
            <Input
              value={settings.base_url ?? ""}
              onChange={(event) => patch({ base_url: event.target.value })}
              placeholder="http://localhost:11434/v1"
              className="h-9 text-xs"
            />
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* Credential                                                    */}
        {/* ------------------------------------------------------------ */}
        <div className="mt-5 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <Key className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs font-semibold">API key</Label>

            {settings.api_key_source === "bot" && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                Stored · {settings.api_key_hint}
              </Badge>
            )}
            {settings.api_key_source === "environment" && (
              <Badge variant="outline" className="text-[10px]">
                Using the platform key from the server environment
              </Badge>
            )}
            {settings.api_key_source === "none" && (
              <Badge variant="outline" className="border-amber-500/50 text-[10px]">
                Not configured
              </Badge>
            )}
          </div>

          <div className="mt-2.5 flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                value={newApiKey}
                onChange={(event) => setNewApiKey(event.target.value)}
                placeholder={
                  settings.has_api_key
                    ? "Enter a new key to replace the stored one"
                    : `Paste your ${provider.name} key`
                }
                className="h-9 pr-9 text-xs"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>

            <Button variant="outline" size="sm" className="h-9" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Test
            </Button>
          </div>

          <p className="mt-2 text-[11px] text-muted-foreground">
            The key is stored encrypted on the server and never sent back to a browser — including
            this one. Leave this field empty to keep the key already stored.
          </p>

          {provider.keyLink && (
            <a
              href={provider.keyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              {provider.keyLinkLabel}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {testResult && (
            <div
              className={`mt-3 flex items-start gap-2 rounded-md p-2.5 text-[11px] ${
                testResult.ok
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {testResult.ok ? (
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Generation                                                        */}
      {/* ---------------------------------------------------------------- */}
      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Response style</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              How the model words what Hive has already established.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Temperature</Label>
              <span className="font-mono text-xs text-muted-foreground">
                {settings.temperature.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.temperature}
              onChange={(event) => patch({ temperature: Number(event.target.value) })}
              className="w-full accent-primary"
            />
            <p className="text-[11px] text-muted-foreground">
              Low keeps the wording close to the verified answer. 0.2 suits an ERP.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Answer length limit</Label>
              <span className="font-mono text-xs text-muted-foreground">
                {settings.max_tokens} tokens
              </span>
            </div>
            <input
              type="range"
              min={256}
              max={4096}
              step={128}
              value={settings.max_tokens}
              onChange={(event) => patch({ max_tokens: Number(event.target.value) })}
              className="w-full accent-primary"
            />
            <p className="text-[11px] text-muted-foreground">
              The answer budget. Reasoning models are given a further allowance on top, because
              their internal thinking is charged against the same limit.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-1.5">
          <Label className="text-xs">House rules</Label>
          <Textarea
            value={settings.system_prompt ?? ""}
            onChange={(event) => patch({ system_prompt: event.target.value })}
            rows={4}
            className="text-xs"
            placeholder="Tone, terminology and anything specific to your organisation."
          />
          <p className="text-[11px] text-muted-foreground">
            Affects wording only. It cannot grant the assistant access to anything the signed-in
            user does not already have.
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Capabilities                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Capabilities</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Each of these changes what the assistant actually does.
            </p>
          </div>
        </div>

        <div className="mt-4 divide-y">
          {FEATURE_LABELS.map((feature) => (
            <div key={feature.key} className="flex items-start justify-between gap-4 py-3">
              <div>
                <p className="text-xs font-medium">{feature.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{feature.description}</p>
              </div>
              <Switch
                checked={settings.features[feature.key]}
                onCheckedChange={(checked) => patchFeature(feature.key, checked)}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between rounded-xl border bg-card p-4">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Bot className="h-3.5 w-3.5" />
          Changes apply to the assistant for everyone in this workspace.
        </p>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          Save settings
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  );
}

function describeError(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: { message?: string } } })
    ?.response;

  if (response?.status === 403) {
    return "You do not have permission to manage the AI assistant.";
  }

  if (response?.status === 429) {
    return "Too many attempts. Wait a moment and try again.";
  }

  return response?.data?.message ?? "The server could not be reached.";
}

export default AiAssistantSettings;
