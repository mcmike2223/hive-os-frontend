"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Check,
  Headphones,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FormattedChatMessage } from "@/components/support-bot/formatted-chat-message";
import { getSupportBotThreadChannelName, initPublicEcho } from "@/lib/echo";
import { useDictation } from "@/hooks/use-dictation";
import { useWidgetDrag } from "@/hooks/use-widget-drag";
import api from "@/modules/shared/api/http";
import {
  cancelCopilotAction,
  confirmCopilotAction,
  fetchCopilotCapabilities,
  sendCopilotMessage,
  type CopilotReply,
  type CopilotState,
} from "@/modules/support-bot/api/copilot-api";

/**
 * The in-app ERP Copilot.
 *
 * Every decision happens on the server: which tool matches, whether this user
 * may run it, what is still missing, and whether a write needs confirming. This
 * component carries the conversation and renders what comes back. It holds no
 * intent parsing, no provider credential and no ERP write of its own — a
 * browser that can write to the ERP outside the Copilot's permission and audit
 * checks is the thing this replaced.
 */

interface PanelMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  reply?: CopilotReply;
  failed?: boolean;
}

interface SupportSessionCredentials {
  session_id: string;
  session_token: string;
}

const SUPPORT_SESSION_STORAGE_KEY = "hive_copilot_support_session";

const GREETING =
  "Ask me anything about Hive — I can explain a module, take you to the right page, look something up, or do it for you when you have the permission.";

export function ErpCopilotPanel() {
  const pathname = usePathname();

  const [isOpen, setIsOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<PanelMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [state, setState] = React.useState<CopilotState | undefined>(undefined);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [busyToken, setBusyToken] = React.useState<string | null>(null);

  // Reaching a person from inside the workspace. The Copilot answers about the
  // platform; some questions are not about the platform, and previously there
  // was nowhere in here to take them.
  const [withAgent, setWithAgent] = React.useState(false);
  const [escalating, setEscalating] = React.useState(false);
  const [streamToken, setStreamToken] = React.useState<string | null>(null);
  const [supportCredentials, setSupportCredentials] =
    React.useState<SupportSessionCredentials | null>(null);

  const endRef = React.useRef<HTMLDivElement>(null);

  const drag = useWidgetDrag({ storageKey: "hive_copilot_panel_position" });

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Suggestions come from the caller's own permitted tools, so the panel never
  // offers an action this user cannot perform.
  React.useEffect(() => {
    if (!isOpen || suggestions.length > 0) return;

    let cancelled = false;

    fetchCopilotCapabilities()
      .then((capabilities) => {
        if (!cancelled) setSuggestions(capabilities.suggestions.slice(0, 4));
      })
      .catch(() => {
        // Suggestions are a convenience; the assistant works without them.
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, suggestions.length]);

  const pageContext = React.useMemo(
    () => (pathname ? { route: pathname } : undefined),
    [pathname],
  );

  const append = (message: PanelMessage) =>
    setMessages((prev) => [...prev, message]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    append({ id: `u_${Date.now()}`, role: "user", content: trimmed });
    setInput("");
    setSending(true);

    try {
      if (withAgent) {
        if (!supportCredentials) {
          throw new Error("The live-support session has expired. Reconnect and try again.");
        }

        await api.post("/public/support-bot/hive-ai-assistant/chat", {
          ...supportCredentials,
          message: trimmed,
        });

        return;
      }

      const reply = await sendCopilotMessage({
        message: trimmed,
        state,
        page_context: pageContext,
      });

      // The server decides whether the conversation is still waiting on
      // something; an absent state ends the slot-filling turn.
      setState(reply.payload.state);

      append({
        id: `a_${Date.now()}`,
        role: "assistant",
        content: reply.content,
        reply,
      });
    } catch (error: unknown) {
      append({
        id: `e_${Date.now()}`,
        role: "assistant",
        content: describeError(error),
        failed: true,
      });
    } finally {
      setSending(false);
    }
  };

  const resolveAction = async (token: string, confirmed: boolean) => {
    setBusyToken(token);

    try {
      const reply = confirmed
        ? await confirmCopilotAction(token)
        : await cancelCopilotAction(token);

      setState(reply.payload.state);
      append({ id: `a_${Date.now()}`, role: "assistant", content: reply.content, reply });
    } catch (error: unknown) {
      append({
        id: `e_${Date.now()}`,
        role: "assistant",
        content: describeError(error),
        failed: true,
      });
    } finally {
      setBusyToken(null);
    }
  };


  const requestHuman = async () => {
    if (escalating) return;

    setEscalating(true);

    try {
      let existing = supportCredentials;

      if (!existing) {
        try {
          const saved = window.localStorage.getItem(SUPPORT_SESSION_STORAGE_KEY);
          const parsed = saved ? JSON.parse(saved) : null;
          if (
            typeof parsed?.session_id === "string" &&
            typeof parsed?.session_token === "string"
          ) {
            existing = parsed;
          }
        } catch {
          // The server will issue a fresh session below.
        }
      }

      const startedResponse = await api.post(
        "/public/support-bot/hive-ai-assistant/session",
        {
          session_id: existing?.session_id,
          session_token: existing?.session_token,
        },
      );
      const started = startedResponse.data?.data ?? {};
      if (
        typeof started.session_id !== "string" ||
        typeof started.session_token !== "string"
      ) {
        throw new Error("The support server did not issue session credentials.");
      }

      const credentials: SupportSessionCredentials = {
        session_id: started.session_id,
        session_token: started.session_token,
      };
      setSupportCredentials(credentials);
      try {
        window.localStorage.setItem(SUPPORT_SESSION_STORAGE_KEY, JSON.stringify(credentials));
      } catch {
        // The live page session remains usable when storage is unavailable.
      }

      const response = await api.post("/public/support-bot/hive-ai-assistant/escalate", {
        ...credentials,
      });

      const data = response.data?.data ?? {};
      setWithAgent(true);
      setStreamToken(data.stream_token ?? null);

      append({
        id: `esc_${Date.now()}`,
        role: "assistant",
        content:
          "I have put you in the queue for a member of the team. Stay on this page — their reply will appear here.",
      });
    } catch (error: unknown) {
      append({
        id: `escfail_${Date.now()}`,
        role: "assistant",
        content: describeError(error),
        failed: true,
      });
    } finally {
      setEscalating(false);
    }
  };

  // An agent's reply, delivered live on the conversation's own channel.
  React.useEffect(() => {
    if (!streamToken) return;

    const echo = initPublicEcho();
    if (!echo) return;

    const channelName = getSupportBotThreadChannelName(streamToken);
    const channel = echo.channel(channelName);

    channel.listen(".support-bot.message", (event: any) => {
      if (event?.sender_type === "visitor") return;

      append({
        id: `agent_${event.id}`,
        role: "assistant",
        content: `**${event.sender_name || "Support"}:** ${event.content}`,
      });
    });

    return () => {
      echo.leaveChannel(channelName);
    };
  }, [streamToken]);

  const voice = useDictation(
    (text) => void send(text),
    (text) => setInput(text),
  );

  /**
   * Suggestions still worth offering: the caller's permitted tools, minus
   * anything they have already asked in this conversation.
   */
  const visibleSuggestions = React.useMemo(() => {
    const asked = new Set(
      messages
        .filter((message) => message.role === "user")
        .map((message) => message.content.trim().toLowerCase()),
    );

    return suggestions.filter((item) => !asked.has(item.trim().toLowerCase()));
  }, [messages, suggestions]);

  const reset = () => {
    setMessages([]);
    setState(undefined);
  };

  if (!isOpen) {
    return (
      <div
        ref={drag.ref}
        {...drag.handleProps}
        // Offset from the corner: the offline-queue inspector is pinned there
        // at a higher z-index and was covering this button entirely.
        className={`${
          drag.position ? "fixed" : "fixed bottom-6 right-24"
        } z-50 print:hidden ${drag.dragging ? "cursor-grabbing" : ""}`}
        style={{ ...drag.style, touchAction: "none" }}
      >
        <button
          type="button"
          onClick={() => {
            // A drag that ends over the button must not also open the panel.
            if (drag.didDrag()) return;
            setIsOpen(true);
          }}
          aria-label="Open the Hive Copilot"
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Sparkles className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
    );
  }

  // The open panel is deliberately not draggable and always sits in the same
  // corner, however far the launcher has been moved: only the collapsed button
  // travels.
  return (
    <aside
      aria-labelledby="erp-copilot-title"
      className="fixed bottom-6 right-6 z-50 flex h-[min(640px,calc(100vh-6rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl print:hidden">
      <header className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <h2 id="erp-copilot-title" className="text-sm font-semibold">Hive Copilot</h2>
            <p className="text-[11px] text-muted-foreground">
              Permission-aware · every action audited
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={reset} title="Start over" aria-label="Start a new Copilot conversation">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            onClick={() => setIsOpen(false)}
            title="Close"
            aria-label="Close Copilot"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {/* min-h-0: without it this flex child grows to fit its content and the
          scroll viewport never becomes shorter than the conversation. */}
      <ScrollArea className="min-h-0 flex-1 px-4 py-3">
        <div className="space-y-3" role="log" aria-live="polite" aria-relevant="additions text">
          {messages.length === 0 && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs leading-relaxed text-muted-foreground">{GREETING}</p>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id}>
              {message.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-xs text-primary-foreground">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div
                    className={`max-w-[92%] rounded-2xl rounded-bl-sm px-3 py-2 ${
                      message.failed
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <FormattedChatMessage content={message.content} />
                  </div>

                  {message.reply && (
                    <ReplyExtras
                      reply={message.reply}
                      busyToken={busyToken}
                      onResolve={resolveAction}
                      onAsk={send}
                    />
                  )}
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking Hive…
            </div>
          )}

          {/* Shown throughout the conversation, not only on the empty state.
              Gated on `messages.length === 0`, these vanished the moment the
              first question was asked — exactly when knowing what else to ask
              is most useful. Anything already asked is dropped. */}
          {visibleSuggestions.length > 0 && !sending && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {visibleSuggestions.slice(0, 6).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="min-h-11 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-foreground/80 transition hover:border-primary/40 hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {withAgent ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-2 text-[11px] text-emerald-700 dark:text-emerald-400">
              <Headphones className="h-3.5 w-3.5 shrink-0" />
              You are in the queue for the support team.
            </div>
          ) : (
            <button
              type="button"
              onClick={requestHuman}
              disabled={escalating}
              className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-2.5 py-2 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {escalating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Headphones className="h-3.5 w-3.5" />
              )}
              Talk to a person
            </button>
          )}

          <div ref={endRef} />
        </div>
      </ScrollArea>

      {/* Dictation state sits next to the control it explains. A blocked
          microphone is the most common reason the mic button looks dead, and
          it used to report nothing at all. */}
      {(voice.notice || voice.listening) && (
        <div
          className={`flex items-center justify-between gap-2 border-t px-3 py-2 text-[11px] ${
            voice.notice
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "bg-destructive/5 text-destructive"
          }`}
        >
          <span className="flex items-center gap-1.5">
            {voice.listening && !voice.notice && (
              <span className="flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-destructive" />
            )}
            {voice.notice ??
              `Listening in ${voice.lang === "am-ET" ? "Amharic" : "English"} — speak now.`}
          </span>

          {voice.notice && (
            <button
              type="button"
              onClick={voice.dismissNotice}
              className="shrink-0 font-medium underline underline-offset-2"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      <form
        className="flex items-center gap-1.5 border-t bg-background/80 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <label htmlFor="erp-copilot-message" className="shrink-0 text-[10px] font-medium text-muted-foreground">
          Message
        </label>
        <Input
          id="erp-copilot-message"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={
            state?.awaiting_input?.length
              ? `Enter ${state.awaiting_input[0].replace(/_/g, " ")}…`
              : "Ask about anything in Hive…"
          }
          className="h-11 min-w-0 flex-1 text-xs"
          disabled={sending}
        />
        <button
          type="button"
          onClick={() => voice.setLang(voice.lang === "en-US" ? "am-ET" : "en-US")}
          title={`Dictation language: ${voice.lang === "am-ET" ? "Amharic" : "English"} — tap to switch`}
          aria-label={`Dictation language: ${voice.lang === "am-ET" ? "Amharic" : "English"}. Activate to switch.`}
          className="h-11 min-w-11 shrink-0 rounded-full px-2 text-[10px] font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {voice.lang === "am-ET" ? "አማ" : "EN"}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`relative h-11 w-11 shrink-0 ${
            voice.listening ? "bg-destructive/10 text-destructive" : ""
          }`}
          onClick={voice.toggle}
          title={voice.listening ? "Stop dictation" : "Dictate"}
          aria-pressed={voice.listening}
          aria-label={voice.listening ? "Stop dictation" : "Start dictation"}
        >
          {voice.listening && (
            <span className="absolute inset-0 animate-ping rounded-full bg-destructive/20" />
          )}
          {voice.listening ? (
            <MicOff className="relative h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
        <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={sending || !input.trim()} aria-label="Send message">
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
    </aside>
  );
}

/**
 * Everything the server attached to an answer: a confirmation to approve, pages
 * to open, records it found, and what to ask next.
 */
function ReplyExtras({
  reply,
  busyToken,
  onResolve,
  onAsk,
}: {
  reply: CopilotReply;
  busyToken: string | null;
  onResolve: (token: string, confirmed: boolean) => void;
  onAsk: (text: string) => void;
}) {
  const { payload } = reply;
  const confirmation = payload.confirmation;

  return (
    <div className="space-y-2">
      {confirmation && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            {confirmation.risk === "critical" ? (
              <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            )}
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Confirm before this runs
            </p>
          </div>

          <p className="text-xs text-foreground">{confirmation.summary}</p>

          {Object.keys(confirmation.parameters ?? {}).length > 0 && (
            <dl className="mt-2 space-y-0.5 rounded-md bg-background/60 p-2">
              {Object.entries(confirmation.parameters).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-3 text-[11px]">
                  <dt className="text-muted-foreground">{key.replace(/_/g, " ")}</dt>
                  <dd className="truncate font-medium">{String(value)}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-2.5 flex gap-2">
            <Button
              size="sm"
              className="h-7 text-[11px]"
              disabled={busyToken === confirmation.token}
              onClick={() => onResolve(confirmation.token, true)}
            >
              {busyToken === confirmation.token ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Check className="mr-1 h-3 w-3" />
              )}
              Yes, do it
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              disabled={busyToken === confirmation.token}
              onClick={() => onResolve(confirmation.token, false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {payload.navigation && payload.navigation.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {payload.navigation.map((link) => (
            <Link
              key={`${link.href}-${link.label}`}
              href={link.href}
              className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-[11px] font-medium transition hover:bg-accent"
            >
              {link.label}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          ))}
        </div>
      )}

      {payload.records && payload.records.length > 0 && (
        <div className="rounded-lg border">
          {payload.records.slice(0, 6).map((record, index) => (
            <div
              key={index}
              className="border-b px-2.5 py-1.5 text-[11px] last:border-b-0"
            >
              {summariseRecord(record)}
            </div>
          ))}
          {typeof payload.total === "number" && payload.total > payload.records.length && (
            <p className="px-2.5 py-1.5 text-[11px] text-muted-foreground">
              {payload.total - payload.records.length} more not shown.
            </p>
          )}
        </div>
      )}

      {payload.required_permissions && payload.required_permissions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[11px] text-muted-foreground">Needs:</span>
          {payload.required_permissions.slice(0, 4).map((permission) => (
            <Badge key={permission} variant="outline" className="text-[10px]">
              {permission.replace(/_/g, " ")}
            </Badge>
          ))}
        </div>
      )}

      {payload.follow_ups && payload.follow_ups.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {payload.follow_ups.slice(0, 3).map((followUp) => (
            <button
              key={followUp}
              type="button"
              onClick={() => onAsk(followUp)}
              className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              {followUp}
            </button>
          ))}
        </div>
      )}

      {payload.sources && payload.sources.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          From: {payload.sources.map((source) => source.title).join(" · ")}
        </p>
      )}
    </div>
  );
}

function summariseRecord(record: Record<string, unknown>): string {
  const label =
    record.name ??
    record.title ??
    record.primary_name ??
    record.reference ??
    record.number ??
    record.id;

  const detail = Object.entries(record)
    .filter(([key]) => !["id", "name", "title", "primary_name"].includes(key))
    .slice(0, 2)
    .map(([key, value]) => `${key.replace(/_/g, " ")}: ${String(value)}`)
    .join(" · ");

  return detail ? `${String(label)} — ${detail}` : String(label);
}

/**
 * Reports what actually went wrong. A failed turn that reads as a normal answer
 * is worse than no answer at all.
 */
function describeError(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: { message?: string } } })
    ?.response;

  if (response?.status === 401) {
    return "Your session has expired. Sign in again and I will pick this up.";
  }

  if (response?.status === 403) {
    return "That is not open to your account.";
  }

  if (response?.status === 429) {
    return "That is a lot of questions at once — give me a moment and try again.";
  }

  if (response?.data?.message) {
    return response.data.message;
  }

  return "I could not reach Hive just now, so I have not answered. Try again in a moment.";
}

export default ErpCopilotPanel;
